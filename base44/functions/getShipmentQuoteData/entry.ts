/**
 * getShipmentQuoteData
 *
 * Returns full quote data for a ShipmentRequest.
 * Used by both admin (full detail) and user (own charges only).
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

    const isAdmin = user.role === 'admin' || user.role === 'platform_admin';

    // ── Load ShipmentRequest ───────────────────────────────────────────────
    const srs = await base44.asServiceRole.entities.ShipmentRequest.filter(
      { id: shipment_request_id }
    );
    const sr = srs[0];
    if (!sr) return Response.json({ error: 'ShipmentRequest not found' }, { status: 404 });

    if (sr.tenant_id !== user.tenant_id && user.role !== 'platform_admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Non-admin: must be creator or a participant in the items
    if (!isAdmin && sr.creator_user_id !== user.email) {
      const userItems = await base44.asServiceRole.entities.ShippingRequestItem.filter(
        { shipping_request_id: shipment_request_id, user_id: user.email }
      );
      if (!userItems || userItems.length === 0) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // ── Load ShippingQuote ─────────────────────────────────────────────────
    const quotes = await base44.asServiceRole.entities.ShippingQuote.filter(
      { shipping_request_id: shipment_request_id }
    );
    const quote = quotes[0] || null;

    // ── Load ShippingUserCharge records ────────────────────────────────────
    const allCharges = await base44.asServiceRole.entities.ShippingUserCharge.filter(
      { shipping_request_id: shipment_request_id }
    );
    const charges = isAdmin ? allCharges : allCharges.filter(c => c.user_id === user.email);

    // ── Load ShippingRequestItems ──────────────────────────────────────────
    const allItems = await base44.asServiceRole.entities.ShippingRequestItem.filter(
      { shipping_request_id: shipment_request_id }
    );
    const items = isAdmin ? allItems : allItems.filter(i => i.user_id === user.email);

    // ── Load BoxTemplate if referenced ────────────────────────────────────
    let boxTemplate = null;
    if (quote?.box_template_id) {
      const bts = await base44.asServiceRole.entities.BoxTemplate.filter(
        { id: quote.box_template_id }
      );
      boxTemplate = bts[0] || null;
    }

    return Response.json({
      shipment_request: sr,
      quote,
      box_template: boxTemplate,
      charges,
      items,
      is_admin: isAdmin,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});