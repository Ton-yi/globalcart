// Canonical permissions preset — used for display in AdminSettings and PlatformAdminSettings
// Each category contains a list of permissions; permissions may have `children` for visual nesting.

// 精简权限定义：只保留通过 RBAC（role-based access control）管理的权限
// 其他功能由 settings 或内置角色（admin/user/staff）控制
// TODO: 待实现的权限检查点标记在相应页面/组件中

export const PERMISSIONS_PRESET = [
  {
    category: "用户管理",
    color: "bg-red-100 text-red-700",
    permissions: [
      {
        name: "user:edit_user_permissions",
        display_name: "可编辑用户权限",
        description: "包括用户权限分配、角色分配"
      },
      {
        name: "user:audit_credit_application",
        display_name: "可审核记账申请",
        description: "可完全管理用户的记账申请"
      },
      {
        name: "role:edit_role",
        display_name: "可编辑角色",
        description: "可创建或修改或删除角色"
      }
    ]
  }
];