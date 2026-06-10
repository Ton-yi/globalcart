import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { pool_id, user_email, order_ids, shipping_data } = await req.json();
    
    if (!pool_id || !user_email || !order_ids || !Array.isArray(order_ids) || order_ids.length === 0) {
      return Response.json({ error: 'pool_id, user_email, and order_ids array are required' }, { status: 400 });
    }

    // Fetch pool data
    const pool = await base44.entities.ShippingPool.get(pool_id);
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

    // Find the user group in per_user_groups
    const userGroupIndex = pool.per_user_groups?.findIndex(g => g.user_email === user_email);
    if (userGroupIndex === -1 || userGroupIndex === undefined) {
      return Response.json({ error: 'User group not found in pool' }, { status: 404 });
    }

    // Initialize transit_shipping_info_per_user if not exists
    const transitShippingInfoPerUser = pool.transit_shipping_info_per_user || [];
    
    // Find or create user's shipping info entry
    let userShippingInfoIndex = transitShippingInfoPerUser.findIndex(info => info.user_email === user_email);
    
    if (userShippingInfoIndex === -1) {
      // Create new entry for this user
      transitShippingInfoPerUser.push({
        user_email,
        user_name: pool.per_user_groups[userGroupIndex]?.user_name || '',
        address_groups: []
      });
      userShippingInfoIndex = transitShippingInfoPerUser.length - 1;
    }

    // Find or create address group based on order_ids
    const userShippingInfo = transitShippingInfoPerUser[userShippingInfoIndex];
    if (!userShippingInfo.address_groups) {
      userShippingInfo.address_groups = [];
    }

    // Find existing address group that contains any of these orders
    let addressGroupIndex = -1;
    for (let i = 0; i < userShippingInfo.address_groups.length; i++) {
      const group = userShippingInfo.address_groups[i];
      const groupOrderIds = group.order_ids || [];
      
      // Check if there's overlap (at least one order matches)
      if (order_ids.some(id => groupOrderIds.includes(id))) {
        addressGroupIndex = i;
        break;
      }
    }

    // If no matching group found, create a new one
    if (addressGroupIndex === -1) {
      addressGroupIndex = userShippingInfo.address_groups.length;
      userShippingInfo.address_groups.push({
        order_ids: [],
        ...shipping_data
      });
    }

    // Update the address group with new shipping data and order_ids
    userShippingInfo.address_groups[addressGroupIndex] = {
      ...userShippingInfo.address_groups[addressGroupIndex],
      ...shipping_data,
      order_ids: order_ids, // Store the order IDs for this group
      updated_at: new Date().toISOString(),
      updated_by: user.email
    };

    transitShippingInfoPerUser[userShippingInfoIndex] = userShippingInfo;

    // Update pool with new transit_shipping_info_per_user
    await base44.entities.ShippingPool.update(pool_id, {
      transit_shipping_info_per_user: transitShippingInfoPerUser
    });

    // If a tracking number is provided, update each order to "transit_shipped" status
    // and write transit info directly onto the order for easy user-facing display
    if (shipping_data?.transit_tracking_number) {
      await Promise.all(order_ids.map(orderId =>
        base44.asServiceRole.entities.Order.update(orderId, {
          order_status: 'transit_shipped',
          transit_tracking_number: shipping_data.transit_tracking_number,
          transit_shipping_method: shipping_data.transit_shipping_method || '',
          transit_shipped_date: shipping_data.transit_shipped_date || new Date().toISOString().split('T')[0],
          transit_note: shipping_data.transit_note || '',
          // Store image urls as JSON string for order-level display
          transit_image_urls: shipping_data.transit_image_urls || [],
        }).catch(e => console.error(`Failed to update order ${orderId}:`, e))
      ));
    }

    return Response.json({ 
      success: true, 
      message: 'Shipping info updated successfully',
      updated_info: transitShippingInfoPerUser[userShippingInfoIndex]
    });
  } catch (error) {
    console.error('Error in updateUserTransitShipping:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});