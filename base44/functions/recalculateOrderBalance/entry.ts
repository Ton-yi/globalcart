import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * recalculateOrderBalance
 * Admin-only: recompute an order's goods balance (尾款) and surcharge (尾款加值)
 * after amounts (estimated_jpy / service_fee / prepayment) were manually edited.
 *
 * Balance     = max(0, orderTotal − prepayment)            (JPY)
 * Surcharge   = orderTotal × current tenant surcharge rate (JPY)
 * orderTotal  = estimated_jpy + service_fee_amount + order addons (JPY)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['admin', 'platform_admin', 'tenant_admin', 'staff'].includes(user.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { order_id } = await req.json();
    if (!order_id) return Response.json({ error: 'Missing order_id' }, { status: 400 });

    // Tenant context from session
    const userRecords = await base44.asServiceRole.entities.User.filter({ email: user.email });
    const tenantId = userRecords?.[0]?.tenant_id;
    if (!tenantId && user.role !== 'platform_admin') {
      return Response.json({ error: 'User has no tenant assigned' }, { status: 403 });
    }

    const orderResult = await base44.asServiceRole.entities.Order.filter({ id: order_id });
    const order = Array.isArray(orderResult) ? orderResult[0] : orderResult;
    if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });
    if (user.role !== 'platform_admin' && order.tenant_id !== tenantId) {
      return Response.json({ error: 'Forbidden: Order does not belong to your tenant' }, { status: 403 });
    }

    if (order.payment_mode !== 'prepay') {
      return Response.json({ error: '仅预付款模式订单存在尾款' }, { status: 400 });
    }
    if (order.order_balance_settled) {
      return Response.json({ error: '尾款已结算，不可重算' }, { status: 400 });
    }

    // Order total in JPY (goods + service fee + order-stage addons)
    const estimatedJpy = parseFloat(order.estimated_jpy) || 0;
    const serviceFeeJpy = parseFloat(order.service_fee_amount) || 0;
    const addonsJpy = (order.selected_addons || []).reduce((s, a) => s + (parseFloat(a.fee) || 0), 0);
    const orderTotalJpy = estimatedJpy + serviceFeeJpy + addonsJpy;

    const prepaymentJpy = parseFloat(order.prepayment_amount_jpy) || parseFloat(order.prepayment_amount) || 0;

    // Current tenant surcharge rate (settings-driven)
    const siteSettings = await base44.asServiceRole.entities.SiteSettings.filter({ tenant_id: order.tenant_id });
    const settingsMap = {};
    (siteSettings || []).forEach(s => { settingsMap[s.key] = s.value; });
    let surchargeRatePct = parseFloat(settingsMap.pre_shipment_balance_surcharge_rate);
    if (isNaN(surchargeRatePct) || surchargeRatePct < 0) surchargeRatePct = 0;

    const balanceJpy = Math.max(0, Math.round(orderTotalJpy) - Math.round(prepaymentJpy));
    const surchargeJpy = surchargeRatePct > 0 ? Math.round(orderTotalJpy * surchargeRatePct / 100) : 0;

    await base44.asServiceRole.entities.Order.update(order.id, {
      order_balance_due_jpy: balanceJpy,
      order_balance_surcharge_jpy: surchargeJpy,
      order_balance_surcharge_rate: surchargeRatePct,
    });

    return Response.json({
      success: true,
      order_total_jpy: Math.round(orderTotalJpy),
      prepayment_jpy: Math.round(prepaymentJpy),
      order_balance_due_jpy: balanceJpy,
      order_balance_surcharge_jpy: surchargeJpy,
      order_balance_surcharge_rate: surchargeRatePct,
    });
  } catch (error) {
    console.error('recalculateOrderBalance error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});