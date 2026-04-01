import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { order_id } = body;
    if (!order_id) return Response.json({ error: 'Missing order_id' }, { status: 400 });

    // Resolve tenant
    const userRecords = await base44.asServiceRole.entities.User.filter({ email: user.email });
    const tenantId = userRecords?.[0]?.tenant_id;

    const [orders, siteSettings] = await Promise.all([
      base44.asServiceRole.entities.Order.filter({ id: order_id }),
      tenantId
        ? base44.asServiceRole.entities.SiteSettings.filter({ tenant_id: tenantId })
        : Promise.resolve([]),
    ]);

    const order = orders?.[0];
    if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });

    // Only allow the order owner (or admin) to access
    if (user.role === 'user' && order.user_email !== user.email) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const settings = {};
    (siteSettings || []).forEach(s => { settings[s.key] = s.value; });

    return Response.json({ order, settings });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});