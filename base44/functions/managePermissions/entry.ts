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

    // ==================== CREATE PERMISSION ====================
    if (action === 'create') {
      const { name, description, resource_type, action: permAction, category, is_global } = data;

      // 只有平台管理员可以创建全局权限
      if (is_global && !isPlatformAdmin) {
        return Response.json({ error: 'Only platform admin can create global permissions' }, { status: 403 });
      }

      const tenant_id = is_global ? null : userTenant;
      if (!is_global && !userTenant) {
        return Response.json({ error: 'Tenant context required' }, { status: 400 });
      }

      const newPermission = await base44.asServiceRole.entities.Permission.create({
        tenant_id,
        name,
        description,
        resource_type,
        action: permAction,
        category: category || resource_type,
        is_global
      });

      return Response.json({ permission: newPermission });
    }

    // ==================== LIST PERMISSIONS ====================
    if (action === 'listPermissions') {
      const { tenant_id_filter } = data;

      let query = {};

      if (isPlatformAdmin) {
        if (tenant_id_filter !== undefined) {
          query.tenant_id = tenant_id_filter;
        }
      } else {
        // 租户用户可以查看自己租户的权限和全局权限
        query = {
          $or: [
            { tenant_id: userTenant },
            { is_global: true }
          ]
        };
      }

      const permissions = await base44.asServiceRole.entities.Permission.filter(query, 'category', 200);
      return Response.json({ permissions });
    }

    // ==================== UPDATE PERMISSION ====================
    if (action === 'update') {
      const { permission_id, updates } = data;

      const permission = await base44.asServiceRole.entities.Permission.read(permission_id);
      if (!permission) {
        return Response.json({ error: 'Permission not found' }, { status: 404 });
      }

      // 权限检查
      if (permission.is_global && !isPlatformAdmin) {
        return Response.json({ error: 'Only platform admin can modify global permissions' }, { status: 403 });
      }

      if (!isPlatformAdmin && permission.tenant_id !== userTenant) {
        return Response.json({ error: 'Cannot modify permission from another tenant' }, { status: 403 });
      }

      const updatedPermission = await base44.asServiceRole.entities.Permission.update(permission_id, updates);
      return Response.json({ permission: updatedPermission });
    }

    // ==================== DELETE PERMISSION ====================
    if (action === 'delete') {
      const { permission_id } = data;

      const permission = await base44.asServiceRole.entities.Permission.read(permission_id);
      if (!permission) {
        return Response.json({ error: 'Permission not found' }, { status: 404 });
      }

      // 权限检查
      if (permission.is_global && !isPlatformAdmin) {
        return Response.json({ error: 'Only platform admin can delete global permissions' }, { status: 403 });
      }

      if (!isPlatformAdmin && permission.tenant_id !== userTenant) {
        return Response.json({ error: 'Cannot delete permission from another tenant' }, { status: 403 });
      }

      // 检查权限是否被角色使用
      const rolesUsingPermission = await base44.asServiceRole.entities.Role.filter({
        $or: [
          { direct_permissions: { $elemMatch: { $eq: permission_id } } },
          { 'overridden_permissions.permission_id': permission_id }
        ]
      });

      if (rolesUsingPermission.length > 0) {
        return Response.json({
          error: 'Cannot delete permission used by roles',
          used_by_role_count: rolesUsingPermission.length
        }, { status: 400 });
      }

      await base44.asServiceRole.entities.Permission.delete(permission_id);
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});