# 自动通知触发示例

本文档提供在业务逻辑中集成自动通知的示例代码。

## 核心函数

### `createNotificationWithEmail`
发送站内通知并可选发送邮件。

**参数:**
```javascript
{
  user_email: string,           // 接收用户邮箱
  notification_type: string,    // 通知类型：payment, shipping_request, order_status, message, other
  notification_subtype: string, // 通知子类型：order_payment_required, order_in_warehouse 等
  title: string,                // 标题（如使用模板则可选）
  content: string,              // 内容（如使用模板则可选）
  use_template: boolean,        // 是否使用模板渲染
  template_vars: object,        // 模板变量：{order_number, amount, user_name 等}
  send_email: boolean,          // 是否发送邮件
  related_entity_type: string,  // 关联实体类型：Order, ShippingPool 等
  related_entity_id: string,    // 关联实体 ID
  related_url: string,          // 点击跳转 URL
  priority: string,             // 优先级：low, normal, high, urgent
  metadata: object              // 额外元数据
}
```

**返回:**
```javascript
{
  success: true,
  notification_id: string,      // 通知 ID
  email_sent_count: number      // 邮件发送数量
}
```

## 业务场景示例

### 1. 订单需付款时发送通知

```javascript
// 在订单创建或更新付款状态时调用
await base44.functions.invoke('createNotificationWithEmail', {
  user_email: order.user_email,
  notification_type: 'payment',
  notification_subtype: 'order_payment_required',
  use_template: true,
  template_vars: {
    order_number: order.order_number,
    amount: order.estimated_jpy,
    user_name: order.user_name,
    due_date: order.payment_due_date
  },
  send_email: true,
  related_entity_type: 'Order',
  related_entity_id: order.id,
  related_url: `/Payment?order_id=${order.id}`,
  priority: 'high',
  metadata: {
    order_number: order.order_number,
    amount: order.estimated_jpy,
    currency: 'JPY'
  }
});
```

### 2. 订单入库时发送通知

```javascript
// 在订单状态更新为 in_warehouse 时调用
await base44.functions.invoke('createNotificationWithEmail', {
  user_email: order.user_email,
  notification_type: 'order_status',
  notification_subtype: 'order_in_warehouse',
  use_template: true,
  template_vars: {
    order_number: order.order_number,
    product_name: order.product_name,
    warehouse_date: order.in_warehouse_date,
    user_name: order.user_name
  },
  send_email: false,  // 入库通知默认不发送邮件
  related_entity_type: 'Order',
  related_entity_id: order.id,
  related_url: `/MyOrders`,
  priority: 'normal',
  metadata: {
    order_number: order.order_number,
    warehouse_date: order.in_warehouse_date
  }
});
```

### 3. 发货申请到达中转地

```javascript
// 在中转地负责人确认收货时调用
await base44.functions.invoke('createNotificationWithEmail', {
  user_email: pool.creator_email,
  notification_type: 'shipping_request',
  notification_subtype: 'shipping_request_arrived',
  use_template: true,
  template_vars: {
    pool_code: pool.pool_code,
    transit_location_name: pool.transit_location_name,
    arrival_date: new Date().toLocaleDateString('zh-CN'),
    user_name: pool.creator_name
  },
  send_email: true,
  related_entity_type: 'ShippingPool',
  related_entity_id: pool.id,
  related_url: `/ShippingPool`,
  priority: 'normal',
  metadata: {
    pool_code: pool.pool_code,
    transit_location_name: pool.transit_location_name
  }
});
```

### 4. 管理员留言回复

```javascript
// 在订单/发货池留言中管理员回复后调用
await base44.functions.invoke('createNotificationWithEmail', {
  user_email: order.user_email,
  notification_type: 'message',
  notification_subtype: 'admin_message',
  use_template: true,
  template_vars: {
    order_number: order.order_number,
    admin_name: '客服团队',
    message_preview: lastMessage.content.substring(0, 50)
  },
  send_email: true,
  related_entity_type: 'Order',
  related_entity_id: order.id,
  related_url: `/MyOrders`,
  priority: 'normal',
  metadata: {
    order_number: order.order_number,
    message_count: order.messages?.length || 0
  }
});
```

