import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function extractEmailFromJwt(req) {
  try {
    const auth = req.headers.get('authorization') || '';
    const token = auth.replace(/^Bearer\s+/i, '');
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload?.email || payload?.sub || null;
  } catch {
    return null;
  }
}

/**
 * Get transit location work page data.
 * Only accessible by transit location managers.
 * Filters pools by transit_location_id and manager_email.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let transitLocationId;
    
    // Get transit_location_id from request body (JSON payload)
    if (req.method === 'POST' && req.body) {
      const body = await req.json();
      transitLocationId = body.transit_location_id;
    }
    
    // Fallback to query params
    if (!transitLocationId) {
      const url = new URL(req.url);
      transitLocationId = url.searchParams.get('transit_location_id');
    }

    if (!transitLocationId) {
      return Response.json({ error: 'Missing transit_location_id' }, { status: 400 });
    }

    // Fetch transit location to verify user is manager
    const locations = await base44.asServiceRole.entities.TransitLocation.filter({ 
      id: transitLocationId 
    });
    
    if (!locations || locations.length === 0) {
      return Response.json({ error: 'Transit location not found' }, { status: 404 });
    }

    const location = locations[0];
    
    // Check if user is the manager
    const isManager = location.manager_email === user.email;
    const isAdmin = user.role === 'admin' || user.role === 'tenant_admin' || user.role === 'platform_admin';
    
    if (!isManager && !isAdmin) {
      return Response.json({ error: 'Forbidden: Not authorized for this transit location' }, { status: 403 });
    }

    // Fetch GroupBuyRequests AND ShippingPools for this transit location
    const filter = {
      tenant_id: location.tenant_id,
      transit_location_id: transitLocationId
    };

    console.log('[getTransitLocationWorkPageData] Fetching data for transit_location_id:', transitLocationId);
    console.log('[getTransitLocationWorkPageData] Location tenant_id:', location.tenant_id);
    console.log('[getTransitLocationWorkPageData] User email:', user.email);
    console.log('[getTransitLocationWorkPageData] Is manager:', location.manager_email === user.email);
    
    const [allGroupBuyRequests, allShippingPools] = await Promise.all([
      base44.asServiceRole.entities.GroupBuyRequest.filter(filter),
      base44.asServiceRole.entities.ShippingPool.filter(filter),
    ]);
    
    console.log('[getTransitLocationWorkPageData] GroupBuyRequests:', allGroupBuyRequests?.length || 0);
    console.log('[getTransitLocationWorkPageData] ShippingPools:', allShippingPools?.length || 0);
    console.log('[getTransitLocationWorkPageData] Combined requests:', (allGroupBuyRequests?.length || 0) + (allShippingPools?.length || 0));
    
    // Combine both arrays for unified handling
    const requests = [...(allGroupBuyRequests || []), ...(allShippingPools || [])]
      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    
    console.log('[getTransitLocationWorkPageData] Found', requests.length, 'requests for transit location', transitLocationId);

    // Fetch entries for GroupBuyRequests
    const groupBuyRequestIds = (allGroupBuyRequests || []).map(r => r.id);
    let allEntries = [];
    if (groupBuyRequestIds.length > 0) {
      allEntries = await base44.asServiceRole.entities.GroupBuyEntry.filter({ 
        request_id: { $in: groupBuyRequestIds }
      });
    }
    
    // Group entries by request_id (only for GroupBuyRequests)
    const entriesByRequest = {};
    groupBuyRequestIds.forEach(rid => { entriesByRequest[rid] = []; });
    (allEntries || []).forEach(entry => {
      if (entriesByRequest[entry.request_id]) {
        entriesByRequest[entry.request_id].push(entry);
      }
    });
    
    // Fetch all orders for ShippingPools (to get user_email/user_name per order)
    const shippingPoolOrderIds = [];
    (allShippingPools || []).forEach(pool => {
      if (pool.order_ids && pool.order_ids.length > 0) {
        shippingPoolOrderIds.push(...pool.order_ids);
      }
    });
    
    const ordersById = {};
    if (shippingPoolOrderIds.length > 0) {
      const fetchedOrders = [];
      for (const orderId of shippingPoolOrderIds) {
        try {
          const order = await base44.asServiceRole.entities.Order.get(orderId);
          if (order) fetchedOrders.push(order);
        } catch (e) {
          console.error(`[getTransitLocationWorkPageData] Failed to fetch order ${orderId}:`, e);
        }
      }
      fetchedOrders.forEach(o => { ordersById[o.id] = o; });
    }
    
    // Enrich requests with entry counts and totals
    const enrichedRequests = requests.map(request => {
      const isRequest = !!request.title; // GroupBuyRequest has title, ShippingPool has pool_code
      const entries = entriesByRequest[request.id] || [];
      
      if (isRequest) {
        // GroupBuyRequest
        return {
          ...request,
          entry_count: entries.length,
          active_entry_count: entries.filter(e => e.status === 'active').length,
          completed_entry_count: entries.filter(e => e.status === 'completed').length,
          entries: entries,
          order_count: entries.length,
        };
      } else {
        // ShippingPool - build entries from order_ids and per_user_groups
        const poolOrderIds = request.order_ids || [];
        const perUserGroups = request.per_user_groups || [];
        
        // Build a map: order_id -> which per_user_groups entry it belongs to
        const orderGroupMap = {};
        for (const userGroup of perUserGroups) {
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
                  transit_shipping_method_id: ag.transit_shipping_method_id,
                  selected_addon_ids: ag.selected_addon_ids || [],
                  selected_addons: ag.selected_addons || [],
                  note: ag.note || userGroup.note,
                };
              });
            });
          } else {
            // Flat per_user_groups structure
            (userGroup.order_entries || []).forEach(oe => {
              orderGroupMap[oe.order_id] = {
                user_email: userGroup.user_email,
                user_name: userGroup.user_name,
                group_label: userGroup.group_label,
                group_index: 0,
                group_final_address: oe.override_final_address || userGroup.group_final_address,
                transit_shipping_method: userGroup.transit_shipping_method,
                transit_shipping_method_id: oe.transit_shipping_method_id || userGroup.transit_shipping_method_id,
                selected_addon_ids: oe.selected_addon_ids || userGroup.selected_addon_ids || [],
                selected_addons: oe.selected_addons || userGroup.selected_addons || [],
                note: oe.note || userGroup.note,
              };
            });
          }
        }
        
        // Build entries from orders
        const poolEntries = poolOrderIds.map(orderId => {
          const order = ordersById[orderId];
          const groupInfo = orderGroupMap[orderId];
          return {
            id: `order_${orderId}`,
            order_id: orderId,
            status: 'active',
            product_name: order?.product_name || '包裹',
            user_email: groupInfo?.user_email || order?.user_email || request.creator_email,
            user_name: groupInfo?.user_name || order?.user_name || request.creator_name,
            group_label: groupInfo?.group_label,
            group_index: groupInfo?.group_index ?? 0,
            group_final_address: groupInfo?.group_final_address,
            transit_shipping_method: groupInfo?.transit_shipping_method,
            transit_shipping_method_id: groupInfo?.transit_shipping_method_id,
            selected_addon_ids: groupInfo?.selected_addon_ids || [],
            selected_addons: groupInfo?.selected_addons || [],
            note: groupInfo?.note,
            estimated_jpy: order?.estimated_jpy || 0,
            weight_g: order?.weight_g || 100,
            order_details: order || null,
          };
        });
        
        return {
          ...request,
          entry_count: poolEntries.length,
          active_entry_count: poolEntries.length,
          completed_entry_count: 0,
          entries: poolEntries,
          order_count: poolOrderIds.length,
        };
      }
    });
    
    // Fetch related data
    const [transitMethods, addonOptions] = await Promise.all([
      base44.asServiceRole.entities.TransitShippingMethod.filter({ tenant_id: location.tenant_id }),
      base44.asServiceRole.entities.AddonOption.filter({ tenant_id: location.tenant_id, addon_type: 'shipping' }),
    ]);

    return Response.json({
      location,
      requests: enrichedRequests,
      transitMethods: (transitMethods || []).filter(m => m.is_active !== false),
      addonOptions: (addonOptions || []).filter(a => a.is_active !== false),
      isManager,
      isAdmin,
    });

  } catch (error) {
    console.error('getTransitLocationWorkPageData error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});