# 自动通知触发指南

本文档说明如何在业务逻辑中集成自动通知创建。

## 核心函数

### 1. createNotificationWithEmail
**功能**: 创建站内通知并可选发送邮件
**路径**: `functions/createNotificationWithEmail`

**调用示例**:
```javascript
import { base44 } from "@/api/base44Client";

// 发送给单个用户
await base44.functions.invoke('createNotificationWithEmail', {
  user_email: "user@example.com",
  notification_type: "order_status",
  notification_subtype: "order_purchased",
  title: "订单已采购",
  content: "您的订单已采购完成",
  metadata: {
    order_number: "ORD123",
    amount: 5000,
    user_name: "张三"
  },
  related_entity_type: "Order",
  related_entity_id: "order_123",
  related_url: "/MyOrders",
  priority: "normal",
  send_email: true  // 是否发送邮件
});

// 发送给所有用户
await base44.functions.invoke('createNotificationWithEmail', {
  send_to_all: true,
  notification_type: "platform",
  notification_subtype: "system_maintenance",
  title: "系统维护通知",
  content: "系统将于今晚 23:00-24:00 进行维护",
  priority: "high",
  send_email: true
});
```

## 常见业务场景集成

### 场景 1: 订单需付款
在创建订单或更新付款状态时触发：
```javascript
// 在 createTenantOrder 或 updateTenantOrder 函数中
await base44.functions.invoke('createNotificationWithEmail', {
  user_email: order.user_email,
  notification_type: "payment",
  notification_subtype: "order_payment_required",
  title: `订单 ${order.order_number} 需付款`,
  content: `
    <p>尊敬的 ${order.user_name}：</p>
    <p>您的订单 <strong>${order.order_number}</strong> 需要付款。</p>
    <ul>
      <li>商品：${order.product_name}</li>
      <li>金额：${order.estimated_jpy} JPY</li>
      <li>付款截止：${order.payment_due_date}</li>
    </ul>
    <p>请及时付款，以免订单被取消。</p>
  `,
  metadata: {
    order_number: order.order_number,
    amount: order.estimated_jpy,
    user_name: order.user_name,
    due_date: order.payment_due_date
  },
  related_entity_type: "Order",
  related_entity_id: order.id,
  related_url: `/MyOrders`,
  priority: "high",
  send_email: true
});
```

### 场景 2: 订单入库
在订单状态更新为 `in_warehouse` 时触发：
```javascript
// 在 updateTenantOrder 函数中
if (newData.order_status === 'in_warehouse' && oldData.order_status !== 'in_warehouse') {
  await base44.functions.invoke('createNotificationWithEmail', {
    user_email: order.user_email,
    notification_type: "order_status",
    notification_subtype: "order_in_warehouse",
    title: `订单 ${order.order_number} 已入库`,
    content: `
      <p>好消息！您的订单已到达仓库。</p>
      <p>订单号：${order.order_number}</p>
      <p>商品：${order.product_name}</p>
      <p>您可以提交发货申请了。</p>
    `,
    metadata: {
      order_number: order.order_number,
      product_name: order.product_name
    },
    related_entity_type: "Order",
    related_entity_id: order.id,
    related_url: `/MyOrders`,
    send_email: false
  });
}
```

### 场景 3: 发货申请到达中转地
在发货池状态更新时触发：
```javascript
// 在 updateTransitPoolShipment 或相关函数中
if (pool.transit_arrival_confirmed_at && !oldData.transit_arrival_confirmed_at) {
  // 通知所有参与者
  const participantEmails = [...new Set(pool.order_ids.map(id => orders.find(o => o.id === id)?.user_email))];
  
  for (const email of participantEmails) {
    await base44.functions.invoke('createNotificationWithEmail', {
      user_email: email,
      notification_type: "shipping_request",
      notification_subtype: "shipping_request_arrived",
      title: `发货申请已到达中转地`,
      content: `您的发货申请已到达 ${pool.transit_location_name} 中转地，正在处理中。`,
      metadata: {
        pool_code: pool.pool_code,
        transit_location_name: pool.transit_location_name
      },
      related_entity_type: "ShippingPool",
      related_entity_id: pool.id,
      related_url: `/ShippingPool`,
      send_email: false
    });
  }
}
```

### 场景 4: 新留言回复
在订单或发货池添加消息时触发：
```javascript
// 在添加消息的函数中
if (message.from !== user.email) {
  await base44.functions.invoke('createNotificationWithEmail', {
    user_email: message.from === 'admin' ? order.user_email : adminEmail,
    notification_type: "message",
    notification_subtype: "new_reply",
    title: `您有新的留言回复`,
    content: `订单 ${order.order_number} 有新的留言，请查看。`,
    metadata: {
      order_number: order.order_number,
      message_preview: message.content.substring(0, 50)
    },
    related_entity_type: "Order",
    related_entity_id: order.id,
    related_url: `/MyOrders`,
    send_email: true
  });
}
```

## 通知模板变量

模板中可使用以下变量：

- `{{order_number}}` - 订单号
- `{{user_name}}` - 用户姓名
- `{{amount}}` - 金额
- `{{product_name}}` - 商品名称
- `{{pool_code}}` - 发货池代码
- `{{transit_location_name}}` - 中转地名称
- `{{due_date}}` - 截止日期

## 最佳实践

1. **使用模板**: 优先使用 NotificationTemplate 实体存储模板，而不是硬编码
2. **metadata 完整**: 始终提供完整的 metadata 对象，便于模板渲染和数据分析
3. **关联实体**: 填写 related_entity_type 和 related_entity_id，方便追踪
4. **优先级**: 根据紧急程度设置 priority（low/normal/high/urgent）
5. **邮件开关**: 重要通知（如付款）开启 send_email，普通状态更新可关闭
6. **批量发送**: 使用 send_to_all 时注意性能，避免频繁调用

## 权限说明

- 只有管理员（admin/tenant_admin/platform_admin）可以发送通知给所有用户
- 普通用户只能发送通知给特定用户（需要验证租户内）
- 系统自动通知不受限制

## 用户偏好设置

用户可以在 `/UserNotificationSettings` 页面设置：
- 各类通知的站内开关
- 各类通知的邮件开关
- 子类型级别的精细控制

发送通知时会自动检查用户偏好，不会发送用户关闭的通知类型。