import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { order_id, shipping_request_data } = await req.json();

    if (!order_id || !shipping_request_data) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
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

    // 验证订单状态为已入库
    if (order.ticket_status !== 'in_warehouse') {
      return Response.json({ error: 'Order is not in warehouse' }, { status: 400 });
    }

    // 验证发货申请数据
    const {
      shipping_method_type,
      shipping_method_code,
      pickup_location_id,
      expected_delivery_datetime,
      pickup_datetime,
      address,
      note,
      payment_amount_jpy,
      payment_method
    } = shipping_request_data;

    if (!['domestic', 'pickup'].includes(shipping_method_type)) {
      return Response.json({ error: 'Invalid shipping method type' }, { status: 400 });
    }

    if (shipping_method_type === 'domestic') {
      if (!shipping_method_code || !address || !expected_delivery_datetime) {
        return Response.json({ error: 'Missing required fields for domestic shipping' }, { status: 400 });
      }
    } else if (shipping_method_type === 'pickup') {
      if (!pickup_location_id || !pickup_datetime) {
        return Response.json({ error: 'Missing required fields for pickup' }, { status: 400 });
      }
    }

    // 更新订单状态为已发货
    const updateData = {
      ticket_status: 'shipped',
      shipping_method: shipping_method_type === 'domestic' ? shipping_method_code : 'pickup',
      destination_country: 'JP',
      recipient_name: shipping_method_type === 'domestic' ? address.recipient_name : user.full_name,
      address_line1: shipping_method_type === 'domestic' ? address.addr1 : null,
      address_line2: shipping_method_type === 'domestic' ? address.addr2 : null,
      city: shipping_method_type === 'domestic' ? address.city : null,
      state: shipping_method_type === 'domestic' ? address.state : null,
      postal_code: shipping_method_type === 'domestic' ? address.postal_code : null,
      recipient_phone: shipping_method_type === 'domestic' ? address.phone : user.phone,
      pre_shipment: {
        ...(order.pre_shipment || {}),
        shipping_method: shipping_method_type === 'domestic' ? shipping_method_code : 'pickup',
        scheduled_ship_date: shipping_method_type === 'domestic' ? expected_delivery_datetime : pickup_datetime,
        user_note: note,
        transit_location_id: shipping_method_type === 'pickup' ? pickup_location_id : null,
        transit_location_name: shipping_method_type === 'pickup' 
          ? (await base44.entities.PickupLocation.get(pickup_location_id))?.name 
          : null,
      },
      messages: [
        ...(order.messages || []),
        {
          id: `shipping_request_${Date.now()}`,
          from: user.full_name || user.email,
          from_email: user.email,
          role: 'user',
          content: `发货申请：${shipping_method_type === 'domestic' ? '日本发货' : '自提'} - ${note || '无备注'}`,
          timestamp: new Date().toISOString(),
          is_shipping_request: true,
          meta: {
            type: 'shipping_request',
            status: 'submitted',
            shipping_method_type,
            shipping_method_code,
            pickup_location_id,
            expected_delivery_datetime,
            pickup_datetime,
            payment_amount_jpy,
            payment_method
          }
        }
      ],
      unread_roles: ['admin']
    };

    // 如果有付款金额，更新订单
    if (payment_amount_jpy && payment_amount_jpy > 0) {
      updateData.payment_surcharge_jpy = (order.payment_surcharge_jpy || 0) + payment_amount_jpy;
      updateData.paid_amount = (order.paid_amount || 0) + payment_amount_jpy;
      
      // 添加付款记录
      updateData.messages.push({
        id: `payment_${Date.now()}`,
        from: '系统通知',
        from_email: 'system@system.local',
        role: 'admin',
        content: `用户已支付发货费用 ¥${payment_amount_jpy.toLocaleString()}，支付方式：${payment_method}`,
        timestamp: new Date().toISOString(),
        is_system_notification: true,
        meta: {
          type: 'payment',
          amount_jpy: payment_amount_jpy,
          payment_method
        }
      });
    }

    // 更新订单
    await base44.entities.Order.update(order_id, updateData);

    // 创建通知
    try {
      await base44.functions.invoke('createNotification', {
        order_id,
        notification_type: 'order_status',
        notification_subtype: 'ticket_shipping_request',
        recipient_emails: [user.email],
        custom_title: '发货申请已提交',
        custom_content: `您的票务订单（${order.order_number}）发货申请已提交，管理员会尽快处理。`
      });
    } catch (e) {
      console.error('Failed to create notification:', e);
    }

    return Response.json({ 
      success: true, 
      message: '发货申请已提交',
      order_id 
    });

  } catch (error) {
    console.error('Error in submitTicketShippingRequest:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});