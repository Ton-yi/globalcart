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
      time_slot
    } = await req.json();
    
    if (!pool_id) {
      return Response.json({ error: 'pool_id is required' }, { status: 400 });
    }

    const pool = await base44.asServiceRole.entities.ShippingPool.get(pool_id);
    if (!pool) {
      return Response.json({ error: 'Pool not found' }, { status: 404 });
    }

    // Verify user is creator or admin/manager
    const isCreator = user.email === pool.creator_email;
    const isAdmin = user.role === 'admin' || user.role === 'platform_admin';
    
    let isManager = false;
    if (pool.transit_location_id) {
      const location = await base44.asServiceRole.entities.TransitLocation.get(pool.transit_location_id);
      isManager = location && user.email === location.manager_email;
    }

    if (!isCreator && !isAdmin && !isManager) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    let updateData = {};

    if (action === 'schedule') {
      // Schedule pickup time (admin/manager/creator)
      if (!time_slot) {
        return Response.json({ error: 'time_slot is required' }, { status: 400 });
      }
      updateData = {
        transit_pickup_enabled: true,
        transit_pickup_time_slot: time_slot,
        transit_pickup_user_confirmed: false,
        transit_pickup_admin_confirmed: false,
        transit_pickup_completed: false
      };
    } else if (action === 'user_confirm') {
      // User confirms pickup time
      if (!isCreator) {
        return Response.json({ error: 'Forbidden: Creator only' }, { status: 403 });
      }
      updateData = {
        transit_pickup_user_confirmed: true
      };
    } else if (action === 'admin_confirm') {
      // Admin/manager confirms pickup time
      if (!isAdmin && !isManager) {
        return Response.json({ error: 'Forbidden: Admin/Manager only' }, { status: 403 });
      }
      updateData = {
        transit_pickup_admin_confirmed: true
      };
    } else if (action === 'complete') {
      // Mark as completed (admin/manager only)
      if (!isAdmin && !isManager) {
        return Response.json({ error: 'Forbidden: Admin/Manager only' }, { status: 403 });
      }
      updateData = {
        transit_pickup_completed: true,
        transit_shipped_date: new Date().toISOString(),
        transit_shipped_by: user.email
      };
    }

    await base44.asServiceRole.entities.ShippingPool.update(pool_id, updateData);

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error in updateTransitPoolPickup:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});