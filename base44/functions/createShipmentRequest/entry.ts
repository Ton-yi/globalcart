import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Create a ShipmentRequest for user shipping notification
 * Called when user submits "通知发货" (notify shipment)
 * Updates all related orders to shipping_request_status = "draft"
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
      order_ids,
      shipping_method,
      consolidation_requested,
      consolidation_deadline,
      consolidation_min_weight_g,
      consolidation_timeout_action,
      consolidation_type,
      transit_location_id,
      final_address_id,
      selected_addon_ids = [],
      remark,
    } = body;

    if (!Array.isArray(order_ids) || order_ids.length === 0) {
      return Response.json({ error: 'order_ids required and non-empty' }, { status: 400 });
    }

    // Get user record for tenant_id
    const userRecords = await base44.asServiceRole.entities.User.filter({ email: user.email });
    if (!userRecords || userRecords.length === 0) {
      return Response.json({ error: 'User record not found' }, { status: 404 });
    }

    const tenantId = userRecords[0].tenant_id;
    if (!tenantId && user.role !== 'platform_admin') {
      return Response.json({ error: 'User has no tenant assigned' }, { status: 403 });
    }

    // Create ShipmentRequest
    const shipmentRequest = await base44.asServiceRole.entities.ShipmentRequest.create({
      tenant_id: tenantId,
      creator_user_id: user.email,
      request_type: consolidation_requested ? 'pooled_shipment' : 'single_shipment',
      destination_type: consolidation_type === 'transit' ? 'transit_location' : 
                       consolidation_type === 'other' ? 'other_address' : 'other_address',
      destination_address_id: consolidation_type !== 'transit' ? final_address_id : '',
      transit_location_id: consolidation_type === 'transit' ? transit_location_id : '',
      selected_shipping_method: shipping_method,
      customs_declaration_mode: 'user_fill',
      shipping_request_status: 'draft',
      user_confirmed_quote: false,
      remark,
      legacy_order_id: order_ids.length === 1 ? order_ids[0] : null,
    });

    // Update all related orders to point to new shipping request
    // Mark order_status as "shipping_request_created" to indicate new workflow
    await Promise.all(
      order_ids.map(orderId =>
        base44.asServiceRole.entities.Order.update(orderId, {
          order_status: 'shipping_request_created',
        })
      )
    );

    return Response.json({
      success: true,
      shipment_request: shipmentRequest,
    });

  } catch (error) {
    console.error('createShipmentRequest error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});