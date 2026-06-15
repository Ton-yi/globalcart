import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * 处理票务订单补款支付
 * 当实际票数 > 预付票数时，用户需要补缴差额
 * 此函数创建补款支付链接并更新订单状态
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { order_id, payment_method } = await req.json();

    if (!order_id || !payment_method) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 获取订单
    const order = await base44.asServiceRole.entities.Order.get(order_id);
    if (!order) {
      return Response.json({ error: 'Order not found' }, { status: 404 });
    }

    // 验证订单属于当前用户
    if (order.user_email !== user.email) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 验证订单类型
    if (order.order_type !== 'ticket') {
      return Response.json({ error: '非票务订单' }, { status: 400 });
    }

    // 验证是否存在补款
    if (!order.supplement_requested || !(order.supplement_amount || 0) > 0) {
      return Response.json({ error: '无需补款' }, { status: 400 });
    }

    // 验证订单状态（必须是已收货或待收货状态才能补款）
    const validStatuses = ['delivered', 'shipped', 'in_warehouse'];
    if (!validStatuses.includes(order.ticket_status)) {
      return Response.json({ error: '订单状态不允许补款' }, { status: 400 });
    }

    // 检查是否已支付补款
    if (order.supplement_paid) {
      return Response.json({ error: '补款已支付' }, { status: 400 });
    }

    // 获取支付方式配置
    const paymentMethods = await base44.asServiceRole.entities.PaymentMethod.filter({ 
      tenant_id: order.tenant_id, 
      is_active: true 
    });
    const selectedMethod = (paymentMethods || []).find(m => (m.provider_key || m.name) === payment_method);
    
    if (!selectedMethod) {
      return Response.json({ error: '无效的支付方式' }, { status: 400 });
    }

    const paymentCurrency = selectedMethod.payment_currency || 'JPY';
    const supplementAmount = order.supplement_amount;

    // 生成支付链接（使用支付宝）
    let paymentUrl = null;
    let tradeNo = null;

    if (payment_method === 'alipay') {
      // 生成商户订单号
      const now = new Date();
      const jstOffset = 9 * 60 * 60 * 1000;
      const jstNow = new Date(now.getTime() + jstOffset);
      const dateStr = `${jstNow.getUTCFullYear()}${String(jstNow.getUTCMonth() + 1).padStart(2, '0')}${String(jstNow.getUTCDate()).padStart(2, '0')}`;
      const prefix = `SUP${dateStr}`;
      
      // 获取今天的补款订单数
      const existingSupplements = await base44.asServiceRole.entities.Order.filter({ 
        tenant_id: order.tenant_id,
      });
      const todaySupplements = (existingSupplements || []).filter(o => 
        (o.order_number || '').startsWith(prefix)
      );
      const maxSeq = todaySupplements.reduce((max, o) => {
        const seq = parseInt((o.order_number || '').slice(prefix.length), 10) || 0;
        return Math.max(max, seq);
      }, 0);
      
      tradeNo = `${prefix}${String(maxSeq + 1).padStart(4, '0')}`;

      // 调用支付宝生成支付链接
      const alipayRes = await base44.functions.invoke('generateAlipayPaymentLink', {
        out_trade_no: tradeNo,
        total_amount: supplementAmount,
        subject: `票务订单补款 - ${order.order_number}`,
        body: `补款金额：¥${supplementAmount.toLocaleString()} JPY`,
        payment_currency: paymentCurrency,
      });

      if (alipayRes.data?.payment_url) {
        paymentUrl = alipayRes.data.payment_url;
      }
    }

    // 更新订单，记录补款信息
    const updateData = {
      supplement_payment_method: payment_method,
      supplement_payment_currency: paymentCurrency,
      supplement_trade_no: tradeNo,
      supplement_payment_url: paymentUrl,
      supplement_payment_status: 'awaiting_payment',
      messages: [
        ...(order.messages || []),
        {
          id: `supplement_request_${Date.now()}`,
          from: user.full_name || user.email,
          from_email: user.email,
          role: 'user',
          content: `申请补款支付：¥${supplementAmount.toLocaleString()} JPY，支付方式：${payment_method}`,
          timestamp: new Date().toISOString(),
          meta: { type: 'supplement_payment_request', amount: supplementAmount, payment_method }
        }
      ],
      unread_roles: ['admin']
    };

    await base44.asServiceRole.entities.Order.update(order_id, updateData);

    return Response.json({
      success: true,
      payment_url: paymentUrl,
      trade_no: tradeNo,
      amount: supplementAmount,
      currency: paymentCurrency,
    });

  } catch (error) {
    console.error('requestTicketSupplement error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});