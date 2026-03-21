import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Update an order with tenant isolation verification
 * Ensures the user can only update orders within their tenant
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { order_id, ...updateData } = body;

    if (!order_id) {
      return Response.json({ error: 'Missing order_id' }, { status: 400 });
    }

    // Security: never allow changing tenant_id from client
    delete updateData.tenant_id;

    // Get user record and tenant_id
    const userRecord = await base44.asServiceRole.entities.User.filter({ email: user.email });
    if (!userRecord || userRecord.length === 0) {
      return Response.json({ error: 'User record not found' }, { status: 404 });
    }

    const tenantId = userRecord[0].tenant_id;
    if (!tenantId && user.role !== 'platform_admin') {
      return Response.json({ error: 'User has no tenant assigned' }, { status: 403 });
    }

    // Fetch order to verify ownership
    const orderResult = await base44.asServiceRole.entities.Order.filter({ id: order_id });
    const order = Array.isArray(orderResult) ? orderResult[0] : orderResult;

    if (!order) {
      return Response.json({ error: 'Order not found' }, { status: 404 });
    }

    // Verify tenant ownership
    if (user.role !== 'platform_admin' && order.tenant_id !== tenantId) {
      return Response.json({ error: 'Forbidden: Order does not belong to your tenant' }, { status: 403 });
    }

    // Verify user can update (own order, or is staff/admin)
    if (user.role === 'user' && order.user_email !== user.email) {
      return Response.json({ error: 'Forbidden: You can only update your own orders' }, { status: 403 });
    }

    // Update order
    const updatedOrder = await base44.asServiceRole.entities.Order.update(order_id, updateData);

    return Response.json({ 
      success: true,
      order: updatedOrder 
    });

  } catch (error) {
    console.error('updateTenantOrder error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});