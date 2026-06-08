import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Auto-create ShippingPool from order.pre_shipment when order status → in_warehouse
 * 
 * Flow:
 * 1. Direct shipping to existing pool → join if not shipped, else cancel pre_shipment
 * 2. Transit to existing pool → join if not shipped, else cancel pre_shipment  
 * 3. Official pool (specific) → join if not shipped, else reset to default match
 * 4. Official pool (default) → keep in staging for admin assignment
 * 5. New pool (direct/transit) → create new pool
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { order_id } = body;
    
    // Fetch order
    let order = body.data;
    if (!order && order_id) {
      const results = await base44.asServiceRole.entities.Order.filter({ id: order_id });
      order = (results || [])[0];
    }
    
    if (!order?.id || !order.pre_shipment || order.pre_shipment.pool_created) {
      return Response.json({ skipped: true, reason: 'no_pre_shipment_or_already_created' });
    }

    const pre = order.pre_shipment;
    const { consType, target_pool_id } = pre;
    const tenantId = order.tenant_id;

    // Helper: check if pool exists and is shipped
    const checkPool = async (poolId) => {
      if (!poolId) return { exists: false };
      const pools = await base44.asServiceRole.entities.ShippingPool.filter({ id: poolId });
      const pool = pools?.[0];
      if (!pool) return { exists: false };
      return { exists: true, pool, isShipped: pool.status === 'shipped' || pool.status === 'delivered' };
    };

    // Case 1: Join existing direct/transit pool
    if (consType !== 'official_pool' && target_pool_id) {
      const { exists, pool, isShipped } = await checkPool(target_pool_id);
      if (!exists) return Response.json({ error: 'Pool not found' }, { status: 404 });
      
      if (isShipped) {
        await base44.asServiceRole.entities.Order.update(order.id, {
          pre_shipment: null,
          messages: [...(order.messages || []), {
            id: `shipped_${Date.now()}`, from: '系统通知', from_email: '__system__', role: 'admin',
            content: `您选择的发货申请 ${pool.pool_code} 已发出，预出货设置已取消。`,
            timestamp: new Date().toISOString(),
          }],
          unread_roles: [...new Set([...(order.unread_roles || []), 'user'])],
        });
        return Response.json({ skipped: true, reason: 'pool_shipped' });
      }
      
      // Join pool
      await base44.asServiceRole.entities.ShippingPool.update(pool.id, {
        order_ids: [...(pool.order_ids || []), order.id],
        order_names: [...(pool.order_names || []), order.product_name].filter(Boolean),
        total_weight_g: (pool.total_weight_g || 0) + (order.weight_g || 0),
      });
      await base44.asServiceRole.entities.Order.update(order.id, {
        order_status: 'notified_shipment',
        consolidation_pool_id: pool.id,
        pre_shipment: { ...pre, pool_created: true, pool_id: pool.id },
      });
      return Response.json({ success: true, pool_id: pool.id, pool_code: pool.pool_code, joined_existing: true });
    }

    // Case 2: Official pool - specific selection
    if (consType === 'official_pool' && target_pool_id) {
      const { exists, pool, isShipped } = await checkPool(target_pool_id);
      if (!exists) return Response.json({ error: 'Official pool not found' }, { status: 404 });
      
      if (isShipped) {
        await base44.asServiceRole.entities.Order.update(order.id, {
          pre_shipment: { ...pre, target_pool_id: '', target_pool_code: '', target_pool_title: '' },
          messages: [...(order.messages || []), {
            id: `official_shipped_${Date.now()}`, from: '系统通知', from_email: '__system__', role: 'admin',
            content: `您选择的官方拼邮池 ${pool.pool_code} 已发出，已改为默认匹配。`,
            timestamp: new Date().toISOString(),
          }],
          unread_roles: [...new Set([...(order.unread_roles || []), 'user'])],
        });
        return Response.json({ skipped: true, reason: 'official_pool_shipped', reset_to_default: true });
      }
      
      // Join official pool
      await base44.asServiceRole.entities.ShippingPool.update(pool.id, {
        order_ids: [...(pool.order_ids || []), order.id],
        order_names: [...(pool.order_names || []), order.product_name].filter(Boolean),
        total_weight_g: (pool.total_weight_g || 0) + (order.weight_g || 0),
      });
      await base44.asServiceRole.entities.Order.update(order.id, {
        order_status: 'notified_shipment',
        consolidation_pool_id: pool.id,
        pre_shipment: { ...pre, pool_created: true, pool_id: pool.id },
      });
      return Response.json({ success: true, pool_id: pool.id, pool_code: pool.pool_code, is_official_pool: true });
    }

    // Case 3: Official pool - default match (keep in staging)
    if (consType === 'official_pool' && !target_pool_id) {
      await base44.asServiceRole.entities.Order.update(order.id, {
        order_status: 'notified_shipment',
        pre_shipment: { ...pre, pool_created: true },
      });
      return Response.json({ success: true, is_staging: true, is_official_pool: true });
    }

    // Case 4: Create new pool (direct/transit without existing pool)
    const transitLoc = pre.transit_location_id
      ? (await base44.asServiceRole.entities.TransitLocation.filter({ id: pre.transit_location_id }))?.[0]
      : null;
    const prefix = consType === 'transit' && transitLoc?.code_prefix ? transitLoc.code_prefix.toUpperCase() : 'AAA';
    const allPools = await base44.asServiceRole.entities.ShippingPool.filter({ tenant_id: tenantId });
    const prefixPools = (allPools || []).filter(p => p.pool_code?.startsWith(prefix));
    const maxSeq = prefixPools.reduce((max, p) => {
      const seq = parseInt(p.pool_code.slice(prefix.length), 10);
      return isNaN(seq) ? max : Math.max(max, seq);
    }, 0);
    const pool_code = `${prefix}${String(maxSeq + 1).padStart(5, '0')}`;
    
    const addr = pre.address || {};
    const pool = await base44.asServiceRole.entities.ShippingPool.create({
      tenant_id: tenantId,
      pool_code,
      shipping_method: pre.shipping_method || '',
      scheduled_ship_date: pre.scheduled_ship_date === '__asap__' ? '' : (pre.scheduled_ship_date || ''),
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
      destination_country: addr.country || '',
      recipient_name: addr.recipient_name || '',
      address_line1: addr.addr1 || '',
      address_line2: addr.addr2 || '',
      selected_addon_ids: pre.selected_addon_ids || [],
      selected_addons: pre.selected_addons || [],
    });

    await base44.asServiceRole.entities.Order.update(order.id, {
      order_status: 'notified_shipment',
      consolidation_pool_id: pool.id,
      pre_shipment: { ...pre, pool_created: true, pool_id: pool.id },
    });

    return Response.json({ success: true, pool_id: pool.id, pool_code });
  } catch (error) {
    console.error('autoCreatePreShipmentPool error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});