import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Get tenant context from authenticated user
    const userRecord = await base44.asServiceRole.entities.User.filter({ email: user.email });
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

    // Platform admins see all users; tenant admins with no tenant see all (degraded diagnostic mode)
    const filter = (isPlatformAdmin || !tenantId) ? {} : { tenant_id: tenantId };
    const allUsers = await base44.asServiceRole.entities.User.filter(filter);
    const nonAdmins = (allUsers || [])
      .filter(u => u.email !== user.email)
      .map(u => ({ id: u.id, email: u.email, full_name: u.full_name || '', role: u.role || 'user', tenant_id: u.tenant_id || null, created_date: u.created_date }));

    return Response.json({ users: nonAdmins });
  } catch (error) {
    console.error('listNonAdminUsers error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});