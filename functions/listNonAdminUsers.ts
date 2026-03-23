import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  const t0 = Date.now();
  try {
    const base44 = createClientFromRequest(req);

    const t1 = Date.now();
    const user = await base44.auth.me();
    console.log(`[TIMING] listNonAdminUsers | auth.me: ${Date.now()-t1}ms`);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const t2 = Date.now();
    const userRecord = await base44.asServiceRole.entities.User.filter({ email: user.email });
    console.log(`[TIMING] listNonAdminUsers | User.filter (tenant lookup): ${Date.now()-t2}ms`);

    if (!userRecord || userRecord.length === 0) {
      return Response.json({ error: 'User record not found' }, { status: 404 });
    }

    const tenantId = userRecord[0].tenant_id;
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
      .map(u => ({ id: u.id, email: u.email, full_name: u.full_name || '', role: u.role || 'user', tenant_id: u.tenant_id || null, created_date: u.created_date }));

    return Response.json({ users: nonAdmins });
  } catch (error) {
    console.error(`[TIMING] listNonAdminUsers | TOTAL (error): ${Date.now()-t0}ms`);
    console.error('listNonAdminUsers error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});