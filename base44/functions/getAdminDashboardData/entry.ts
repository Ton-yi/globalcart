import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

function extractEmailFromJwt(req) {
  try {
    const auth = req.headers.get('authorization') || '';
    const token = auth.replace(/^Bearer\s+/i, '');
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload?.email || payload?.sub || null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  const t0 = Date.now();
  try {
    const base44 = createClientFromRequest(req);

    const emailHint = extractEmailFromJwt(req);
    const [user, earlyUserRecords] = await Promise.all([
      base44.auth.me(),
      emailHint
        ? base44.asServiceRole.entities.User.filter({ email: emailHint })
        : Promise.resolve(null),
    ]);

    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const userRecords = earlyUserRecords ?? await base44.asServiceRole.entities.User.filter({ email: user.email });
    const userRecord = userRecords?.[0];
    const tenantId = userRecord?.tenant_id;
    const isPlatformAdmin = userRecord?.role === 'platform_admin';

    const orderFilter = isPlatformAdmin ? {} : (tenantId ? { tenant_id: tenantId } : null);
    const userFilter = isPlatformAdmin ? {} : (tenantId ? { tenant_id: tenantId } : null);

    if (!orderFilter) {
      console.log(`[TIMING] getAdminDashboardData | no tenant, returning empty | ${Date.now()-t0}ms`);
      return Response.json({ orders: [], users: [] });
    }

    const [allUsers, orders] = await Promise.all([
      base44.asServiceRole.entities.User.filter(userFilter),
      base44.asServiceRole.entities.Order.filter(orderFilter),
    ]);

    // Exclude admins from user count (mirrors listNonAdminUsers logic)
    const nonAdminRoles = ['user', 'staff', 'transit_manager'];
    const users = (allUsers || []).filter(u =>
      u.email !== user.email && nonAdminRoles.includes(u.role)
    );

    console.log(`[TIMING] getAdminDashboardData | TOTAL: ${Date.now()-t0}ms`);
    return Response.json({ orders: orders || [], users });

  } catch (error) {
    console.error(`[TIMING] getAdminDashboardData | error: ${Date.now()-t0}ms`, error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});