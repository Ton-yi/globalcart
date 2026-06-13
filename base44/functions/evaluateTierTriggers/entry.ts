import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * 会员阶级触发规则引擎
 *
 * 根据 MemberTier.trigger_condition 条件树对照 UserMemberStats 评估用户应处阶级。
 * 升降级规则：
 * - 满足更高阶级条件 → 自动升级
 * - 当前阶级 is_permanent=true → 永不自动降级
 * - 当前阶级为手动指定（trigger_enabled=false）→ 不自动降级（保护人工操作）
 * - 阶级变更时自动同步 associated_role_ids 角色标签，并发送站内通知
 *
 * 调用方式：
 * - UserMemberStats 实体自动化事件（统计更新后自动评估）
 * - 管理员手动：action=evaluate_user {user_email} / evaluate_all
 */

const OPS = {
  gte: (a, b) => Number(a) >= Number(b),
  gt: (a, b) => Number(a) > Number(b),
  lte: (a, b) => Number(a) <= Number(b),
  lt: (a, b) => Number(a) < Number(b),
  eq: (a, b) => String(a) === String(b),
  equals: (a, b) => String(a) === String(b),
  neq: (a, b) => String(a) !== String(b),
  not_equals: (a, b) => String(a) !== String(b),
  contains: (a, b) => String(a ?? '').includes(String(b)),
  not_contains: (a, b) => !String(a ?? '').includes(String(b)),
};

/** 递归评估条件树 {logic, conditions:[{field,operator,value} | 嵌套组]} */
function evalCondition(node, stats) {
  if (!node || typeof node !== 'object') return false;
  if (Array.isArray(node.conditions)) {
    if (node.conditions.length === 0) return false;
    const results = node.conditions.map(c => evalCondition(c, stats));
    return node.logic === 'or' ? results.some(Boolean) : results.every(Boolean);
  }
  const fn = OPS[node.operator];
  if (!fn || !node.field) return false;
  return fn(stats[node.field], node.value);
}

