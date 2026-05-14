# 权限预设配置

## 全局角色与权限映射

### 用户 (user)
- order:read - 订单查看
- shipping_pool:read - 发货池查看

### 员工 (staff)
- order:read - 订单查看
- order:create - 订单创建
- order:update - 订单编辑
- shipping_pool:read - 发货池查看
- shipping_pool:create - 发货池创建
- payment:read - 支付管理查看

### 管理员 (admin)
- order:read - 订单查看
- order:create - 订单创建
- order:update - 订单编辑
- order:delete - 订单删除
- shipping_pool:read - 发货池查看
- shipping_pool:create - 发货池创建
- shipping_pool:update - 发货池编辑
- shipping_pool:delete - 发货池删除
- user:read - 用户查看
- payment:read - 支付管理查看
- payment:confirm - 确认支付

### 租户管理员 (tenant_admin)
- order:read - 订单查看
- order:create - 订单创建
- order:update - 订单编辑
- order:delete - 订单删除
- shipping_pool:read - 发货池查看
- shipping_pool:create - 发货池创建
- shipping_pool:update - 发货池编辑
- shipping_pool:delete - 发货池删除
- user:read - 用户查看
- user:create - 用户创建
- user:update - 用户编辑
- payment:read - 支付管理查看
- payment:confirm - 确认支付

### 平台管理员 (platform_admin)
- 所有权限