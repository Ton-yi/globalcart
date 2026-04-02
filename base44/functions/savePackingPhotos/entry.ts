/**
 * savePackingPhotos
 *
 * Admin saves packing photos and/or shipping label images for a ShipmentRequest
 * without changing its status.
 *
 * Payload:
 * {
 *   shipment_request_id: string,
 *   packing_photos?: string[],
 *   shipping_label_images?: string[],
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
    const { shipment_request_id, packing_photos, shipping_label_images } = body;

    if (!shipment_request_id) {
      return Response.json({ error: 'shipment_request_id is required' }, { status: 400 });
    }

    const srs = await base44.asServiceRole.entities.ShipmentRequest.filter({ id: shipment_request_id });
    const sr = srs[0];
    if (!sr) return Response.json({ error: 'ShipmentRequest not found' }, { status: 404 });

    if (sr.tenant_id !== user.tenant_id && user.role !== 'platform_admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (sr.shipping_request_status === 'shipped' || sr.shipping_request_status === 'delivered') {
      return Response.json({ error: 'Cannot modify photos after shipment is completed' }, { status: 400 });
    }

    const update = {};
    if (packing_photos !== undefined) update.packing_photos = packing_photos;
    if (shipping_label_images !== undefined) update.shipping_label_images = shipping_label_images;

    if (Object.keys(update).length === 0) {
      return Response.json({ success: true, message: 'No changes' });
    }

    await base44.asServiceRole.entities.ShipmentRequest.update(shipment_request_id, update);

    return Response.json({ success: true, shipment_request_id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});