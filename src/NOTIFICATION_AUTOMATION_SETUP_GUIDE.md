# 通知自动化配置指南

## 📌 配置步骤

### 方法 1: 通过 Dashboard UI 配置（推荐）

1. 访问 **Dashboard** → **Automations**
2. 点击 **New Automation** → **Create from scratch**
3. 选择 **Data event** 触发类型
4. 按以下配置填写

---

## 🔔 需要配置的自动化列表

### 1. 订单付款通知

**配置**:
```json
{
  "name": "Notify_Order_Payment_Required",
  "type": "entity",
  "entity_name": "Order",
  "event_types": ["update"],
  "trigger_conditions": {
    "conditions": [
      {
        "field": "data.payment_status",
        "operator": "equals",
        "value": "awaiting_payment"
      },
      {
        "field": "old_data.payment_status",
        "operator": "not_equals",
        "value": "awaiting_payment"
      }
    ]
  }
}
```

**后端函数**: `createNotificationWithEmail`

**Payload 示例**:
```javascript
{
  "notification_type": "payment",
  "notification_subtype": "order_payment_required",
  "user_email": "{{data.user_email}}",
  "title": "订单 {{data.order_number}} 需付款",
  "content": "您的订单 {{data.order_number}} 需支付 {{data.estimated_jpy}} JPY，请及时付款。",
  "related_entity_type": "Order",
  "related_entity_id": "{{data.id}}",
  "related_url": "/MyOrders",
  "metadata": {
    "order_number": "{{data.order_number}}",
    "amount": "{{data.estimated_jpy}}"
  }
}
```

---

### 2. 订单需补款通知

**配置**:
```json
{
  "name": "Notify_Order_Supplement_Required",
  "type": "entity",
  "entity_name": "Order",
  "event_types": ["update"],
  "trigger_conditions": {
    "conditions": [
      {
        "field": "data.supplement_requested",
        "operator": "equals",
        "value": true
      },
      {
        "field": "old_data.supplement_requested",
        "operator": "not_equals",
        "value": true
      }
    ]
  }
}
```

**后端函数**: `createNotificationWithEmail`

---

### 3. 发货申请已送达中转地

**配置**:
```json
{
  "name": "Notify_Shipping_Arrived_Transit",
  "type": "entity",
  "entity_name": "ShippingPool",
  "event_types": ["update"],
  "trigger_conditions": {
    "conditions": [
      {
        "field": "data.transit_arrival_confirmed_at",
        "operator": "exists",
        "value": true
      },
      {
        "field": "old_data.transit_arrival_confirmed_at",
        "operator": "not_exists",
        "value": true
      }
    ]
  }
}
```

**后端函数**: `createNotificationWithEmail`

**Payload**:
```javascript
{
  "notification_type": "shipping_request",
  "notification_subtype": "shipping_request_arrived",
  "user_email": "{{data.creator_email}}",
  "title": "发货申请已送达中转地",
  "content": "您的发货申请已送达中转地 {{data.transit_location_name}}，正在处理中。",
  "related_entity_type": "ShippingPool",
  "related_entity_id": "{{data.id}}",
  "related_url": "/ShippingPool",
  "metadata": {
    "transit_location_name": "{{data.transit_location_name}}"
  }
}
```

---

### 4. 中转地已发货通知

**配置**:
```json
{
  "name": "Notify_Transit_Shipped",
  "type": "entity",
  "entity_name": "ShippingPool",
  "event_types": ["update"],
  "trigger_conditions": {
    "conditions": [
      {
        "field": "data.transit_shipped_date",
        "operator": "exists",
        "value": true
      },
      {
        "field": "old_data.transit_shipped_date",
        "operator": "not_exists",
        "value": true
      }
    ]
  }
}
```

**后端函数**: `createNotificationWithEmail`

---

### 5. 订单已入库通知

**配置**:
```json
{
  "name": "Notify_Order_In_Warehouse",
  "type": "entity",
  "entity_name": "Order",
  "event_types": ["update"],
  "trigger_conditions": {
    "conditions": [
      {
        "field": "data.order_status",
        "operator": "in_list",
        "value": ["in_warehouse", "in_storage"]
      },
      {
        "field": "old_data.order_status",
        "operator": "not_in_list",
        "value": ["in_warehouse", "in_storage"]
      }
    ]
  }
}
```

**后端函数**: `createNotificationWithEmail`

