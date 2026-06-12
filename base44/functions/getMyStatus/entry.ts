import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Compute effective permissions for a user:
 *   1. Collect direct_permissions from all assigned roles (via assigned_role_ids)
 *   2. Apply permission_overrides: "add" grants, "remove" revokes
 */
function computeEffectivePermissions(userRecord, allRoles) {
  const base = new Set();
  (userRecord.assigned_role_ids || []).forEach(roleId => {
    // Support both role ID lookup and legacy role name lookup (e.g., 'user', 'admin')
    let role = allRoles.find(r => r.id === roleId);
    if (!role && typeof roleId === 'string') {
      // Fallback: try to find by predefined_key or name for legacy role references
      role = allRoles.find(r => r.predefined_key === `builtin_${roleId}` || r.name === roleId);
    }
    (role?.direct_permissions || []).forEach(p => base.add(p));
  });

  const overrides = userRecord.permission_overrides || {};
  Object.entries(overrides).forEach(([p, action]) => {
    if (action === 'add') base.add(p);
    else if (action === 'remove') base.delete(p);
  });

  return Array.from(base);
}

/**
 * Returns the current user's is_active status and effective permissions.
 * Used by frontend on app boot.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const records = await base44.asServiceRole.entities.User.filter({ email: user.email });
    const userRecord = records?.[0];
    if (!userRecord) return Response.json({ is_active: true, permissions: [] });

    // 记录最近登录时间（1 小时节流，供公开资料页「最近登录时间」展示）
    // 注意：必须在 platform_admin 提前返回之前执行，否则管理员的登录时间永远不会被记录
    const lastLogin = userRecord.last_login_at ? new Date(userRecord.last_login_at).getTime() : 0;
    if (Date.now() - lastLogin > 60 * 60 * 1000) {
      await base44.asServiceRole.entities.User.update(userRecord.id, { last_login_at: new Date().toISOString() });
    }

    // platform_admin bypasses all granular permission checks — return early
    if (user.role === 'platform_admin') {
      return Response.json({ is_active: true, permissions: [] });
    }

    const isActive = userRecord.is_active !== false;

    // Only compute granular permissions if the user has assigned roles or overrides
    let permissions = [];
    const hasGranularPerms = (userRecord.assigned_role_ids?.length > 0) ||
      (Object.keys(userRecord.permission_overrides || {}).length > 0);

    let assignedRoles = [];
    if (userRecord.tenant_id) {
      // Load both tenant-specific and global roles
      const tenantRoles = await base44.asServiceRole.entities.Role.filter({
        tenant_id: userRecord.tenant_id,
        is_archived: false,
      });
      const globalRoles = await base44.asServiceRole.entities.Role.filter({
        is_global: true,
        is_archived: false,
      });
      const rolesArr = [...(tenantRoles || []), ...(globalRoles || [])];
      if (hasGranularPerms) {
        permissions = computeEffectivePermissions(userRecord, rolesArr);
      }
      // Return assigned role labels (non-predefined custom roles only)
      assignedRoles = (userRecord.assigned_role_ids || [])
        .map(id => rolesArr.find(r => r.id === id))
        .filter(r => r && !r.is_predefined)
        .map(r => ({ id: r.id, name: r.name, color: r.color || '#9ca3af' }));
    }

    return Response.json({ is_active: isActive, permissions, assigned_roles: assignedRoles });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});