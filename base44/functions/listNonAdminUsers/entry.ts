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
    console.log(`[TIMING] listNonAdminUsers | auth.me + User.filter (parallel): ${Date.now()-t0}ms`);

    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const userRecords = earlyUserRecords ?? await base44.asServiceRole.entities.User.filter({ email: user.email });

    if (!userRecords || userRecords.length === 0) {
      return Response.json({ error: 'User record not found' }, { status: 404 });
    }

    const tenantId = userRecords[0].tenant_id;
    const isPlatformAdmin = user.role === 'platform_admin';
    const isTenantAdmin = user.role === 'admin' || user.role === 'tenant_admin';
    const isStaff = user.role === 'staff';

    if (!isPlatformAdmin && !isTenantAdmin && !isStaff) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const filter = (isPlatformAdmin || !tenantId) ? {} : { tenant_id: tenantId };

    const t3 = Date.now();
    const allUsers = await base44.asServiceRole.entities.User.filter(filter);
    console.log(`[TIMING] listNonAdminUsers | User.filter (all users): ${Date.now()-t3}ms | count: ${allUsers?.length}`);
    console.log(`[TIMING] listNonAdminUsers | TOTAL: ${Date.now()-t0}ms`);

    const nonAdmins = (allUsers || [])
      .filter(u => u.email !== user.email)
      .map(u => ({
        id: u.id, email: u.email, full_name: u.full_name || '',
        role: u.role || 'user', tenant_id: u.tenant_id || null, created_date: u.created_date
      }));

    return Response.json({ users: nonAdmins });
  } catch (error) {
    console.error(`[TIMING] listNonAdminUsers | TOTAL (error): ${Date.now()-t0}ms`);
    console.error('listNonAdminUsers error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});