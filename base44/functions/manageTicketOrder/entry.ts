import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * 票务订单后台管理：状态流转 / 录入实际票数 / 服务端权威退差价 / 录入发券信息 / 取消。
 * 权限：platform_admin / admin / tenant_admin / staff。
 * 退差价金额服务端计算，绝不信任客户端传入金额。
 *
 * actions:
 *  - set_status            { order_id, ticket_status }
 *  - record_actual         { order_id, actual_quantities: { [seatIndex]: number } }  → 计算退差价并写入
 *  - settle_refund         { order_id, refund_amount_jpy? }  → 标记退差价已处理（金额以服务端计算为准）
 *  - record_ticketing      { order_id, ticket_number_issued?, ticket_image_urls? }
 *  - cancel                { order_id, cancel_reason }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const isPlatformAdmin = user.role === 'platform_admin';
    const isTenantAdmin = user.role === 'admin' || user.role === 'tenant_admin';
    const isStaff = user.role === 'staff';
    if (!isPlatformAdmin && !isTenantAdmin && !isStaff) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { action, order_id } = body;
    if (!action || !order_id) return Response.json({ error: 'Missing action or order_id' }, { status: 400 });

    const userRecords = await base44.asServiceRole.entities.User.filter({ email: user.email });
    const tenantId = userRecords?.[0]?.tenant_id || null;

    // Fetch + verify ownership
    let orderResult = [];
    try { orderResult = await base44.asServiceRole.entities.Order.filter({ id: order_id }); } catch (_) {}
    const order = Array.isArray(orderResult) ? orderResult[0] : orderResult;
    if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });
    if (order.order_type !== 'ticket') return Response.json({ error: '非票务订单' }, { status: 400 });
    if (!isPlatformAdmin && order.tenant_id !== tenantId) {
      return Response.json({ error: 'Forbidden: Order does not belong to your tenant' }, { status: 403 });
    }

    const td = order.ticket_data || {};
    const seats = Array.isArray(td.seats) ? td.seats : [];
    const accountCount = parseFloat(td.account_count) || 1;

    // 服务端权威退差价计算 = Σ((预付票数 − 实际票数) × 单价) × 账户数
    const calcRefund = (seatList) => {
      const diffTotal = seatList.reduce((sum, s) => {
        const expected = parseFloat(s.quantity) || 0;
        const actual = s.actual_quantity == null ? expected : (parseFloat(s.actual_quantity) || 0);
        const diff = Math.max(0, expected - actual);
        return sum + diff * (parseFloat(s.price_jpy) || 0);
      }, 0);
      return Math.round(diffTotal * accountCount);
    };

    let updateData = {};

    if (action === 'set_status') {
      const valid = ['pending_confirmation', 'accepted', 'awaiting_lottery_result', 'purchased_pending_warehouse', 'in_warehouse', 'shipped', 'delivered', 'cancelled'];
      if (!valid.includes(body.ticket_status)) return Response.json({ error: '无效状态' }, { status: 400 });
      updateData.ticket_status = body.ticket_status;

    } else if (action === 'record_actual') {
      const actuals = body.actual_quantities || {};
      const newSeats = seats.map((s, idx) => {
        const raw = actuals[idx] ?? actuals[String(idx)];
        const actual = raw == null ? (parseFloat(s.quantity) || 0) : Math.max(0, parseFloat(raw) || 0);
        return { ...s, actual_quantity: Math.min(actual, parseFloat(s.quantity) || 0) };
      });
      const refund = calcRefund(newSeats);
      updateData.ticket_data = { ...td, seats: newSeats };
      updateData.ticket_refund_jpy = refund;

    } else if (action === 'settle_refund') {
      // 金额以服务端当前 seats 重算为准，忽略客户端传值
      const refund = calcRefund(seats);
      updateData.ticket_refund_jpy = refund;
      updateData.ticket_refund_settled = true;

    } else if (action === 'record_ticketing') {
      if (body.ticket_number_issued !== undefined) updateData.ticket_number_issued = String(body.ticket_number_issued);
      if (Array.isArray(body.ticket_image_urls)) updateData.ticket_image_urls = body.ticket_image_urls;

    } else if (action === 'cancel') {
      updateData.ticket_status = 'cancelled';
      updateData.order_status = 'cancelled';
      if (body.cancel_reason) updateData.cancel_reason = String(body.cancel_reason);

    } else {
      return Response.json({ error: '未知操作' }, { status: 400 });
    }

    const updated = await base44.asServiceRole.entities.Order.update(order_id, updateData);
    return Response.json({ success: true, order: updated });
  } catch (error) {
    console.error('manageTicketOrder error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});