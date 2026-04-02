/**
 * startPacking
 *
 * Admin starts the packing process for a paid ShipmentRequest.
 * Transitions status: paid → packing
 * Records packing_started_at timestamp.
 *
 * Payload: { shipment_request_id: string }
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
    const { shipment_request_id } = body;

    if (!shipment_request_id) {
      return Response.json({ error: 'shipment_request_id is required' }, { status: 400 });
    }

    const srs = await base44.asServiceRole.entities.ShipmentRequest.filter({ id: shipment_request_id });
    const sr = srs[0];
    if (!sr) return Response.json({ error: 'ShipmentRequest not found' }, { status: 404 });

    if (sr.tenant_id !== user.tenant_id && user.role !== 'platform_admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (sr.shipping_request_status !== 'paid') {
      return Response.json({
        error: `Cannot start packing when status is '${sr.shipping_request_status}'. Status must be 'paid'.`
      }, { status: 400 });
    }

    await base44.asServiceRole.entities.ShipmentRequest.update(shipment_request_id, {
      shipping_request_status: 'packing',
      packing_started_at: new Date().toISOString(),
    });

    return Response.json({ success: true, shipment_request_id, new_status: 'packing' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});