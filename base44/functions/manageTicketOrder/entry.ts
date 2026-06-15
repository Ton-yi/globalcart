import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

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
      const valid = ['pending_confirmation', 'accepted', 'awaiting_lottery_result', 'purchased_pending_warehouse', 'in_warehouse', 'shipped', 'delivered', 'lottery_lost', 'cancelled'];
      if (!valid.includes(body.ticket_status)) return Response.json({ error: '无效状态' }, { status: 400 });
      updateData.ticket_status = body.ticket_status;

      // 如果是未中选，自动计算全额退款
      if (body.ticket_status === 'lottery_lost') {
        const refund = calcRefund(seats.map(s => ({ ...s, actual_quantity: 0 })));
        updateData.ticket_refund_jpy = refund;
        updateData.ticket_refund_settled = false; // 标记为待结算
      }

    } else if (action === 'record_actual') {
      const actuals = body.actual_quantities || {};
      const newSeats = seats.map((s, idx) => {
        const raw = actuals[idx] ?? actuals[String(idx)];
        const actual = raw == null ? (parseFloat(s.quantity) || 0) : Math.max(0, parseFloat(raw) || 0);
        return { ...s, actual_quantity: Math.min(actual, parseFloat(s.quantity) || 0) };
      });
      // 服务端重新从数据库读取最新 seats 计算退差价，确保数据一致性
      const refund = calcRefund(newSeats);
      updateData.ticket_data = { ...td, seats: newSeats };
      updateData.ticket_refund_jpy = refund;
      // 如果有差额，标记为待结算
      if (refund > 0 && !order.ticket_refund_settled) {
        updateData.ticket_refund_settled = false;
      }

    } else if (action === 'settle_refund') {
      // 金额以服务端当前 seats 重算为准，忽略客户端传值
      const currentOrder = await base44.asServiceRole.entities.Order.get(order_id);
      const currentSeats = (currentOrder?.ticket_data?.seats || []);
      const refund = calcRefund({ seats: currentSeats, account_count: parseFloat(currentOrder?.ticket_data?.account_count) || 1 });
      updateData.ticket_refund_jpy = refund;
      updateData.ticket_refund_settled = true;

    } else if (action === 'record_ticketing') {
      if (body.ticket_number_issued !== undefined) updateData.ticket_number_issued = String(body.ticket_number_issued);
      if (Array.isArray(body.ticket_image_urls)) updateData.ticket_image_urls = body.ticket_image_urls;

    } else if (action === 'cancel') {
      updateData.ticket_status = 'cancelled';
      updateData.order_status = 'cancelled';
      if (body.cancel_reason) updateData.cancel_reason = String(body.cancel_reason);

    } else if (action === 'mark_lottery_lost') {
      if (order.ticket_data?.sales_method !== 'lottery') {
        return Response.json({ error: 'Not a lottery order' }, { status: 400 });
      }

      // Set all actual quantities to 0
      const newSeats = seats.map(s => ({ ...s, actual_quantity: 0 }));
      const refund = calcRefund(newSeats);

      updateData.ticket_status = 'lottery_lost';
      updateData.ticket_data = { ...td, seats: newSeats };
      updateData.ticket_refund_jpy = refund;
      updateData.ticket_refund_settled = false; // Mark as pending settlement
      updateData.messages = [
        ...(order.messages || []),
        {
          id: `lottery_lost_${Date.now()}`,
          from: "系统通知",
          from_email: "system@system.local",
          role: "admin",
          content: `订单状态更新为：未中选。已自动计算全额退款 ¥${refund.toLocaleString()}。`,
          timestamp: new Date().toISOString(),
          is_system_notification: true,
          meta: { type: "status_update", new_status: "lottery_lost" }
        }
      ];
      updateData.unread_roles = ["user"];

    } else {
      return Response.json({ error: '未知操作' }, { status: 400 });
    }

    const updated = await base44.asServiceRole.entities.Order.update(order_id, updateData);

    // Trigger notification if status was changed
    if (updateData.ticket_status && updateData.ticket_status !== order.ticket_status) {
      try {
        let notif_subtype = `ticket_${updateData.ticket_status}`;
        let notif_title = `票务订单状态更新`;
                const isLottery = order.ticket_data?.sales_method === 'lottery';
        const statusLabelMap = {
          pending_confirmation: { user: "待受理", admin: "待确认" },
          accepted: { user: isLottery ? "待开始抽选" : "待受理", admin: isLottery ? "待开始抽选" : "待开票" },
          awaiting_lottery_result: { user: "等待抽选结果", admin: "等待抽选结果" },
          purchased_pending_warehouse: { user: isLottery ? "已抽中待入库" : "已购买待入库", admin: isLottery ? "已抽中待入库" : "已购买待入库" },
          in_warehouse: { user: "待发货", admin: "已入库" },
          shipped: { user: "已发货", admin: "已发货" },
          delivered: { user: "已收货", admin: "已收货" },
          lottery_lost: { user: "未中选", admin: "未中选" },
          cancelled: { user: "已取消", admin: "已取消" },
        };
        const statusLabel = statusLabelMap[updateData.ticket_status]?.user || updateData.ticket_status;
        let notif_content = `您的票务订单（${order.order_number}）状态已更新为：${statusLabel}。`;

        if (updateData.ticket_status === 'lottery_lost') {
            notif_subtype = 'lottery_lost';
            notif_title = '票务订单未中选';
            notif_content = `您的票务订单（${order.order_number}）未中选，已自动为您处理退款事宜。`;
        }

        await base44.functions.invoke('createNotification', {
          order_id: order.id,
          notification_type: 'order_status',
          notification_subtype: notif_subtype,
          recipient_emails: [order.user_email],
          custom_title: notif_title,
          custom_content: notif_content
        });
      } catch (e) {
        console.error(`Failed to create notification for status update to ${updateData.ticket_status}:`, e);
      }
    }

    return Response.json({ success: true, order: updated });
  } catch (error) {
    console.error('manageTicketOrder error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});