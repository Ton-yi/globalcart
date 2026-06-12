import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ── Multi-tenant Alipay public key resolver ────────────────────────────────
async function getAlipayPublicKey(base44, tenantId) {
  let settings = [];
  if (tenantId) {
    settings = await base44.asServiceRole.entities.SiteSettings.filter({ tenant_id: tenantId });
  }
  const map = {};
  (settings || []).forEach(s => { map[s.key] = s.value; });
  return map['alipay_key_public_key'] || Deno.env.get('ALIPAY_PUBLIC_KEY') || '';
}

// ── Helpers ────────────────────────────────────────────────────────────────

function pemToBinary(pem) {
  const b64 = pem.replace(/-----BEGIN [^-]+-----|-----END [^-]+-----|\s/g, '');
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf;
}

async function importPublicKey(pemOrRaw) {
  let pem = pemOrRaw.trim();
  if (!pem.startsWith('-----')) {
    pem = `-----BEGIN PUBLIC KEY-----\n${pem}\n-----END PUBLIC KEY-----`;
  }
  const keyData = pemToBinary(pem);
  return crypto.subtle.importKey(
    'spki',
    keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
}

async function verifyAlipaySign(params, publicKeyPem) {
  const sign = params.sign;
  if (!sign) return false;

  const sortedKeys = Object.keys(params).sort();
  const str = sortedKeys
    .filter(k => k !== 'sign' && k !== 'sign_type' && params[k] !== '' && params[k] != null)
    .map(k => `${k}=${params[k]}`)
    .join('&');

  const publicKey = await importPublicKey(publicKeyPem);
  const sigBin = Uint8Array.from(atob(sign), c => c.charCodeAt(0));
  const encoder = new TextEncoder();
  return crypto.subtle.verify(
    { name: 'RSASSA-PKCS1-v1_5' },
    publicKey,
    sigBin,
    encoder.encode(str)
  );
}

// ── Main handler ───────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  console.log('[DIAG][handleAlipayPaymentCallback] === CALLBACK RECEIVED ===');
  console.log('[DIAG][handleAlipayPaymentCallback] method:', req.method);
  console.log('[DIAG][handleAlipayPaymentCallback] url:', req.url);
  console.log('[DIAG][handleAlipayPaymentCallback] content-type:', req.headers.get('content-type'));
  console.log('[DIAG][handleAlipayPaymentCallback] Base44-App-Id header (original):', req.headers.get('Base44-App-Id'));

  try {
    const base44 = createClientFromRequest(req);

    const bodyText = await req.text();
    console.log('[DIAG][handleAlipayPaymentCallback] raw body (first 500 chars):', bodyText.slice(0, 500));

    // Parse form-encoded body
    const params = {};
    for (const pair of bodyText.split('&')) {
      const eqIdx = pair.indexOf('=');
      if (eqIdx === -1) continue;
      const k = decodeURIComponent(pair.slice(0, eqIdx));
      const v = decodeURIComponent(pair.slice(eqIdx + 1).replace(/\+/g, ' '));
      params[k] = v;
    }

    const { trade_status, out_trade_no, trade_no, buyer_logon_id, total_amount, app_id: alipayAppId } = params;
    console.log('[DIAG][handleAlipayPaymentCallback] trade_status:', trade_status);
    console.log('[DIAG][handleAlipayPaymentCallback] out_trade_no:', out_trade_no);
    console.log('[DIAG][handleAlipayPaymentCallback] trade_no:', trade_no);
    console.log('[DIAG][handleAlipayPaymentCallback] total_amount:', total_amount);
    console.log('[DIAG][handleAlipayPaymentCallback] buyer_logon_id:', buyer_logon_id);
    console.log('[DIAG][handleAlipayPaymentCallback] alipay app_id in params:', alipayAppId);

    // Resolve tenant from out_trade_no via matching order, then use tenant-specific public key
    // We do a pre-fetch to find tenant_id for the right public key
    let tenantIdForKey = null;
    if (out_trade_no && out_trade_no.startsWith('MT')) {
      // 会员阶级购买单：从 TierPurchase 解析租户
      const tp = await base44.asServiceRole.entities.TierPurchase.filter({ out_trade_no });
      if (tp?.[0]) tenantIdForKey = tp[0].tenant_id;
    } else {
      const preOrders = await base44.asServiceRole.entities.Order.list('-created_date', 500);
      const preMatch = (preOrders || []).find(o =>
        o.alipay_trade_no === out_trade_no || o.shipping_alipay_trade_no === out_trade_no
      );
      if (preMatch) tenantIdForKey = preMatch.tenant_id;
    }
    const publicKeyPem = await getAlipayPublicKey(base44, tenantIdForKey);
    console.log('[DIAG][handleAlipayPaymentCallback] ALIPAY_PUBLIC_KEY present:', !!publicKeyPem, '| tenantId:', tenantIdForKey);
    // Log first 60 chars of public key (non-secret header) to confirm which key type it is
    const keyPreview = publicKeyPem ? publicKeyPem.replace(/\s+/g, ' ').slice(0, 80) : 'null';
    console.log('[DIAG][handleAlipayPaymentCallback] ALIPAY_PUBLIC_KEY preview (first 80 chars):', keyPreview);

    // Build and log the exact string being signed for diagnosis
    const signStr = (() => {
      const sortedKeys = Object.keys(params).sort();
      return sortedKeys
        .filter(k => k !== 'sign' && k !== 'sign_type' && params[k] !== '' && params[k] != null)
        .map(k => `${k}=${params[k]}`)
        .join('&');
    })();
    console.log('[DIAG][handleAlipayPaymentCallback] sign_type in params:', params.sign_type);
    console.log('[DIAG][handleAlipayPaymentCallback] sign present:', !!params.sign);
    console.log('[DIAG][handleAlipayPaymentCallback] sign string to verify (first 200 chars):', signStr.slice(0, 200));
    console.log('[DIAG][handleAlipayPaymentCallback] total params keys:', Object.keys(params).sort().join(','));

    // 1. Verify signature
    let valid = false;
    let verifyError = null;
    try {
      valid = await verifyAlipaySign(params, publicKeyPem);
    } catch (e) {
      verifyError = e.message;
    }
    console.log('[DIAG][handleAlipayPaymentCallback] signature valid:', valid, '| verifyError:', verifyError);
    if (!valid) {
      console.error('[DIAG][handleAlipayPaymentCallback] SIGNATURE VERIFICATION FAILED — returning fail');
      console.error('[DIAG][handleAlipayPaymentCallback] verifyError:', verifyError);
      return new Response('fail', { status: 200 });
    }

    // 2. Only process successful trades
    if (trade_status !== 'TRADE_SUCCESS' && trade_status !== 'TRADE_FINISHED') {
      console.log('[DIAG][handleAlipayPaymentCallback] trade_status not success/finished, skipping');
      return new Response('success', { status: 200 });
    }

    // 3-pre. Member tier purchase (out_trade_no starts with 'MT')
    if (out_trade_no && out_trade_no.startsWith('MT')) {
      console.log('[DIAG][handleAlipayPaymentCallback] detected tier purchase trade_no:', out_trade_no);
      const tpList = await base44.asServiceRole.entities.TierPurchase.filter({ out_trade_no });
      const purchase = tpList?.[0];
      if (!purchase) {
        console.error('[DIAG][handleAlipayPaymentCallback] no TierPurchase matched:', out_trade_no);
        return new Response('success', { status: 200 });
      }
      if (purchase.status === 'paid') {
        console.log('[DIAG][handleAlipayPaymentCallback] tier purchase already paid, idempotent skip');
        return new Response('success', { status: 200 });
      }
      const [users, tiers] = await Promise.all([
        base44.asServiceRole.entities.User.filter({ email: purchase.user_email, tenant_id: purchase.tenant_id }),
        base44.asServiceRole.entities.MemberTier.filter({ tenant_id: purchase.tenant_id }),
      ]);
      const userRec = users?.[0];
      const toTier = (tiers || []).find(t => t.id === purchase.to_tier_id);
      if (!userRec || !toTier) {
        console.error('[DIAG][handleAlipayPaymentCallback] tier purchase user/tier not found:', purchase.user_email, purchase.to_tier_id);
        return new Response('success', { status: 200 });
      }
      const fromTier = (tiers || []).find(t => t.id === userRec.member_tier_id) || null;

      // 金额校验：实付 CNY 必须与生成链接时的应付金额一致（防篡改/部分支付）
      const actualCny = total_amount ? parseFloat(total_amount) : null;
      if (purchase.amount_cny && actualCny !== null && Math.abs(actualCny - purchase.amount_cny) > 0.01) {
        console.error(`[DIAG][handleAlipayPaymentCallback] tier purchase AMOUNT MISMATCH: expected ${purchase.amount_cny} CNY, got ${actualCny} CNY — NOT upgrading`);
        return new Response('success', { status: 200 });
      }

      // 防降级：目标阶级必须高于用户当前阶级（防止支付过期的低阶级链接覆盖高阶级）
      const callbackCurrentSort = fromTier ? (fromTier.sort_order || 0) : -Infinity;
      if (fromTier && fromTier.id !== toTier.id && (toTier.sort_order || 0) <= callbackCurrentSort) {
        console.error(`[DIAG][handleAlipayPaymentCallback] tier purchase would DOWNGRADE (${fromTier.name} -> ${toTier.name}) — payment recorded, tier NOT changed`);
        await base44.asServiceRole.entities.TierPurchase.update(purchase.id, {
          status: 'paid',
          alipay_transaction_id: trade_no,
          paid_at: new Date().toISOString(),
        });
        await base44.asServiceRole.entities.Notification.create({
          tenant_id: purchase.tenant_id,
          user_email: purchase.user_email,
          notification_type: 'other',
          notification_subtype: 'member_tier_purchased',
          icon: 'Crown',
          title: '会员购买支付已收到',
          content: `您支付的「${toTier.name}」不高于您当前的阶级「${fromTier.name}」，阶级未变更。如有疑问请联系管理员处理退款。`,
          is_system: true,
          priority: 'normal',
        });
        return new Response('success', { status: 200 });
      }

      // 升级用户阶级 + 同步角色标签
      const oldRoleIds = fromTier?.associated_role_ids || [];
      const newRoleIds = toTier.associated_role_ids || [];
      const assigned = new Set(userRec.assigned_role_ids || []);
      oldRoleIds.forEach(r => { if (!newRoleIds.includes(r)) assigned.delete(r); });
      newRoleIds.forEach(r => assigned.add(r));
      await Promise.all([
        base44.asServiceRole.entities.User.update(userRec.id, {
          member_tier_id: toTier.id,
          member_tier_name: toTier.name,
          assigned_role_ids: [...assigned],
        }),
        base44.asServiceRole.entities.TierPurchase.update(purchase.id, {
          status: 'paid',
          alipay_transaction_id: trade_no,
          paid_at: new Date().toISOString(),
        }),
      ]);
      await base44.asServiceRole.entities.Notification.create({
        tenant_id: purchase.tenant_id,
        user_email: purchase.user_email,
        notification_type: 'other',
        notification_subtype: 'member_tier_purchased',
        icon: 'Crown',
        title: `🎉 会员升级成功：${toTier.name}`,
        content: `感谢您的购买！您已升级为「${toTier.name}」会员。${toTier.description || ''}`,
        is_system: true,
        priority: 'normal',
      });
      console.log(`[DIAG][handleAlipayPaymentCallback] tier purchase SUCCESS: ${purchase.user_email} -> ${toTier.name}`);
      return new Response('success', { status: 200 });
    }

    // 3a. Check if this is a credit repayment (out_trade_no starts with 'CR')
    if (out_trade_no && out_trade_no.startsWith('CR')) {
      console.log('[DIAG][handleAlipayPaymentCallback] detected credit repayment trade_no:', out_trade_no);
      // Find user with this pending trade no
      const allUsers = await base44.asServiceRole.entities.User.list('-created_date', 1000);
      const matchedUser = (allUsers || []).find(u => u.credit_pending_trade_no === out_trade_no);
      if (matchedUser) {
        console.log('[DIAG][handleAlipayPaymentCallback] matched credit user:', matchedUser.email, 'clearing balance:', matchedUser.credit_balance_jpy);
        await base44.asServiceRole.entities.User.update(matchedUser.id, {
          credit_balance_jpy: 0,
          credit_pending_trade_no: null,
          credit_last_payment_date: new Date().toISOString().slice(0, 10),
          credit_last_payment_amount: matchedUser.credit_balance_jpy || 0,
        });
        console.log('[DIAG][handleAlipayPaymentCallback] credit balance cleared for user:', matchedUser.email);
      } else {
        console.error('[DIAG][handleAlipayPaymentCallback] no user matched credit_pending_trade_no:', out_trade_no);
      }
      return new Response('success', { status: 200 });
    }

    // 3. Find matching orders — reuse the pre-fetched list from signature resolution step
    console.log('[DIAG][handleAlipayPaymentCallback] searching pre-fetched orders for out_trade_no:', out_trade_no);
    const allOrders = await base44.asServiceRole.entities.Order.list('-created_date', 500);
    console.log('[DIAG][handleAlipayPaymentCallback] total orders fetched:', allOrders?.length);

    const matchedOrders = (allOrders || []).filter(o =>
      o.alipay_trade_no === out_trade_no || o.shipping_alipay_trade_no === out_trade_no
    );
    console.log('[DIAG][handleAlipayPaymentCallback] matched orders count:', matchedOrders.length);
    matchedOrders.forEach((o, i) => {
      console.log(`[DIAG][handleAlipayPaymentCallback] matched[${i}]: id=${o.id} alipay_trade_no=${o.alipay_trade_no} shipping_alipay_trade_no=${o.shipping_alipay_trade_no} payment_status=${o.payment_status} order_status=${o.order_status}`);
    });

    if (matchedOrders.length === 0) {
      // Log a sample of alipay_trade_no values to diagnose mismatch
      const sample = (allOrders || []).slice(0, 10).map(o => `id=${o.id.slice(-6)} alipay_trade_no=${o.alipay_trade_no || 'null'}`);
      console.error('[DIAG][handleAlipayPaymentCallback] NO MATCH FOUND. out_trade_no was:', out_trade_no);
      console.error('[DIAG][handleAlipayPaymentCallback] Sample of orders:', sample.join(' | '));
      return new Response('success', { status: 200 });
    }

    // 4. Idempotency check
    const pendingOrders = matchedOrders.filter(o =>
      o.payment_status !== 'paid' && o.payment_status !== 'confirmed'
    );
    console.log('[DIAG][handleAlipayPaymentCallback] pending (not yet paid) orders:', pendingOrders.length);
    if (pendingOrders.length === 0) {
      console.log('[DIAG][handleAlipayPaymentCallback] all matched orders already paid, idempotent skip');
      return new Response('success', { status: 200 });
    }

    // 5. Update all matching orders
    // total_amount from Alipay callback is the actual CNY amount paid
    const actualCnyPaid = total_amount ? parseFloat(total_amount) : null;

    await Promise.all(pendingOrders.map(order => {
      const isShippingPayment = order.shipping_alipay_trade_no === out_trade_no;
      let updates;
      if (isShippingPayment) {
        updates = {
          payment_status: 'confirmed',
          order_status: 'ready_to_ship',
          alipay_transaction_id: trade_no,
          payment_method: 'alipay',
        };
      } else {
        // prepayment_amount stays in JPY (internal base currency — never overwrite with CNY)
        // Actual CNY paid is recorded in prepayment_amount_cny
        const originalJpy = order.prepayment_amount_jpy || order.prepayment_amount || 0;
        const cnyAmount = order.prepayment_amount_cny || actualCnyPaid;
        updates = {
          payment_status: 'paid',
          order_status: 'pending_purchase',
          paid_amount: originalJpy, // JPY for internal accounting
          alipay_transaction_id: trade_no,
          payment_method: 'alipay',
          prepayment_currency: 'CNY',
          ...(cnyAmount ? { prepayment_amount_cny: cnyAmount } : {}),
          ...(originalJpy ? { prepayment_amount_jpy: originalJpy } : {}),
        };
      }
      console.log(`[DIAG][handleAlipayPaymentCallback] updating order ${order.id}: status ${order.order_status} → ${updates.order_status}, payment ${order.payment_status} → ${updates.payment_status}`);
      return base44.asServiceRole.entities.Order.update(order.id, updates);
    }));

    console.log(`[DIAG][handleAlipayPaymentCallback] SUCCESS: ${pendingOrders.length} order(s) updated. out_trade_no: ${out_trade_no}, trade_no: ${trade_no}`);
    return new Response('success', { status: 200 });

  } catch (error) {
    console.error('[DIAG][handleAlipayPaymentCallback] EXCEPTION:', error.message);
    console.error('[DIAG][handleAlipayPaymentCallback] stack:', error.stack);
    return new Response('success', { status: 200 });
  }
});