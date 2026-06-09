import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Update transit location request with arrival confirmation or shipment info.
 * Supports both GroupBuyRequest (new) and ShippingPool (legacy) data structures.
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
      request_id,
      request_ids,
      pool_id, 
      pool_ids, 
      action, 
      transit_arrival_image_urls, 
      transit_arrival_note,
      transit_shipped_date,
      transit_tracking_number,
      transit_fee_jpy,
      transit_shipping_method,
    } = body;

    // Support both new (request_id) and legacy (pool_id) parameters
    const targetRequestIds = request_ids || (request_id ? [request_id] : []);
    const targetPoolIds = pool_ids || (pool_id ? [pool_id] : []);

    if (targetRequestIds.length === 0 && targetPoolIds.length === 0) {
      return Response.json({ error: 'Missing request_id, request_ids, pool_id, or pool_ids' }, { status: 400 });
    }

    // Handle GroupBuyRequest updates
    if (targetRequestIds.length > 0) {
      const requests = await base44.asServiceRole.entities.GroupBuyRequest.filter({
        id: targetRequestIds
      });

      if (!requests || requests.length === 0) {
        return Response.json({ error: 'Requests not found' }, { status: 404 });
      }

      // Get transit locations to check authorization
      const transitLocationIds = [...new Set(requests.map(r => r.transit_location_id).filter(Boolean))];
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

      // Update requests based on action
      const updateData = {};
      
      if (action === 'confirm_arrival') {
        updateData.transit_arrival_image_urls = transit_arrival_image_urls || [];
        updateData.transit_arrival_note = transit_arrival_note || '';
        updateData.transit_arrival_confirmed_by = user.email;
        updateData.transit_arrival_confirmed_at = new Date().toISOString();
      } else if (action === 'confirm_forward') {
        updateData.transit_shipped_date = transit_shipped_date || new Date().toISOString().split('T')[0];
        if (transit_tracking_number) {
          updateData.transit_tracking_number = transit_tracking_number;
        }
        if (transit_fee_jpy !== undefined) {
          updateData.transit_fee_jpy = transit_fee_jpy;
        }
        if (transit_shipping_method) {
          updateData.transit_shipping_method = transit_shipping_method;
        }
      }

      // Perform updates
      const updatePromises = targetRequestIds.map(id => 
        base44.asServiceRole.entities.GroupBuyRequest.update(id, updateData)
      );

      await Promise.all(updatePromises);

      return Response.json({ 
        success: true, 
        updated_count: targetRequestIds.length 
      });
    }

    // Handle legacy ShippingPool updates (for backward compatibility)
    if (targetPoolIds.length > 0) {
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
        if (transit_tracking_number) {
          updateData.transit_forward_tracking_number = transit_tracking_number;
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
    }

  } catch (error) {
    console.error('updateTransitLocationPool error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});