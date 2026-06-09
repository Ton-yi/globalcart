import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * updateTransitPoolShipment - 更新中转地发货信息
 * 支持 GroupBuyRequest (新) 和 ShippingPool (旧) 两种数据结构
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
      pool_id,
      transit_shipping_method,
      transit_tracking_number,
      transit_fee_jpy,
      transit_note,
      transit_image_urls,
      transit_shipped_date
    } = body;
    
    // Support both new (request_id) and legacy (pool_id) parameters
    if (!request_id && !pool_id) {
      return Response.json({ error: 'request_id or pool_id is required' }, { status: 400 });
    }

    // Handle GroupBuyRequest updates (new)
    if (request_id) {
      const request = await base44.asServiceRole.entities.GroupBuyRequest.get(request_id);
      if (!request) {
        return Response.json({ error: 'Request not found' }, { status: 404 });
      }

      // Verify user is transit location manager or admin
      if (request.transit_location_id) {
        const location = await base44.asServiceRole.entities.TransitLocation.get(request.transit_location_id);
        if (location && user.email !== location.manager_email && user.role !== 'admin' && user.role !== 'platform_admin') {
          return Response.json({ error: 'Forbidden: Not authorized' }, { status: 403 });
        }
      } else if (user.role !== 'admin' && user.role !== 'platform_admin') {
        return Response.json({ error: 'Forbidden: Not authorized' }, { status: 403 });
      }

      // Update request with transit shipment info
      const updatedRequest = await base44.asServiceRole.entities.GroupBuyRequest.update(request_id, {
        transit_shipping_method,
        transit_tracking_number,
        transit_fee_jpy: transit_fee_jpy || 0,
        transit_note,
        transit_image_urls: transit_image_urls || [],
        transit_shipped_date: transit_shipped_date || new Date().toISOString().split('T')[0],
        transit_shipped_by: user.email
      });

      return Response.json({
        success: true,
        request: updatedRequest
      });
    }

    // Handle ShippingPool updates (legacy)
    if (pool_id) {
      const pool = await base44.asServiceRole.entities.ShippingPool.get(pool_id);
      if (!pool) {
        return Response.json({ error: 'Pool not found' }, { status: 404 });
      }

      // Verify user is transit location manager or admin
      if (pool.transit_location_id) {
        const location = await base44.asServiceRole.entities.TransitLocation.get(pool.transit_location_id);
        if (location && user.email !== location.manager_email && user.role !== 'admin' && user.role !== 'platform_admin') {
          return Response.json({ error: 'Forbidden: Not authorized' }, { status: 403 });
        }
      } else if (user.role !== 'admin' && user.role !== 'platform_admin') {
        return Response.json({ error: 'Forbidden: Not authorized' }, { status: 403 });
      }

      // Update pool with transit shipment info
      const updatedPool = await base44.asServiceRole.entities.ShippingPool.update(pool_id, {
        transit_shipping_method,
        transit_tracking_number,
        transit_fee_jpy: transit_fee_jpy || 0,
        transit_note,
        transit_image_urls: transit_image_urls || [],
        transit_shipped_date: transit_shipped_date || new Date().toISOString().split('T')[0],
        transit_shipped_by: user.email
      });

      // Update all orders in this pool to mark them as transit shipped
      if (pool.order_ids && pool.order_ids.length > 0) {
        const updatePromises = pool.order_ids.map(orderId => 
          base44.asServiceRole.entities.Order.update(orderId, {
            transit_shipped_date: new Date().toISOString(),
            transit_tracking_number,
            transit_shipping_method
          }).catch(e => console.error(`Failed to update order ${orderId}:`, e))
        );
        await Promise.all(updatePromises);
      }

      return Response.json({
        success: true,
        pool: updatedPool
      });
    }

  } catch (error) {
    console.error('Error in updateTransitPoolShipment:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});