import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { order_id } = await req.json();

    if (!order_id) {
      return Response.json({ error: 'Missing order_id' }, { status: 400 });
    }

    // 获取订单
    const order = await base44.entities.Order.get(order_id);
    if (!order) {
      return Response.json({ error: 'Order not found' }, { status: 404 });
    }

    // 验证订单属于当前用户
    if (order.user_email !== user.email) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 验证订单状态为已发货
    if (order.ticket_status !== 'shipped') {
      return Response.json({ error: 'Order is not shipped' }, { status: 400 });
    }

    // 更新订单状态为已收货
    await base44.entities.Order.update(order_id, {
      ticket_status: 'delivered',
      shipped_date: new Date().toISOString().split('T')[0],
      messages: [
        ...(order.messages || []),
        {
          id: `delivered_${Date.now()}`,
          from: user.full_name || user.email,
          from_email: user.email,
          role: 'user',
          content: '确认收货',
          timestamp: new Date().toISOString(),
          meta: { type: 'delivery_confirmed' }
        }
      ],
      unread_roles: ['admin']
    });

    // 创建通知
    try {
      await base44.functions.invoke('createNotification', {
        order_id,
        notification_type: 'order_status',
        notification_subtype: 'ticket_delivered',
        recipient_emails: [user.email],
        custom_title: '订单已确认收货',
        custom_content: `您的票务订单（${order.order_number}）已确认收货。感谢您的使用！`
      });
    } catch (e) {
      console.error('Failed to create notification:', e);
    }

    return Response.json({ 
      success: true, 
      message: '已确认收货',
      order_id 
    });

  } catch (error) {
    console.error('Error in confirmTicketDelivery:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});