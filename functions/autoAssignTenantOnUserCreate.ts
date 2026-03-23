import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Entity automation: fires on User create events.
 * If the new user has no tenant_id, attempt to infer one from:
 *   1. The inviting admin's tenant_id (most reliable — user was invited by a tenant admin)
 *   2. If only one active tenant exists, assign it automatically (bootstrap convenience)
 *
 * This is a safety net only — normal assignment goes through adminAssignTenant.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Automation payloads are sent as service-role webhooks — no user auth token.
    // We use asServiceRole for all operations here.
    let body = {};
    try { body = await req.json(); } catch { /* empty body */ }

    const { event, data } = body;

    // Determine which users to process:
    // - Entity automation (event.type === 'create'): process single new user from payload
    // - Scheduled run (no event): scan all users missing tenant_id
    let usersToProcess = [];

    if (event?.type === 'create') {
      const newUser = data;
      if (!newUser?.id || !newUser?.email) {
        return Response.json({ skipped: true, reason: 'missing user data' });
      }
      if (newUser.tenant_id) {
        return Response.json({ skipped: true, reason: 'user already has tenant_id' });
      }
      usersToProcess = [newUser];
    } else {
      // Scheduled sweep: find all users without tenant_id
      const allUsers = await base44.asServiceRole.entities.User.list();
      usersToProcess = (allUsers || []).filter(u => !u.tenant_id);
      if (usersToProcess.length === 0) {
        return Response.json({ skipped: true, reason: 'all users have tenant_id' });
      }
      console.log(`autoAssignTenant: scheduled sweep found ${usersToProcess.length} unassigned user(s)`);
    }

    // Fetch active tenants and admins once for all users
    const tenants = await base44.asServiceRole.entities.Tenant.filter({ is_active: true });
    if (!tenants || tenants.length === 0) {
      console.warn('autoAssignTenant: no active tenants found, cannot auto-assign');
      return Response.json({ skipped: true, reason: 'no active tenants' });
    }

    const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
    const tenantAdmins = await base44.asServiceRole.entities.User.filter({ role: 'tenant_admin' });
    const assignedAdmins = [...(admins || []), ...(tenantAdmins || [])].filter(a => a.tenant_id);

    const results = [];

    for (const targetUser of usersToProcess) {
      const otherAdmins = assignedAdmins.filter(a => a.email !== targetUser.email);

      // Strategy 1: Only one active tenant — assign automatically
      if (tenants.length === 1) {
        await base44.asServiceRole.entities.User.update(targetUser.id, { tenant_id: tenants[0].id });
        console.log(`autoAssignTenant: assigned single tenant ${tenants[0].code} to ${targetUser.email}`);
        results.push({ email: targetUser.email, tenant_id: tenants[0].id, reason: 'single_tenant' });
        continue;
      }

      // Strategy 2: Exactly one admin with a tenant — safe to assign their tenant
      if (otherAdmins.length === 1) {
        await base44.asServiceRole.entities.User.update(targetUser.id, { tenant_id: otherAdmins[0].tenant_id });
        console.log(`autoAssignTenant: assigned tenant ${otherAdmins[0].tenant_id} (from sole admin) to ${targetUser.email}`);
        results.push({ email: targetUser.email, tenant_id: otherAdmins[0].tenant_id, reason: 'sole_admin_tenant' });
        continue;
      }

      // Ambiguous — cannot safely infer, requires manual resolution
      console.warn(
        `autoAssignTenant: cannot auto-assign ${targetUser.email} — ` +
        `${tenants.length} active tenants, ${otherAdmins.length} admins with tenants. ` +
        `Resolve via Admin → Users → Tenant Assignment Diagnostics.`
      );
      results.push({ email: targetUser.email, reason: 'ambiguous_tenant', skipped: true });
    }

    return Response.json({ processed: results.length, results });

  } catch (error) {
    console.error('autoAssignTenantOnUserCreate error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});