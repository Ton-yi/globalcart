import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Triggered by entity automation when an Order is updated to order_status=in_warehouse
 * and has a pre_shipment object set.
 * Automatically creates a ShippingPool from the pre-filled shipment info.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const { event, data: order } = body;

    if (!order || !order.id) {
      return Response.json({ error: 'No order data in payload' }, { status: 400 });
    }

    // Only proceed if pre_shipment is set and pool hasn't been created yet
    const pre = order.pre_shipment;
    if (!pre || pre.pool_created) {
      return Response.json({ skipped: true, reason: 'no pre_shipment or already created' });
    }

    const tenantId = order.tenant_id;
    if (!tenantId) {
      return Response.json({ error: 'Order has no tenant_id' }, { status: 400 });
    }

    // Generate pool code
    const consType = pre.consType || '';
    const transitLoc = pre.transit_location_id
      ? (await base44.asServiceRole.entities.TransitLocation.filter({ id: pre.transit_location_id }))?.[0]
      : null;
    const prefix = consType === 'transit' && transitLoc?.code_prefix
      ? transitLoc.code_prefix.toUpperCase()
      : 'AAA';

    const allPools = await base44.asServiceRole.entities.ShippingPool.filter({ tenant_id: tenantId });
    const prefixPools = (allPools || []).filter(p => p.pool_code && p.pool_code.startsWith(prefix));
    const maxSeq = prefixPools.reduce((max, p) => {
      const seq = parseInt(p.pool_code.slice(prefix.length), 10);
      return isNaN(seq) ? max : Math.max(max, seq);
    }, 0);
    const pool_code = `${prefix}${String(maxSeq + 1).padStart(5, '0')}`;

    const addr = pre.address || {};
    const isAsap = pre.scheduled_ship_date === '__asap__';

    // Determine destination country from address
    const destinationCountry = addr.country || '';

    const pool = await base44.asServiceRole.entities.ShippingPool.create({
      tenant_id: tenantId,
      pool_code,
      shipping_method: pre.shipping_method || '',
      scheduled_ship_date: isAsap ? '' : (pre.scheduled_ship_date || ''),
      asap: isAsap,
      transit_location_id: pre.transit_location_id || '',
      transit_location_name: transitLoc?.name || '',
      user_note: pre.user_note || '',
      consolidation_type: consType,
      order_ids: [order.id],
      order_names: [order.product_name].filter(Boolean),
      creator_email: order.user_email,
      creator_name: order.user_name || order.user_email,
      is_admin_created: false,
      total_weight_g: order.weight_g || 0,
      status: 'pending',
      destination_country: destinationCountry,
      recipient_name: addr.recipient_name || '',
      address_line1: addr.addr1 || '',
      address_line2: addr.addr2 || '',
      city: addr.addr3 || '',
      state: addr.state || '',
      messages: [],
      selected_addon_ids: pre.selected_addon_ids || [],
      selected_addons: pre.selected_addons || [],
    });

    // Update order: status → notified_shipment, mark pool as created, link pool id
    await base44.asServiceRole.entities.Order.update(order.id, {
      order_status: 'notified_shipment',
      consolidation_pool_id: pool.id,
      pre_shipment: {
        ...pre,
        pool_created: true,
        pool_id: pool.id,
      },
    });

    console.log(`[autoCreatePreShipmentPool] Created pool ${pool_code} for order ${order.id}`);
    return Response.json({ success: true, pool_code, pool_id: pool.id });
  } catch (error) {
    console.error('autoCreatePreShipmentPool error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});