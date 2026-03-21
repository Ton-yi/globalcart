import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Fetch orders for the current tenant with proper isolation
 * Users see only their own orders; staff/admin see all orders in their tenant
 * Platform admins can see all orders across all tenants
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user record to find tenant_id
    const userRecord = await base44.asServiceRole.entities.User.filter({ email: user.email });
    if (!userRecord || userRecord.length === 0) {
      return Response.json({ error: 'User record not found' }, { status: 404 });
    }

    const tenantId = userRecord[0].tenant_id;
    
    // Platform admins can see all orders
    if (user.role === 'platform_admin') {
      const allOrders = await base44.asServiceRole.entities.Order.list();
      return Response.json({ orders: allOrders || [] });
    }

    // Non-platform users must have a tenant
    if (!tenantId) {
      return Response.json({ error: 'User has no tenant assigned' }, { status: 403 });
    }

    // Regular users see only their own orders
    // Staff and tenant admins see all orders in their tenant
    let filter = { tenant_id: tenantId };
    if (user.role === 'user') {
      filter.user_email = user.email;
    }

    const orders = await base44.asServiceRole.entities.Order.filter(filter);
    return Response.json({ orders: orders || [] });

  } catch (error) {
    console.error('getTenantOrders error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});