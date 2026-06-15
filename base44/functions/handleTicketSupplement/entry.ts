import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * 处理票务订单补款支付
 * 当实际购买票数超过预付票数时，用户需要补缴差额
 * 
 * actions:
 *  - request_payment: 生成补款支付链接
 *  - confirm_payment: 管理员确认补款已收到
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, order_id } = body;

    if (!action || !order_id) {
      return Response.json({ error: 'Missing action or order_id' }, { status: 400 });
    }

    // 获取订单（使用服务端角色）
    const order = await base44.asServiceRole.entities.Order.get(order_id);
    if (!order) {
      return Response.json({ error: 'Order not found' }, { status: 404 });
    }

    // 验证租户归属
    const userRecords = await base44.asServiceRole.entities.User.filter({ email: user.email });
    const tenantId = userRecords?.[0]?.tenant_id || null;
    if (!isPlatformAdmin && order.tenant_id !== tenantId) {
      return Response.json({ error: 'Forbidden: Order does not belong to your tenant' }, { status: 403 });
    }

    // 验证订单类型
    if (order.order_type !== 'ticket') {
      return Response.json({ error: '非票务订单' }, { status: 400 });
    }

    // 权限验证
    const isPlatformAdmin = user.role === 'platform_admin';
    const isTenantAdmin = user.role === 'admin' || user.role === 'tenant_admin';
    const isStaff = user.role === 'staff';
    const isUser = order.user_email === user.email;

    if (!isPlatformAdmin && !isTenantAdmin && !isStaff && !isUser) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 验证补款状态
    const supplementAmount = order.supplement_amount || 0;
    if (!order.supplement_requested || supplementAmount <= 0) {
      return Response.json({ error: '无需补款' }, { status: 400 });
    }

    if (action === 'request_payment') {
      // 用户申请补款支付
      if (!isUser) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }

      const { payment_method } = body;
      if (!payment_method) {
        return Response.json({ error: 'Missing payment_method' }, { status: 400 });
      }

      // 获取支付方式配置
      const userRecords = await base44.asServiceRole.entities.User.filter({ email: user.email });
      const tenantId = userRecords?.[0]?.tenant_id || null;
      
      const paymentMethods = await base44.asServiceRole.entities.PaymentMethod.filter(
        tenantId ? { tenant_id: tenantId, is_active: true } : { is_active: true }
      );
      
      const selectedMethod = (paymentMethods || []).find(m => (m.provider_key || m.name) === payment_method);
      if (!selectedMethod) {
        return Response.json({ error: 'Invalid payment method' }, { status: 400 });
      }

      // 生成支付链接（使用支付宝）
      if (selectedMethod.provider_key === 'alipay') {
        const outTradeNo = `SUP${order_id.slice(-12)}${Date.now()}`;
        const subject = `票务订单补款 - ${order.order_number}`;
        
        const paymentRes = await base44.functions.invoke('generateAlipayPaymentLink', {
          out_trade_no: outTradeNo,
          total_amount: supplementAmount,
          subject,
          body: `订单 ${order.order_number} 补款`,
          return_url: '', // 可选
          notify_url: '', // 可选，webhook
        });

        if (!paymentRes.data?.payment_url) {
          return Response.json({ error: 'Failed to generate payment link' }, { status: 500 });
        }

        // 更新订单状态（使用服务端角色）
        await base44.asServiceRole.entities.Order.update(order_id, {
          supplement_payment_url: paymentRes.data.payment_url,
          supplement_out_trade_no: outTradeNo,
          supplement_payment_method: payment_method,
          messages: [
            ...(order.messages || []),
            {
              id: `supplement_request_${Date.now()}`,
              from: user.full_name || user.email,
              from_email: user.email,
              role: 'user',
              content: `申请补款支付 ¥${supplementAmount.toLocaleString()} JPY，支付方式：${payment_method}`,
              timestamp: new Date().toISOString(),
              meta: { 
                type: 'supplement_payment_requested',
                amount: supplementAmount,
                payment_method: payment_method,
                out_trade_no: outTradeNo,
              }
            }
          ],
          unread_roles: ['admin']
        });

        return Response.json({ 
          success: true, 
          payment_url: paymentRes.data.payment_url,
          message: '补款支付链接已生成'
        });
      }

      // 其他支付方式：手动确认
      await base44.asServiceRole.entities.Order.update(order_id, {
        supplement_payment_method: payment_method,
        messages: [
          ...(order.messages || []),
          {
            id: `supplement_request_${Date.now()}`,
            from: user.full_name || user.email,
            from_email: user.email,
            role: 'user',
            content: `申请补款支付 ¥${supplementAmount.toLocaleString()} JPY，支付方式：${payment_method}，请等待管理员确认`,
            timestamp: new Date().toISOString(),
            meta: { 
              type: 'supplement_payment_requested',
              amount: supplementAmount,
              payment_method: payment_method,
            }
          }
        ],
        unread_roles: ['admin']
      });

      return Response.json({ 
        success: true, 
        message: '补款申请已提交，请等待管理员确认'
      });

    } else if (action === 'confirm_payment') {
      // 管理员确认补款
      if (!isPlatformAdmin && !isTenantAdmin && !isStaff) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }

      const { paid_amount, payment_proof_url } = body;
      const finalAmount = paid_amount !== undefined ? paid_amount : supplementAmount;

      await base44.asServiceRole.entities.Order.update(order_id, {
        supplement_requested: false,
        supplement_amount: 0,
        supplement_paid: true,
        supplement_paid_amount: finalAmount,
        supplement_paid_at: new Date().toISOString(),
        supplement_paid_by: user.email,
        supplement_payment_proof_url: payment_proof_url || null,
        paid_amount: (order.paid_amount || 0) + finalAmount,
        messages: [
          ...(order.messages || []),
          {
            id: `supplement_confirmed_${Date.now()}`,
            from: '系统通知',
            from_email: 'system@system.local',
            role: 'admin',
            content: `管理员已确认收到补款 ¥${finalAmount.toLocaleString()} JPY`,
            timestamp: new Date().toISOString(),
            is_system_notification: true,
            meta: { 
              type: 'supplement_payment_confirmed',
              amount: finalAmount,
              confirmed_by: user.email,
            }
          }
        ],
        unread_roles: ['user']
      });

      // 创建通知
      try {
        await base44.functions.invoke('createNotification', {
          order_id,
          notification_type: 'payment',
          notification_subtype: 'supplement_paid',
          recipient_emails: [order.user_email],
          custom_title: '补款已确认',
          custom_content: `您的票务订单（${order.order_number}）补款已确认，感谢您的配合。`
        });
      } catch (e) {
        console.error('Failed to create notification:', e);
      }

      return Response.json({ 
        success: true, 
        message: '补款已确认'
      });

    } else {
      return Response.json({ error: 'Unknown action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Error in handleTicketSupplement:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});