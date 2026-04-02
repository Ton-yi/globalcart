/**
 * completeShipment
 *
 * Admin completes the physical shipment.
 * Records tracking number, actual shipped date, and optional images.
 * Advances ShipmentRequest status to 'shipped'.
 *
 * Payload:
 * {
 *   shipment_request_id: string,
 *   tracking_number: string,
 *   actual_shipped_date: string,      // YYYY-MM-DD
 *   shipping_label_image_urls?: string[],
 *   packaging_image_urls?: string[],
 * }
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }

  const {
    shipment_request_id,
    tracking_number,
    actual_shipped_date,
    shipping_label_image_urls,
    packaging_image_urls,
  } = await req.json();

  if (!shipment_request_id || !tracking_number || !actual_shipped_date) {
    return Response.json({
      error: 'shipment_request_id, tracking_number, and actual_shipped_date are required'
    }, { status: 400 });
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

  const shippableStatuses = ['paid', 'packing'];
  if (!shippableStatuses.includes(sr.shipping_request_status)) {
    return Response.json({
      error: `Cannot complete shipment when status is '${sr.shipping_request_status}'`
    }, { status: 400 });
  }

  // ── Update ShipmentRequest ───────────────────────────────────────────────
  await base44.asServiceRole.entities.ShipmentRequest.update(shipment_request_id, {
    shipping_request_status: 'shipped',
    tracking_number,
    actual_shipped_date,
  });

  // ── Update ShippingQuote with images and status ──────────────────────────
  const quotes = await base44.asServiceRole.entities.ShippingQuote.filter(
    { shipping_request_id: shipment_request_id }
  );
  if (quotes[0]) {
    const quoteUpdate = {
      tracking_number,
      quote_step_status: 'shipped',
    };
    if (shipping_label_image_urls !== undefined) {
      quoteUpdate.shipping_label_image_urls = shipping_label_image_urls;
    }
    if (packaging_image_urls !== undefined) {
      quoteUpdate.packaging_image_urls = packaging_image_urls;
    }
    await base44.asServiceRole.entities.ShippingQuote.update(quotes[0].id, quoteUpdate);
  }

  return Response.json({
    success: true,
    shipment_request_id,
    tracking_number,
    actual_shipped_date,
    new_status: 'shipped',
  });
});