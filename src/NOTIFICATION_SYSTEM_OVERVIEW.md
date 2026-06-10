# 通知系统实现概述

## 已完成的核心功能

### 1. 实体设计 (Entities)
已创建以下实体：

#### Notification (通知)
- `tenant_id`: 租户 ID
- `user_email`: 接收用户邮箱
- `notification_type`: 通知分类 (payment, shipping_request, order_status, message, other, platform)
- `notification_subtype`: 通知子类型 (如 order_payment_required, shipping_request_arrived 等)
- `icon`: 通知图标
- `title`: 通知标题
- `content`: 通知内容 (支持 HTML/Markdown)
- `related_entity_type`: 关联实体类型
- `related_entity_id`: 关联实体 ID
- `related_url`: 点击跳转 URL
- `is_read`: 是否已读
- `read_at`: 阅读时间
- `is_system`: 是否系统通知
- `sender_email`: 发送者邮箱
- `priority`: 优先级 (low, normal, high, urgent)
- `metadata`: 额外元数据

#### NotificationPreference (通知偏好)
- `user_email`: 用户邮箱
- `in_app_enabled`: 站内通知开关
- `email_enabled`: 邮件通知开关
- `notification_settings`: 各类型通知的详细设置

#### NotificationTemplate (通知模板)
- `notification_type`: 通知类型
- `notification_subtype`: 通知子类型
- `title_template`: 标题模板 (支持变量)
- `content_template`: 内容模板
- `default_in_app`: 默认站内通知开关
- `default_email`: 默认邮件通知开关

### 2. 后端函数 (Backend Functions)

#### getUnreadNotificationCount
获取当前用户未读通知数量

#### getUserNotifications
获取用户通知列表 (支持分页和类型筛选)

#### markNotificationAsRead
标记通知为已读 (支持单个和全部标记)

#### createNotification
创建系统通知 (支持发送给单个用户或全体用户)

#### getNotificationPreferences
获取用户通知偏好设置

#### updateNotificationPreferences
更新用户通知偏好设置

### 3. 前端组件 (Frontend Components)

#### NotificationBell (components/common/NotificationBell)
- 显示未读通知数量徽章
- 悬浮显示最近 7 个未读通知
- 点击通知跳转到相关页面
- 支持"全部标记为已读"
- 快速筛选按钮 (付款通知 / 全部通知)

### 4. 页面 (Pages)

#### Notifications (pages/Notifications)
- 通知中心页面
- 按类型分类展示 (全部/付款/发货/订单状态/留言/其他)
- 支持标记为已读
- 显示通知详情

#### UserNotificationSettings (pages/UserNotificationSettings)
- 用户通知偏好设置
- 全局开关 (站内通知/邮件通知)
- 各通知类型的详细设置

### 5. 路由配置 (App.jsx)
已添加以下路由：
- `/Notifications` - 通知中心
- `/UserNotificationSettings` - 通知设置
- `/AdminNotificationManager` - 管理员通知管理

## 通知类型分类

### 1. 付款通知 (payment)
- `order_payment_required` - 订单需付款
- `order_supplement_required` - 订单需补款
- `shipping_fee_required` - 需付运费
- `shipping_fee_supplement_required` - 需补运费

### 2. 发货申请状态 (shipping_request)
- `shipping_request_sent` - 发货申请已发出
- `shipping_request_arrived` - 发货申请已送达中转地
- `transit_shipped` - 中转地已发货

### 3. 订单状态更新 (order_status)
- `order_created` - 订单创建 (默认关)
- `order_payment_confirmed` - 订单付款已被确认
- `order_purchased` - 订单已下单
- `order_in_warehouse` - 订单已入库
- `order_added_to_pool` - 订单已添加至发货申请 (默认关)

### 4. 留言 (message)
- `new_reply` - 某个订单或发货申请有新回复

