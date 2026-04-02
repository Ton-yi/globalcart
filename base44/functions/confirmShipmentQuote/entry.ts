/**
 * confirmShipmentQuote
 *
 * User explicitly confirms the shipment quotation.
 * Sets user_confirmed = true on their ShippingUserCharge and advances
 * ShipmentRequest status to waiting_payment.
 *
 * For pooled shipments: ALL participants must confirm before status advances.
 * For single shipments: only the creator needs to confirm.
 *
 * Payload: { shipment_request_id: string }
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body = {};
    try { body = await req.json(); } catch (_) {}
    const { shipment_request_id } = body;
    if (!shipment_request_id) {
      return Response.json({ error: 'shipment_request_id is required' }, { status: 400 });
    }

    // ── Load ShipmentRequest ───────────────────────────────────────────────
    const srs = await base44.asServiceRole.entities.ShipmentRequest.filter(
      { id: shipment_request_id }
    );
    const sr = srs[0];
    if (!sr) return Response.json({ error: 'ShipmentRequest not found' }, { status: 404 });

    if (sr.tenant_id !== user.tenant_id && user.role !== 'platform_admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (sr.shipping_request_status !== 'quote_ready') {
      return Response.json({
        error: `Cannot confirm quote when status is '${sr.shipping_request_status}'`
      }, { status: 400 });
    }

    // ── Verify the user has a charge record ───────────────────────────────
    const myCharges = await base44.asServiceRole.entities.ShippingUserCharge.filter({
      shipping_request_id: shipment_request_id,
      user_id: user.email,
    });
    if (!myCharges || myCharges.length === 0) {
      return Response.json({ error: 'No charge record found for this user' }, { status: 403 });
    }

    // ── Mark this user's charge as confirmed ──────────────────────────────
    await base44.asServiceRole.entities.ShippingUserCharge.update(myCharges[0].id, {
      user_confirmed: true,
    });

    // ── Check if status should advance ────────────────────────────────────
    const isPooled = sr.request_type === 'pooled_shipment';
    let advanceToPayment = false;

    if (!isPooled) {
      advanceToPayment = true;
    } else {
      const allCharges = await base44.asServiceRole.entities.ShippingUserCharge.filter(
        { shipping_request_id: shipment_request_id }
      );
      // Count current user as confirmed (we just updated above)
      const allConfirmed = allCharges.length > 0 && allCharges.every(c =>
        c.id === myCharges[0].id ? true : c.user_confirmed === true
      );
      advanceToPayment = allConfirmed;
    }

    if (advanceToPayment) {
      await base44.asServiceRole.entities.ShipmentRequest.update(shipment_request_id, {
        shipping_request_status: 'waiting_payment',
        user_confirmed_quote: true,
      });
      const quotes = await base44.asServiceRole.entities.ShippingQuote.filter(
        { shipping_request_id: shipment_request_id }
      );
      if (quotes[0]) {
        await base44.asServiceRole.entities.ShippingQuote.update(quotes[0].id, {
          quote_step_status: 'waiting_user_payment',
        });
      }
    }

    return Response.json({
      success: true,
      confirmed: true,
      status_advanced: advanceToPayment,
      new_status: advanceToPayment ? 'waiting_payment' : 'quote_ready',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});