/** 评估单个用户：阶级内嵌触发器 + 独立触发规则（可变更阶级 和/或 增删角色标签） */
async function evaluateUserTier(base44, tenantId, email) {
  const [users, statsList, tiers, rules] = await Promise.all([
    base44.asServiceRole.entities.User.filter({ email, tenant_id: tenantId }),
    base44.asServiceRole.entities.UserMemberStats.filter({ tenant_id: tenantId, user_email: email }),
    base44.asServiceRole.entities.MemberTier.filter({ tenant_id: tenantId, is_active: true }),
    base44.asServiceRole.entities.TierTriggerRule.filter({ tenant_id: tenantId, is_active: true }).catch(() => []),
  ]);
  const userRec = users?.[0];
  const stats = statsList?.[0];
  if (!userRec || !stats) return { user_email: email, changed: false, reason: 'missing user or stats' };

  const hasCond = (c) => c && Array.isArray(c.conditions) && c.conditions.length > 0;

  // 1) 阶级内嵌触发器（兼容原有配置）：命中的最高阶级
  const triggerTiers = (tiers || [])
    .filter(t => t.trigger_enabled && hasCond(t.trigger_condition))
    .sort((a, b) => (b.sort_order || 0) - (a.sort_order || 0));
  const matchedTierTrigger = triggerTiers.find(t => evalCondition(t.trigger_condition, stats)) || null;

  // 2) 独立触发规则：条件命中的规则（可指定目标阶级、添加/移除角色标签）
  const matchedRules = (rules || []).filter(r => hasCond(r.trigger_condition) && evalCondition(r.trigger_condition, stats));

  // 阶级候选：内嵌触发命中 + 规则目标阶级，取排序最高者
  const ruleTierCandidates = matchedRules
    .map(r => r.target_tier_id ? (tiers || []).find(t => t.id === r.target_tier_id) : null)
    .filter(Boolean);
  const matched = [matchedTierTrigger, ...ruleTierCandidates]
    .filter(Boolean)
    .sort((a, b) => (b.sort_order || 0) - (a.sort_order || 0))[0] || null;

  // 规则角色增删集合（多条规则命中时合并，添加优先于移除）
  const addRoleIds = new Set();
  const removeRoleIds = new Set();
  matchedRules.forEach(r => {
    (r.add_role_ids || []).forEach(x => addRoleIds.add(x));
    (r.remove_role_ids || []).forEach(x => removeRoleIds.add(x));
  });

  if (!matched && matchedRules.length === 0) {
    return { user_email: email, changed: false, reason: 'no condition matched' };
  }

  const currentTier = (tiers || []).find(t => t.id === userRec.member_tier_id) || null;

  // 判定阶级变更（沿用保护规则：永久阶级 / 手动指定 / 付费购买不自动降级）
  let tierChange = null;
  let isUpgrade = false;
  if (matched && (!currentTier || matched.id !== currentTier.id)) {
    const currentSort = currentTier ? (currentTier.sort_order || 0) : -Infinity;
    isUpgrade = (matched.sort_order || 0) > currentSort;
    let blocked = false;
    if (!isUpgrade && currentTier) {
      if (currentTier.is_permanent) blocked = true; // 永久阶级保护
      else if (!currentTier.trigger_enabled) blocked = true; // 手动指定阶级保护
      else {
        // 付费购买保护：用户花钱买到的阶级不被自动降级
        const paidPurchases = await base44.asServiceRole.entities.TierPurchase.filter({
          tenant_id: tenantId, user_email: email, to_tier_id: currentTier.id, status: 'paid',
        });
        if (paidPurchases?.length > 0) blocked = true;
      }
    }
    if (!blocked) tierChange = matched;
  }

  // 组装角色标签：阶级变更时同步阶级关联角色 + 规则增删（先移除后添加）
  const assigned = new Set(userRec.assigned_role_ids || []);
  const beforeRoles = JSON.stringify([...assigned].sort());
  if (tierChange) {
    const oldRoleIds = currentTier?.associated_role_ids || [];
    const newRoleIds = tierChange.associated_role_ids || [];
    oldRoleIds.forEach(r => { if (!newRoleIds.includes(r)) assigned.delete(r); });
    newRoleIds.forEach(r => assigned.add(r));
  }
  removeRoleIds.forEach(r => assigned.delete(r));
  addRoleIds.forEach(r => assigned.add(r));
  const rolesChanged = JSON.stringify([...assigned].sort()) !== beforeRoles;

  if (!tierChange && !rolesChanged) {
    return { user_email: email, changed: false, reason: matched ? 'tier change blocked or already in tier' : 'no effective change' };
  }

  await base44.asServiceRole.entities.User.update(userRec.id, {
    ...(tierChange ? { member_tier_id: tierChange.id, member_tier_name: tierChange.name } : {}),
    ...(rolesChanged ? { assigned_role_ids: [...assigned] } : {}),
  });

  if (tierChange) {
    await base44.asServiceRole.entities.Notification.create({
      tenant_id: tenantId,
      user_email: email,
      notification_type: 'other',
      notification_subtype: isUpgrade ? 'member_tier_upgraded' : 'member_tier_changed',
      icon: 'Crown',
      title: isUpgrade ? `🎉 会员升级：${tierChange.name}` : `会员阶级变更：${tierChange.name}`,
      content: isUpgrade
        ? `恭喜！您已自动升级为「${tierChange.name}」会员。${tierChange.description || ''}`
        : `您的会员阶级已调整为「${tierChange.name}」。${tierChange.description || ''}`,
      is_system: true,
      priority: 'normal',
    });
  }

  console.log(`[evaluateTierTriggers] ${email}: tier ${currentTier?.name || '(无)'} -> ${tierChange ? tierChange.name : '(不变)'} | rolesChanged=${rolesChanged}`);
  return {
    user_email: email,
    changed: true,
    from: currentTier?.name || null,
    to: tierChange ? tierChange.name : (currentTier?.name || null),
    direction: tierChange ? (isUpgrade ? 'upgrade' : 'downgrade') : 'roles_only',
    roles_changed: rolesChanged,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let payload = {};
    try { payload = await req.json(); } catch { /* empty body */ }

    // ---- 实体自动化事件路径（UserMemberStats 创建/更新后自动评估） ----
    if (payload?.event?.entity_name === 'UserMemberStats') {
      const { entity_id } = payload.event;
      // 不信任载荷数据：回查真实统计记录
      let record = null;
      if (entity_id) {
        const found = await base44.asServiceRole.entities.UserMemberStats.filter({ id: entity_id });
        record = found?.[0] || null;
      }
      if (!record?.tenant_id || !record?.user_email) {
        return Response.json({ skipped: true, reason: 'stats record not found' });
      }
      const result = await evaluateUserTier(base44, record.tenant_id, record.user_email);
      return Response.json({ success: true, ...result });
    }

    // ---- 手动调用路径（管理员） ----
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const records = await base44.asServiceRole.entities.User.filter({ email: user.email });
    const userRecord = records?.[0];
    if (!userRecord) return Response.json({ error: 'User record not found' }, { status: 404 });
    if (userRecord.is_active === false) return Response.json({ error: 'Account suspended' }, { status: 403 });

    const isPlatformAdmin = user.role === 'platform_admin';
    const isAdmin = isPlatformAdmin || user.role === 'admin' || user.role === 'tenant_admin';
    if (!isAdmin) return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });

    const tenantId = isPlatformAdmin ? (payload.tenant_id || userRecord.tenant_id) : userRecord.tenant_id;
    if (!tenantId) return Response.json({ error: 'Tenant context not found' }, { status: 400 });

    const action = payload.action || 'evaluate_all';

    if (action === 'evaluate_user') {
      if (!payload.user_email) return Response.json({ error: 'user_email required' }, { status: 400 });
      const result = await evaluateUserTier(base44, tenantId, payload.user_email);
      return Response.json({ success: true, ...result });
    }

    if (action === 'evaluate_all') {
      const allStats = await base44.asServiceRole.entities.UserMemberStats.filter({ tenant_id: tenantId });
      const results = [];
      for (const s of allStats || []) {
        if (!s.user_email) continue;
        results.push(await evaluateUserTier(base44, tenantId, s.user_email));
      }
      const changed = results.filter(r => r.changed);
      console.log(`[evaluateTierTriggers] evaluate_all tenant=${tenantId} evaluated=${results.length} changed=${changed.length}`);
      return Response.json({ success: true, evaluated: results.length, changed_count: changed.length, changes: changed });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[evaluateTierTriggers] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});