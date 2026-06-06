import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Update an order with tenant isolation verification
 * Ensures the user can only update orders within their tenant
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { order_id, ...updateData } = body;

    if (!order_id) {
      return Response.json({ error: 'Missing order_id' }, { status: 400 });
    }

    // Security: never allow changing tenant_id from client
    delete updateData.tenant_id;

    // Get user record and tenant_id - use asServiceRole to bypass RLS
    const userRecords = await base44.asServiceRole.entities.User.filter({ email: user.email }, undefined, 1);
    if (!userRecords || userRecords.length === 0) {
      return Response.json({ error: 'User record not found' }, { status: 404 });
    }

    const userRecord = userRecords[0];
    const tenantId = userRecord.tenant_id;
    
    if (!tenantId && user.role !== 'platform_admin') {
      return Response.json({ error: 'User has no tenant assigned' }, { status: 403 });
    }

    // Fetch order to verify ownership - use asServiceRole to bypass RLS
    const orderRecords = await base44.asServiceRole.entities.Order.filter({ id: order_id }, undefined, 1);
    const order = Array.isArray(orderRecords) ? orderRecords[0] : orderRecords;

    if (!order) {
      return Response.json({ error: 'Order not found' }, { status: 404 });
    }

    // Verify tenant ownership
    if (user.role !== 'platform_admin' && order.tenant_id !== tenantId) {
      return Response.json({ error: 'Forbidden: Order does not belong to your tenant' }, { status: 403 });
    }

    // Verify user can update (own order, or is staff/admin)
    if (user.role === 'user' && order.user_email !== user.email) {
      return Response.json({ error: 'Forbidden: You can only update your own orders' }, { status: 403 });
    }

    // If admin is changing order_status away from notified_shipment, remove order from its shipping pool
    const isAdmin = user.role === 'admin' || user.role === 'platform_admin' || user.role === 'staff';
    const newStatus = updateData.order_status;
    if (isAdmin && newStatus && newStatus !== order.order_status) {
      // Case 1: order was in notified_shipment and is being moved to another status → remove from pool
      if (order.order_status === 'notified_shipment' && newStatus !== 'notified_shipment') {
        const poolId = order.consolidation_pool_id;
        if (poolId) {
          const poolResults = await base44.asServiceRole.entities.ShippingPool.filter({ id: poolId });
          const pool = Array.isArray(poolResults) ? poolResults[0] : poolResults;
          if (pool) {
            const updatedIds = (pool.order_ids || []).filter(id => id !== order_id);
            const updatedWeight = Math.max(0, (pool.total_weight_g || 0) - (order.weight_g || 0));
            await base44.asServiceRole.entities.ShippingPool.update(poolId, {
              order_ids: updatedIds,
              total_weight_g: updatedWeight,
            });
          }
          // Clear pool reference from order
          updateData.consolidation_pool_id = '';
        }
      }

      // Case 2: order is being set to notified_shipment — if it was already in another pool, remove from that one
      // (handles re-submission scenario)
      if (newStatus === 'notified_shipment' && order.consolidation_pool_id && updateData.consolidation_pool_id && updateData.consolidation_pool_id !== order.consolidation_pool_id) {
        const oldPoolId = order.consolidation_pool_id;
        const oldPoolResults = await base44.asServiceRole.entities.ShippingPool.filter({ id: oldPoolId });
        const oldPool = Array.isArray(oldPoolResults) ? oldPoolResults[0] : oldPoolResults;
        if (oldPool) {
          const updatedIds = (oldPool.order_ids || []).filter(id => id !== order_id);
          const updatedWeight = Math.max(0, (oldPool.total_weight_g || 0) - (order.weight_g || 0));
          await base44.asServiceRole.entities.ShippingPool.update(oldPoolId, {
            order_ids: updatedIds,
            total_weight_g: updatedWeight,
          });
        }
      }
    }

    // If updating pre_shipment, preserve pool_id/pool_created ONLY when the automation
    // has already run (i.e. the order is already in notified_shipment status).
    // Before in-warehouse, the user should be free to change their pool selection freely.
    if (updateData.pre_shipment && order.pre_shipment) {
      const existing = order.pre_shipment;
      const alreadyProcessed = existing.pool_id && order.order_status === 'notified_shipment';
      if (alreadyProcessed) {
        updateData.pre_shipment.pool_created = true;
        updateData.pre_shipment.pool_id = existing.pool_id;
      }
    }

    // Update order
    const updatedOrder = await base44.asServiceRole.entities.Order.update(order_id, updateData);

    return Response.json({ 
      success: true,
      order: updatedOrder 
    });

  } catch (error) {
    console.error('updateTenantOrder error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});