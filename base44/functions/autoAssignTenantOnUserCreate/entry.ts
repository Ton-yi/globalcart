import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

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
        await assignBuiltinUserRole(base44, targetUser.id, tenants[0].id);
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
          await assignBuiltinUserRole(base44, targetUser.id, inviter.tenant_id);
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
        await assignBuiltinUserRole(base44, targetUser.id, assignedAdmins[0].tenant_id);
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

/**
 * 将租户的默认角色赋给用户（仅限 role==='user' 的普通用户）
 * 优先级：租户 default_role_id > 平台全局 global_default_role_id > 租户 builtin_user 角色
 */
async function assignBuiltinUserRole(base44, userId, tenantId) {
  try {
    const users = await base44.asServiceRole.entities.User.filter({ id: userId });
    const targetUser = users?.[0];
    if (!targetUser || targetUser.role !== 'user') return;

    let roleToAssign = null;

    // 1. 租户自定义默认角色
    const tenants = await base44.asServiceRole.entities.Tenant.filter({ id: tenantId });
    const tenant = tenants?.[0];
    if (tenant?.default_role_id) {
      const roles = await base44.asServiceRole.entities.Role.filter({ id: tenant.default_role_id });
      if (roles?.[0]) roleToAssign = roles[0];
    }

    // 2. 平台全局默认角色
    if (!roleToAssign) {
      const globalSettings = await base44.asServiceRole.entities.SiteSettings.filter({ key: 'global_default_role_id', tenant_id: null });
      const globalRoleId = globalSettings?.[0]?.value;
      if (globalRoleId) {
        // 查找租户内是否有对应 predefined_key 的角色（从全局角色复制过来的）
        const globalRole = await base44.asServiceRole.entities.Role.filter({ id: globalRoleId });
        if (globalRole?.[0]?.predefined_key) {
          const tenantRoles = await base44.asServiceRole.entities.Role.filter({
            tenant_id: tenantId,
            predefined_key: globalRole[0].predefined_key,
          });
          if (tenantRoles?.[0]) roleToAssign = tenantRoles[0];
        }
      }
    }

    // 3. Fallback: builtin_user
    if (!roleToAssign) {
      const builtinRoles = await base44.asServiceRole.entities.Role.filter({
        tenant_id: tenantId,
        predefined_key: 'builtin_user',
      });
      if (builtinRoles?.[0]) roleToAssign = builtinRoles[0];
    }

    if (!roleToAssign) return;

    const existingIds = targetUser.assigned_role_ids || [];
    if (existingIds.includes(roleToAssign.id)) return;

    await base44.asServiceRole.entities.User.update(userId, {
      assigned_role_ids: [...existingIds, roleToAssign.id],
    });
    console.log(`assignBuiltinUserRole: assigned role ${roleToAssign.id} (${roleToAssign.name}) to user ${userId}`);
  } catch (e) {
    console.warn(`assignBuiltinUserRole failed for user ${userId}:`, e.message);
  }
}