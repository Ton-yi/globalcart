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
      request_id,
      action,
      time_slot,
      accept 
    } = await req.json();
    
    // Support both ShippingPool (pool_id) and GroupBuyRequest (request_id)
    const targetId = request_id || pool_id;
    if (!targetId) {
      return Response.json({ error: 'pool_id or request_id is required' }, { status: 400 });
    }

    // Try to fetch as GroupBuyRequest first, then as ShippingPool
    let pool = await base44.asServiceRole.entities.GroupBuyRequest.get(targetId);
    let isRequest = true;
    if (!pool) {
      pool = await base44.asServiceRole.entities.ShippingPool.get(targetId);
      isRequest = false;
    }
    
    if (!pool) {
      return Response.json({ error: 'Pool/Request not found' }, { status: 404 });
    }

    // Verify transit location manager or admin
    let location;
    if (pool.transit_location_id) {
      location = await base44.asServiceRole.entities.TransitLocation.get(pool.transit_location_id);
      if (location && user.email !== location.manager_email && user.role !== 'admin' && user.role !== 'platform_admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    let updateData = {};

    if (action === 'set_time_slot') {
      // Set pickup time slot (manager or admin)
      updateData = {
        transit_pickup_enabled: true,
        transit_pickup_time_slot: time_slot,
        transit_pickup_user_confirmed: false,
        transit_pickup_admin_confirmed: user.role === 'admin' || user.role === 'platform_admin'
      };
    } else if (action === 'user_accept') {
      // User accepts proposed time slot
      updateData = {
        transit_pickup_user_confirmed: true
      };
    } else if (action === 'user_decline') {
      // User declines, reset confirmation
      updateData = {
        transit_pickup_user_confirmed: false,
        transit_pickup_admin_confirmed: false
      };
    } else if (action === 'admin_accept') {
      // Admin confirms user's acceptance
      updateData = {
        transit_pickup_admin_confirmed: true
      };
    } else if (action === 'mark_completed') {
      // Mark as picked up (admin/manager only)
      if (user.role !== 'admin' && user.role !== 'platform_admin' && user.email !== location?.manager_email) {
        return Response.json({ error: 'Forbidden: Admin/Manager only' }, { status: 403 });
      }
      updateData = {
        transit_pickup_completed: true,
        transit_pickup_completed_at: new Date().toISOString(),
        transit_shipped_date: new Date().toISOString(),
        transit_shipped_by: user.email
      };
    }

    // Update the appropriate entity
    if (isRequest) {
      await base44.asServiceRole.entities.GroupBuyRequest.update(targetId, updateData);
    } else {
      await base44.asServiceRole.entities.ShippingPool.update(targetId, updateData);
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error in manageTransitPickup:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});