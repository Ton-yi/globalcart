/**
 * completeShipment
 *
 * Admin completes the physical shipment.
 * Transitions status: paid|packing → shipped
 * Records tracking_number, actual_shipped_date, shipped_at timestamp,
 * final_total_weight_g, packing_photos, and shipping_label_images.
 *
 * Payload:
 * {
 *   shipment_request_id: string,
 *   tracking_number: string,           // required, must not be empty
 *   actual_shipped_date: string,       // YYYY-MM-DD
 *   final_total_weight_g?: number,     // >= 0
 *   packing_photos?: string[],         // image URLs
 *   shipping_label_images?: string[],  // image URLs
 * }
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    let body = {};
    try { body = await req.json(); } catch (_) {}

    const {
      shipment_request_id,
      tracking_number,
      actual_shipped_date,
      final_total_weight_g,
      packing_photos,
      shipping_label_images,
    } = body;

    if (!shipment_request_id) {
      return Response.json({ error: 'shipment_request_id is required' }, { status: 400 });
    }
    if (!tracking_number || !tracking_number.trim()) {
      return Response.json({ error: 'tracking_number must not be empty' }, { status: 400 });
    }
    if (!actual_shipped_date) {
      return Response.json({ error: 'actual_shipped_date is required' }, { status: 400 });
    }
    if (final_total_weight_g != null && final_total_weight_g < 0) {
      return Response.json({ error: 'final_total_weight_g must be >= 0' }, { status: 400 });
    }

    // ── Load ShipmentRequest ─────────────────────────────────────────────────
    const srs = await base44.asServiceRole.entities.ShipmentRequest.filter({ id: shipment_request_id });
    const sr = srs[0];
    if (!sr) return Response.json({ error: 'ShipmentRequest not found' }, { status: 404 });

    if (sr.tenant_id !== user.tenant_id && user.role !== 'platform_admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const shippableStatuses = ['paid', 'packing'];
    if (!shippableStatuses.includes(sr.shipping_request_status)) {
      return Response.json({
        error: `Cannot complete shipment when status is '${sr.shipping_request_status}'`
      }, { status: 400 });
    }

    const shippedAt = new Date().toISOString();

    // ── Update ShipmentRequest ───────────────────────────────────────────────
    const srUpdate = {
      shipping_request_status: 'shipped',
      tracking_number: tracking_number.trim(),
      actual_shipped_date,
      shipped_at: shippedAt,
    };
    if (final_total_weight_g != null) srUpdate.final_total_weight_g = final_total_weight_g;
    if (packing_photos !== undefined) srUpdate.packing_photos = packing_photos;
    if (shipping_label_images !== undefined) srUpdate.shipping_label_images = shipping_label_images;
    // Record packing_started_at if not already set (e.g. admin skipped startPacking)
    if (!sr.packing_started_at) srUpdate.packing_started_at = shippedAt;

    await base44.asServiceRole.entities.ShipmentRequest.update(shipment_request_id, srUpdate);

    // ── Update active ShippingQuote with images and status ───────────────────
    const quotes = await base44.asServiceRole.entities.ShippingQuote.filter(
      { shipping_request_id: shipment_request_id }
    );
    // Active quote = not superseded
    const supersededIds = new Set(quotes.map(q => q.superseded_by).filter(Boolean));
    const activeQuote = quotes.find(q => !supersededIds.has(q.id) && !q.superseded_by) || quotes[quotes.length - 1] || null;

    if (activeQuote) {
      const quoteUpdate = {
        tracking_number: tracking_number.trim(),
        quote_step_status: 'shipped',
      };
      if (shipping_label_images !== undefined) quoteUpdate.shipping_label_image_urls = shipping_label_images;
      if (packing_photos !== undefined) quoteUpdate.packaging_image_urls = packing_photos;
      await base44.asServiceRole.entities.ShippingQuote.update(activeQuote.id, quoteUpdate);
    }

    return Response.json({
      success: true,
      shipment_request_id,
      tracking_number: tracking_number.trim(),
      actual_shipped_date,
      shipped_at: shippedAt,
      new_status: 'shipped',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});