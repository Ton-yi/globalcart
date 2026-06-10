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
    
    // Support both direct call ({ order_id }) and entity automation ({ event, data })
    const order_id = body.order_id || body.event?.entity_id;
    
    // Fetch order - prefer body.data from automation, otherwise fetch
    let order = body.data;
    if (!order && order_id) {
      const results = await base44.asServiceRole.entities.Order.filter({ id: order_id });
      order = (results || [])[0];
    }
    
    if (!order?.id || !order.pre_shipment) {
      return Response.json({ skipped: true, reason: 'no_order_or_no_pre_shipment' });
    }
    
    // Check if pool already created - if yes, skip to prevent duplicates
    if (order.pre_shipment.pool_created) {
      console.log('[autoCreatePreShipmentPool] Pool already created for order:', order.id, 'Pool ID:', order.pre_shipment.pool_id);
      return Response.json({ skipped: true, reason: 'pool_already_created', pool_id: order.pre_shipment.pool_id });
    }
    
    // Additional check: if order already has consolidation_pool_id, skip
    if (order.consolidation_pool_id) {
      console.log('[autoCreatePreShipmentPool] Order already assigned to pool:', order.id, 'Pool ID:', order.consolidation_pool_id);
      return Response.json({ skipped: true, reason: 'order_already_has_pool', pool_id: order.consolidation_pool_id });
    }

    // Support both in_warehouse and notified_shipment status
    // This allows the function to be called when user submits shipment notification
    const shouldProcess = order.order_status === 'in_warehouse' || order.order_status === 'notified_shipment';
    if (!shouldProcess && !body.force) {
      console.log('[autoCreatePreShipmentPool] Skipped: order status is', order.order_status);
      return Response.json({ skipped: true, reason: 'order_status_not_eligible', status: order.order_status });
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

    // Case 1: Join existing direct/transit pool (including join_existing_pool mode)
    const shouldJoinExistingPool = pre.join_existing_pool && target_pool_id;
    if ((consType !== 'official_pool' && target_pool_id) || shouldJoinExistingPool) {
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
      
      // Join pool - also add to per_user_groups
      // Check if user already has a group in this pool
      const existingGroupIndex = (pool.per_user_groups || []).findIndex(g => g.user_email === order.user_email);
      const addr = pre.address || {};
      const newOrderEntry = {
        order_id: order.id,
        note: order.product_name || '',
        image_urls: order.product_image_url ? [order.product_image_url] : [],
        selected_addon_ids: order.selected_addon_ids || [],
        selected_addons: order.selected_addons || [],
        override_final_address: null,
        use_group_address: true,
        // Per-order transit shipping settings
        transit_shipping_method_id: pre.transit_shipping_method_id || '',
        transit_shipping_method_name: pre.transit_shipping_method_name || '',
        transit_note: pre.user_note || '',
      };
      
      let updatedPerUserGroups = [...(pool.per_user_groups || [])];
      if (existingGroupIndex >= 0) {
        // User already has a group - add order entry to existing group
        updatedPerUserGroups[existingGroupIndex] = {
          ...updatedPerUserGroups[existingGroupIndex],
          order_entries: [...(updatedPerUserGroups[existingGroupIndex].order_entries || []), newOrderEntry],
        };
      } else {
        // Create new group for this user
        updatedPerUserGroups.push({
          user_email: order.user_email,
          user_name: order.user_name || order.user_email,
          group_label: order.user_name || order.user_email,
          note: pre.user_note || '',
          image_urls: [],
          selected_addon_ids: pre.selected_addon_ids || [],
          selected_addons: pre.selected_addons || [],
          group_final_address: {
            recipient_name: addr.recipient_name || '',
            country: addr.country || '',
            addr1: addr.addr1 || '',
            addr2: addr.addr2 || '',
            addr3: addr.addr3 || '',
            state: addr.state || '',
            phone: addr.phone || '',
          },
          order_entries: [newOrderEntry],
        });
      }
      
      await base44.asServiceRole.entities.ShippingPool.update(pool.id, {
        order_ids: [...(pool.order_ids || []), order.id],
        order_names: [...(pool.order_names || []), order.product_name].filter(Boolean),
        total_weight_g: (pool.total_weight_g || 0) + (order.weight_g || 0),
        per_user_groups: updatedPerUserGroups,
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
      
      // Join official pool - also add to per_user_groups
      const existingGroupIndex = (pool.per_user_groups || []).findIndex(g => g.user_email === order.user_email);
      const addr = pre.address || {};
      const newOrderEntry = {
        order_id: order.id,
        note: order.product_name || '',
        image_urls: order.product_image_url ? [order.product_image_url] : [],
        selected_addon_ids: order.selected_addon_ids || [],
        selected_addons: order.selected_addons || [],
        override_final_address: null,
        use_group_address: true,
      };
      
      let updatedPerUserGroups = [...(pool.per_user_groups || [])];
      if (existingGroupIndex >= 0) {
        // User already has a group - add order to existing group
        updatedPerUserGroups[existingGroupIndex] = {
          ...updatedPerUserGroups[existingGroupIndex],
          order_entries: [...(updatedPerUserGroups[existingGroupIndex].order_entries || []), newOrderEntry],
        };
      } else {
        // Create new group for this user with transit/addon settings at group level
        updatedPerUserGroups.push({
          user_email: order.user_email,
          user_name: order.user_name || order.user_email,
          group_label: order.user_name || order.user_email,
          note: pre.user_note || '',
          image_urls: [],
          // Group-level transit shipping settings (applies to all orders in this group)
          transit_shipping_method_id: pre.transit_shipping_method_id || '',
          transit_shipping_method_name: pre.transit_shipping_method_name || '',
          // Group-level selected addons (applies to all orders in this group)
          selected_addon_ids: pre.selected_addon_ids || [],
          selected_addons: pre.selected_addons || [],
          group_final_address: {
            recipient_name: addr.recipient_name || '',
            country: addr.country || '',
            addr1: addr.addr1 || '',
            addr2: addr.addr2 || '',
            addr3: addr.addr3 || '',
            state: addr.state || '',
            phone: addr.phone || '',
          },
          order_entries: [newOrderEntry],
        });
      }
      
      await base44.asServiceRole.entities.ShippingPool.update(pool.id, {
        order_ids: [...(pool.order_ids || []), order.id],
        order_names: [...(pool.order_names || []), order.product_name].filter(Boolean),
        total_weight_g: (pool.total_weight_g || 0) + (order.weight_g || 0),
        per_user_groups: updatedPerUserGroups,
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
    // CRITICAL: Check if order already belongs to a pool (prevent duplicates)
    if (order.consolidation_pool_id) {
      console.log('[autoCreatePreShipmentPool] Order already has pool_id, skipping:', order.id, order.consolidation_pool_id);
      return Response.json({ skipped: true, reason: 'order_already_has_pool' });
    }
    
    // Double-check: search for any existing pool containing this order
    const allPoolsCheck = await base44.asServiceRole.entities.ShippingPool.filter({ tenant_id: tenantId });
    const existingPoolForOrder = (allPoolsCheck || []).find(p => (p.order_ids || []).includes(order.id));
    if (existingPoolForOrder) {
      console.log('[autoCreatePreShipmentPool] Order already in pool, skipping:', order.id, existingPoolForOrder.pool_code);
      // Update order to mark as created (prevent future attempts)
      await base44.asServiceRole.entities.Order.update(order.id, {
        pre_shipment: { ...pre, pool_created: true, pool_id: existingPoolForOrder.id },
      });
      return Response.json({ skipped: true, reason: 'order_already_in_pool', pool_id: existingPoolForOrder.id });
    }
    
    const transitLoc = pre.transit_location_id
      ? (await base44.asServiceRole.entities.TransitLocation.filter({ id: pre.transit_location_id }))?.[0]
      : null;
    const prefix = consType === 'transit' && transitLoc?.code_prefix ? transitLoc.code_prefix.toUpperCase() : 'AAA';
    
    // Generate unique pool_code with retry logic
    const generatePoolCode = async (prefix, tenantId) => {
      const allPools = await base44.asServiceRole.entities.ShippingPool.filter({ tenant_id: tenantId });
      const prefixPools = (allPools || []).filter(p => p.pool_code?.startsWith(prefix));
      const maxSeq = prefixPools.reduce((max, p) => {
        const seq = parseInt(p.pool_code.slice(prefix.length), 10);
        return isNaN(seq) ? max : Math.max(max, seq);
      }, 0);
      return `${prefix}${String(maxSeq + 1).padStart(5, '0')}`;
    };
    
    // Generate pool_code and verify uniqueness (retry if collision)
    let pool_code = await generatePoolCode(prefix, tenantId);
    let retryCount = 0;
    while (retryCount < 3) {
      const existingPool = (await base44.asServiceRole.entities.ShippingPool.filter({ tenant_id: tenantId, pool_code }))?.[0];
      if (!existingPool) break;
      // Collision detected, increment sequence
      retryCount++;
      const currentSeq = parseInt(pool_code.slice(prefix.length), 10);
      pool_code = `${prefix}${String(currentSeq + 1).padStart(5, '0')}`;
    }
    
    console.log('[autoCreatePreShipmentPool] Creating new pool:', {
      pool_code,
      order_id: order.id,
      consType,
      transit_location_id: pre.transit_location_id,
    });
    
    const addr = pre.address || {};
    // For transit pools, destination_country is stored directly in pre_shipment.transit_location_country
    // (set at form-submit time from the TransitLocation entity); fall back to fetched entity field.
    // For direct shipment, it comes from the address the user filled in.
    const destinationCountry = consType === 'transit'
      ? (pre.transit_location_country || transitLoc?.country || addr.country || '')
      : (addr.country || '');
    // Build per_user_groups structure to preserve order-level details in the pool
    const perUserGroups = [{
      user_email: order.user_email,
      user_name: order.user_name || order.user_email,
      group_label: order.user_name || order.user_email,
      note: pre.user_note || '',
      image_urls: [],
      // Group-level transit shipping settings (applies to all orders in this group)
      transit_shipping_method_id: pre.transit_shipping_method_id || '',
      transit_shipping_method_name: pre.transit_shipping_method_name || '',
      // Group-level selected addons (applies to all orders in this group)
      selected_addon_ids: pre.selected_addon_ids || [],
      selected_addons: pre.selected_addons || [],
      group_final_address: {
        recipient_name: addr.recipient_name || '',
        country: destinationCountry,
        addr1: addr.addr1 || '',
        addr2: addr.addr2 || '',
        addr3: addr.addr3 || '',
        state: addr.state || '',
        phone: addr.phone || '',
      },
      order_entries: [{
        order_id: order.id,
        note: order.product_name || '',
        image_urls: order.product_image_url ? [order.product_image_url] : [],
        selected_addon_ids: order.selected_addon_ids || [],
        selected_addons: order.selected_addons || [],
        override_final_address: null,
        use_group_address: true,
      }],
    }];

    const pool = await base44.asServiceRole.entities.ShippingPool.create({
      tenant_id: tenantId,
      pool_code,
      shipping_method: pre.shipping_method || '',
      scheduled_ship_date: pre.scheduled_ship_date === '__asap__' ? '' : (pre.scheduled_ship_date || ''),
      transit_location_id: pre.transit_location_id || '',
      transit_location_name: transitLoc?.name || '',
      transit_shipping_method_id: pre.transit_shipping_method_id || '',
      transit_shipping_method_name: pre.transit_shipping_method_name || '',
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
      selected_addon_ids: pre.selected_addon_ids || [],
      selected_addons: pre.selected_addons || [],
      per_user_groups: perUserGroups,
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