import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * managePendingPools
 * 
 * Manages "待拼邮看板" (Pending Pools) - persistent staging pools for official consolidation.
 * 
 * Actions:
 *   list   - returns all pending pools for the tenant
 *   create - creates a new pending pool (enforces capacity limit)
 *   update - updates title or pending_pool_shipping_method
 *   delete - deletes a pending pool (refuses if it's the last one)
 *   clearMethod - clears the shipping method of a pending pool (used when a shipping method is disabled)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const isTenantAdmin = ['admin', 'tenant_admin', 'platform_admin'].includes(user.role);
    if (!isTenantAdmin) return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });

    const userRecords = await base44.asServiceRole.entities.User.filter({ email: user.email });
    const tenantId = userRecords?.[0]?.tenant_id;
    if (!tenantId && user.role !== 'platform_admin') {
      return Response.json({ error: 'No tenant assigned' }, { status: 403 });
    }

    const body = await req.json();
    const { action, pool_id, title, shipping_method_code } = body;

    // Get all pending pools for tenant
    const allPendingPools = await base44.asServiceRole.entities.ShippingPool.filter({
      tenant_id: tenantId,
      is_pending_pool: true,
    });
    // Sort by created_date ascending (oldest first)
    allPendingPools.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));

    // Get count of shipping methods that allow official pool (for capacity limit)
    const shippingMethods = await base44.asServiceRole.entities.ShippingMethod.filter({ tenant_id: tenantId });
    const officialPoolMethods = (shippingMethods || []).filter(
      m => m.is_active !== false && m.enabled_for_official_pool !== false
    );
    const maxPendingPools = officialPoolMethods.length + 1;

    if (action === 'list') {
      return Response.json({
        success: true,
        pendingPools: allPendingPools,
        maxPendingPools,
        officialPoolMethodCount: officialPoolMethods.length,
      });
    }

    if (action === 'create') {
      if (allPendingPools.length >= maxPendingPools) {
        return Response.json({
          error: `已达到待拼邮看板上限（${maxPendingPools}个），无法继续添加`,
          limitReached: true,
          current: allPendingPools.length,
          max: maxPendingPools,
        }, { status: 400 });
      }

      // Generate a pool_code for the pending pool
      const allPools = await base44.asServiceRole.entities.ShippingPool.filter({ tenant_id: tenantId });
      const prefix = 'PND';
      const prefixPools = (allPools || []).filter(p => p.pool_code?.startsWith(prefix));
      const maxSeq = prefixPools.reduce((max, p) => {
        const seq = parseInt(p.pool_code.slice(prefix.length), 10);
        return isNaN(seq) ? max : Math.max(max, seq);
      }, 0);
      const pool_code = `${prefix}${String(maxSeq + 1).padStart(5, '0')}`;

      const newPool = await base44.asServiceRole.entities.ShippingPool.create({
        tenant_id: tenantId,
        pool_code,
        title: title || '待拼邮',
        is_pending_pool: true,
        pending_pool_shipping_method: shipping_method_code || '',
        is_admin_created: true,
        consolidation_type: '',
        order_ids: [],
        order_names: [],
        creator_email: user.email,
        creator_name: user.full_name || user.email,
        status: 'pending',
        per_user_groups: [],
        total_weight_g: 0,
      });

      return Response.json({ success: true, pool: newPool });
    }

    if (action === 'update') {
      if (!pool_id) return Response.json({ error: 'Missing pool_id' }, { status: 400 });

      const poolRecords = await base44.asServiceRole.entities.ShippingPool.filter({ id: pool_id });
      const pool = poolRecords?.[0];
      if (!pool || pool.tenant_id !== tenantId) {
        return Response.json({ error: 'Pool not found' }, { status: 404 });
      }
      if (!pool.is_pending_pool) {
        return Response.json({ error: 'Not a pending pool' }, { status: 400 });
      }

      const updateData = {};
      if (title !== undefined) updateData.title = title;
      if (shipping_method_code !== undefined) updateData.pending_pool_shipping_method = shipping_method_code;

      const updated = await base44.asServiceRole.entities.ShippingPool.update(pool_id, updateData);
      return Response.json({ success: true, pool: updated });
    }

    if (action === 'delete') {
      if (!pool_id) return Response.json({ error: 'Missing pool_id' }, { status: 400 });

      if (allPendingPools.length <= 1) {
        return Response.json({
          error: '至少需要保留一个待拼邮看板，无法删除最后一个',
          isLastPool: true,
        }, { status: 400 });
      }

      const poolRecords = await base44.asServiceRole.entities.ShippingPool.filter({ id: pool_id });
      const pool = poolRecords?.[0];
      if (!pool || pool.tenant_id !== tenantId) {
        return Response.json({ error: 'Pool not found' }, { status: 404 });
      }
      if (!pool.is_pending_pool) {
        return Response.json({ error: 'Not a pending pool' }, { status: 400 });
      }

      // If pool has orders, move them back to staging (clear consolidation_pool_id)
      if ((pool.order_ids || []).length > 0) {
        await Promise.all((pool.order_ids || []).map(orderId =>
          base44.asServiceRole.entities.Order.update(orderId, {
            consolidation_pool_id: '',
          }).catch(e => console.error('Failed to unlink order from pending pool:', e))
        ));
      }

      await base44.asServiceRole.entities.ShippingPool.delete(pool_id);
      return Response.json({ success: true });
    }

    // clearMethod: called when a shipping method is disabled, to revert affected pending pools to default
    if (action === 'clearMethod') {
      const { method_code } = body;
      if (!method_code) return Response.json({ error: 'Missing method_code' }, { status: 400 });

      const affected = allPendingPools.filter(p => p.pending_pool_shipping_method === method_code);
      await Promise.all(affected.map(p =>
        base44.asServiceRole.entities.ShippingPool.update(p.id, { pending_pool_shipping_method: '' })
      ));

      return Response.json({
        success: true,
        clearedCount: affected.length,
        warning: affected.length > 0
          ? `已将 ${affected.length} 个绑定运输方式"${method_code}"的待拼邮看板重置为默认看板`
          : null,
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    console.error('managePendingPools error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});