### 5. 其他 (other)
- `store_template_pending_review` - 有新的店铺模板提交待审核 (管理员)
- `store_template_reviewed` - 店铺模板已通过审核或已被拒绝 (用户)

### 6. 平台通知 (platform)
- 平台管理员发送给特定或所有租户的通知

## 待实现功能

### 1. 自动通知触发
需要在以下场景自动创建通知：

#### 订单相关
- 订单创建时 → 发送通知给用户
- 订单付款确认时 → 发送通知给用户
- 订单入库时 → 发送通知给用户
- 订单添加到发货申请时 → 发送通知给用户

#### 付款相关
- 生成付款链接时 → 发送付款通知
- 需要补款时 → 发送补款通知
- 运费确认时 → 发送运费通知

#### 发货相关
- 发货申请提交时 → 发送通知
- 中转地确认收货时 → 发送通知
- 中转地发货时 → 发送通知

#### 留言相关
- 订单/发货申请有新回复时 → 发送通知

### 2. 管理员通知管理页面
需要创建 `pages/AdminNotificationManager`：
- 创建新通知 (支持 HTML/Markdown 编辑器)
- 选择通知类型和子类型
- 选择接收用户 (单个/全体/特定角色)
- 使用通知模板
- 查看通知历史

### 3. 平台管理员通知管理
需要创建平台级通知管理：
- 发送给特定或所有租户
- 使用 HTML/Markdown 格式
- 设置优先级和过期时间

### 4. 通知模板管理
需要创建模板管理页面：
- 查看所有通知类型的默认模板
- 编辑模板内容
- 设置默认开关状态

### 5. 邮件通知集成
需要集成邮件发送功能：
- 使用 SendEmail 集成
- 根据用户偏好发送邮件
- 使用模板渲染邮件内容

## 默认通知模板示例

### 订单需付款
```
标题：订单 {{order_number}} 需付款
内容：您的订单 {{order_number}} 需要支付 {{amount}} JPY。请点击查看详情并完成付款。
```

### 订单已入库
```
标题：订单 {{order_number}} 已入库
内容：您的订单 {{order_number}} 已到达仓库并入库，重量为 {{weight}}g。
```

### 发货申请已送达中转地
```
标题：发货申请已到达中转地 {{transit_location_name}}
内容：您的发货申请 ({{pool_code}}) 已安全到达{{transit_location_name}}中转地，工作人员正在确认收货。
```

### 中转地已发货
```
标题：中转地已发货 - 运单号 {{tracking_number}}
内容：您的货物已从{{transit_location_name}}发出，运单号为{{tracking_number}}，请注意查收。
```

## 下一步实现建议

1. **完善通知设置页面** - 当前 UserNotificationSettings 页面需要补全导入和完整逻辑
2. **创建管理员通知管理页面** - AdminNotificationManager
3. **集成自动通知触发** - 在现有业务逻辑中添加通知创建调用
4. **创建通知模板管理** - 允许管理员自定义模板
5. **集成邮件通知** - 使用 SendEmail 集成发送邮件

## 使用说明

### 用户使用
1. 用户登录后，右上角铃铛图标显示未读通知数量
2. 点击铃铛可查看最近 7 个未读通知
3. 点击通知可跳转到相关页面
4. 访问 `/Notifications` 查看所有通知
5. 访问 `/UserNotificationSettings` 设置通知偏好

### 管理员使用
1. 访问 `/AdminNotificationManager` 创建新通知
2. 可选择通知类型、接收用户、使用模板
3. 可发送通知给单个用户或全体用户

### 平台管理员使用
1. 可创建平台级通知
2. 可发送给特定或所有租户
3. 使用 HTML/Markdown 格式编辑内容

## 注意事项

1. **权限控制** - 只有管理员可以发送系统通知
2. **租户隔离** - 通知按 tenant_id 隔离，确保数据安全
3. **性能优化** - 未读数量每 30 秒刷新一次
4. **用户体验** - 通知中心支持分页加载，避免一次性加载过多数据