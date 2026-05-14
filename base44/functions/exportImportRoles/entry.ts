import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, data } = await req.json();
    const isPlatformAdmin = user.role === 'platform_admin';
    const userTenant = user.tenant_id || null;

    // ==================== EXPORT SINGLE ROLE ====================
    if (action === 'exportRole') {
      const { role_id } = data;

      const role = await base44.asServiceRole.entities.Role.read(role_id);
      if (!role) {
        return Response.json({ error: 'Role not found' }, { status: 404 });
      }

      // 权限检查
      if (!isPlatformAdmin && role.tenant_id !== userTenant) {
        return Response.json({ error: 'Cannot access role from another tenant' }, { status: 403 });
      }

      // 获取角色权限详情
      const permissions = [];
      const permissionIds = new Set([
        ...(role.direct_permissions || []),
        ...(role.overridden_permissions || []).map(op => op.permission_id)
      ]);

      for (const permId of permissionIds) {
        const perm = await base44.asServiceRole.entities.Permission.read(permId);
        if (perm) {
          permissions.push(perm);
        }
      }

      // 获取父角色信息（仅ID和名称）
      let parentRole = null;
      if (role.parent_role_id) {
        const parent = await base44.asServiceRole.entities.Role.read(role.parent_role_id);
        if (parent) {
          parentRole = { id: parent.id, name: parent.name };
        }
      }

      const exportData = {
        version: '1.0',
        exported_at: new Date().toISOString(),
        role: {
          name: role.name,
          description: role.description,
          parent_role: parentRole,
          direct_permissions: role.direct_permissions || [],
          overridden_permissions: role.overridden_permissions || []
        },
        permissions
      };

      return Response.json(exportData);
    }

    // ==================== EXPORT TENANT ROLES ====================
    if (action === 'exportTenantRoles') {
      const { tenant_id_filter } = data;

      let targetTenant = userTenant;

      // 平台管理员可以导出任何租户的角色
      if (isPlatformAdmin && tenant_id_filter) {
        targetTenant = tenant_id_filter;
      }

      if (!targetTenant) {
        return Response.json({ error: 'Tenant context required' }, { status: 400 });
      }

      // 获取租户所有角色
      const roles = await base44.asServiceRole.entities.Role.filter({
        tenant_id: targetTenant
      }, '-created_date', 200);

      // 获取租户所有权限
      const permissions = await base44.asServiceRole.entities.Permission.filter({
        tenant_id: targetTenant
      }, 'category', 200);

      const exportData = {
        version: '1.0',
        exported_at: new Date().toISOString(),
        tenant_id: targetTenant,
        roles_count: roles.length,
        permissions_count: permissions.length,
        roles: roles.map(r => ({
          name: r.name,
          description: r.description,
          parent_role_id: r.parent_role_id,
          direct_permissions: r.direct_permissions || [],
          overridden_permissions: r.overridden_permissions || []
        })),
        permissions
      };

      return Response.json(exportData);
    }

    // ==================== IMPORT ROLES ====================
    if (action === 'importRoles') {
      const { export_data, target_tenant_id, mode } = data; // mode: 'replace' | 'merge'

      let targetTenant = userTenant;

      // 平台管理员可以导入到任何租户
      if (isPlatformAdmin && target_tenant_id) {
        targetTenant = target_tenant_id;
      }

      if (!targetTenant) {
        return Response.json({ error: 'Tenant context required' }, { status: 400 });
      }

      // 如果mode是replace，先删除现有的角色和权限
      if (mode === 'replace') {
        const existingRoles = await base44.asServiceRole.entities.Role.filter({
          tenant_id: targetTenant
        });

        for (const role of existingRoles) {
          // 检查是否有用户使用此角色
          const usersWithRole = await base44.asServiceRole.entities.User.filter({
            role_ids: { $elemMatch: { $eq: role.id } }
          });

          if (usersWithRole.length === 0) {
            await base44.asServiceRole.entities.Role.delete(role.id);
          }
        }

        const existingPerms = await base44.asServiceRole.entities.Permission.filter({
          tenant_id: targetTenant
        });

        for (const perm of existingPerms) {
          await base44.asServiceRole.entities.Permission.delete(perm.id);
        }
      }

      // 导入权限
      const permissionMapping = {}; // 用于映射旧的权限ID到新的ID

      for (const perm of export_data.permissions || []) {
        const newPerm = await base44.asServiceRole.entities.Permission.create({
          tenant_id: targetTenant,
          name: perm.name,
          description: perm.description,
          resource_type: perm.resource_type,
          action: perm.action,
          category: perm.category || perm.resource_type,
          is_global: false
        });
        permissionMapping[perm.id] = newPerm.id;
      }

      // 导入角色
      const roleMapping = {}; // 用于处理父角色引用

      for (const roleData of export_data.roles || []) {
        // 更新权限ID引用
        const updatedDirectPerms = (roleData.direct_permissions || []).map(
          permId => permissionMapping[permId] || permId
        ).filter(p => p);

        const updatedOverrides = (roleData.overridden_permissions || []).map(override => ({
          ...override,
          permission_id: permissionMapping[override.permission_id] || override.permission_id
        })).filter(o => permissionMapping[o.permission_id]);

        const newRole = await base44.asServiceRole.entities.Role.create({
          tenant_id: targetTenant,
          name: roleData.name,
          description: roleData.description,
          direct_permissions: updatedDirectPerms,
          overridden_permissions: updatedOverrides,
          is_global: false
        });

        roleMapping[roleData.name] = newRole.id;
      }

      // 第二遍：处理父角色引用
      for (const roleData of export_data.roles || []) {
        if (roleData.parent_role_id) {
          const parentName = export_data.roles.find(r => r.name === roleData.parent_role_id)?.name;
          if (parentName && roleMapping[parentName]) {
            const currentRole = roleMapping[roleData.name];
            await base44.asServiceRole.entities.Role.update(currentRole, {
              parent_role_id: roleMapping[parentName]
            });
          }
        }
      }

      return Response.json({
        success: true,
        imported_permissions: Object.keys(permissionMapping).length,
        imported_roles: Object.keys(roleMapping).length
      });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});