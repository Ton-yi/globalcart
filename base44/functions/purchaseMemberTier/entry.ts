import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * 付费购买会员阶级
 *
 * actions:
 * - list: 用户端获取可购买阶级列表 + 当前阶级 + 我的购买记录
 * - create_payment: 创建支付宝差价支付链接（差价为 0 时直接升级）
 *
 * 差价规则：应付 = 目标阶级 price_jpy − 当前阶级 price_jpy（最低 0），仅允许购买更高 sort_order 的阶级。
 * 支付完成由 handleAlipayPaymentCallback（MT 前缀单号）回调升级。
 */

// ── Alipay signing helpers（与 generateAlipayPaymentLink 一致） ──────────────
async function getAlipayConfig(base44, tenantId) {
  let settings = [];
  if (tenantId) {
    settings = await base44.asServiceRole.entities.SiteSettings.filter({ tenant_id: tenantId });
  }
  const map = {};
  (settings || []).forEach(s => { map[s.key] = s.value; });
  return {
    appId:      map['alipay_key_app_id']      || Deno.env.get('ALIPAY_APP_ID')      || '',
    privateKey: map['alipay_key_private_key'] || Deno.env.get('ALIPAY_PRIVATE_KEY') || '',
    gatewayUrl: map['alipay_key_gateway_url'] || Deno.env.get('ALIPAY_GATEWAY_URL') || 'https://openapi.alipay.com/gateway.do',
  };
}

function pemToBinary(pem) {
  let b64 = pem.replace(/-----BEGIN [^-]+-----/g, '').replace(/-----END [^-]+-----/g, '');
  b64 = b64.replace(/\s+/g, '');
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf;
}

