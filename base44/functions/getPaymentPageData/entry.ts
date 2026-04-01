import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { order_id } = body;
    if (!order_id) return Response.json({ error: 'Missing order_id' }, { status: 400 });

    // Resolve tenant via user record
    const userRecords = await base44.asServiceRole.entities.User.filter({ email: user.email });
    const userRecord = userRecords?.[0];
    const tenantId = userRecord?.tenant_id || null;

    // Fetch order by user_email + tenant_id for safety (avoids id-filter SDK limitation)
    const [allOrders, siteSettings] = await Promise.all([
      base44.asServiceRole.entities.Order.filter(
        tenantId ? { tenant_id: tenantId, user_email: user.email } : { user_email: user.email }
      ),
      tenantId
        ? base44.asServiceRole.entities.SiteSettings.filter({ tenant_id: tenantId })
        : base44.asServiceRole.entities.SiteSettings.list(),
    ]);

    const order = (allOrders || []).find(o => o.id === order_id);
    if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });

    // Admin can also access
    const isAdmin = user.role === 'admin' || user.role === 'platform_admin' || user.role === 'tenant_admin';
    if (!isAdmin && order.user_email !== user.email) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const settings = {};
    (siteSettings || []).forEach(s => { settings[s.key] = s.value; });

    return Response.json({ order, settings });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});