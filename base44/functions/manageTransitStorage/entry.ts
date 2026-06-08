import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      pool_id,
      action,
      storage_until,
      target_pool_id,
      transit_shipping_method 
    } = await req.json();
    
    if (!pool_id) {
      return Response.json({ error: 'pool_id is required' }, { status: 400 });
    }

    const pool = await base44.entities.ShippingPool.get(pool_id);
    if (!pool) {
      return Response.json({ error: 'Pool not found' }, { status: 404 });
    }

    // Verify transit location manager or admin
    let location;
    if (pool.transit_location_id) {
      location = await base44.entities.TransitLocation.get(pool.transit_location_id);
      if (location && user.email !== location.manager_email && user.role !== 'admin' && user.role !== 'platform_admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    let updateData = {};

    if (action === 'enable_storage') {
      // Enable storage mode (admin/manager only)
      if (user.role !== 'admin' && user.role !== 'platform_admin' && user.email !== location?.manager_email) {
        return Response.json({ error: 'Forbidden: Admin/Manager only' }, { status: 403 });
      }
      updateData = {
        transit_storage_enabled: true,
        transit_storage_until: storage_until
      };
    } else if (action === 'release_to_pool') {
      // Release stored orders to a new pool (admin only)
      if (user.role !== 'admin' && user.role !== 'platform_admin') {
        return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });
      }
      updateData = {
        transit_storage_released_to_pool_id: target_pool_id,
        transit_shipped_date: new Date().toISOString(),
        transit_shipped_by: user.email
      };
      
      // Update orders to point to new pool
      if (pool.order_ids && pool.order_ids.length > 0) {
        const updatePromises = pool.order_ids.map(orderId => 
          base44.entities.Order.update(orderId, {
            consolidation_pool_id: target_pool_id
          }).catch(e => console.error(`Failed to update order ${orderId}:`, e))
        );
        await Promise.all(updatePromises);
      }
    } else if (action === 'change_to_shipping') {
      // Change from storage to shipping mode (user or admin)
      updateData = {
        transit_storage_enabled: false,
        transit_shipping_method: transit_shipping_method,
        transit_shipped_date: new Date().toISOString(),
        transit_shipped_by: user.email
      };
    }

    await base44.entities.ShippingPool.update(pool_id, updateData);

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error in manageTransitStorage:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});