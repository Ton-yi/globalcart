import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Handles user-initiated mutations to shipping pools:
 *   - move_order: move user's own order to another pool
 *   - cancel_order: return user's own order back to in_warehouse
 *   - add_order: add user's in_warehouse order to an existing pool
 *
 * If SiteSettings key "allow_user_pool_edit_instant" = "true",
 * changes are applied immediately. Otherwise a ShippingEditRequest
 * is created and the admin must approve it.
 *
 * A pool that has been notified of shipping fees (status != "pending") cannot be edited.
 */
Deno.serve(async (req) => {
  const t0 = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    const [user, body] = await Promise.all([base44.auth.me(), req.json()]);

    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, pool_id, order_id, target_pool_id, user_note } = body;
    if (!action || !pool_id || !order_id) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const userRecords = await base44.asServiceRole.entities.User.filter({ email: user.email });
    if (!userRecords || userRecords.length === 0) {
      return Response.json({ error: 'User record not found' }, { status: 404 });
    }
    const tenantId = userRecords[0].tenant_id;
    if (!tenantId) return Response.json({ error: 'No tenant assigned' }, { status: 403 });

    // Load pool and verify it belongs to tenant and is still editable
    const pools = await base44.asServiceRole.entities.ShippingPool.filter({ id: pool_id });
    const pool = pools?.[0];
    if (!pool || pool.tenant_id !== tenantId) {
      return Response.json({ error: 'Pool not found' }, { status: 404 });
    }

    // Pool is locked once admin has notified shipping fee
    const lockedStatuses = ['awaiting_payment', 'awaiting_payment_confirmation', 'ready_to_ship', 'shipped', 'delivered', 'cancelled'];
    if (lockedStatuses.includes(pool.status)) {
      return Response.json({ error: 'Pool is locked: shipping fee already notified' }, { status: 403 });
    }

    // Verify the order belongs to the user and is in this pool
    const orders = await base44.asServiceRole.entities.Order.filter({ id: order_id });
    const order = orders?.[0];
    if (!order || order.tenant_id !== tenantId) {
      return Response.json({ error: 'Order not found' }, { status: 404 });
    }
    if (order.user_email !== user.email) {
      return Response.json({ error: 'Forbidden: not your order' }, { status: 403 });
    }

    // For move/cancel: order must be in this pool
    if (action === 'move_order' || action === 'cancel_order') {
      if (!(pool.order_ids || []).includes(order_id)) {
        return Response.json({ error: 'Order is not in this pool' }, { status: 400 });
      }
    }

    // For add_order: order must be in_warehouse and NOT already in a pool
    if (action === 'add_order') {
      if (order.order_status !== 'in_warehouse') {
        return Response.json({ error: 'Order must be in_warehouse to add to pool' }, { status: 400 });
      }
    }

    // For move_order: validate target pool
    let targetPool = null;
    if (action === 'move_order') {
      if (!target_pool_id) return Response.json({ error: 'Missing target_pool_id' }, { status: 400 });
      const targetPools = await base44.asServiceRole.entities.ShippingPool.filter({ id: target_pool_id });
      targetPool = targetPools?.[0];
      if (!targetPool || targetPool.tenant_id !== tenantId) {
        return Response.json({ error: 'Target pool not found' }, { status: 404 });
      }
      if (lockedStatuses.includes(targetPool.status)) {
        return Response.json({ error: 'Target pool is locked' }, { status: 403 });
      }
    }

    // Check the setting: instant approval or request?
    const settings = await base44.asServiceRole.entities.SiteSettings.filter({
      tenant_id: tenantId,
      key: 'allow_user_pool_edit_instant'
    });
    const isInstant = settings?.[0]?.value === 'true';

    if (isInstant) {
      // Apply immediately
      if (action === 'cancel_order') {
        const updatedIds = (pool.order_ids || []).filter(id => id !== order_id);
        const updatedWeight = Math.max(0, (pool.total_weight_g || 0) - (order.weight_g || 0));
        await Promise.all([
          base44.asServiceRole.entities.ShippingPool.update(pool_id, {
            order_ids: updatedIds,
            total_weight_g: updatedWeight,
          }),
          base44.asServiceRole.entities.Order.update(order_id, {
            order_status: 'in_warehouse',
            consolidation_pool_id: '',
          }),
        ]);
      } else if (action === 'move_order') {
        const updatedIds = (pool.order_ids || []).filter(id => id !== order_id);
        const updatedWeight = Math.max(0, (pool.total_weight_g || 0) - (order.weight_g || 0));
        await Promise.all([
          base44.asServiceRole.entities.ShippingPool.update(pool_id, {
            order_ids: updatedIds,
            total_weight_g: updatedWeight,
          }),
          base44.asServiceRole.entities.ShippingPool.update(target_pool_id, {
            order_ids: [...new Set([...(targetPool.order_ids || []), order_id])],
            total_weight_g: (targetPool.total_weight_g || 0) + (order.weight_g || 0),
          }),
          base44.asServiceRole.entities.Order.update(order_id, {
            consolidation_pool_id: target_pool_id,
          }),
        ]);
      } else if (action === 'add_order') {
        const updatedIds = [...new Set([...(pool.order_ids || []), order_id])];
        const updatedWeight = (pool.total_weight_g || 0) + (order.weight_g || 0);
        await Promise.all([
          base44.asServiceRole.entities.ShippingPool.update(pool_id, {
            order_ids: updatedIds,
            total_weight_g: updatedWeight,
          }),
          base44.asServiceRole.entities.Order.update(order_id, {
            order_status: 'notified_shipment',
            consolidation_pool_id: pool_id,
          }),
        ]);
      }
      console.log(`[userMutateShippingPool] INSTANT action=${action} pool=${pool_id} order=${order_id} | ${Date.now()-t0}ms`);
      return Response.json({ mode: 'instant', success: true });
    } else {
      // Create a ShippingEditRequest for admin approval
      const editType = action === 'cancel_order' ? 'cancel_shipment'
                     : action === 'move_order' ? 'move_pool'
                     : 'add_to_pool';

      // For add_order, we reuse cancel_shipment type but with a note; better to store as custom
      // We store add_to_pool as a new edit_type — handled in modal approval logic
      const reqData = {
        tenant_id: tenantId,
        order_id,
        pool_id,
        user_email: user.email,
        edit_type: editType,
        user_note: user_note || '',
        status: 'pending',
        is_instant: false,
      };
      if (action === 'move_order') reqData.target_pool_id = target_pool_id;
      if (action === 'add_order') reqData.target_pool_id = pool_id; // target is same pool for add

      await base44.asServiceRole.entities.ShippingEditRequest.create(reqData);
      console.log(`[userMutateShippingPool] REQUEST created action=${action} pool=${pool_id} order=${order_id} | ${Date.now()-t0}ms`);
      return Response.json({ mode: 'pending_approval', success: true });
    }
  } catch (error) {
    console.error('userMutateShippingPool error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});