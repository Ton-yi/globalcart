# 库存存放期限功能完成总结

## ✅ 已完成的功能模块

### 1. 数据库实体更新

#### Order 实体新增字段
- `storage_deadline_date` - 仓储截止日期
- `storage_fee_per_day` - 每日仓储管理费（JPY）
- `storage_fee_currency` - 仓储费货币单位
- `accrued_storage_fee_jpy` - 累计仓储管理费
- `storage_days_overdue` - 超期天数
- `storage_reminder_sent` - 是否已发送到期提醒
- `storage_expired_sent` - 是否已发送超期通知
- `order_status` 新增 `expired` 状态（已超时）

#### BoxTemplate 实体新增字段
- `storage_fee_per_day` - 此外箱的每日仓储管理费（优先级高于默认设置）

#### StorageSettings 实体（新建）
- `storage_enabled` - 是否启用库存管理
- `default_storage_days` - 默认存放期限（天）
- `default_reminder_days` - 提醒天数
- `default_storage_fee_per_day` - 默认每日仓储费
- `storage_fee_currency` - 货币单位
- `on_deadline_action` - 到期后行为
- `deadline_status` - 超期状态
- 通知模板 ID 字段

### 2. 后端函数

#### 设置管理
- ✅ `getStorageSettings` - 获取租户库存设置
- ✅ `manageStorageSettings` - 管理租户库存设置

#### 费用计算
- ✅ `calculateStorageFee` - 计算订单仓储管理费
  - 从入库日开始计算
  - 优先使用外箱模板设置的费率
  - 返回累计费用和超期天数

#### 自动化检查
- ✅ `checkExpiredOrders` - 检查并处理超期订单
  - 每日自动运行（需配置 scheduled automation）
  - 发送即将到期提醒（默认 60 天）
  - 发送已到期通知（默认 90 天）
  - 根据设置追加仓储费
  - 根据设置更新订单状态

#### 通知模板
- ✅ `initializeStorageNotificationTemplates` - 初始化 3 个通知模板
  - `storage_upcoming_deadline` - 即将到期通知
  - `storage_expired` - 已到期通知
  - `storage_fee_required` - 需要支付逾期费用通知

### 3. 前端组件

#### 管理页面
- ✅ `AdminStorageSettings` - 库存设置管理页面
- ✅ `StorageSettingsManager` - 库存设置管理组件
  - 总开关控制
  - 存放期限设置（天）
  - 提醒天数设置
  - 每日仓储费设置
  - 到期行为选择
  - 超期状态选择

#### 集成到 AdminSettings
- ✅ 在"通知设置"标签页添加库存设置入口
- ✅ 与 Gmail、SMTP、Google Sheets 设置并列显示

#### 外箱模板管理
- ✅ `BoxTemplateManager` 更新
  - 添加"每日仓储管理费"字段
  - 在列表中显示仓储费信息

### 4. 路由配置
- ✅ `/AdminStorageSettings` 路由已添加到 App.jsx

## 📋 功能特性

### 模块化设计
- ✅ 管理员可选择开启或关闭
- ✅ 关闭后相关功能不显示
- ✅ 不影响其他功能正常使用

### 存放期限计算
- ✅ 从订单入库日（`in_warehouse_date`）开始计算
- ✅ 按天计数
- ✅ 默认 90 天超期，60 天提醒

### 到期后行为（管理员可配置）
1. **仅提醒** - 发送通知但不变更状态或收费
2. **变更订单状态** - 更新为"已超时"或"已取消"
3. **追加费用并提醒** - 累计仓储费并发送通知
4. **追加费用并变更状态** - 完整处理流程

### 仓储管理费
- ✅ 按天计费（超期后）
- ✅ 支持 JPY/CNY/USD 货币
- ✅ 外箱模板费率优先级 > 默认费率
- ✅ 费用累计至 `accrued_storage_fee_jpy`
- ✅ 在运费结算时一并收取

### 通知系统
- ✅ 3 个通知模板已创建
- ✅ 支持站内通知和邮件通知
- ✅ 可自定义模板内容
- ✅ 自动记录发送状态（避免重复发送）

## 🔧 待配置项

### Scheduled Automation（需手动配置）
需要创建一个 scheduled automation 来每日运行 `checkExpiredOrders` 函数：

```
自动化类型：scheduled
函数名：checkExpiredOrders
重复间隔：每 24 小时
开始时间：02:00（日本时间）
```

## 📊 显示和计算逻辑检查清单

### 订单详情页（需更新）
- [ ] 显示入库日期
- [ ] 显示仓储截止日期
- [ ] 显示已存放天数
- [ ] 显示超期天数（如已超期）
- [ ] 显示累计仓储费
- [ ] 在运费结算处包含仓储费

### 订单列表页（需更新）
- [ ] "已超时"订单状态显示（橙色/红色标签）
- [ ] 可筛选超期订单

### 发货池/运费结算（需更新）
- [ ] 计算总费用时包含 `accrued_storage_fee_jpy`
- [ ] 显示费用明细（仓储费单独列出）

### 用户端（需更新）
- [ ] 我的订单中显示仓储信息
- [ ] 超期订单特殊标识
- [ ] 仓储费支付提示

## 🎯 默认配置

根据需求文档：
- 默认存放期限：90 天
- 默认提醒天数：60 天
- 默认仓储费：0 JPY/天（管理员可设置）
- 到期行为：变更状态为"已超时"

## 💡 使用说明

1. **启用功能**：
   - 管理员进入 AdminSettings → 通知设置 → 库存存放期限管理
   - 开启总开关
   - 配置存放期限、提醒天数、仓储费等

2. **设置外箱模板仓储费**：
   - 进入外箱模板管理
   - 为特定外箱设置"每日仓储管理费"
   - 该外箱的订单将优先使用此费率

3. **初始化通知模板**：
   - 首次使用需调用 `initializeStorageNotificationTemplates` 函数
   - 可在通知模板管理中自定义内容

4. **配置自动化检查**：
   - 创建 scheduled automation
   - 每日运行 `checkExpiredOrders` 函数
   - 系统自动处理超期订单

## ⚠️ 注意事项

1. **历史订单**：功能启用前的订单不会自动计算仓储费
2. **状态一致性**："已超时"订单与"已取消"订单行为一致，仅显示不同
3. **费用结算**：仓储费在运费结算时一并收取，需确保结算逻辑包含此费用
4. **时区处理**：日期计算使用日本时间（Asia/Tokyo）

## 📝 后续建议

1. 在订单详情页添加仓储信息展示面板
2. 在运费结算页面添加仓储费明细
3. 为用户添加仓储期限提醒的推送通知
4. 添加仓储费豁免功能（管理员手动减免）
5. 创建仓储统计报表（超期订单数量、累计费用等）