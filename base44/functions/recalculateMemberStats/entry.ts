import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * 会员统计数据归纳引擎（异步缓存层）
 *
 * actions:
 * - status     : 返回最近一次全量扫描时间（管理员）
 * - scan_all   : 全量扫描租户所有用户，重建 UserMemberStats（管理员）
 * - scan_user  : 重算单个用户（管理员可指定 user_email；普通用户仅可重算自己）
 */

const DAY_MS = 86400000;

function topKey(counts) {
  let top = '', max = 0;
  for (const [k, v] of Object.entries(counts)) {
    if (v > max) { max = v; top = k; }
  }
  return top;
}

function computeStats(email, orders, pools, userRec, nowIso, source) {
  const now = new Date(nowIso);
  let totalPaid = 0, totalGoods = 0, totalSvc = 0, totalAddon = 0, totalStorage = 0, maxOrder = 0;
  let refundCount = 0, refundTotal = 0;
  let deferredCount = 0, creditCount = 0, groupBuyCount = 0, storageOverdueCount = 0;
  let count30 = 0, count90 = 0, count365 = 0;
  const methodCounts = {}, countryCounts = {};
  let firstDate = null, lastDate = null;
  let activeCount = 0, cancelledCount = 0;

  orders.forEach(o => {
    const st = o.order_status;
    if (st === 'cancelled') cancelledCount++;
    else if (st !== 'expired') activeCount++;

    const paid = o.order_stage_payment_jpy || o.paid_amount || 0;
    totalPaid += paid;
    totalGoods += o.estimated_jpy || 0;
    totalSvc += o.service_fee_amount || 0;
    totalAddon += (o.selected_addons || []).reduce((s, a) => s + (a.fee || 0), 0);
    totalStorage += o.accrued_storage_fee_jpy || 0;
    if (paid > maxOrder) maxOrder = paid;

    if (o.refund_amount_jpy && o.refund_amount_jpy > 0) {
      refundCount++;
      refundTotal += o.refund_amount_jpy;
    }
    if (o.payment_mode === 'deferred') deferredCount++;
    if (o.payment_mode === 'credit') creditCount++;
    if (o.group_buy_request_id) groupBuyCount++;
    if ((o.storage_days_overdue || 0) > 0) storageOverdueCount++;
    if (o.shipping_method) methodCounts[o.shipping_method] = (methodCounts[o.shipping_method] || 0) + 1;
    if (o.destination_country) countryCounts[o.destination_country] = (countryCounts[o.destination_country] || 0) + 1;

    const d = new Date(o.submit_date || o.created_date);
    if (!isNaN(d)) {
      if (!firstDate || d < firstDate) firstDate = d;
      if (!lastDate || d > lastDate) lastDate = d;
      const age = now - d;
      if (age <= 30 * DAY_MS) count30++;
      if (age <= 90 * DAY_MS) count90++;
      if (age <= 365 * DAY_MS) count365++;
    }
  });

  const userPools = pools.filter(p =>
    p.creator_email === email ||
    (p.per_user_groups || []).some(g => g.user_email === email)
  );
  const consolidationCount = userPools.filter(p => p.consolidation_type && p.consolidation_type !== '').length;

  const total = orders.length;
  const accountCreated = userRec?.created_date ? new Date(userRec.created_date) : null;

  return {
    user_id: userRec?.id || '',
    user_email: email,
    user_name: userRec?.full_name || orders[0]?.user_name || '',
    order_count_total: total,
    order_count_active: activeCount,
    order_count_cancelled: cancelledCount,
    order_count_30d: count30,
    order_count_90d: count90,
    order_count_365d: count365,
    total_paid_jpy: Math.round(totalPaid),
    total_goods_jpy: Math.round(totalGoods),
    total_service_fee_jpy: Math.round(totalSvc),
    total_addon_fee_jpy: Math.round(totalAddon),
    total_storage_fee_jpy: Math.round(totalStorage),
    avg_order_value_jpy: total > 0 ? Math.round(totalPaid / total) : 0,
    max_order_value_jpy: Math.round(maxOrder),
    refund_count: refundCount,
    refund_total_jpy: Math.round(refundTotal),
    refund_rate_pct: total > 0 ? Math.round((refundCount / total) * 10000) / 100 : 0,
    first_order_date: firstDate ? firstDate.toISOString().split('T')[0] : null,
    last_order_date: lastDate ? lastDate.toISOString().split('T')[0] : null,
    days_since_last_order: lastDate ? Math.floor((now - lastDate) / DAY_MS) : -1,
    account_age_days: accountCreated ? Math.floor((now - accountCreated) / DAY_MS) : 0,
    pool_count: userPools.length,
    consolidation_count: consolidationCount,
    group_buy_order_count: groupBuyCount,
    deferred_order_count: deferredCount,
    credit_order_count: creditCount,
    storage_overdue_count: storageOverdueCount,
    top_shipping_method: topKey(methodCounts),
    distinct_shipping_method_count: Object.keys(methodCounts).length,
    top_destination_country: topKey(countryCounts),
    distinct_country_count: Object.keys(countryCounts).length,
    last_update_source: source,
    ...(source === 'scan' ? { last_scan_at: nowIso } : { last_event_at: nowIso }),
  };
}

