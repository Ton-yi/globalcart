import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * getTransitPoolWorkData - 单箱工作面板数据（基于拼邮申请 GroupBuyRequest）
 * 参数：request_id - 拼邮申请 ID
 * 返回：拼邮申请详情、条目列表、中转地信息、相关订单
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { request_id } = await req.json();
    
    if (!request_id) {
      return Response.json({ error: 'request_id or pool_code is required' }, { status: 400 });
    }

    console.log('[getTransitPoolWorkData] Fetching data for:', request_id);

    // Try to fetch as GroupBuyRequest first (by ID or pool_code)
    let request = null;
    let isRequest = true;
    
    const allRequests = await base44.asServiceRole.entities.GroupBuyRequest.filter({});
    request = allRequests.find(r => r.id === request_id || r.pool_code === request_id);
    
    if (!request) {
      // Try ShippingPool as fallback (by ID or pool_code)
      console.log('[getTransitPoolWorkData] Not found as GroupBuyRequest, trying ShippingPool...');
      const allPools = await base44.asServiceRole.entities.ShippingPool.filter({});
      request = allPools.find(p => p.id === request_id || p.pool_code === request_id);
      isRequest = false;
    }
    
    if (!request) {
      console.error('[getTransitPoolWorkData] Not found:', request_id);
      return Response.json({ error: 'Request not found' }, { status: 404 });
    }
    
    console.log('[getTransitPoolWorkData] Found:', request.id, isRequest ? 'title=' + request.title : 'pool_code=' + request.pool_code);

    // Resolve tenant from user session
    const userRecords = await base44.asServiceRole.entities.User.filter({ email: user.email });
    if (!userRecords || userRecords.length === 0) {
      return Response.json({ error: 'User record not found' }, { status: 404 });
    }
    const tenantId = userRecords[0].tenant_id;
    const isAdmin = user.role === 'admin' || user.role === 'tenant_admin' || user.role === 'platform_admin';

    // Verify tenant isolation
    if (request.tenant_id !== tenantId && !isAdmin) {
      return Response.json({ error: 'Forbidden: Request belongs to different tenant' }, { status: 403 });
    }

    // Fetch transit location if assigned
    let location = null;
    if (request.transit_location_id) {
      const locations = await base44.asServiceRole.entities.TransitLocation.filter({ id: request.transit_location_id });
      if (locations && locations.length > 0) {
        location = locations[0];
        
        // Check if user is the assigned manager (if transit location is set)
        if (user.email !== location.manager_email && !isAdmin) {
          return Response.json({ error: 'Forbidden: Not the assigned transit location manager' }, { status: 403 });
        }
      }
    }

    // Fetch entries based on type
    let entries = [];
    if (isRequest) {
      // GroupBuyRequest uses GroupBuyEntry
      const allEntries = await base44.asServiceRole.entities.GroupBuyEntry.filter({ request_id: request.id });
      entries = allEntries || [];
      console.log('[getTransitPoolWorkData] Fetched', entries.length, 'GroupBuyEntry items');
    } else {
      // ShippingPool - fetch real Order records to get correct user_email/user_name per order
      const poolOrderIds = request.order_ids || [];
      const fetchedOrders = [];
      for (const orderId of poolOrderIds) {
        try {
          const order = await base44.asServiceRole.entities.Order.get(orderId);
          if (order) fetchedOrders.push(order);
        } catch (e) {
          console.error(`[getTransitPoolWorkData] Failed to fetch order ${orderId}:`, e);
        }
      }
      const ordersById = {};
      fetchedOrders.forEach(o => { ordersById[o.id] = o; });

      // Build a map: order_id -> which per_user_groups entry it belongs to
      const normalizeMethodId = (id) => {
        if (id === 'pickup') return '__pickup__';
        if (id === 'storage') return '__storage__';
        return id || '';
      };
      const orderGroupMap = {};
      const perUserGroups = request.per_user_groups || [];
      for (const userGroup of perUserGroups) {
        // Support both address_groups nested structure AND flat order_entries
        const addressGroups = userGroup.address_groups;
        if (addressGroups && addressGroups.length > 0) {
          addressGroups.forEach((ag, gi) => {
            (ag.order_entries || []).forEach(oe => {
              orderGroupMap[oe.order_id] = {
                user_email: userGroup.user_email,
                user_name: userGroup.user_name,
                group_label: userGroup.group_label,
                group_index: gi,
                group_final_address: ag.group_final_address || userGroup.group_final_address,
                transit_shipping_method: ag.transit_shipping_method,
                transit_shipping_method_id: normalizeMethodId(ag.transit_shipping_method_id),
                selected_addon_ids: ag.selected_addon_ids || [],
                selected_addons: ag.selected_addons || [],
                note: ag.note || userGroup.note,
              };
            });
          });
        } else {
          // Flat per_user_groups (current ShippingPool structure with order_entries directly on group)
          (userGroup.order_entries || []).forEach(oe => {
            const methodId = normalizeMethodId(oe.transit_shipping_method_id || userGroup.transit_shipping_method_id);
            orderGroupMap[oe.order_id] = {
              user_email: userGroup.user_email,
              user_name: userGroup.user_name,
              group_label: userGroup.group_label,
              group_index: 0,
              group_final_address: oe.override_final_address || userGroup.group_final_address,
              transit_shipping_method: userGroup.transit_shipping_method,
              transit_shipping_method_id: methodId,
              selected_addon_ids: oe.selected_addon_ids || userGroup.selected_addon_ids || [],
              selected_addons: oe.selected_addons || userGroup.selected_addons || [],
              note: oe.note || userGroup.note,
            };
          });
        }
      }

      entries = fetchedOrders.map(order => {
        const groupInfo = orderGroupMap[order.id];
        return {
          id: `order_${order.id}`,
          order_id: order.id,
          status: 'active',
          product_name: order.product_name || '包裹',
          user_email: groupInfo?.user_email || order.user_email || request.creator_email,
          user_name: groupInfo?.user_name || order.user_name || request.creator_name,
          group_label: groupInfo?.group_label,
          group_index: groupInfo?.group_index ?? 0,
          group_final_address: groupInfo?.group_final_address,
          transit_shipping_method: groupInfo?.transit_shipping_method,
          transit_shipping_method_id: groupInfo?.transit_shipping_method_id,
          selected_addon_ids: groupInfo?.selected_addon_ids || [],
          selected_addons: groupInfo?.selected_addons || [],
          note: groupInfo?.note,
          estimated_jpy: order.estimated_jpy || 0,
          weight_g: order.weight_g || 100,
          order_details: order,
        };
      });
      // Placeholder for any unfetched order_ids
      const fetchedIds = new Set(fetchedOrders.map(o => o.id));
      poolOrderIds.filter(id => !fetchedIds.has(id)).forEach(orderId => {
        const groupInfo = orderGroupMap[orderId];
        entries.push({
          id: `order_${orderId}`,
          order_id: orderId,
          status: 'active',
          product_name: '包裹',
          user_email: groupInfo?.user_email || request.creator_email,
          user_name: groupInfo?.user_name || request.creator_name,
          group_label: groupInfo?.group_label,
          group_index: groupInfo?.group_index ?? 0,
          estimated_jpy: 0,
          weight_g: 100,
        });
      });
      console.log('[getTransitPoolWorkData] Created', entries.length, 'entries from ShippingPool orders with per_user_groups data');
    }

    // Fetch orders linked to entries (skip entries that already have order_details from ShippingPool fetch above)
    const entriesToFetch = entries.filter(e => e.order_id && !e.order_details);
    const orderIds = entriesToFetch.map(e => e.order_id);
    const orders = [];
    if (orderIds.length > 0) {
      for (const orderId of orderIds) {
        try {
          const order = await base44.asServiceRole.entities.Order.get(orderId);
          if (order) orders.push(order);
        } catch (e) {
          console.error(`Failed to fetch order ${orderId}:`, e);
        }
      }
    }

    // Enrich entries with order details (ShippingPool entries already have order_details set above)
    const ordersMap = {};
    orders.forEach(o => { ordersMap[o.id] = o; });
    
    const enrichedEntries = entries.map(entry => {
      if (entry.order_details) return entry; // already enriched
      const order = ordersMap[entry.order_id];
      return {
        ...entry,
        order_details: order || null,
      };
    });

    // Fetch transit shipping methods
    const allTransitMethods = await base44.asServiceRole.entities.TransitShippingMethod.filter({ 
      tenant_id: request.tenant_id,
      is_active: true 
    });
    
    const transitMethods = location && location.disabled_transit_method_ids
      ? allTransitMethods.filter(m => !location.disabled_transit_method_ids.includes(m.id))
      : allTransitMethods;

    // Fetch addon options
    const allAddons = await base44.asServiceRole.entities.AddonOption.filter({ 
      tenant_id: request.tenant_id,
      addon_type: 'shipping',
      is_active: true 
    });
    
    const addonOptions = location && location.disabled_addon_ids
      ? allAddons.filter(a => !location.disabled_addon_ids.includes(a.id))
      : allAddons;

    return Response.json({
      request,
      entries: enrichedEntries,
      location,
      orders,
      transitMethods,
      addonOptions,
      debug: {
        request_id: request.id,
        entries_count: entries.length,
        orders_fetched: orders.length,
        transitMethods_count: transitMethods.length,
        addonOptions_count: addonOptions.length
      }
    });
  } catch (error) {
    console.error('Error in getTransitPoolWorkData:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});