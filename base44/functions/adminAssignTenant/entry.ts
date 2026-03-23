import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Admin: diagnose and fix tenant_id assignment for users.
 * Actions:
 *   - "diagnose": list users with missing tenant_id
 *       platform_admin: sees ALL users
 *       tenant_admin (admin): sees only users with no tenant OR in their own tenant
 *   - "assign": set tenant_id on a specific user
 *       platform_admin: can assign any tenant to any user
 *       tenant_admin: can only assign their OWN tenant to a user with no tenant yet
 *   - "self_assign": assign own tenant_id to a specific user email (tenant admin)
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
      const allUsers = await base44.asServiceRole.entities.User.list();
      const allTenants = await base44.asServiceRole.entities.Tenant.filter({ is_active: true });

      let missingUsers = (allUsers || []).filter(u => !u.tenant_id);

      // Tenant admins without a tenant see ALL missing users (bootstrap mode)
      // Tenant admins WITH a tenant also see all missing users so they can assign their own tenant
      // Platform admins see everything — no restriction
      // (For security: the assign action still prevents tenant admins from assigning other tenants)

      const missing = missingUsers.map(u => ({
        id: u.id,
        email: u.email,
        full_name: u.full_name || '',
        role: u.role || 'user',
      }));

      return Response.json({
        missing_tenant_users: missing,
        total_users: (allUsers || []).length,
        tenants: isPlatformAdmin
          // Platform admins can pick any tenant
          ? (allTenants || []).map(t => ({ id: t.id, name: t.name, code: t.code }))
          // Tenant admins can only assign their own tenant (or all if they have none)
          : callerTenantId
            ? (allTenants || []).filter(t => t.id === callerTenantId).map(t => ({ id: t.id, name: t.name, code: t.code }))
            : (allTenants || []).map(t => ({ id: t.id, name: t.name, code: t.code })),
        caller_tenant_id: callerTenantId,
      });
    }

    // ── assign: set a user's tenant_id ─────────────────────────────────────
    if (action === 'assign') {
      if (!target_email || !tenant_id) {
        return Response.json({ error: 'Missing target_email or tenant_id' }, { status: 400 });
      }

      // Tenant admins can only assign their own tenant
      if (!isPlatformAdmin) {
        if (callerTenantId && tenant_id !== callerTenantId) {
          return Response.json({ error: 'Forbidden: You can only assign your own tenant' }, { status: 403 });
        }
        // If caller has no tenant yet, they can assign any tenant to themselves but only to unassigned users
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

      // Non-platform-admins can only assign to users who have no tenant yet
      if (!isPlatformAdmin && targetUser.tenant_id && targetUser.tenant_id !== callerTenantId) {
        return Response.json({ error: 'Forbidden: Target user already belongs to a different tenant' }, { status: 403 });
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