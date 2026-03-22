import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Fetch orders for the current tenant with proper isolation.
 * Body/query: { all: bool } — admins/staff may request all tenant orders.
 * Users always see only their own. Platform admins see everything.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body = {};
    try { body = await req.json(); } catch { /* GET with no body */ }

    const userRecords = await base44.asServiceRole.entities.User.filter({ email: user.email });
    if (!userRecords || userRecords.length === 0) {
      return Response.json({ error: 'User record not found' }, { status: 404 });
    }

    const tenantId = userRecords[0].tenant_id;
    const isPlatformAdmin = user.role === 'platform_admin';
    const isTenantAdmin = user.role === 'admin' || user.role === 'tenant_admin';
    const isStaff = user.role === 'staff';
    const canSeeAll = isPlatformAdmin || isTenantAdmin || isStaff;

    if (isPlatformAdmin) {
      const allOrders = await base44.asServiceRole.entities.Order.list('-updated_date', 500);
      return Response.json({ orders: allOrders || [] });
    }

    if (!tenantId) {
      return Response.json({ error: 'User has no tenant assigned' }, { status: 403 });
    }

    let filter = { tenant_id: tenantId };
    // Regular users always scoped to themselves; admins/staff see all in tenant
    if (!canSeeAll) {
      filter.user_email = user.email;
    }

    const orders = await base44.asServiceRole.entities.Order.filter(filter, '-updated_date', 500);
    return Response.json({ orders: orders || [] });

  } catch (error) {
    console.error('getTenantOrders error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});