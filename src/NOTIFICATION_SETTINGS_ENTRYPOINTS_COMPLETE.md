# 通知系统入口添加完成

## ✅ 完成内容

### 1. 平台管理员设置中添加通知管理入口

**位置**: `/PlatformAdminSettings` → 新增"通知管理"标签页

**功能**:
- 跨租户通知（跳转到 `/PlatformNotificationManager`）
- 默认通知设置（跳转到 `/AdminNotificationDefaults`）
- 初始化默认模板按钮（一键创建所有子类型的默认模板）

---

### 2. 用户个人设置中添加通知设置入口

**位置**: `/UserPreferences` → "偏好设置"卡片中

**改动**:
- 移除了简单的"接收邮件通知"开关
- 添加了"通知偏好设置"按钮，跳转到 `/UserNotificationSettings`
- 用户可以在那里进行精细化的通知类型和子类型设置

---

### 3. 通知中心添加通知设置入口

**位置**: `/Notifications` → 页面右上角

**改动**:
- 在"全部标记为已读"按钮旁边添加了"通知设置"按钮
- 点击跳转到 `/UserNotificationSettings`

---

### 4. 创建默认通知模板初始化函数

**后端函数**: `initializeDefaultNotificationTemplates.js`

**功能**:
- 为所有 15 个通知子类型创建默认模板
- 如果模板已存在则更新，不存在则创建
- 包含完整的变量替换支持（如 `{{order_number}}`, `{{amount}}` 等）

**默认模板列表**:

**付款通知（4 个）**:
1. `order_payment_required` - 订单需付款
2. `order_supplement_required` - 订单需补款
3. `shipping_fee_required` - 需付运费
4. `shipping_fee_supplement_required` - 需补运费

**发货通知（3 个）**:
5. `shipping_request_sent` - 发货申请已发出
6. `shipping_request_arrived` - 发货申请已送达中转地
7. `transit_shipped` - 中转地已发货

**订单状态（5 个）**:
8. `order_created` - 订单创建（默认关闭）
9. `order_payment_confirmed` - 订单付款已确认
10. `order_purchased` - 订单已下单
11. `order_in_warehouse` - 订单已入库
12. `order_added_to_pool` - 订单已添加至发货申请（默认关闭）

**留言回复（1 个）**:
13. `new_reply` - 订单/发货申请有新回复

**其他通知（2 个）**:
14. `store_template_pending_review` - 店铺模板待审核（管理员）
15. `store_template_reviewed` - 店铺模板审核结果（用户）

---

## 📊 使用方式

### 平台管理员
1. 访问 `/PlatformAdminSettings`
2. 点击"通知管理"标签
3. 可快速跳转到：
   - 跨租户通知管理
   - 默认通知设置管理
4. 点击"初始化默认通知模板"按钮为当前租户创建所有默认模板

### 租户管理员
1. 访问 `/AdminNotificationDefaults` 设置新用户默认偏好
2. 访问 `/AdminNotificationTemplates` 管理通知模板
3. 访问 `/AdminNotificationManager` 创建租户内通知

### 普通用户
1. 访问 `/UserPreferences` → 点击"通知偏好设置"
2. 或访问 `/Notifications` → 点击右上角"通知设置"
3. 或直接访问 `/UserNotificationSettings`

---

## 🎯 通知设置层级

```
平台级默认设置 (NotificationPreferenceDefaults)
  └─ 租户级默认设置 (NotificationPreferenceDefaults.tenant_id=xxx)
       └─ 用户个人设置 (NotificationPreference)
            └─ 用户可在 /UserNotificationSettings 自定义
```

---

## 📝 技术实现

### 权限控制
- 平台管理员：所有通知功能
- 租户管理员：租户内通知和模板管理
- 普通用户：仅个人通知偏好设置

### 模板变量支持
所有模板支持以下变量：
- `{{order_number}}` - 订单号
- `{{amount}}` - 金额
- `{{currency}}` - 货币
- `{{user_name}}` - 用户名称
- `{{transit_location_name}}` - 中转地名称
- `{{tracking_number}}` - 运单号
- `{{pool_code}}` - 发货池代码
- `{{template_name}}` - 模板名称
- `{{review_result}}` - 审核结果

### 默认开关设置
- **默认开启站内通知**：所有类型
- **默认开启邮件通知**：付款类、重要发货通知
- **默认关闭邮件通知**：订单状态更新、非紧急通知

---

## ✅ 完成度

- [x] 平台管理员设置添加通知管理入口
- [x] 用户个人设置添加通知设置入口
- [x] 通知中心添加通知设置入口
- [x] 创建默认模板初始化函数
- [x] 为所有 15 个子类型创建默认模板
- [x] 支持模板变量替换
- [x] 权限控制完善

**总体完成度：100%**