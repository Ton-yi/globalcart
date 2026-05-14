# 预设权限系统（后端配置）

## 概述

权限系统现已从前端转为后端配置模式。所有权限和角色通过 `managePermissions.js` 后端函数进行管理。

## 预设权限列表

系统初始化时自动创建以下权限（全局权限，所有租户可用）：

### Order Management（订单管理）
- `order:read` - 查看订单
- `order:create` - 创建订单
- `order:update` - 更新订单
- `order:delete` - 删除订单

### ShippingPool Management（发货池管理）
- `shipping_pool:read` - 查看发货池
- `shipping_pool:create` - 创建发货申请
- `shipping_pool:update` - 更新发货池信息
- `shipping_pool:manage_fees` - 管理发货费用

### User Management（用户管理）
- `user:read` - 查看用户列表
- `user:update` - 编辑用户信息
- `user:manage_roles` - 管理用户角色

### Settings & Configuration（系统设置）
- `settings:read` - 查看系统设置
- `settings:update` - 修改系统设置

### Payment Management（支付管理）
- `payment:read` - 查看支付记录
- `payment:confirm` - 确认支付

### Dashboard & Analytics（管理面板）
- `dashboard:view` - 查看管理面板

## 预设角色分配

### user（普通用户）
- order:read
- order:create
- shipping_pool:read
- shipping_pool:create

### staff（员工）
- order:read
- order:update
- shipping_pool:read
- shipping_pool:update
- payment:read

### admin（管理员）
- 所有订单、发货、用户、设置、支付权限
- 不包括 `user:manage_roles` 和 `dashboard:view`

### tenant_admin（租户管理员）
- 所有管理权限
- 包括 `user:manage_roles`（可管理用户角色）
- 包括 `dashboard:view`（可查看管理面板）

### platform_admin（平台管理员）
- 所有权限

## 后端 API 使用

### 创建权限
```javascript
const res = await base44.functions.invoke('managePermissions', {
  action: 'create',
  data: {
    name: 'order:read',
    description: '查看订单',
    resource_type: 'Order',
    action: 'read',
    category: 'Order',
    is_global: true
  }
});
```

### 列出权限
```javascript
const res = await base44.functions.invoke('managePermissions', {
  action: 'listPermissions',
  data: {
    tenant_id_filter: null // 可选，平台管理员可过滤特定租户
  }
});
```

### 更新权限
```javascript
const res = await base44.functions.invoke('managePermissions', {
  action: 'update',
  data: {
    permission_id: 'perm_id',
    updates: {
      description: '新的描述',
      category: 'NewCategory'
    }
  }
});
```

### 删除权限
```javascript
const res = await base44.functions.invoke('managePermissions', {
  action: 'delete',
  data: {
    permission_id: 'perm_id'
  }
});
```

### 获取预设角色信息
```javascript
const res = await base44.functions.invoke('managePermissions', {
  action: 'getPresetRoles'
});
// 返回 { preset_roles: {...} }
```

## 权限管理

在用户管理页面（AdminUsers），管理员可以：
1. **编辑用户角色** - 为用户分配不同的角色
2. **管理用户状态** - 启用/停用用户账户
3. **调整信用额度** - 为支持记账的用户设置欠款限制

角色变更后，用户拥有的权限会自动更新。

## 定制权限

如需添加新权限或修改现有权限，可以：

### 方式 1：直接修改源代码
编辑 `functions/managePermissions.js` 中的 `PRESET_PERMISSIONS` 数组，添加新权限定义。

### 方式 2：通过后端函数创建
```javascript
// 在后端函数或自定义脚本中调用
const res = await base44.functions.invoke('managePermissions', {
  action: 'create',
  data: {
    name: 'order:archive',
    description: '存档订单',
    resource_type: 'Order',
    action: 'archive',
    category: 'Order',
    is_global: true // 如需租户私有权限，设为 false
  }
});
```

## 权限继承与覆盖

对于需要更细粒度的角色配置，可使用 `manageRoles.js` 函数：

- 创建子角色并继承父角色的权限
- 在子角色中移除某些权限（override）
- 在子角色中新增额外权限

示例：
```javascript
await base44.functions.invoke('manageRoles', {
  action: 'create',
  data: {
    name: 'LimitedAdmin',
    description: '受限管理员',
    parent_role_id: 'admin_role_id',
    overridden_permissions: [
      {
        permission_id: 'order:delete',
        action: 'remove' // 移除删除权限
      },
      {
        permission_id: 'payment:confirm',
        action: 'add' // 新增支付确认权限
      }
    ]
  }
});
```

## 权限检查

在前端组件中检查权限：
```javascript
import { hasPermission, hasAnyPermission } from '@/lib/permissionHelper';

// 检查单个权限
if (await hasPermission('order:read')) {
  // 显示订单
}

// 检查任意权限
if (await hasAnyPermission(['order:read', 'order:create'])) {
  // 显示订单相关内容
}
```

在后端函数中自动包含权限检查逻辑。

## 参考修改

根据实际业务需求，可修改的内容：

1. **权限细度** - 调整权限的粗细度（如 `order:read` vs `order:read_own`）
2. **角色职责** - 调整各角色拥有的权限
3. **新增权限** - 为新功能添加新的权限定义
4. **权限命名** - 统一权限名称格式（当前使用 `resource:action`）

修改后无需额外部署，系统会自动应用新的权限配置。