### 5. 订单已发货通知

```javascript
// 在订单状态更新为 shipped 时调用
await base44.functions.invoke('createNotificationWithEmail', {
  user_email: order.user_email,
  notification_type: 'order_status',
  notification_subtype: 'order_shipped',
  use_template: true,
  template_vars: {
    order_number: order.order_number,
    tracking_number: order.tracking_number,
    shipping_method: order.shipping_method,
    shipped_date: order.shipped_date
  },
  send_email: true,
  related_entity_type: 'Order',
  related_entity_id: order.id,
  related_url: `/MyOrders`,
  priority: 'normal',
  metadata: {
    order_number: order.order_number,
    tracking_number: order.tracking_number
  }
});
```

## 集成到现有业务逻辑

### 在订单状态变更时自动触发

```javascript
// 示例：在 updateTenantOrder 函数中添加通知逻辑
if (oldData.order_status !== newData.order_status) {
  const statusChangeMap = {
    'pending_confirmation': 'order_created',
    'purchased': 'order_purchased',
    'in_warehouse': 'order_in_warehouse',
    'shipped': 'order_shipped',
    'delivered': 'order_delivered'
  };

  const subtype = statusChangeMap[newData.order_status];
  if (subtype) {
    await base44.functions.invoke('createNotificationWithEmail', {
      user_email: newData.user_email,
      notification_type: 'order_status',
      notification_subtype: subtype,
      use_template: true,
      template_vars: {
        order_number: newData.order_number,
        user_name: newData.user_name,
        status: newData.order_status,
        date: new Date().toLocaleDateString('zh-CN')
      },
      send_email: subtype === 'order_payment_required' || subtype === 'order_shipped',
      related_entity_type: 'Order',
      related_entity_id: newData.id,
      related_url: `/MyOrders`,
      priority: subtype === 'order_payment_required' ? 'high' : 'normal'
    });
  }
}
```

### 在付款状态变更时自动触发

```javascript
// 示例：在付款确认时发送通知
if (oldData.payment_status !== newData.payment_status && newData.payment_status === 'paid') {
  await base44.functions.invoke('createNotificationWithEmail', {
    user_email: newData.user_email,
    notification_type: 'payment',
    notification_subtype: 'payment_confirmed',
    use_template: true,
    template_vars: {
      order_number: newData.order_number,
      amount: newData.paid_amount,
      payment_method: newData.payment_method,
      confirmed_date: new Date().toLocaleDateString('zh-CN')
    },
    send_email: true,
    related_entity_type: 'Order',
    related_entity_id: newData.id,
    related_url: `/Payment?order_id=${newData.id}`,
    priority: 'normal'
  });
}
```

## 最佳实践

1. **使用模板**: 始终使用 `use_template: true` 和 `template_vars`，让管理员可以通过模板管理页面自定义内容
2. **选择性子类型**: 使用标准的 `notification_subtype` 值，便于分类和筛选
3. **关联实体**: 始终提供 `related_entity_type` 和 `related_entity_id`，方便用户点击跳转
4. **邮件策略**: 重要通知（付款、发货）开启邮件，状态更新类通知默认关闭邮件
5. **优先级**: 付款相关使用 `high`，其他使用 `normal`
6. **元数据**: 在 `metadata` 中存储关键信息，便于后续扩展

## 测试

在开发环境中测试通知功能：

```javascript
// 测试发送通知
const testResult = await base44.functions.invoke('createNotificationWithEmail', {
  user_email: 'test@example.com',
  notification_type: 'order_status',
  notification_subtype: 'order_in_warehouse',
  use_template: true,
  template_vars: {
    order_number: 'TEST001',
    product_name: '测试商品',
    warehouse_date: '2026-06-10'
  },
  send_email: false
});

console.log('Test result:', testResult);
```

## 相关页面

- **用户通知中心**: `/Notifications` - 用户查看所有通知
- **用户通知设置**: `/UserNotificationSettings` - 用户自定义各类通知的邮件开关
- **管理员通知管理**: `/AdminNotificationManager` - 管理员手动创建通知
- **管理员模板管理**: `/AdminNotificationTemplates` - 管理员自定义通知模板