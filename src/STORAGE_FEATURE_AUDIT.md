# 库存存放期限功能 - 完整审计检查清单

## ✅ 已完成的功能模块

### 1. 数据库实体 Schema
- ✅ `StorageSettings` 实体 - 完整的租户级库存配置
  - tenant_id, storage_enabled, default_storage_days, default_reminder_days
  - default_storage_fee_per_day, storage_fee_currency
  - on_deadline_action, deadline_status
  - deadline_reminder_template_id, expired_reminder_template_id, fee_reminder_template_id
  - updated_by, updated_at

- ✅ `Order` 实体 - 仓储相关字段完整
  - storage_deadline_date - 仓储截止日期
  - storage_fee_per_day - 每日仓储费率
  - storage_fee_currency - 仓储费货币
  - accrued_storage_fee_jpy - 累计仓储费
  - storage_days_overdue - 超期天数
  - storage_reminder_sent - 是否已发送到期提醒
  - storage_expired_sent - 是否已发送超期通知
  - order_status 包含 'expired' 状态

- ✅ `BoxTemplate` 实体 - 外箱模板支持仓储费
  - storage_fee_per_day - 外箱级别的每日仓储费（优先级高于默认设置）

### 2. 后端函数
- ✅ `getStorageSettings` - 获取租户库存设置
- ✅ `manageStorageSettings` - 管理租户库存设置
- ✅ `calculateStorageFee` - 计算单个订单仓储费
- ✅ `calculateShippingPoolStorageFee` - 计算拼邮订单批量仓储费
- ✅ `checkExpiredOrders` - 自动化超期检查和处理
- ✅ `initializeStorageNotificationTemplates` - 初始化 3 个通知模板

### 3. 前端组件
- ✅ `StorageSettingsManager` - 库存设置管理组件（集成到 AdminSettings）
- ✅ `OrderStorageInfo` - 订单仓储信息展示组件
- ✅ `BoxTemplateManager` - 外箱模板管理（已添加仓储费字段）
- ✅ AdminSettings → 库存存放 tab

### 4. 路由配置
- ✅ AdminSettings 中的"库存存放"tab
- ✅ `/AdminStorageSettings` 路由已移除（集成到 AdminSettings）

### 5. 通知系统
- ✅ 3 个通知子类型已添加到：
  - AdminNotificationTemplates（管理员可编辑模板）
  - AdminNotificationDefaults（新用户默认设置）
  - UserNotificationSettings（用户个人偏好设置）
- ✅ 通知子类型：
  - `storage_upcoming_deadline` - 仓储期限即将到期
  - `storage_expired` - 仓储期限已超期
  - `storage_fee_required` - 需要支付逾期仓储费

### 6. 权限控制
- ✅ 所有后端函数均验证管理员权限
- ✅ 租户数据隔离（通过 tenant_id）
- ✅ checkExpiredOrders 支持自动化模式（无用户上下文）

## ⚠️ 发现的问题

### 1. 缺少 Scheduled Automation
**问题**: `checkExpiredOrders` 函数没有配置每日自动运行
**影响**: 超期订单不会自动检查和处理，需要手动触发
**解决方案**: 创建 scheduled automation，每日运行 `checkExpiredOrders`

### 2. 通知模板 ID 未关联
**问题**: StorageSettings 中的 template_id 字段没有自动关联到创建的模板
**影响**: 通知发送时无法使用自定义模板
**解决方案**: 在 initializeStorageNotificationTemplates 中返回模板 ID 并更新 StorageSettings

### 3. 初始化数据缺失
**问题**: 新租户没有 StorageSettings 记录
**影响**: 管理员无法立即配置库存设置
**解决方案**: 在租户创建时自动初始化 StorageSettings 记录

### 4. 订单入库时未设置 storage_deadline_date
**问题**: 订单进入 in_storage 状态时没有自动计算和设置 storage_deadline_date
**影响**: 无法准确追踪订单的仓储截止日期
**解决方案**: 在订单状态变更时自动设置此字段

## 🔧 需要修复的项目

### 高优先级
1. **创建 scheduled automation** - 每日运行 checkExpiredOrders
2. **修复通知模板关联** - 初始化时保存模板 ID 到 StorageSettings
3. **订单入库时设置 deadline** - 在订单状态变为 in_storage 时自动计算

### 中优先级
4. **租户创建时初始化** - 新租户自动创建 StorageSettings 记录
5. **前端显示优化** - 在订单列表/详情页显示仓储状态
6. **运费结算集成** - 在支付页面显示和计算仓储费

### 低优先级
7. **报表统计** - 在 AdminReports 中添加仓储费收入统计
8. **批量操作** - 管理员手动触发超期订单处理

## 📋 模块化设计检查

### ✅ 符合模块化设计
- **独立开关**: storage_enabled 控制功能启用/关闭
- **设置驱动**: 所有行为通过 StorageSettings 配置，无硬编码
- **通知解耦**: 使用现有通知系统，不重复造轮子
- **费用分离**: 仓储费独立计算，在运费结算时合并收取
- **外箱优先级**: BoxTemplate 可覆盖默认设置，灵活度高

### ✅ 租户隔离
- 所有数据查询均使用 tenant_id 过滤
- 后端函数验证用户租户权限
- 使用 service role 时确保租户上下文正确

### ✅ 扩展性
- 支持多租户独立配置
- 通知模板可自定义
- 仓储费支持多货币
- 超期行为可配置（提醒/收费/变更状态）

## 🎯 功能可用性评估

### 当前状态：部分可用（70%）
**可以使用的功能**:
- ✅ 管理员配置库存设置
- ✅ 外箱模板设置仓储费
- ✅ 查看订单仓储信息
- ✅ 通知模板管理
- ✅ 用户自定义通知偏好

**需要修复才能完整使用**:
- ❌ 自动化超期检查（需配置 automation）
- ❌ 订单入库时自动设置截止日期
- ❌ 通知模板 ID 关联
- ❌ 运费结算时计算仓储费

### 修复后状态：完全可用（100%）
完成高优先级修复后，功能将完全可用且符合生产环境要求。

## 📝 建议的下一步

1. **立即修复**:
   - 创建 scheduled automation 配置
   - 修复 initializeStorageNotificationTemplates 返回模板 ID
   - 在订单入库流程中添加 storage_deadline_date 设置

2. **测试流程**:
   - 创建测试订单并设置 in_warehouse_date
   - 手动运行 checkExpiredOrders 验证逻辑
   - 验证通知发送和用户接收
   - 验证仓储费计算和运费结算集成

3. **文档完善**:
   - 更新用户使用指南
   - 添加管理员操作手册
   - 记录常见问题和解决方案

## ✅ 总结

库存存放期限功能的核心架构完整，符合模块化设计要求，租户隔离和权限控制正确。主要遗漏的是自动化配置和一些初始化逻辑，修复后即可投入生产使用。