import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Admin-only: diagnose and fix tenant_id assignment for users.
 * Actions:
 *   - "diagnose": list all users with missing tenant_id (platform_admin only)
 *   - "assign": set tenant_id on a specific user by email (platform_admin only)
 *   - "self_assign": assign own tenant_id to a specific user email (tenant admin, for their own tenant)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const isPlatformAdmin = user.role === 'platform_admin';
    const isTenantAdmin = user.role === 'admin' || user.role === 'tenant_admin';

    if (!isPlatformAdmin && !isTenantAdmin) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { action, target_email, tenant_id } = body;

    // Get caller's own record (needed for tenant_admin to know their tenant)
    const callerRecords = await base44.asServiceRole.entities.User.filter({ email: user.email });
    const callerRecord = callerRecords?.[0];
    const callerTenantId = callerRecord?.tenant_id || null;

    // ── diagnose: show users missing tenant_id ──────────────────────────────
    if (action === 'diagnose') {
      if (!isPlatformAdmin) {
        return Response.json({ error: 'Forbidden: platform_admin required for diagnose' }, { status: 403 });
      }
      const allUsers = await base44.asServiceRole.entities.User.list();
      const allTenants = await base44.asServiceRole.entities.Tenant.filter({ is_active: true });

      const missing = (allUsers || [])
        .filter(u => !u.tenant_id)
        .map(u => ({ id: u.id, email: u.email, full_name: u.full_name || '', role: u.role || 'user' }));

      return Response.json({
        missing_tenant_users: missing,
        total_users: (allUsers || []).length,
        tenants: (allTenants || []).map(t => ({ id: t.id, name: t.name, code: t.code })),
      });
    }

    // ── assign: platform_admin sets any user's tenant_id ───────────────────
    if (action === 'assign') {
      if (!isPlatformAdmin) {
        return Response.json({ error: 'Forbidden: platform_admin required for assign' }, { status: 403 });
      }
      if (!target_email || !tenant_id) {
        return Response.json({ error: 'Missing target_email or tenant_id' }, { status: 400 });
      }
      // Verify tenant exists
      const tenants = await base44.asServiceRole.entities.Tenant.filter({ id: tenant_id });
      if (!tenants?.[0]) {
        return Response.json({ error: 'Tenant not found' }, { status: 404 });
      }
      const targetRecords = await base44.asServiceRole.entities.User.filter({ email: target_email });
      const targetUser = targetRecords?.[0];
      if (!targetUser) {
        return Response.json({ error: 'Target user not found' }, { status: 404 });
      }
      await base44.asServiceRole.entities.User.update(targetUser.id, { tenant_id });
      return Response.json({ success: true, email: target_email, tenant_id });
    }

    // ── self_assign: tenant admin assigns their own tenant_id to a user ─────
    if (action === 'self_assign') {
      if (!callerTenantId) {
        return Response.json({ error: 'Caller has no tenant assigned — cannot self_assign' }, { status: 403 });
      }
      if (!target_email) {
        return Response.json({ error: 'Missing target_email' }, { status: 400 });
      }
      const targetRecords = await base44.asServiceRole.entities.User.filter({ email: target_email });
      const targetUser = targetRecords?.[0];
      if (!targetUser) {
        return Response.json({ error: 'Target user not found' }, { status: 404 });
      }
      // Only allow assigning to your own tenant (or if user has no tenant yet)
      if (targetUser.tenant_id && targetUser.tenant_id !== callerTenantId) {
        return Response.json({ error: 'Forbidden: Target user belongs to a different tenant' }, { status: 403 });
      }
      await base44.asServiceRole.entities.User.update(targetUser.id, { tenant_id: callerTenantId });
      return Response.json({ success: true, email: target_email, tenant_id: callerTenantId });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    console.error('adminAssignTenant error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});