import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { pool_code } = await req.json();
    
    if (!pool_code) {
      return Response.json({ error: 'pool_code is required' }, { status: 400 });
    }

    // Fetch pool data by pool_code with tenant isolation
    const allPools = await base44.asServiceRole.entities.ShippingPool.filter({});
    const pool = allPools.find(p => p.pool_code === pool_code);
    if (!pool) {
      return Response.json({ error: 'Pool not found' }, { status: 404 });
    }

    // Verify user is transit location manager
    if (!pool.transit_location_id) {
      return Response.json({ error: 'This pool is not assigned to a transit location' }, { status: 403 });
    }

    const location = await base44.entities.TransitLocation.get(pool.transit_location_id);
    if (!location) {
      return Response.json({ error: 'Transit location not found' }, { status: 404 });
    }

    // Check if user is the assigned manager
    if (user.email !== location.manager_email && user.role !== 'admin' && user.role !== 'platform_admin') {
      return Response.json({ error: 'Forbidden: Not the assigned transit location manager' }, { status: 403 });
    }

    // Fetch orders in this pool
    const orders = [];
    console.log('[getTransitPoolWorkData] Pool', pool.pool_code, 'order_ids:', pool.order_ids);
    if (pool.order_ids && pool.order_ids.length > 0) {
      for (const orderId of pool.order_ids) {
        try {
          const order = await base44.asServiceRole.entities.Order.get(orderId);
          if (order) orders.push(order);
        } catch (e) {
          console.error(`Failed to fetch order ${orderId}:`, e);
        }
      }
    }
    console.log('[getTransitPoolWorkData] Fetched', orders.length, 'orders for pool', pool.pool_code);

    // Fetch all orders to enrich per_user_groups with product details
    const allOrderIds = new Set(pool.order_ids || []);
    pool.per_user_groups?.forEach(group => {
      group.order_entries?.forEach(entry => {
        if (entry.order_id) {
          allOrderIds.add(entry.order_id);
        }
      });
    });

    const allOrdersMap = {};
    for (const orderId of allOrderIds) {
      try {
        const order = await base44.asServiceRole.entities.Order.get(orderId);
        if (order) {
          allOrdersMap[orderId] = order;
        }
      } catch (e) {
        console.error(`Failed to fetch order ${orderId}:`, e);
      }
    }

    // Enrich per_user_groups order_entries with product details from orders
    if (pool.per_user_groups) {
      pool.per_user_groups.forEach(group => {
        if (group.order_entries) {
          group.order_entries.forEach(entry => {
            const order = allOrdersMap[entry.order_id];
            if (order) {
              entry.product_name = order.product_name;
              entry.product_description = order.product_description;
              entry.product_image_url = order.product_image_url;
              entry.arrival_photo_url = order.arrival_photo_url;
              entry.purchase_screenshot_url = order.purchase_screenshot_url;
              entry.note = entry.note || order.user_note || '';
              // Merge images from order
              const orderImages = [order.product_image_url, order.arrival_photo_url, order.purchase_screenshot_url].filter(Boolean);
              if (orderImages.length > 0) {
                entry.image_urls = [...new Set([...(entry.image_urls || []), ...orderImages])];
              }
            }
          });
        }
      });
    }

    // Fetch transit shipping methods (filter out disabled ones)
    const allTransitMethods = await base44.asServiceRole.entities.TransitShippingMethod.filter({ 
      tenant_id: pool.tenant_id,
      is_active: true 
    });
    
    const transitMethods = allTransitMethods.filter(m => 
      !location.disabled_transit_method_ids?.includes(m.id)
    );

    // Get user's preferred transit shipping method from orders
    const preferredTransitMethodId = orders.find(o => o.pre_shipment?.transit_shipping_method_id)?.pre_shipment?.transit_shipping_method_id;

    return Response.json({
      pool,
      location,
      orders,
      transitMethods,
      preferredTransitMethodId,
      debug: {
        order_ids_count: pool.order_ids?.length || 0,
        orders_fetched: orders.length,
        transitMethods_count: transitMethods.length,
        preferredTransitMethodId
      }
    });
  } catch (error) {
    console.error('Error in getTransitPoolWorkData:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});