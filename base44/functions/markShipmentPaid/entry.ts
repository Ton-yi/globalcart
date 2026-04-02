/**
 * markShipmentPaid
 *
 * Admin marks a user's charge as paid, or marks entire shipment as paid.
 * When all user charges are paid, ShipmentRequest advances to 'paid'.
 *
 * Payload:
 * {
 *   shipment_request_id: string,
 *   user_id: string,           // which user's charge to mark paid
 *   payment_proof_url?: string,
 * }
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }

  const { shipment_request_id, user_id, payment_proof_url } = await req.json();
  if (!shipment_request_id || !user_id) {
    return Response.json({ error: 'shipment_request_id and user_id are required' }, { status: 400 });
  }

  // ── Load ShipmentRequest ─────────────────────────────────────────────────
  const srs = await base44.asServiceRole.entities.ShipmentRequest.filter(
    { id: shipment_request_id }
  );
  const sr = srs[0];
  if (!sr) return Response.json({ error: 'ShipmentRequest not found' }, { status: 404 });

  if (sr.tenant_id !== user.tenant_id && user.role !== 'platform_admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!['waiting_payment', 'paid'].includes(sr.shipping_request_status)) {
    return Response.json({
      error: `Cannot mark payment when status is '${sr.shipping_request_status}'`
    }, { status: 400 });
  }

  // ── Find and update the charge record ───────────────────────────────────
  const charges = await base44.asServiceRole.entities.ShippingUserCharge.filter({
    shipping_request_id: shipment_request_id,
    user_id,
  });
  if (!charges || charges.length === 0) {
    return Response.json({ error: 'Charge record not found for this user' }, { status: 404 });
  }

  const updateData = { is_paid: true };
  if (payment_proof_url) updateData.payment_proof_url = payment_proof_url;

  await base44.asServiceRole.entities.ShippingUserCharge.update(charges[0].id, updateData);

  // ── Check if all charges are now paid ───────────────────────────────────
  const allCharges = await base44.asServiceRole.entities.ShippingUserCharge.filter(
    { shipping_request_id: shipment_request_id }
  );
  const allPaid = allCharges.length > 0 && allCharges.every(c =>
    c.id === charges[0].id ? true : c.is_paid === true
  );

  if (allPaid) {
    await base44.asServiceRole.entities.ShipmentRequest.update(shipment_request_id, {
      shipping_request_status: 'paid',
    });
    const quotes = await base44.asServiceRole.entities.ShippingQuote.filter(
      { shipping_request_id: shipment_request_id }
    );
    if (quotes[0]) {
      await base44.asServiceRole.entities.ShippingQuote.update(quotes[0].id, {
        quote_step_status: 'paid',
      });
    }
  }

  return Response.json({
    success: true,
    all_paid: allPaid,
    new_status: allPaid ? 'paid' : sr.shipping_request_status,
  });
});