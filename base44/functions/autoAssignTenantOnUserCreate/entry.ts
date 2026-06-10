import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Entity automation: fires on User create events.
 * 1. Assigns tenant (existing logic)
 * 2. Assigns built-in role (existing logic)
 * 3. NEW: Initializes notification preferences from defaults (platform or tenant level)
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
        await initializeUserNotificationDefaults(base44, targetUser.email, tenants[0].id);
        console.log(`autoAssignTenant: assigned single tenant ${tenants[0].code} to ${targetUser.email}`);
        results.push({ email: targetUser.email, tenant_id: tenants[0].id, reason: 'single_tenant' });
        continue;
      }

      // Strategy 2: Infer from the inviting user's tenant_id (created_by field)
      const inviterEmail = targetUser.created_by;
      if (inviterEmail) {
        const inviterRecords = await base44.asServiceRole.entities.User.filter({ email: inviterEmail });
        const inviter = inviterRecords?.[0];
        if (inviter?.tenant_id) {
          await base44.asServiceRole.entities.User.update(targetUser.id, { tenant_id: inviter.tenant_id });
          await assignBuiltinUserRole(base44, targetUser.id, inviter.tenant_id);
          await initializeUserNotificationDefaults(base44, targetUser.email, inviter.tenant_id);
          console.log(`autoAssignTenant: assigned tenant ${inviter.tenant_id} (from inviter ${inviterEmail}) to ${targetUser.email}`);
          results.push({ email: targetUser.email, tenant_id: inviter.tenant_id, reason: 'inviter_tenant' });
          continue;
        }
      }

      // Strategy 3: Exactly one admin/tenant_admin with a tenant
      const allAssignedAdmins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
      const allAssignedTenantAdmins = await base44.asServiceRole.entities.User.filter({ role: 'tenant_admin' });
      const assignedAdmins = [...(allAssignedAdmins || []), ...(allAssignedTenantAdmins || [])]
        .filter(a => a.tenant_id && a.email !== targetUser.email);
      
      if (assignedAdmins.length === 1) {
        await base44.asServiceRole.entities.User.update(targetUser.id, { tenant_id: assignedAdmins[0].tenant_id });
        await assignBuiltinUserRole(base44, targetUser.id, assignedAdmins[0].tenant_id);
        await initializeUserNotificationDefaults(base44, targetUser.email, assignedAdmins[0].tenant_id);
        console.log(`autoAssignTenant: assigned tenant ${assignedAdmins[0].tenant_id} (from sole admin) to ${targetUser.email}`);
        results.push({ email: targetUser.email, tenant_id: assignedAdmins[0].tenant_id, reason: 'sole_admin_tenant' });
        continue;
      }

      // Ambiguous — cannot safely infer
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

/**
 * NEW: Initialize user notification preferences from defaults
 * Priority: Tenant-level defaults > Platform-level defaults > Hardcoded defaults
 */
async function initializeUserNotificationDefaults(base44, userEmail, tenantId) {
  try {
    // Check if preferences already exist
    const existingPrefs = await base44.asServiceRole.entities.NotificationPreference.filter({
      tenant_id: tenantId,
      user_email: userEmail
    });

    if (existingPrefs && existingPrefs.length > 0) {
      console.log(`initializeUserNotificationDefaults: preferences already exist for ${userEmail}`);
      return;
    }

    // Fetch tenant-level defaults first
    let defaults = null;
    const tenantDefaults = await base44.asServiceRole.entities.NotificationPreferenceDefaults.filter({
      tenant_id: tenantId
    });

    if (tenantDefaults && tenantDefaults.length > 0) {
      defaults = tenantDefaults[0];
      console.log(`initializeUserNotificationDefaults: using tenant-level defaults for ${userEmail}`);
    } else {
      // Fallback to platform-level defaults
      const platformDefaults = await base44.asServiceRole.entities.NotificationPreferenceDefaults.filter({
        tenant_id: null
      });

      if (platformDefaults && platformDefaults.length > 0) {
        defaults = platformDefaults[0];
        console.log(`initializeUserNotificationDefaults: using platform-level defaults for ${userEmail}`);
      }
    }

    // Prepare default preferences
    const defaultPrefs = {
      tenant_id: tenantId,
      user_email: userEmail,
      in_app_enabled: defaults?.in_app_enabled ?? true,
      email_enabled: defaults?.email_enabled ?? true,
      notification_settings: defaults?.notification_settings ?? {
        payment: { in_app: true, email: true },
        shipping_request: { in_app: true, email: true },
        order_status: {
          in_app: true,
          email: false,
          subtypes: {
            order_created: { in_app: false, email: false },
            order_payment_confirmed: { in_app: true, email: false },
            order_purchased: { in_app: true, email: false },
            order_in_warehouse: { in_app: true, email: false },
            order_added_to_pool: { in_app: false, email: false }
          }
        },
        message: { in_app: true, email: true },
        other: { in_app: true, email: false }
      }
    };

    // Create user preferences
    await base44.asServiceRole.entities.NotificationPreference.create(defaultPrefs);
    console.log(`initializeUserNotificationDefaults: created preferences for ${userEmail} in tenant ${tenantId}`);

  } catch (e) {
    console.error(`initializeUserNotificationDefaults failed for ${userEmail}:`, e.message);
    // Don't throw — this is a best-effort initialization
  }
}