# 完整的角色创建系统指南

## 系统概述

这是一个完整的多租户角色权限管理系统，支持：
- **权限定义**：创建细粒度的权限（如 `order:read`, `shipping_pool:update`）
- **角色管理**：创建角色并关联权限，支持权限继承
- **权限继承**：单一继承，子角色可以继承父角色的权限，并选择性地移除或新增权限
- **多租户支持**：平台管理员创建全局角色，租户管理员创建私有角色
- **导出/导入**：复用角色配置

## 核心概念

### Permission（权限）
定义系统中的具体操作权限。
- **全局权限**：由平台管理员创建，所有租户可用
- **租户权限**：由租户管理员创建，仅该租户可用

```json
{
  "name": "order:read",
  "description": "查看订单",
  "resource_type": "Order",
  "action": "read",
  "is_global": true
}
```

### Role（角色）
一组相关权限的集合。
- **全局角色**：由平台管理员创建，所有租户可用
- **租户角色**：由租户管理员创建，仅该租户可用
- **单一继承**：每个角色最多继承自一个父角色

```json
{
  "name": "OrderManager",
  "description": "订单管理员",
  "parent_role_id": null,
  "direct_permissions": ["order:read", "order:update", "order:delete"],
  "overridden_permissions": [],
  "is_global": true
}
```

### 权限继承

子角色继承父角色的所有权限，并可以进行两种操作：

1. **移除继承的权限** (`action: "remove"`)
   - 子角色可以选择性地移除父角色的某些权限
   - 例如：父角色有 `order:delete`，但子角色想移除这个权限

2. **新增额外权限** (`action: "add"`)
   - 子角色可以在父角色基础上新增权限
   - 例如：父角色只有 `order:read`，子角色新增 `order:update`

```json
{
  "name": "LimitedOrderManager",
  "parent_role_id": "parent_role_id",
  "direct_permissions": ["order:read"],
  "overridden_permissions": [
    {
      "permission_id": "order:delete",
      "action": "remove"  // 移除父角色的delete权限
    },
    {
      "permission_id": "shipping_pool:read",
      "action": "add"  // 新增额外权限
    }
  ]
}
```

## 后端函数

### manageRoles.js
处理角色的创建、更新、删除和查询。

**Actions:**
- `create`: 创建新角色
- `update`: 更新角色信息
- `delete`: 删除角色（前提：无用户或子角色使用该角色）
- `listRoles`: 列出可访问的角色
- `getRoleWithEffectivePermissions`: 获取角色及其有效权限

**权限检查：**
- 平台管理员可以创建和修改全局角色，查看所有租户角色
- 租户管理员只能创建和修改自己租户的角色

### managePermissions.js
处理权限的创建、更新、删除和查询。

**Actions:**
- `create`: 创建新权限
- `update`: 更新权限信息
- `delete`: 删除权限（前提：无角色使用该权限）
- `listPermissions`: 列出可访问的权限

**权限检查：**
- 平台管理员可以创建全局权限
- 租户管理员可以创建租户私有权限

### exportImportRoles.js
处理角色的导出和导入。

**Actions:**
- `exportRole`: 导出单个角色（包括权限详情）
- `exportTenantRoles`: 导出整个租户的所有角色和权限
- `importRoles`: 导入角色（支持 `replace` 或 `merge` 模式）

## 前端页面

### AdminRoleManagement
管理界面，位于 `/AdminRoleManagement`

两个标签页：
1. **权限管理**：创建、查看、删除权限
2. **角色管理**：创建、查看、删除角色；支持权限继承配置；导出角色

## 使用流程

### 1. 创建权限
进入 "角色权限管理" → "权限管理" 标签

1. 点击 "创建权限"
2. 填写：
   - 权限名称：`order:read`
   - 描述：`查看订单`
   - 资源类型：`Order`
   - 操作：`read`
3. 保存

### 2. 创建基础角色
进入 "角色权限管理" → "角色管理" 标签

1. 点击 "创建角色"
2. 填写：
   - 角色名称：`OrderViewer`
   - 角色描述：`订单查看员`
   - 不选择父角色（基础角色）
   - 选择权限：勾选 `order:read`
3. 保存

### 3. 创建子角色（继承）
1. 点击 "创建角色"
2. 填写：
   - 角色名称：`OrderManager`
   - 角色描述：`订单管理员`
   - 选择父角色：`OrderViewer`
   - 选择权限：勾选 `order:update`, `order:delete`
   - （系统会自动处理权限继承和合并）
3. 保存

### 4. 导出角色
1. 在角色列表中，点击角色右侧的 "下载" 按钮
2. 系统会生成 JSON 文件，包含角色和权限信息

### 5. 导入角色
1. 可在后续功能中添加导入界面
2. 支持两种模式：
   - `replace`：清除现有角色，导入新角色
   - `merge`：与现有角色合并

## 权限检查示例

### 前端权限检查
```javascript
import { hasPermission, hasAnyPermission, hasAllPermissions } from '@/lib/permissionHelper';

// 检查单个权限
if (await hasPermission('order:read')) {
  // 显示订单
}

// 检查任意权限
if (await hasAnyPermission(['order:read', 'order:update'])) {
  // 显示订单或编辑按钮
}

// 检查全部权限
if (await hasAllPermissions(['order:read', 'order:update', 'order:delete'])) {
  // 显示完整管理界面
}
```

### 后端权限检查
在后端函数中，权限检查已自动集成：
1. 函数获取当前用户
2. 调用 `calculateEffectivePermissions()` 获取有效权限
3. 对比用户权限和所需权限

## 多租户隔离

- **全局角色/权限**：`tenant_id` 为 `null`，所有租户可访问
- **租户私有角色/权限**：`tenant_id` 指定该租户，仅该租户可见
- **平台管理员**：可查看和修改所有租户的角色
- **租户管理员**：只能查看和修改自己租户的角色

## 扩展建议

### 1. 在 User 实体中集成 role_ids 字段
目前系统已为此准备，但 User 实体的 `role_ids` 字段需要在实际应用中启用。

### 2. 创建 UserRole 关联管理页面
在用户管理界面中，可以为每个用户分配多个角色。

### 3. 权限检查中间件
在后端函数中创建权限检查中间件，简化权限验证逻辑。

### 4. 角色模板库
创建预定义的角色模板（如 `TransitManager`, `Packer`, `FinanceStaff`），供快速配置。

### 5. 权限变更日志
记录所有角色和权限的变更操作，便于审计。

## 注意事项

1. **不能删除正在使用的角色**：如果角色被用户或其他角色继承，删除会失败
2. **循环继承保护**：系统应验证不存在循环继承关系
3. **权限粒度**：建议使用 `resource:action` 格式定义权限名称
4. **全局角色修改**：平台管理员修改全局角色会影响所有使用该角色的租户用户
5. **导出/导入冲突**：在导入时，如果名称冲突，系统会创建新的而不是覆盖（除非使用 `replace` 模式）