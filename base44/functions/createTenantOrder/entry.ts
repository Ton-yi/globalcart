import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Create an order with automatic tenant_id assignment from authenticated user
 * Frontend must NOT send tenant_id; it will be derived from the authenticated session
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    
    // Remove any tenant_id from request body (security: never trust client)
    delete body.tenant_id;

    // Get user record to find tenant_id
    const userRecord = await base44.asServiceRole.entities.User.filter({ email: user.email });
    if (!userRecord || userRecord.length === 0) {
      return Response.json({ error: 'User record not found' }, { status: 404 });
    }

    const tenantId = userRecord[0].tenant_id;
    if (!tenantId && user.role !== 'platform_admin') {
      return Response.json({ error: 'User has no tenant assigned' }, { status: 403 });
    }

    // For platform admins, tenant_id must be provided in body; for others it's auto-assigned
    const assignedTenantId = user.role === 'platform_admin' && body.tenant_id 
      ? body.tenant_id 
      : tenantId;

    if (!assignedTenantId) {
      return Response.json({ error: 'Cannot determine tenant for order creation' }, { status: 400 });
    }

    // === Server-side fee recomputation (never trust client-submitted amounts) ===
    const estimatedJpy = parseFloat(body.estimated_jpy) || 0;

    const [siteSettings, feeRules, addonOptions] = await Promise.all([
      base44.asServiceRole.entities.SiteSettings.filter({ tenant_id: assignedTenantId }),
      base44.asServiceRole.entities.ServiceFeeRule.filter({ tenant_id: assignedTenantId }),
      base44.asServiceRole.entities.AddonOption.filter({ tenant_id: assignedTenantId }),
    ]);
    const settingsMap = {};
    (siteSettings || []).forEach(s => { settingsMap[s.key] = s.value; });

    // Validate addons against DB records (clamp customizable fees to min/max)
    let liveRates = null;
    const fetchLiveRates = async () => {
      try {
        const res = await fetch('https://open.er-api.com/v6/latest/JPY');
        if (!res.ok) return null;
        const data = await res.json();
        return data?.rates || null;
      } catch { return null; }
    };
    let addonTotalJpy = 0;
    const validatedAddons = [];
    for (const a of (body.selected_addons || [])) {
      const opt = (addonOptions || []).find(o => o.id === a.id);
      if (!opt || opt.is_active === false) continue;
      let fee = parseFloat(opt.fee) || 0;
      if (opt.is_user_customizable) {
        const custom = parseFloat(a.fee);
        if (!isNaN(custom)) {
          const minFee = parseFloat(opt.min_fee) || 0;
          const maxFee = parseFloat(opt.max_fee) || 0;
          fee = custom;
          if (maxFee > 0 && fee > maxFee) fee = maxFee;
          if (fee < minFee) fee = minFee;
        }
      }
      const feeCur = opt.fee_currency || 'JPY';
      validatedAddons.push({ id: opt.id, name: opt.name, fee, fee_currency: feeCur });
      if (feeCur === 'JPY') {
        addonTotalJpy += fee;
      } else {
        if (!liveRates) liveRates = await fetchLiveRates();
        const baseRate = liveRates?.[feeCur] || null;
        const increment = parseFloat(settingsMap[`jpy_${feeCur.toLowerCase()}_increment`]) || 0;
        const rate = baseRate ? baseRate + increment : null;
        addonTotalJpy += rate ? fee / rate : fee;
      }
    }

    // Pick active order-phase fee rule (same logic as getSubmitOrderPageData)
    const today = new Date().toISOString().slice(0, 10);
    const activeRule = (feeRules || [])
      .filter(r => !r.is_archived && r.status === 'active' && r.fee_phase !== 'shipping')
      .filter(r => !r.effective_from || r.effective_from <= today)
      .filter(r => !r.effective_until || r.effective_until >= today)
      .sort((a, b) => (parseFloat(b.priority) || 0) - (parseFloat(a.priority) || 0))[0] || null;

    let serviceFeeJpy = 0;
    if (activeRule) {
      const evalRes = await base44.functions.invoke('serviceFeeRuleEngine', {
        action: 'evaluate',
        variables: {
          goodsAmount: estimatedJpy,
          orderAmount: estimatedJpy,
          itemCount: 1,
          sourceSite: '其它',
          customerLevel: '',
          valueAddedServiceAmount: addonTotalJpy,
        },
        rule: activeRule,
      });
      serviceFeeJpy = evalRes.data?.fee ?? 0;
    } else {
      const feeRatePct = parseFloat(settingsMap.service_fee_rate);
      serviceFeeJpy = estimatedJpy * ((isNaN(feeRatePct) ? 10 : feeRatePct) / 100);
    }

    // Prepay rate: valid range (0, 100]; invalid values fall back to 80%
    const prepayEnabled = settingsMap.prepay_enabled !== 'false';
    let prepayRatePct = parseFloat(settingsMap.prepay_rate);
    if (isNaN(prepayRatePct) || prepayRatePct <= 0 || prepayRatePct > 100) prepayRatePct = 80;
    const prepayRate = prepayEnabled ? prepayRatePct / 100 : 1.0;

    const orderTotalJpy = estimatedJpy + serviceFeeJpy + addonTotalJpy;
    const serverPrepayment = Math.round(orderTotalJpy * prepayRate);

    // Override client-submitted amounts with server-computed canonical values (JPY)
    body.estimated_jpy = estimatedJpy;
    body.service_fee_amount = Math.round(serviceFeeJpy);
    body.prepayment_amount = serverPrepayment;
    body.selected_addons = validatedAddons;
    body.selected_addon_ids = validatedAddons.map(a => a.id);
    body.service_fee_rule_id = activeRule?.id || null;
    body.service_fee_rule_name = activeRule?.name || null;
    body.service_fee_rule_version = activeRule?.version || null;
    // Enforce payment mode consistency with prepay setting
    if (body.payment_mode === 'prepay' && !prepayEnabled) body.payment_mode = 'fullpay_once';

    // Remaining goods balance (尾款) after prepayment — collected at the shipping-fee stage.
    // Only applies to prepay mode with partial prepayment; fullpay/credit/deferred have no balance.
    const hasBalance = body.payment_mode === 'prepay' && prepayRate < 1;
    body.order_balance_due_jpy = hasBalance
      ? Math.max(0, Math.round(orderTotalJpy) - serverPrepayment)
      : 0;
    // 尾款加值比例: extra percentage of the order total added on top of the balance (default 0%)
    let surchargeRatePct = parseFloat(settingsMap.pre_shipment_balance_surcharge_rate);
    if (isNaN(surchargeRatePct) || surchargeRatePct < 0) surchargeRatePct = 0;
    body.order_balance_surcharge_rate = hasBalance ? surchargeRatePct : 0;
    body.order_balance_surcharge_jpy = (hasBalance && surchargeRatePct > 0)
      ? Math.round(orderTotalJpy * surchargeRatePct / 100)
      : 0;
    body.order_balance_settled = false;

    // Generate a unique order number server-side to avoid frontend race conditions
    // Format: TY{YYYYMMDD}{4-digit seq}, e.g. TY202605130001
    const now = new Date();
    const jstOffset = 9 * 60 * 60 * 1000; // JST = UTC+9
    const jstNow = new Date(now.getTime() + jstOffset);
    const yyyy = jstNow.getUTCFullYear();
    const mm = String(jstNow.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(jstNow.getUTCDate()).padStart(2, '0');
    const dateStr = `${yyyy}${mm}${dd}`;
    const prefix = `TY${dateStr}`;

    // Fetch all orders with this prefix for the tenant to find max seq
    const existingOrders = await base44.asServiceRole.entities.Order.filter({ tenant_id: assignedTenantId });
    const todayOrders = (existingOrders || []).filter(o => (o.order_number || '').startsWith(prefix));
    const maxSeq = todayOrders.reduce((max, o) => {
      const seq = parseInt((o.order_number || '').slice(prefix.length), 10) || 0;
      return Math.max(max, seq);
    }, 0);
    const orderNumber = `${prefix}${String(maxSeq + 1).padStart(4, '0')}`;

    // Detect --- split marker in product_url
    const productUrl = body.product_url || '';
    const splitSections = productUrl.split(/\n-{3,}\n/).map(s => s.trim()).filter(Boolean);
    const hasSplitMarker = splitSections.length > 1;

    // Create order with tenant_id
    // Also snapshot the original JPY prepayment amount for reference
    const orderData = {
      ...body,
      tenant_id: assignedTenantId,
      order_number: orderNumber, // always override with server-generated number
      // Always store the original JPY amount separately for display/accounting
      ...(body.prepayment_amount ? { prepayment_amount_jpy: parseFloat(body.prepayment_amount) } : {}),
      // Split marker detection
      has_split_marker: hasSplitMarker,
      split_sections: hasSplitMarker ? splitSections : [],
    };

    const order = await base44.asServiceRole.entities.Order.create(orderData);

    // === Credit accounting: if order uses credit payment, check limit and update balance ===
    if (body.payment_mode === 'credit') {
      // Use server-recomputed total (goods + service fee + addons, all JPY)
      const totalJpy = Math.round(orderTotalJpy);

      const currentUser = userRecord[0];
      const currentBalance = parseFloat(currentUser.credit_balance_jpy) || 0;
      const creditLimit = parseFloat(currentUser.credit_limit_jpy) || 0;
      const availableCredit = Math.max(0, creditLimit - currentBalance);

      // If this order would exceed the credit limit, downgrade to deferred payment
      if (totalJpy > availableCredit) {
        // Update the order to deferred payment mode
        await base44.asServiceRole.entities.Order.update(order.id, {
          payment_mode: 'deferred',
          order_status: 'payment_pending',
          payment_status: 'awaiting_payment',
        });
        const updatedOrder = { ...order, payment_mode: 'deferred', order_status: 'payment_pending', payment_status: 'awaiting_payment' };
        return Response.json({
          success: true,
          order: updatedOrder,
          credit_downgraded: true,
          credit_downgrade_reason: `记账额度不足：本次需记账 ¥${totalJpy.toLocaleString()} JPY，剩余可用额度仅 ¥${availableCredit.toLocaleString()} JPY，订单已自动改为后付款方式。`,
          required_jpy: totalJpy,
          available_credit_jpy: availableCredit,
        });
      }

      // Credit within limit — update balance
      if (totalJpy > 0) {
        // 记账订单：记录支付方式与下单阶段账面金额（供偏好统计与财务报表正确展示）
        await base44.asServiceRole.entities.Order.update(order.id, {
          payment_method: 'credit',
          order_stage_payment_jpy: totalJpy,
          paid_amount: totalJpy,
        });

        const newBalance = currentBalance + totalJpy;
        const balanceUpdate = { credit_balance_jpy: newBalance };

        // If this is the first time they're incurring debt, set start date + next due date
        if (currentBalance === 0) {
          const now = new Date();
          balanceUpdate.credit_start_date = now.toISOString().slice(0, 10);
          const cycle = currentUser.credit_cycle;
          if (cycle === 'weekly') {
            const nextDue = new Date(now);
            nextDue.setDate(now.getDate() + 7);
            balanceUpdate.credit_next_due_date = nextDue.toISOString().slice(0, 10);
          } else if (cycle === 'monthly') {
            const nextDue = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            balanceUpdate.credit_next_due_date = nextDue.toISOString().slice(0, 10);
          }
        }

        await base44.asServiceRole.entities.User.update(currentUser.id, balanceUpdate);
      }
    }

    return Response.json({ 
      success: true,
      order 
    });

  } catch (error) {
    console.error('createTenantOrder error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});