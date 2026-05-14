import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// 预设权限模板
const PRESET_PERMISSIONS = [
  // Order Management
  { name: 'order:read', description: '查看订单', resource_type: 'Order', action: 'read', category: 'Order' },
  { name: 'order:create', description: '创建订单', resource_type: 'Order', action: 'create', category: 'Order' },
  { name: 'order:update', description: '更新订单', resource_type: 'Order', action: 'update', category: 'Order' },
  { name: 'order:delete', description: '删除订单', resource_type: 'Order', action: 'delete', category: 'Order' },
  
  // Shipping Pool Management
  { name: 'shipping_pool:read', description: '查看发货池', resource_type: 'ShippingPool', action: 'read', category: 'ShippingPool' },
  { name: 'shipping_pool:create', description: '创建发货申请', resource_type: 'ShippingPool', action: 'create', category: 'ShippingPool' },
  { name: 'shipping_pool:update', description: '更新发货池信息', resource_type: 'ShippingPool', action: 'update', category: 'ShippingPool' },
  { name: 'shipping_pool:manage_fees', description: '管理发货费用', resource_type: 'ShippingPool', action: 'manage_fees', category: 'ShippingPool' },
  
  // User Management
  { name: 'user:read', description: '查看用户列表', resource_type: 'User', action: 'read', category: 'User' },
  { name: 'user:update', description: '编辑用户信息', resource_type: 'User', action: 'update', category: 'User' },
  { name: 'user:manage_roles', description: '管理用户角色', resource_type: 'User', action: 'manage_roles', category: 'User' },
  
  // Settings & Configuration
  { name: 'settings:read', description: '查看系统设置', resource_type: 'Settings', action: 'read', category: 'Settings' },
  { name: 'settings:update', description: '修改系统设置', resource_type: 'Settings', action: 'update', category: 'Settings' },
  
  // Payment Management
  { name: 'payment:read', description: '查看支付记录', resource_type: 'Payment', action: 'read', category: 'Payment' },
  { name: 'payment:confirm', description: '确认支付', resource_type: 'Payment', action: 'confirm', category: 'Payment' },
  
  // Dashboard & Analytics
  { name: 'dashboard:view', description: '查看管理面板', resource_type: 'Dashboard', action: 'view', category: 'Dashboard' },
];

// 预设角色定义
const PRESET_ROLES = {
  user: {
    name: 'user',
    description: '普通用户',
    permissions: ['order:read', 'order:create', 'shipping_pool:read', 'shipping_pool:create']
  },
  staff: {
    name: 'staff',
    description: '员工',
    permissions: ['order:read', 'order:update', 'shipping_pool:read', 'shipping_pool:update', 'payment:read']
  },
  admin: {
    name: 'admin',
    description: '管理员',
    permissions: ['order:read', 'order:update', 'order:delete', 'shipping_pool:read', 'shipping_pool:update', 'shipping_pool:manage_fees', 'user:read', 'user:update', 'settings:read', 'settings:update', 'payment:read', 'payment:confirm', 'dashboard:view']
  },
  tenant_admin: {
    name: 'tenant_admin',
    description: '租户管理员',
    permissions: ['order:read', 'order:update', 'order:delete', 'shipping_pool:read', 'shipping_pool:update', 'shipping_pool:manage_fees', 'user:read', 'user:update', 'user:manage_roles', 'settings:read', 'settings:update', 'payment:read', 'payment:confirm', 'dashboard:view']
  },
  platform_admin: {
    name: 'platform_admin',
    description: '平台管理员',
    permissions: ['order:read', 'order:update', 'order:delete', 'shipping_pool:read', 'shipping_pool:update', 'shipping_pool:manage_fees', 'user:read', 'user:update', 'user:manage_roles', 'settings:read', 'settings:update', 'payment:read', 'payment:confirm', 'dashboard:view']
  }
};

/**
 * 初始化预设权限（仅在系统首次设置时调用）
 */
async function initializePresetPermissions(base44, userTenant) {
  try {
    // 检查是否已存在权限
    const existingPerms = await base44.asServiceRole.entities.Permission.filter({ tenant_id: null }, '-created_date', 1);
    if (existingPerms.length > 0) {
      return; // 权限已初始化，跳过
    }

    // 创建所有预设权限
    for (const perm of PRESET_PERMISSIONS) {
      await base44.asServiceRole.entities.Permission.create({
        ...perm,
        is_global: true,
        tenant_id: null
      });
    }
  } catch (err) {
    console.warn('Failed to initialize preset permissions', err);
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 初始化预设权限（首次调用时）
    await initializePresetPermissions(base44, user.tenant_id);

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

    // ==================== GET PRESET ROLES ====================
    if (action === 'getPresetRoles') {
      return Response.json({ preset_roles: PRESET_ROLES });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});