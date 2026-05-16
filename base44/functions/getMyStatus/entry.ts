import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Compute effective permissions for a user:
 *   1. Collect direct_permissions from all assigned roles (via assigned_role_ids)
 *   2. Apply permission_overrides: "add" grants, "remove" revokes
 */
function computeEffectivePermissions(userRecord, allRoles) {
  const base = new Set();
  (userRecord.assigned_role_ids || []).forEach(roleId => {
    const role = allRoles.find(r => r.id === roleId);
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

    // platform_admin bypasses all granular permission checks — return early
    if (user.role === 'platform_admin') {
      return Response.json({ is_active: true, permissions: [] });
    }

    const records = await base44.asServiceRole.entities.User.filter({ email: user.email });
    const userRecord = records?.[0];
    if (!userRecord) return Response.json({ is_active: true, permissions: [] });

    const isActive = userRecord.is_active !== false;

    // Only compute granular permissions if the user has assigned roles or overrides
    let permissions = [];
    const hasGranularPerms = (userRecord.assigned_role_ids?.length > 0) ||
      (Object.keys(userRecord.permission_overrides || {}).length > 0);

    if (hasGranularPerms && userRecord.tenant_id) {
      const allRoles = await base44.asServiceRole.entities.Role.filter({
        tenant_id: userRecord.tenant_id,
        is_archived: false,
      });
      permissions = computeEffectivePermissions(userRecord, allRoles || []);
    }

    return Response.json({ is_active: isActive, permissions });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});