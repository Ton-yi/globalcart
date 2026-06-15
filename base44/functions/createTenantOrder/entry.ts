import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// ── 阻断标签检查：拥有 block_<permission> 即被强制禁止（优先级最高，覆盖任何允许项） ──
async function hasBlockTag(base44, userRecord, permissionId) {
  const blockKey = `block_${permissionId}`;
  const overrides = userRecord.permission_overrides || {};
  if (overrides[blockKey] === 'add') return true;
  if (overrides[blockKey] === 'remove') return false;
  const roleIds = userRecord.assigned_role_ids || [];
  if (roleIds.length === 0) return false;
  const [tenantRoles, globalRoles] = await Promise.all([
    userRecord.tenant_id
      ? base44.asServiceRole.entities.Role.filter({ tenant_id: userRecord.tenant_id, is_archived: false })
      : Promise.resolve([]),
    base44.asServiceRole.entities.Role.filter({ is_global: true, is_archived: false }),
  ]);
  const allRoles = [...(tenantRoles || []), ...(globalRoles || [])];
  return roleIds.some(roleId => {
    let role = allRoles.find(r => r.id === roleId);
    if (!role && typeof roleId === 'string') {
      role = allRoles.find(r => r.predefined_key === `builtin_${roleId}` || r.name === roleId);
    }
    return (role?.direct_permissions || []).includes(blockKey);
  });
}

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

    // 阻断检查：禁止下单（管理员豁免）
    if (!['platform_admin', 'admin', 'tenant_admin'].includes(user.role) &&
        await hasBlockTag(base44, userRecord[0], 'order:submit_purchase_request')) {
      return Response.json({ error: '您已被禁止提交购买需求，请联系管理员。' }, { status: 403 });
    }

    // ========================================================================
    // === 票务订单分支：独立流程，与普通购买代购解耦 ===========================
    // ========================================================================
    if (body.order_type === 'ticket') {
      const ticketSettings = await base44.asServiceRole.entities.SiteSettings.filter({ tenant_id: assignedTenantId, key: 'ticket_order_config' });
      let ticketCfg = {};
      try { ticketCfg = JSON.parse(ticketSettings?.[0]?.value || '{}'); } catch { ticketCfg = {}; }
      if (ticketCfg.enabled !== true) {
        return Response.json({ error: '票务购买需求功能未开启' }, { status: 400 });
      }

      const td = body.ticket_data || {};
      const seats = Array.isArray(td.seats) ? td.seats : [];
      const accountCount = parseFloat(td.account_count) || 1;
      const additionalFee = parseFloat(td.additional_fee_jpy) || 0;

      // 服务端权威计算预付总额（JPY）= Σ(数量×单价) × 账户数 + 追加料金
      const seatTotal = seats.reduce((sum, s) => sum + (parseFloat(s.quantity) || 0) * (parseFloat(s.price_jpy) || 0), 0);
      const grossTotal = seatTotal * accountCount + additionalFee;

      // 校验各发券方式最低追加料金
      const minFee = (ticketCfg.min_additional_fee || {})[td.ticketing_method] || 0;
      if (td.ticketing_method && additionalFee < minFee) {
        return Response.json({ error: `追加料金不得低于 ¥${minFee}` }, { status: 400 });
      }
      if (td.sales_method === 'lottery') {
        const minBonus = ticketCfg.min_lottery_win_bonus || 0;
        if ((parseFloat(td.lottery_win_bonus_jpy) || 0) < minBonus) {
          return Response.json({ error: `抽中追加报酬不得低于 ¥${minBonus}` }, { status: 400 });
        }
      }

      // 独立预付配置
      const tPrepayEnabled = ticketCfg.prepay_enabled !== false;
      let tPrepayRate = parseFloat(ticketCfg.prepay_rate);
      if (isNaN(tPrepayRate) || tPrepayRate <= 0 || tPrepayRate > 100) tPrepayRate = 100;

      // 获取用户选择的支付方式配置（用于确定付款币种）
      let paymentCurrency = 'JPY';
      if (body.payment_method) {
        const paymentMethods = await base44.asServiceRole.entities.PaymentMethod.filter({ tenant_id: assignedTenantId, is_active: true });
        const selectedMethod = (paymentMethods || []).find(m => (m.provider_key || m.name) === body.payment_method);
        if (selectedMethod?.payment_currency) {
          paymentCurrency = selectedMethod.payment_currency;
        }
      }

      // Generate ticket order number TK{YYYYMMDD}{seq}
      const tNow = new Date();
      const tJst = new Date(tNow.getTime() + 9 * 60 * 60 * 1000);
      const tDateStr = `${tJst.getUTCFullYear()}${String(tJst.getUTCMonth() + 1).padStart(2, '0')}${String(tJst.getUTCDate()).padStart(2, '0')}`;
      const tPrefix = `TK${tDateStr}`;
      const tExisting = await base44.asServiceRole.entities.Order.filter({ tenant_id: assignedTenantId });
      const tToday = (tExisting || []).filter(o => (o.order_number || '').startsWith(tPrefix));
      const tMaxSeq = tToday.reduce((max, o) => Math.max(max, parseInt((o.order_number || '').slice(tPrefix.length), 10) || 0), 0);
      const tOrderNumber = `${tPrefix}${String(tMaxSeq + 1).padStart(4, '0')}`;

      // ── 票务服务费计算 ──────────────────────────────────────────────────────
      // 1. 优先选取票务专用规则（is_ticket_rule=true, active, 在生效期内，按优先级降序）
      // 2. 若无票务专用规则，则使用票务设置兜底配置（fallback_service_fee_rate + fixed）
      const allFeeRules = await base44.asServiceRole.entities.ServiceFeeRule.filter({ tenant_id: assignedTenantId });
      const todayStr = new Date().toISOString().slice(0, 10);
      const activeTicketRule = (allFeeRules || [])
        .filter(r => !r.is_archived && r.is_ticket_rule && r.status === 'active' && r.fee_phase !== 'shipping')
        .filter(r => !r.effective_from || r.effective_from <= todayStr)
        .filter(r => !r.effective_until || r.effective_until >= todayStr)
        .sort((a, b) => (parseFloat(b.priority) || 0) - (parseFloat(a.priority) || 0))[0] || null;

      let ticketServiceFeeJpy = 0;
      let ticketServiceFeeRuleId = null;
      let ticketServiceFeeRuleName = null;
      let ticketServiceFeeRuleVersion = null;

      if (activeTicketRule) {
        // 使用规则引擎计算（goodsAmount = 票务货款总额）
        const evalRes = await base44.functions.invoke('serviceFeeRuleEngine', {
          action: 'evaluate',
          rule: activeTicketRule,
          variables: {
            goodsAmount: grossTotal,
            orderAmount: grossTotal,
            itemCount: accountCount,
            sourceSite: 'ticket',
            customerLevel: '',
            currency: paymentCurrency,
            country: '',
            weight: 0,
            valueAddedServiceAmount: 0,
            paymentSurcharge: 0,
          },
        });
        ticketServiceFeeJpy = evalRes.data?.fee ?? 0;
        ticketServiceFeeRuleId = activeTicketRule.id;
        ticketServiceFeeRuleName = activeTicketRule.name;
        ticketServiceFeeRuleVersion = activeTicketRule.version;
      } else {
        // 兜底：使用票务设置中的服务费比例和固定费
        const fallbackRate = (parseFloat(ticketCfg.fallback_service_fee_rate) || 0) / 100;
        const fallbackFixed = parseFloat(ticketCfg.fallback_service_fee_fixed) || 0;
        ticketServiceFeeJpy = Math.round(grossTotal * fallbackRate + fallbackFixed);
        ticketServiceFeeRuleName = '兜底服务费';
      }

      const ticketServiceFeeJpyRounded = Math.round(ticketServiceFeeJpy);
      // 预付 = (货款 + 服务费) × 预付比例
      const totalWithFee = grossTotal + ticketServiceFeeJpyRounded;
      const prepaidTotal = Math.round(totalWithFee * (tPrepayEnabled ? tPrepayRate : 100) / 100);

      const ticketOrder = await base44.asServiceRole.entities.Order.create({
        tenant_id: assignedTenantId,
        order_number: tOrderNumber,
        order_type: 'ticket',
        product_name: body.product_name || td.performance_name || '票务需求',
        quantity: 1,
        user_email: body.user_email,
        user_name: body.user_name,
        user_note: body.user_note || '',
        note_image_url: body.note_image_url || null,
        product_image_url: body.product_image_url || null,
        payment_method: body.payment_method || null,
        ticket_data: {
          ...td,
          account_count: accountCount,
          additional_fee_jpy: additionalFee,
          lottery_win_bonus_jpy: parseFloat(td.lottery_win_bonus_jpy) || 0,
          seats: seats.map(s => ({ seat_type: s.seat_type, quantity: parseFloat(s.quantity) || 0, price_jpy: parseFloat(s.price_jpy) || 0 })),
        },
        ticket_status: 'pending_confirmation',
        ticket_prepaid_total_jpy: prepaidTotal,
        prepayment_amount: prepaidTotal,
        prepayment_amount_jpy: prepaidTotal,
        prepayment_currency: paymentCurrency,
        payment_mode: 'prepay',
        order_status: 'payment_pending',
        payment_status: 'awaiting_payment',
        // 服务费快照
        service_fee_amount: ticketServiceFeeJpyRounded,
        service_fee_rule_id: ticketServiceFeeRuleId,
        service_fee_rule_name: ticketServiceFeeRuleName,
        service_fee_rule_version: ticketServiceFeeRuleVersion,
        calculated_at: new Date().toISOString(),
      });

      return Response.json({ success: true, order: ticketOrder });
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
          itemCount: body.quantity ? parseFloat(body.quantity) : 1,
          sourceSite: body.online_store_tag || '其它',
          customerLevel: '',
          currency: body.prepayment_currency || 'JPY',
          country: body.destination_country || '',
          weight: parseFloat(body.weight_g) || 0,
          valueAddedServiceAmount: addonTotalJpy,
          paymentSurcharge: 0,
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

    // fullpay_once: 全额一次性付款（货款 + 服务费 + 预估运费）
    // 预估运费已包含在 pre_shipment.fullpay_once_config.estimated_shipping_fee_jpy 中，但
    // order_stage_payment_jpy 只记录下单阶段收取的部分（货款 + 服务费 + 预估运费）
    // 下单时若存在 fullpay_once_config，则以 total_paid_jpy 作为下单阶段收款额
    if (body.payment_mode === 'fullpay_once') {
      const fpo = body.pre_shipment?.fullpay_once_config || body.fullpay_once_config;
      if (fpo && fpo.estimated_shipping_fee_jpy > 0) {
        const fullpayTotal = Math.round((parseFloat(body.estimated_jpy) || 0) + (parseFloat(body.service_fee_amount) || 0) + (parseFloat(fpo.estimated_shipping_fee_jpy) || 0));
        body.order_stage_payment_jpy = fullpayTotal;
        body.paid_amount = fullpayTotal;
        // 同步到 fullpay_once_config.total_paid_jpy（服务端权威值）
        if (fpo) {
          fpo.total_paid_jpy = fullpayTotal;
          fpo.settlement_status = fpo.settlement_status || 'pending';
          if (body.pre_shipment?.fullpay_once_config) body.pre_shipment.fullpay_once_config = fpo;
          if (body.fullpay_once_config) body.fullpay_once_config = fpo;
        }
      }
    }

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

    // 后付款（deferred）：下单阶段不付货款，货款（100% + 加算比例）随运费一并收取
    let deferredRatePct = parseFloat(settingsMap.deferred_payment_surcharge_rate);
    if (isNaN(deferredRatePct) || deferredRatePct < 0) deferredRatePct = 0;
    if (body.payment_mode === 'deferred') {
      const deferredEnabled = settingsMap.deferred_payment_enabled !== 'false';
      if (!deferredEnabled) {
        return Response.json({ error: '后付款功能未开启' }, { status: 400 });
      }
      body.prepayment_amount = 0;
      body.order_balance_due_jpy = Math.round(orderTotalJpy);
      body.order_balance_surcharge_rate = deferredRatePct;
      body.order_balance_surcharge_jpy = deferredRatePct > 0
        ? Math.round(orderTotalJpy * deferredRatePct / 100)
        : 0;
      body.order_balance_settled = false;
      // 无需下单阶段付款，直接进入待下单
      body.order_status = 'paid';
      body.payment_status = 'pending';
    }

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

    // Detect --- split marker in product_url (only when 允许用户拆单 setting is enabled)
    const splitAllowed = settingsMap.allow_order_split === 'true';
    const productUrl = body.product_url || '';
    const splitSections = splitAllowed
      ? productUrl.split(/\n-{3,}\n/).map(s => s.trim()).filter(Boolean)
      : [];
    const hasSplitMarker = splitSections.length > 1;

    // Create order with tenant_id
    // Also snapshot the original JPY prepayment amount for reference
    const orderData = {
      ...body,
      tenant_id: assignedTenantId,
      order_number: orderNumber, // always override with server-generated number
      order_type: 'physical', // 实物订单（默认）
      // Always store the original JPY amount separately for display/accounting
      ...(body.prepayment_amount ? { prepayment_amount_jpy: parseFloat(body.prepayment_amount) } : {}),
      // Payment method and currency (already validated by frontend, stored as-is)
      payment_method: body.payment_method || null,
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
        // Downgrade to deferred payment: goods balance is collected with the shipping fee
        const downgradeUpdates = {
          payment_mode: 'deferred',
          order_status: 'paid',
          payment_status: 'pending',
          prepayment_amount: 0,
          prepayment_amount_jpy: 0,
          order_balance_due_jpy: totalJpy,
          order_balance_surcharge_rate: deferredRatePct,
          order_balance_surcharge_jpy: deferredRatePct > 0 ? Math.round(orderTotalJpy * deferredRatePct / 100) : 0,
          order_balance_settled: false,
        };
        await base44.asServiceRole.entities.Order.update(order.id, downgradeUpdates);
        const updatedOrder = { ...order, ...downgradeUpdates };
        return Response.json({
          success: true,
          order: updatedOrder,
          credit_downgraded: true,
          credit_downgrade_reason: `记账额度不足：本次需记账 ¥${totalJpy.toLocaleString()} JPY，剩余可用额度仅 ¥${availableCredit.toLocaleString()} JPY，订单已自动改为后付款方式，货款将在支付运费时一并收取。`,
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