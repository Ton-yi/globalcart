import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { pool_id, user_email, address_group_idx, shipping_data } = await req.json();
    
    if (!pool_id || !user_email || !address_group_idx) {
      return Response.json({ error: 'pool_id, user_email, and address_group_idx are required' }, { status: 400 });
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

    // Update or create address group shipping info
    const addressGroupData = transitShippingInfoPerUser[userShippingInfoIndex].address_groups || [];
    
    // Update the specific address group
    addressGroupData[address_group_idx] = {
      ...addressGroupData[address_group_idx],
      ...shipping_data,
      updated_at: new Date().toISOString(),
      updated_by: user.email
    };

    transitShippingInfoPerUser[userShippingInfoIndex].address_groups = addressGroupData;

    // Update pool with new transit_shipping_info_per_user
    await base44.entities.ShippingPool.update(pool_id, {
      transit_shipping_info_per_user: transitShippingInfoPerUser
    });

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