async function importPrivateKey(pkcs8Pem) {
  return crypto.subtle.importKey(
    'pkcs8', pemToBinary(pkcs8Pem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']
  );
}

async function signParams(params, privateKey) {
  const str = Object.keys(params).sort()
    .filter(k => params[k] !== '' && params[k] !== null && params[k] !== undefined)
    .map(k => `${k}=${params[k]}`).join('&');
  const sig = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' }, privateKey, new TextEncoder().encode(str)
  );
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

// ── 阻断标签检查（payment:self_pay，与 generateAlipayPaymentLink 一致） ──────
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

// ── 升级应用：更新用户阶级 + 同步角色标签 + 站内通知 ────────────────────────
async function applyTierUpgrade(base44, tenantId, userRec, fromTier, toTier) {
  const oldRoleIds = fromTier?.associated_role_ids || [];
  const newRoleIds = toTier.associated_role_ids || [];
  const assigned = new Set(userRec.assigned_role_ids || []);
  oldRoleIds.forEach(r => { if (!newRoleIds.includes(r)) assigned.delete(r); });
  newRoleIds.forEach(r => assigned.add(r));

  await base44.asServiceRole.entities.User.update(userRec.id, {
    member_tier_id: toTier.id,
    member_tier_name: toTier.name,
    assigned_role_ids: [...assigned],
  });

  await base44.asServiceRole.entities.Notification.create({
    tenant_id: tenantId,
    user_email: userRec.email,
    notification_type: 'other',
    notification_subtype: 'member_tier_purchased',
    icon: 'Crown',
    title: `🎉 会员升级成功：${toTier.name}`,
    content: `感谢您的购买！您已升级为「${toTier.name}」会员。${toTier.description || ''}`,
    is_system: true,
    priority: 'normal',
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const userRecords = await base44.asServiceRole.entities.User.filter({ email: user.email });
    const userRec = userRecords?.[0];
    if (!userRec) return Response.json({ error: 'User record not found' }, { status: 404 });
    if (userRec.is_active === false) return Response.json({ error: 'Account suspended' }, { status: 403 });

    const tenantId = userRec.tenant_id;
    if (!tenantId) return Response.json({ error: 'User has no tenant assigned' }, { status: 403 });

    let body = {};
    try { body = await req.json(); } catch { /* empty */ }
    const action = body.action || 'list';

    // ── 阶级列表 + 我的购买记录 ──────────────────────────────────────────────
    if (action === 'list') {
      const [tiers, purchases] = await Promise.all([
        base44.asServiceRole.entities.MemberTier.filter({ tenant_id: tenantId, is_active: true }),
        base44.asServiceRole.entities.TierPurchase.filter({ tenant_id: tenantId, user_email: user.email }),
      ]);
      const currentTier = (tiers || []).find(t => t.id === userRec.member_tier_id) || null;
      const currentPrice = currentTier?.price_jpy || 0;
      const currentSort = currentTier ? (currentTier.sort_order || 0) : -Infinity;

      const list = (tiers || [])
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        .map(t => ({
          id: t.id,
          name: t.name,
          description: t.description || '',
          color: t.color,
          icon: t.icon || '',
          name_font_color: t.name_font_color || '',
          sort_order: t.sort_order || 0,
          price_jpy: t.price_jpy || 0,
          purchasable: !!t.purchasable,
          is_permanent: !!t.is_permanent,
          is_current: currentTier?.id === t.id,
          // 仅更高阶级且开放购买时可买，差价最低 0
          can_buy: !!t.purchasable && (t.sort_order || 0) > currentSort && currentTier?.id !== t.id,
          payable_jpy: Math.max(0, (t.price_jpy || 0) - currentPrice),
        }));

      const myPurchases = (purchases || [])
        .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
        .slice(0, 10)
        .map(p => ({
          id: p.id, to_tier_name: p.to_tier_name, payable_jpy: p.payable_jpy,
          status: p.status, created_date: p.created_date, paid_at: p.paid_at || null,
        }));

      return Response.json({
        tiers: list,
        current_tier: currentTier ? { id: currentTier.id, name: currentTier.name } : null,
        purchases: myPurchases,
      });
    }

    // ── 创建支付 ─────────────────────────────────────────────────────────────
    if (action === 'create_payment') {
      const { tier_id } = body;
      if (!tier_id) return Response.json({ error: 'tier_id required' }, { status: 400 });

      if (!['platform_admin', 'admin', 'tenant_admin'].includes(user.role) &&
          await hasBlockTag(base44, userRec, 'payment:self_pay')) {
        return Response.json({ error: '您已被禁止使用自助付款，请联系管理员。' }, { status: 403 });
      }

      const tiers = await base44.asServiceRole.entities.MemberTier.filter({ tenant_id: tenantId, is_active: true });
      const targetTier = (tiers || []).find(t => t.id === tier_id);
      if (!targetTier) return Response.json({ error: '阶级不存在或未启用' }, { status: 404 });
      if (!targetTier.purchasable) return Response.json({ error: '该阶级不开放购买' }, { status: 400 });

      const currentTier = (tiers || []).find(t => t.id === userRec.member_tier_id) || null;
      if (currentTier?.id === targetTier.id) return Response.json({ error: '您已是该阶级会员' }, { status: 400 });
      const currentSort = currentTier ? (currentTier.sort_order || 0) : -Infinity;
      if ((targetTier.sort_order || 0) <= currentSort) {
        return Response.json({ error: '只能购买比当前更高的阶级' }, { status: 400 });
      }

      // 防止重复：存在同目标的待支付记录则提示
      const existing = await base44.asServiceRole.entities.TierPurchase.filter({
        tenant_id: tenantId, user_email: user.email, status: 'pending',
      });
      const dup = (existing || []).find(p => p.to_tier_id === targetTier.id);

      const payableJpy = Math.max(0, (targetTier.price_jpy || 0) - (currentTier?.price_jpy || 0));

      // 差价为 0 → 直接升级，无需支付
      if (payableJpy <= 0) {
        await applyTierUpgrade(base44, tenantId, userRec, currentTier, targetTier);
        await base44.asServiceRole.entities.TierPurchase.create({
          tenant_id: tenantId,
          user_email: user.email,
          user_name: userRec.display_name || user.full_name || '',
          from_tier_id: currentTier?.id || '',
          from_tier_name: currentTier?.name || '',
          to_tier_id: targetTier.id,
          to_tier_name: targetTier.name,
          tier_price_jpy: targetTier.price_jpy || 0,
          payable_jpy: 0,
          status: 'paid',
          paid_at: new Date().toISOString(),
        });
        if (dup) await base44.asServiceRole.entities.TierPurchase.update(dup.id, { status: 'cancelled' });
        return Response.json({ upgraded: true, tier_name: targetTier.name });
      }

      // 汇率 + 支付宝配置
      const [liveRates, settingsList, alipayConfig] = await Promise.all([
        base44.asServiceRole.functions.invoke('fetchExchangeRates', {}),
        base44.asServiceRole.entities.SiteSettings.filter({ tenant_id: tenantId }),
        getAlipayConfig(base44, tenantId),
      ]);
      const { appId, privateKey: privateKeyPem, gatewayUrl } = alipayConfig;
      if (!appId || !privateKeyPem) {
        return Response.json({ error: '支付宝配置缺失，请管理员在网站设置中配置支付宝密钥。' }, { status: 500 });
      }
      const settingsMap = {};
      (settingsList || []).forEach(s => { settingsMap[s.key] = parseFloat(s.value) || 0; });
      const jpy_cny_rate = (liveRates.data?.jpy_cny || 0.048) + (settingsMap.jpy_cny_increment || 0);
      const total_amount_cny = (payableJpy * jpy_cny_rate).toFixed(2);

      const out_trade_no = `MT${targetTier.id.replace(/-/g, '').slice(0, 8).toUpperCase()}${Date.now()}`;

      const appId_env = Deno.env.get('BASE44_APP_ID');
      const origin = req.headers.get('origin') || req.headers.get('referer') || '';
      let frontendHost = '';
      try { frontendHost = new URL(origin).origin; } catch (_) {}
      const notify_url = frontendHost
        ? `${frontendHost}/functions/handleAlipayPaymentCallback`
        : `https://api.base44.com/api/apps/${appId_env}/functions/handleAlipayPaymentCallback`;
      const return_url = frontendHost
        ? `${frontendHost}/MemberTiers`
        : `https://${appId_env}.base44.app/MemberTiers`;

      const bizContent = JSON.stringify({
        out_trade_no,
        total_amount: total_amount_cny,
        subject: `会员升级 - ${targetTier.name}`,
        product_code: 'FAST_INSTANT_TRADE_PAY',
      });
      const params = {
        app_id: appId,
        method: 'alipay.trade.page.pay',
        format: 'JSON',
        charset: 'utf-8',
        sign_type: 'RSA2',
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
        version: '1.0',
        notify_url,
        return_url,
        biz_content: bizContent,
      };
      const privateKey = await importPrivateKey(privateKeyPem);
      params.sign = await signParams(params, privateKey);
      const paymentUrl = `${gatewayUrl}?${Object.entries(params)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')}`;

      // 记录购买单（pending）；同目标旧 pending 单作废
      if (dup) await base44.asServiceRole.entities.TierPurchase.update(dup.id, { status: 'cancelled' });
      await base44.asServiceRole.entities.TierPurchase.create({
        tenant_id: tenantId,
        user_email: user.email,
        user_name: userRec.display_name || user.full_name || '',
        from_tier_id: currentTier?.id || '',
        from_tier_name: currentTier?.name || '',
        to_tier_id: targetTier.id,
        to_tier_name: targetTier.name,
        tier_price_jpy: targetTier.price_jpy || 0,
        payable_jpy: payableJpy,
        amount_cny: parseFloat(total_amount_cny),
        rate_jpy_cny: jpy_cny_rate,
        out_trade_no,
        status: 'pending',
      });

      console.log(`[purchaseMemberTier] ${user.email} -> ${targetTier.name} payable=${payableJpy}JPY cny=${total_amount_cny} out_trade_no=${out_trade_no}`);
      return Response.json({ paymentUrl, out_trade_no, payable_jpy: payableJpy, amount_cny: total_amount_cny });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[purchaseMemberTier] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});