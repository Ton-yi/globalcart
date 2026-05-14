import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, data } = await req.json();

    // 获取用户所属租户
    const userTenant = user.tenant_id || null;
    const isPlatformAdmin = user.role === 'platform_admin';

    // ==================== CREATE ROLE ====================
    if (action === 'create') {
      const { name, description, parent_role_id, direct_permissions, is_global } = data;

      // 权限检查
      if (is_global && !isPlatformAdmin) {
        return Response.json({ error: 'Only platform admin can create global roles' }, { status: 403 });
      }

      const tenant_id = is_global ? null : userTenant;
      if (!is_global && !userTenant) {
        return Response.json({ error: 'Tenant context required' }, { status: 400 });
      }

      // 验证父角色存在且可访问
      if (parent_role_id) {
        const parentRoles = await base44.asServiceRole.entities.Role.filter({ id: parent_role_id }, '', 1);
        const parentRole = parentRoles[0];
        if (!parentRole) {
          return Response.json({ error: 'Parent role not found' }, { status: 404 });
        }
        // 检查父角色可访问性：全局角色或相同租户
        if (!isPlatformAdmin && parentRole.tenant_id && parentRole.tenant_id !== userTenant) {
          return Response.json({ error: 'Cannot access parent role from another tenant' }, { status: 403 });
        }
      }

      const newRole = await base44.asServiceRole.entities.Role.create({
        tenant_id,
        name,
        description,
        is_global,
        parent_role_id: parent_role_id || null,
        direct_permissions: direct_permissions || [],
        overridden_permissions: []
      });

      return Response.json({ role: newRole });
    }

    // ==================== UPDATE ROLE ====================
    if (action === 'update') {
      const { role_id, updates } = data;

      const roles = await base44.asServiceRole.entities.Role.filter({ id: role_id }, '', 1);
      const role = roles[0];
      if (!role) {
        return Response.json({ error: 'Role not found' }, { status: 404 });
      }

      // 权限检查：只有平台管理员可以修改全局角色，租户管理员可以修改自己租户的角色
      if (role.is_global && !isPlatformAdmin) {
        return Response.json({ error: 'Only platform admin can modify global roles' }, { status: 403 });
      }

      if (!isPlatformAdmin && role.tenant_id !== userTenant) {
        return Response.json({ error: 'Cannot modify roles from another tenant' }, { status: 403 });
      }

      // 如果修改parent_role_id，验证新父角色
      if (updates.parent_role_id !== undefined) {
        if (updates.parent_role_id) {
          const parentRoles = await base44.asServiceRole.entities.Role.filter({ id: updates.parent_role_id }, '', 1);
          const parentRole = parentRoles[0];
          if (!parentRole) {
            return Response.json({ error: 'Parent role not found' }, { status: 404 });
          }
          if (!isPlatformAdmin && parentRole.tenant_id && parentRole.tenant_id !== userTenant) {
            return Response.json({ error: 'Cannot access parent role from another tenant' }, { status: 403 });
          }
        }
      }

      console.log('[manageRoles] Updating role with:', updates);
      const updatedRole = await base44.asServiceRole.entities.Role.update(role_id, updates);
      console.log('[manageRoles] Role updated successfully:', updatedRole.id, 'image_url:', updatedRole.image_url);
      return Response.json({ role: updatedRole });
    }

    // ==================== GET ROLE WITH EFFECTIVE PERMISSIONS ====================
    if (action === 'getRoleWithEffectivePermissions') {
      const { role_id } = data;

      const roles = await base44.asServiceRole.entities.Role.filter({ id: role_id }, '', 1);
      const role = roles[0];
      if (!role) {
        return Response.json({ error: 'Role not found' }, { status: 404 });
      }

      // 权限检查
      if (!isPlatformAdmin && role.tenant_id !== userTenant) {
        return Response.json({ error: 'Cannot access role from another tenant' }, { status: 403 });
      }

      // 计算有效权限
      const effectivePermissions = await calculateEffectivePermissions(role_id, base44);

      return Response.json({
        role,
        effective_permissions: effectivePermissions
      });
    }

    // ==================== LIST ROLES ====================
    if (action === 'listRoles') {
      const { tenant_id_filter } = data;

      let query = {};

      if (isPlatformAdmin) {
        // 平台管理员可以查看所有角色
        if (tenant_id_filter !== undefined) {
          query.tenant_id = tenant_id_filter;
        }
      } else {
        // 租户用户只能查看自己租户的角色和全局角色
        query = {
          $or: [
            { tenant_id: userTenant },
            { is_global: true }
          ]
        };
      }

      const roles = await base44.asServiceRole.entities.Role.filter(query, '-created_date', 100);
      return Response.json({ roles });
    }

    // ==================== DELETE ROLE ====================
    if (action === 'delete') {
      const { role_id } = data;

      const roles = await base44.asServiceRole.entities.Role.filter({ id: role_id }, '', 1);
      const role = roles[0];
      if (!role) {
        return Response.json({ error: 'Role not found' }, { status: 404 });
      }

      // 权限检查
      if (role.is_global && !isPlatformAdmin) {
        return Response.json({ error: 'Only platform admin can delete global roles' }, { status: 403 });
      }

      if (!isPlatformAdmin && role.tenant_id !== userTenant) {
        return Response.json({ error: 'Cannot delete role from another tenant' }, { status: 403 });
      }

      // 检查是否有用户使用此角色
      const usersWithRole = await base44.asServiceRole.entities.User.filter({
        role_ids: { $elemMatch: { $eq: role_id } }
      });

      if (usersWithRole.length > 0) {
        return Response.json({
          error: 'Cannot delete role with assigned users',
          assigned_user_count: usersWithRole.length
        }, { status: 400 });
      }

      // 检查是否有子角色继承自此角色
      const childRoles = await base44.asServiceRole.entities.Role.filter({
        parent_role_id: role_id
      });

      if (childRoles.length > 0) {
        return Response.json({
          error: 'Cannot delete role with child roles',
          child_role_count: childRoles.length
        }, { status: 400 });
      }

      await base44.asServiceRole.entities.Role.delete(role_id);
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('[manageRoles] Error:', error);
    return Response.json({ error: error.message, details: error.toString() }, { status: 500 });
  }
});

/**
 * 计算角色的有效权限（包括继承）
 */
async function calculateEffectivePermissions(roleId, base44) {
  const roles = await base44.asServiceRole.entities.Role.filter({ id: roleId }, '', 1);
  const role = roles[0];
  if (!role) return [];

  let effectivePermissions = new Set(role.direct_permissions || []);

  // 如果有父角色，递归获取父角色的有效权限
  if (role.parent_role_id) {
    const parentPermissions = await calculateEffectivePermissions(role.parent_role_id, base44);
    parentPermissions.forEach(p => effectivePermissions.add(p));
  }

  // 处理覆盖权限
  if (role.overridden_permissions && role.overridden_permissions.length > 0) {
    for (const override of role.overridden_permissions) {
      if (override.action === 'remove') {
        effectivePermissions.delete(override.permission_id);
      } else if (override.action === 'add') {
        effectivePermissions.add(override.permission_id);
      }
    }
  }

  return Array.from(effectivePermissions);
}