**Payload**:
```javascript
{
  "notification_type": "order_status",
  "notification_subtype": "order_in_warehouse",
  "user_email": "{{data.user_email}}",
  "title": "订单 {{data.order_number}} 已入库",
  "content": "您的订单 {{data.order_number}} 已入库，可以提交发货申请了。",
  "related_entity_type": "Order",
  "related_entity_id": "{{data.id}}",
  "related_url": "/MyOrders",
  "metadata": {
    "order_number": "{{data.order_number}}"
  }
}
```

---

### 6. 订单付款已确认通知

**配置**:
```json
{
  "name": "Notify_Order_Payment_Confirmed",
  "type": "entity",
  "entity_name": "Order",
  "event_types": ["update"],
  "trigger_conditions": {
    "conditions": [
      {
        "field": "data.payment_status",
        "operator": "in_list",
        "value": ["paid", "confirmed"]
      },
      {
        "field": "old_data.payment_status",
        "operator": "not_in_list",
        "value": ["paid", "confirmed"]
      }
    ]
  }
}
```

---

### 7. 订单已下单通知

**配置**:
```json
{
  "name": "Notify_Order_Purchased",
  "type": "entity",
  "entity_name": "Order",
  "event_types": ["update"],
  "trigger_conditions": {
    "conditions": [
      {
        "field": "data.order_status",
        "operator": "equals",
        "value": "purchased"
      },
      {
        "field": "old_data.order_status",
        "operator": "not_equals",
        "value": "purchased"
      }
    ]
  }
}
```

---

### 8. 订单加入发货池通知

**配置**:
```json
{
  "name": "Notify_Order_Added_To_Pool",
  "type": "entity",
  "entity_name": "Order",
  "event_types": ["update"],
  "trigger_conditions": {
    "conditions": [
      {
        "field": "data.pre_shipment.pool_created",
        "operator": "equals",
        "value": true
      },
      {
        "field": "old_data.pre_shipment.pool_created",
        "operator": "not_equals",
        "value": true
      }
    ]
  }
}
```

---

## 🔧 后端函数增强

### createNotificationWithEmail.js 变量替换逻辑

需要在函数中实现变量替换：

```javascript
function replaceVariables(template, order, pool, user) {
  return template
    .replace(/{{order_number}}/g, order?.order_number || '')
    .replace(/{{amount}}/g, (order?.estimated_jpy || 0).toLocaleString())
    .replace(/{{currency}}/g, order?.prepayment_currency || 'JPY')
    .replace(/{{user_name}}/g, user?.full_name || '')
    .replace(/{{transit_location_name}}/g, pool?.transit_location_name || '')
    .replace(/{{tracking_number}}/g, pool?.tracking_number || '')
    .replace(/{{pool_code}}/g, pool?.pool_code || '')
    .replace(/{{order_date}}/g, order?.submit_date || '');
}
```

---

## ✅ 验证步骤

配置完成后，按以下步骤验证：

1. **创建测试订单**
   - 验证 `order_created` 通知

2. **更新订单付款状态**
   - 设置为 `awaiting_payment`
   - 验证 `order_payment_required` 通知

3. **创建发货申请**
   - 验证 `shipping_request_sent` 通知

4. **确认中转地收货**
   - 设置 `transit_arrival_confirmed_at`
   - 验证 `shipping_request_arrived` 通知

5. **订单入库**
   - 设置 `order_status = 'in_warehouse'`
   - 验证 `order_in_warehouse` 通知

---

## 📊 监控和维护

### 查看自动化执行日志
- Dashboard → Automations → 点击具体自动化 → 查看执行历史

### 常见问题排查
1. **通知未触发**: 检查 trigger_conditions 是否正确
2. **变量未替换**: 检查后端函数的变量替换逻辑
3. **邮件未发送**: 检查用户的通知偏好设置

### 性能优化
- 避免过于频繁的触发条件
- 使用 changed_fields 过滤减少不必要的触发
- 批量操作时考虑合并通知

---

## 🎯 完成度

- [x] 通知模板管理页面完整显示所有子类型
- [x] 通知模板变量支持
- [x] 用户通知偏好设置
- [x] 自动化配置文档
- [ ] 自动化实际配置（需手动在 Dashboard 操作）
- [ ] 通知发送历史查看

**下一步**: 按本文档在 Dashboard 中配置自动化触发器