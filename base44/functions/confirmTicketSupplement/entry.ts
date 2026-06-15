import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * 确认票务订单补款支付
 * 管理员确认收到补款后调用此函数
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 权限验证：只允许管理员
    const isAdmin = ['platform_admin', 'admin', 'tenant_admin', 'staff'].includes(user.role);
    if (!isAdmin) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { order_id, confirmed } = await req.json();

    if (!order_id) {
      return Response.json({ error: 'Missing order_id' }, { status: 400 });
    }

    // 获取订单
    const order = await base44.asServiceRole.entities.Order.get(order_id);
    if (!order) {
      return Response.json({ error: 'Order not found' }, { status: 404 });
    }

    // 验证订单类型
    if (order.order_type !== 'ticket') {
      return Response.json({ error: '非票务订单' }, { status: 400 });
    }

    if (confirmed) {
      // 确认补款支付
      const updateData = {
        supplement_paid: true,
        supplement_paid_at: new Date().toISOString(),
        supplement_paid_by: user.email,
        paid_amount: (order.paid_amount || 0) + (order.supplement_amount || 0),
        messages: [
          ...(order.messages || []),
          {
            id: `supplement_confirmed_${Date.now()}`,
            from: user.full_name || user.email,
            from_email: user.email,
            role: 'admin',
            content: `管理员已确认补款支付：¥${(order.supplement_amount || 0).toLocaleString()} JPY`,
            timestamp: new Date().toISOString(),
            is_system_notification: true,
            meta: { type: 'supplement_confirmed', amount: order.supplement_amount }
          }
        ],
        unread_roles: ['user']
      };

      await base44.asServiceRole.entities.Order.update(order_id, updateData);

      return Response.json({
        success: true,
        message: '补款支付已确认',
      });
    } else {
      // 取消补款确认（如果需要）
      const updateData = {
        supplement_paid: false,
        supplement_paid_at: null,
        supplement_paid_by: null,
        messages: [
          ...(order.messages || []),
          {
            id: `supplement_cancelled_${Date.now()}`,
            from: user.full_name || user.email,
            from_email: user.email,
            role: 'admin',
            content: `管理员已取消补款支付确认`,
            timestamp: new Date().toISOString(),
            is_system_notification: true,
            meta: { type: 'supplement_cancelled' }
          }
        ],
        unread_roles: ['user']
      };

      await base44.asServiceRole.entities.Order.update(order_id, updateData);

      return Response.json({
        success: true,
        message: '补款支付确认已取消',
      });
    }

  } catch (error) {
    console.error('confirmTicketSupplement error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});