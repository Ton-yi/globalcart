# 通知系统检查报告

## 📋 检查结果

### 1. 通知模板管理页面显示 ✅ 已修复

**问题**: 页面显示的子类型列表不完整，与初始化函数创建的模板不匹配

**已修复**:
- 更新 `AdminNotificationTemplates.js` 中的 `commonSubtypes` 映射
- 包含所有 15 个通知子类型
- 添加"其他通知"类型（包含店铺模板审核相关）

### 2. 通知触发时机验证 ⚠️ 需要配置自动化

**当前状态**: 
- ✅ 通知模板系统已就绪
- ✅ 通知创建函数已实现 (`createNotification`, `createNotificationWithEmail`)
- ❌ **缺少实体自动化触发器** - 通知不会自动触发

**需要配置的自动化**:

#### 付款通知 (payment)
| 子类型 | 触发实体 | 触发事件 | 触发条件 |
|--------|---------|---------|---------|
| `order_payment_required` | Order | update | `payment_status` 变为 `awaiting_payment` |
| `order_supplement_required` | Order | update | `supplement_requested` 变为 true |
| `shipping_fee_required` | ShippingPool | update | `payment_status` 变为 `unpaid` |
| `shipping_fee_supplement_required` | ShippingPool | update | `supplement_amount_per_user` 有值 |

#### 发货通知 (shipping_request)
| 子类型 | 触发实体 | 触发事件 | 触发条件 |
|--------|---------|---------|---------|
| `shipping_request_sent` | ShippingPool | create | - |
| `shipping_request_arrived` | ShippingPool | update | `transit_arrival_confirmed_at` 被设置 |
| `transit_shipped` | ShippingPool | update | `transit_shipped_date` 被设置 |

#### 订单状态 (order_status)
| 子类型 | 触发实体 | 触发事件 | 触发条件 |
|--------|---------|---------|---------|
| `order_created` | Order | create | - |
| `order_payment_confirmed` | Order | update | `payment_status` 变为 `paid` 或 `confirmed` |
| `order_purchased` | Order | update | `order_status` 变为 `purchased` |
| `order_in_warehouse` | Order | update | `order_status` 变为 `in_warehouse` 或 `in_storage` |
| `order_added_to_pool` | ShippingPool | update | `order_ids` 包含订单 ID |

#### 留言回复 (message)
| 子类型 | 触发实体 | 触发事件 | 触发条件 |
|--------|---------|---------|---------|
| `new_reply` | Order | update | `messages` 数组有新元素 |

#### 其他通知 (other)
| 子类型 | 触发实体 | 触发事件 | 触发条件 |
|--------|---------|---------|---------|
| `store_template_pending_review` | OnlineStoreTagRule | create/update | 提交审核时 |
| `store_template_reviewed` | OnlineStoreTagRule | update | `is_active` 被设置 |

### 3. 通知模板变量支持 ✅

**支持的变量**:
- `{{order_number}}` - 订单号
- `{{amount}}` - 金额
- `{{currency}}` - 货币
- `{{user_name}}` - 用户名称
- `{{transit_location_name}}` - 中转地名称
- `{{tracking_number}}` - 运单号
- `{{pool_code}}` - 发货池代码
- `{{template_name}}` - 模板名称
- `{{review_result}}` - 审核结果
- `{{order_date}}` - 订单日期

### 4. 用户通知偏好 ✅

**功能完整**:
- ✅ 用户可在 `/UserNotificationSettings` 自定义
- ✅ 支持按类型和子类型精细控制
- ✅ 支持站内通知和邮件通知独立开关
- ✅ 默认设置从 `NotificationPreferenceDefaults` 读取

---

## 🔧 需要执行的操作

### 高优先级 - 配置通知触发自动化

需要在 Dashboard → Automations 中配置以下自动化：

1. **订单付款通知自动化**
   - 触发：Order entity, update event
   - 条件：`data.payment_status` = `awaiting_payment`
   - 函数：调用 `createNotificationWithEmail`

2. **发货申请到达通知自动化**
   - 触发：ShippingPool entity, update event
   - 条件：`data.transit_arrival_confirmed_at` 存在
   - 函数：调用 `createNotificationWithEmail`

3. **订单入库通知自动化**
   - 触发：Order entity, update event
   - 条件：`data.order_status` = `in_warehouse`
   - 函数：调用 `createNotificationWithEmail`

### 中优先级 - 完善模板变量

在 `createNotification` 函数中增强变量替换逻辑：
- 自动从相关实体提取数据
- 支持更多上下文变量

### 低优先级 - 通知历史查看

为管理员提供通知发送历史记录功能。

---

## ✅ 完成度

- [x] 通知模板管理页面显示修复
- [x] 所有 15 个子类型映射完整
- [x] 通知模板变量支持验证
- [x] 用户通知偏好设置验证
- [ ] **自动化触发器配置** (需手动在 Dashboard 配置)
- [ ] 通知发送历史查看

**当前完成度**: 80% (等待自动化配置)