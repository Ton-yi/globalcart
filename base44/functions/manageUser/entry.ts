import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * User management: update role, disable/enable, delete.
 * - platform_admin: can manage ALL users
 * - tenant_admin / admin: can only manage users in their own tenant (cannot elevate to platform_admin)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const isPlatformAdmin = user.role === 'platform_admin';
    const isTenantAdmin = user.role === 'admin' || user.role === 'tenant_admin';

    if (!isPlatformAdmin && !isTenantAdmin) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { action, target_user_id } = body;

    if (!target_user_id) return Response.json({ error: 'target_user_id required' }, { status: 400 });

    // Fetch the target user record
    const allMatched = await base44.asServiceRole.entities.User.filter({ id: target_user_id });
    const targetRecord = allMatched?.[0];
    if (!targetRecord) return Response.json({ error: 'User not found' }, { status: 404 });

    // Prevent self-modification
    if (targetRecord.email === user.email) {
      return Response.json({ error: 'Cannot modify your own account' }, { status: 400 });
    }

    // Tenant admin: can only manage users in their own tenant
    if (!isPlatformAdmin) {
      const callerRecords = await base44.asServiceRole.entities.User.filter({ email: user.email });
      const callerRecord = callerRecords?.[0];
      const callerTenantId = callerRecord?.tenant_id;
      if (!callerTenantId || targetRecord.tenant_id !== callerTenantId) {
        return Response.json({ error: 'Forbidden: can only manage users in your own tenant' }, { status: 403 });
      }
    }

    // ── update_role ──
    if (action === 'update_role') {
      const { role } = body;
      const allowed = isPlatformAdmin
        ? ['platform_admin', 'tenant_admin', 'admin', 'staff', 'user']
        : ['admin', 'tenant_admin', 'staff', 'user']; // tenant admin cannot assign platform_admin
      if (!allowed.includes(role)) {
        return Response.json({ error: `Role "${role}" not allowed` }, { status: 400 });
      }
      const updated = await base44.asServiceRole.entities.User.update(target_user_id, { role });
      return Response.json({ user: updated });
    }

    // ── toggle_active ──
    if (action === 'toggle_active') {
      const { is_active } = body;
      // Prevent disabling other platform admins (tenant admin cannot do this)
      if (!isPlatformAdmin && targetRecord.role === 'platform_admin') {
        return Response.json({ error: 'Cannot disable a platform admin' }, { status: 403 });
      }
      const updated = await base44.asServiceRole.entities.User.update(target_user_id, { is_active: !!is_active });
      return Response.json({ user: updated });
    }

    // ── update_roles ──
    if (action === 'update_roles') {
      const { roles } = body;
      if (!Array.isArray(roles)) {
        return Response.json({ error: 'roles must be an array' }, { status: 400 });
      }
      
      // Validate all roles are custom role IDs (not global roles) - these should be custom tenant roles
      // For now, we just store the role IDs as assigned_role_ids
      const updated = await base44.asServiceRole.entities.User.update(target_user_id, { 
        assigned_role_ids: roles 
      });
      return Response.json({ user: updated });
    }

    // ── delete ──
    if (action === 'delete') {
      if (!isPlatformAdmin && targetRecord.role === 'platform_admin') {
        return Response.json({ error: 'Cannot delete a platform admin' }, { status: 403 });
      }
      await base44.asServiceRole.entities.User.delete(target_user_id);
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    console.error('manageUser error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});