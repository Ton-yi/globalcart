import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Update transit location pool with arrival confirmation or shipment info.
 * Only accessible by transit location managers or admins.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { 
      pool_id, 
      pool_ids, 
      action, 
      transit_arrival_image_urls, 
      transit_arrival_note,
      transit_shipped_date,
      transit_forward_tracking_number,
    } = body;

    if (!pool_id && !pool_ids) {
      return Response.json({ error: 'Missing pool_id or pool_ids' }, { status: 400 });
    }

    const targetPoolIds = pool_ids || [pool_id];

    // Verify user is authorized (transit manager or admin)
    const pools = await base44.asServiceRole.entities.ShippingPool.filter({
      id: targetPoolIds
    });

    if (!pools || pools.length === 0) {
      return Response.json({ error: 'Pools not found' }, { status: 404 });
    }

    // Get transit locations to check authorization
    const transitLocationIds = [...new Set(pools.map(p => p.transit_location_id).filter(Boolean))];
    const locations = await base44.asServiceRole.entities.TransitLocation.filter({
      id: transitLocationIds
    });

    const locationEmails = locations.map(l => l.manager_email);
    const isAdmin = user.role === 'admin' || user.role === 'tenant_admin' || user.role === 'platform_admin';
    
    if (!isAdmin && !locationEmails.includes(user.email)) {
      return Response.json({ 
        error: 'Forbidden: Not authorized for these transit locations' 
      }, { status: 403 });
    }

    // Update pools based on action
    const updateData = {};
    
    if (action === 'confirm_arrival') {
      updateData.transit_arrival_image_urls = transit_arrival_image_urls || [];
      updateData.transit_arrival_note = transit_arrival_note || '';
      updateData.transit_arrival_confirmed_by = user.email;
      updateData.transit_arrival_confirmed_at = new Date().toISOString();
    } else if (action === 'confirm_forward') {
      updateData.transit_shipped_date = transit_shipped_date || new Date().toISOString().split('T')[0];
      if (transit_forward_tracking_number) {
        updateData.transit_forward_tracking_number = transit_forward_tracking_number;
      }
    }

    // Perform updates
    const updatePromises = targetPoolIds.map(id => 
      base44.asServiceRole.entities.ShippingPool.update(id, updateData)
    );

    await Promise.all(updatePromises);

    return Response.json({ 
      success: true, 
      updated_count: targetPoolIds.length 
    });

  } catch (error) {
    console.error('updateTransitLocationPool error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});