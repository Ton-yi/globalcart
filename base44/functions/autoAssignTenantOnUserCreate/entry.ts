import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Entity automation: fires on User create events.
 * If the new user has no tenant_id, attempt to infer one from:
 *   1. The inviting user's tenant_id (most reliable — user was invited by a tenant member)
 *   2. If only one active tenant exists, assign it automatically (bootstrap convenience)
 *
 * This is a safety net only — manual assignment goes through adminAssignTenant.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let body = {};
    try { body = await req.json(); } catch { /* empty body */ }

    const { event, data } = body;

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

    // Fetch active tenants once
    const tenants = await base44.asServiceRole.entities.Tenant.filter({ is_active: true });
    if (!tenants || tenants.length === 0) {
      console.warn('autoAssignTenant: no active tenants found, cannot auto-assign');
      return Response.json({ skipped: true, reason: 'no active tenants' });
    }

    const results = [];

    for (const targetUser of usersToProcess) {
      // Strategy 1: Only one active tenant — assign automatically
      if (tenants.length === 1) {
        await base44.asServiceRole.entities.User.update(targetUser.id, { tenant_id: tenants[0].id });
        console.log(`autoAssignTenant: assigned single tenant ${tenants[0].code} to ${targetUser.email}`);
        results.push({ email: targetUser.email, tenant_id: tenants[0].id, reason: 'single_tenant' });
        continue;
      }

      // Strategy 2: Infer from the inviting user's tenant_id (created_by field)
      // In invite-based systems, the inviter always belongs to a specific tenant
      const inviterEmail = targetUser.created_by;
      if (inviterEmail) {
        const inviterRecords = await base44.asServiceRole.entities.User.filter({ email: inviterEmail });
        const inviter = inviterRecords?.[0];
        if (inviter?.tenant_id) {
          await base44.asServiceRole.entities.User.update(targetUser.id, { tenant_id: inviter.tenant_id });
          console.log(`autoAssignTenant: assigned tenant ${inviter.tenant_id} (from inviter ${inviterEmail}) to ${targetUser.email}`);
          results.push({ email: targetUser.email, tenant_id: inviter.tenant_id, reason: 'inviter_tenant' });
          continue;
        }
      }

      // Strategy 3: Exactly one admin/tenant_admin with a tenant — safe to assign their tenant
      const allAssignedAdmins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
      const allAssignedTenantAdmins = await base44.asServiceRole.entities.User.filter({ role: 'tenant_admin' });
      const assignedAdmins = [...(allAssignedAdmins || []), ...(allAssignedTenantAdmins || [])]
        .filter(a => a.tenant_id && a.email !== targetUser.email);

      if (assignedAdmins.length === 1) {
        await base44.asServiceRole.entities.User.update(targetUser.id, { tenant_id: assignedAdmins[0].tenant_id });
        console.log(`autoAssignTenant: assigned tenant ${assignedAdmins[0].tenant_id} (from sole admin) to ${targetUser.email}`);
        results.push({ email: targetUser.email, tenant_id: assignedAdmins[0].tenant_id, reason: 'sole_admin_tenant' });
        continue;
      }

      // Ambiguous — cannot safely infer, requires manual resolution
      console.warn(
        `autoAssignTenant: cannot auto-assign ${targetUser.email} — ` +
        `${tenants.length} active tenants, inviter has no tenant. ` +
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