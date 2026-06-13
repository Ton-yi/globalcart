import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Pre-shipment Automation Bridge
 *
 * Triggered when an order enters in_warehouse status (entity automation),
 * or called directly with { order_id, force: true } from UserNotifyShipmentModal
 * for orders that already have pre_shipment config.
 *
 * Reads order.pre_shipment, translates it into the standard shipment_payload,
 * and delegates to the unified createShippingPool engine.
 *
 * NOTE: fullpay_once_config inside pre_shipment is passed through as-is
 * and is NOT processed here — it is handled separately by handleFullpayOnceSettlement.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    // Support both direct call ({ order_id }) and entity automation ({ event, data })
    const order_id = body.order_id || body.event?.entity_id;
    if (!order_id) {
      return Response.json({ skipped: true, reason: 'no_order_id' });
    }

    // Fetch order — prefer body.data from automation, otherwise fetch
    let order = body.data;
    if (!order && order_id) {
      const results = await base44.asServiceRole.entities.Order.filter({ id: order_id }).catch(() => []);
      order = results?.[0];
    }

    if (!order?.id || !order.pre_shipment) {
      return Response.json({ skipped: true, reason: 'no_order_or_no_pre_shipment' });
    }

    // Authorization: direct (user-token) calls must come from the order owner
    // or staff/admin of the same tenant. Automation/service-role calls carry
    // no user token and are allowed through.
    const caller = await base44.auth.me().catch(() => null);
    if (caller) {
      const isStaffRole = ['admin', 'tenant_admin', 'staff', 'platform_admin'].includes(caller.role);
      const isOwner = order.user_email === caller.email;
      let sameTenant = caller.role === 'platform_admin';
      if (!sameTenant) {
        const callerRecords = await base44.asServiceRole.entities.User.filter({ email: caller.email }).catch(() => []);
        sameTenant = !!callerRecords?.[0]?.tenant_id && callerRecords[0].tenant_id === order.tenant_id;
      }
      if (!sameTenant || (!isOwner && !isStaffRole)) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Prevent duplicate processing
    if (order.pre_shipment.pool_created) {
      console.log('[autoCreatePreShipmentPool] Pool already created for order:', order.id);
      return Response.json({ skipped: true, reason: 'pool_already_created', pool_id: order.pre_shipment.pool_id });
    }
    if (order.consolidation_pool_id) {
      console.log('[autoCreatePreShipmentPool] Order already assigned to pool:', order.id);
      return Response.json({ skipped: true, reason: 'order_already_has_pool', pool_id: order.consolidation_pool_id });
    }

    // Only process in_warehouse or notified_shipment orders (or when forced)
    const shouldProcess = order.order_status === 'in_warehouse' || order.order_status === 'notified_shipment';
    if (!shouldProcess && !body.force) {
      console.log('[autoCreatePreShipmentPool] Skipped: order status is', order.order_status);
      return Response.json({ skipped: true, reason: 'order_status_not_eligible', status: order.order_status });
    }

    // Check tenant pre_shipment_enabled setting — skip if explicitly disabled
    const tenantSettings = await base44.asServiceRole.entities.SiteSettings.filter({
      tenant_id: order.tenant_id,
      key: 'pre_shipment_enabled',
    }).catch(() => []);
    const preShipmentEnabled = tenantSettings?.[0]?.value;
    if (preShipmentEnabled === 'false') {
      console.log('[autoCreatePreShipmentPool] Skipped: pre_shipment_enabled is false for tenant', order.tenant_id);
      return Response.json({ skipped: true, reason: 'pre_shipment_disabled' });
    }

    const pre = order.pre_shipment;

    // Translate pre_shipment → standard shipment_payload for the engine
    // fullpay_once_config is passed through but not processed by the engine
    const payload = {
      consType:                       pre.consType || '',
      shipping_method:                pre.shipping_method || '',
      scheduled_ship_date:            pre.scheduled_ship_date || '',
      user_note:                      pre.user_note || '',
      pool_title:                     pre.pool_title || '',
      address:                        pre.address || null,
      transit_location_id:            pre.transit_location_id || '',
      transit_location_name:          pre.transit_location_name || '',
      transit_location_country:       pre.transit_location_country || '',
      transit_shipping_method_id:     pre.transit_shipping_method_id || '',
      transit_shipping_method_name:   pre.transit_shipping_method_name || '',
      selected_addon_ids:             pre.selected_addon_ids || [],
      selected_addons:                pre.selected_addons || [],
      target_pool_id:                 pre.target_pool_id || '',
      join_existing_pool:             pre.join_existing_pool || false,
      is_private:                     pre.is_private || false,
      shared_with_emails:             pre.shared_with_emails || [],
      customs_declaration:            null, // customs set directly on order, not via pre_shipment
      fullpay_once_config:            pre.fullpay_once_config || null,
    };

    // Call the unified engine via service role (this is a server-to-server call).
    // Pass service_user_email so createShippingPool can identify the creator without
    // a user token (asServiceRole.functions.invoke does not forward user auth).
    const engineRes = await base44.asServiceRole.functions.invoke('createShippingPool', {
      order_ids: [order.id],
      payload,
      service_user_email: order.user_email,
      service_user_name: order.user_name || order.user_email,
    });
    // asServiceRole.functions.invoke returns an Axios response { data: {...} }
    const result = engineRes?.data || engineRes;

    // Mark pre_shipment as processed so we don't re-trigger
    if (result?.success || result?.skipped) {
      const poolId = result.pool_id || order.consolidation_pool_id || '';
      await base44.asServiceRole.entities.Order.update(order.id, {
        pre_shipment: {
          ...pre,
          pool_created: true,
          ...(poolId ? { pool_id: poolId } : {}),
        },
      });
    }

    console.log('[autoCreatePreShipmentPool] Engine result:', result);
    return Response.json(result || { success: true, pool_id: null });

  } catch (error) {
    console.error('autoCreatePreShipmentPool error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});