async function upsertStats(base44, tenantId, statsData, existingMap) {
  const existing = existingMap.get(statsData.user_email);
  if (existing) {
    await base44.asServiceRole.entities.UserMemberStats.update(existing.id, statsData);
  } else {
    await base44.asServiceRole.entities.UserMemberStats.create({ tenant_id: tenantId, ...statsData });
  }
}

/** 重算单个用户的统计并写入缓存 */
async function recomputeUser(base44, tenantId, email, nowIso, source) {
  const [targetRecords, orders, pools, existingStats] = await Promise.all([
    base44.asServiceRole.entities.User.filter({ email }),
    base44.asServiceRole.entities.Order.filter({ tenant_id: tenantId, user_email: email }),
    base44.asServiceRole.entities.ShippingPool.filter({ tenant_id: tenantId }),
    base44.asServiceRole.entities.UserMemberStats.filter({ tenant_id: tenantId, user_email: email }),
  ]);
  const stats = computeStats(email, orders || [], pools || [], targetRecords?.[0], nowIso, source);
  const existingMap = new Map((existingStats || []).map(s => [s.user_email, s]));
  await upsertStats(base44, tenantId, stats, existingMap);
  return { stats, targetRecord: targetRecords?.[0] };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let payload = {};
    try { payload = await req.json(); } catch { /* empty body */ }

    // ---- 实体自动化事件路径（Order / ShippingPool 变更时由平台自动调用） ----
    if (payload?.event?.entity_name) {
      const { entity_name, entity_id } = payload.event;
      if (!['Order', 'ShippingPool'].includes(entity_name)) {
        return Response.json({ skipped: true, reason: 'unsupported entity' });
      }
      // 不信任载荷数据：优先回查真实实体（仅 delete 事件实体已不存在时，才退回平台提供的快照）
      let record = null;
      if (entity_id) {
        const found = await base44.asServiceRole.entities[entity_name].filter({ id: entity_id });
        record = found?.[0] || null;
      }
      if (!record && payload.event?.type === 'delete') {
        record = payload.data || null;
      }
      const oldRecord = payload.old_data || null;
      const eventTenantId = record?.tenant_id || oldRecord?.tenant_id;
      if (!eventTenantId) {
        return Response.json({ skipped: true, reason: 'no tenant context in event' });
      }
      const emails = new Set();
      if (entity_name === 'Order') {
        if (record?.user_email) emails.add(record.user_email);
        if (oldRecord?.user_email) emails.add(oldRecord.user_email);
      } else {
        [record, oldRecord].forEach(r => {
          if (!r) return;
          if (r.creator_email) emails.add(r.creator_email);
          (r.per_user_groups || []).forEach(g => { if (g.user_email) emails.add(g.user_email); });
        });
      }
      const eventNowIso = new Date().toISOString();
      for (const email of emails) {
        await recomputeUser(base44, eventTenantId, email, eventNowIso, 'event');
      }
      console.log(`[recalculateMemberStats] event ${entity_name}/${payload.event.type} updated=${emails.size}`);
      return Response.json({ success: true, updated: [...emails] });
    }

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const records = await base44.asServiceRole.entities.User.filter({ email: user.email });
    const userRecord = records?.[0];
    if (!userRecord) {
      return Response.json({ error: 'User record not found' }, { status: 404 });
    }
    if (userRecord.is_active === false) {
      return Response.json({ error: 'Account suspended' }, { status: 403 });
    }

    const isPlatformAdmin = user.role === 'platform_admin';
    const isAdmin = isPlatformAdmin || user.role === 'admin' || user.role === 'tenant_admin';
    const tenantId = isPlatformAdmin ? (payload.tenant_id || userRecord.tenant_id) : userRecord.tenant_id;
    if (!tenantId) {
      return Response.json({ error: 'Tenant context not found' }, { status: 400 });
    }

    const action = payload.action || 'scan_all';
    const nowIso = new Date().toISOString();

    // ---- 查询扫描状态 ----
    if (action === 'status') {
      if (!isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });
      const statsList = await base44.asServiceRole.entities.UserMemberStats.filter(
        { tenant_id: tenantId }, '-last_scan_at', 1
      );
      const all = await base44.asServiceRole.entities.UserMemberStats.filter({ tenant_id: tenantId });
      return Response.json({
        success: true,
        last_scan_at: statsList?.[0]?.last_scan_at || null,
        stats_count: (all || []).length,
      });
    }

    // ---- 单用户重算 ----
    if (action === 'scan_user') {
      const targetEmail = isAdmin ? (payload.user_email || user.email) : user.email;
      // 租户归属校验：目标用户必须属于当前租户
      const targetCheck = await base44.asServiceRole.entities.User.filter({ email: targetEmail });
      if (targetCheck?.[0] && targetCheck[0].tenant_id !== tenantId && !isPlatformAdmin) {
        return Response.json({ error: 'Target user not in your tenant' }, { status: 403 });
      }
      const { stats } = await recomputeUser(base44, tenantId, targetEmail, nowIso, 'event');
      return Response.json({ success: true, user_email: targetEmail, stats });
    }

    // ---- 全量扫描（仅管理员） ----
    if (action === 'scan_all') {
      if (!isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });

      const [tenantUsers, allOrders, allPools, existingStats] = await Promise.all([
        base44.asServiceRole.entities.User.filter({ tenant_id: tenantId }),
        base44.asServiceRole.entities.Order.filter({ tenant_id: tenantId }),
        base44.asServiceRole.entities.ShippingPool.filter({ tenant_id: tenantId }),
        base44.asServiceRole.entities.UserMemberStats.filter({ tenant_id: tenantId }),
      ]);

      const existingMap = new Map((existingStats || []).map(s => [s.user_email, s]));
      const userMap = new Map((tenantUsers || []).map(u => [u.email, u]));

      // 按用户分组订单
      const ordersByEmail = new Map();
      (allOrders || []).forEach(o => {
        if (!o.user_email) return;
        if (!ordersByEmail.has(o.user_email)) ordersByEmail.set(o.user_email, []);
        ordersByEmail.get(o.user_email).push(o);
      });

      // 扫描对象 = 租户所有用户 ∪ 有订单记录的邮箱
      const emails = new Set([...userMap.keys(), ...ordersByEmail.keys()]);

      let scanned = 0;
      for (const email of emails) {
        const stats = computeStats(
          email,
          ordersByEmail.get(email) || [],
          allPools || [],
          userMap.get(email),
          nowIso,
          'scan'
        );
        await upsertStats(base44, tenantId, stats, existingMap);
        scanned++;
      }

      console.log(`[recalculateMemberStats] scan_all tenant=${tenantId} scanned=${scanned}`);
      return Response.json({ success: true, scanned, last_scan_at: nowIso });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[recalculateMemberStats] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});