import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ── Multi-tenant Alipay config resolver ────────────────────────────────────
// Priority: tenant SiteSettings (alipay_key_*) → env vars (ALIPAY_*)
async function getAlipayConfig(base44, tenantId) {
  let settings = [];
  if (tenantId) {
    settings = await base44.asServiceRole.entities.SiteSettings.filter({ tenant_id: tenantId });
  }
  const map = {};
  (settings || []).forEach(s => { map[s.key] = s.value; });
  return {
    appId:      map['alipay_key_app_id']      || Deno.env.get('ALIPAY_APP_ID')      || '',
    privateKey: map['alipay_key_private_key']  || Deno.env.get('ALIPAY_PRIVATE_KEY') || '',
    publicKey:  map['alipay_key_public_key']   || Deno.env.get('ALIPAY_PUBLIC_KEY')  || '',
    gatewayUrl: map['alipay_key_gateway_url']  || Deno.env.get('ALIPAY_GATEWAY_URL') || 'https://openapi.alipay.com/gateway.do',
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function pemToBinary(pem) {
  // Strip PEM headers/footers and ALL whitespace (including \r\n, spaces, tabs)
  let b64 = pem.replace(/-----BEGIN [^-]+-----/g, '').replace(/-----END [^-]+-----/g, '');
  b64 = b64.replace(/\s+/g, '');
  // If it's a raw base64 key (no PEM headers), use as-is
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf;
}

async function importPrivateKey(pkcs8Pem) {
  const keyData = pemToBinary(pkcs8Pem);
  return crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

async function signParams(params, privateKey) {
  const sortedKeys = Object.keys(params).sort();
  const str = sortedKeys
    .filter(k => params[k] !== '' && params[k] !== null && params[k] !== undefined)
    .map(k => `${k}=${params[k]}`)
    .join('&');

  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const sig = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    privateKey,
    data
  );
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

// ── Main handler ───────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    // DIAG: log request context
    console.log('[DIAG][generateAlipayPaymentLink] === REQUEST START ===');
    console.log('[DIAG][generateAlipayPaymentLink] method:', req.method);
    console.log('[DIAG][generateAlipayPaymentLink] url:', req.url);
    console.log('[DIAG][generateAlipayPaymentLink] origin header:', req.headers.get('origin'));
    console.log('[DIAG][generateAlipayPaymentLink] referer header:', req.headers.get('referer'));
    console.log('[DIAG][generateAlipayPaymentLink] host header:', req.headers.get('host'));
    console.log('[DIAG][generateAlipayPaymentLink] Base44-App-Id header:', req.headers.get('Base44-App-Id'));

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    console.log('[DIAG][generateAlipayPaymentLink] auth user:', user?.email, '| role:', user?.role);

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get tenant context
    const userRecord = await base44.asServiceRole.entities.User.filter({ email: user.email });
    const tenantId = userRecord?.[0]?.tenant_id;
    console.log('[DIAG][generateAlipayPaymentLink] tenantId:', tenantId);

    if (!userRecord || userRecord.length === 0) {
      return Response.json({ error: 'User record not found' }, { status: 404 });
    }
    if (!tenantId && user.role !== 'platform_admin') {
      return Response.json({ error: 'User has no tenant assigned' }, { status: 403 });
    }

    const body = await req.json();
    const orderIds = body.orderIds || (body.orderId ? [body.orderId] : null);
    const { amount, subject, paymentType } = body;
    console.log('[DIAG][generateAlipayPaymentLink] orderIds:', orderIds, '| amount:', amount);

    if (!orderIds || orderIds.length === 0) {
      return Response.json({ error: 'Missing required parameter: orderId or orderIds' }, { status: 400 });
    }

    // FIXED: Use list() then find by id — filter({id}) is not supported by SDK
    console.log('[DIAG][generateAlipayPaymentLink] fetching orders for tenant:', tenantId);
    const allTenantOrders = await base44.asServiceRole.entities.Order.filter({ tenant_id: tenantId });
    console.log('[DIAG][generateAlipayPaymentLink] total tenant orders found:', allTenantOrders?.length);

    const orders = orderIds.map(id => (allTenantOrders || []).find(o => o.id === id));
    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      console.log(`[DIAG][generateAlipayPaymentLink] order[${i}] id:${orderIds[i]} found:${!!order} tenant_id:${order?.tenant_id} user_email:${order?.user_email} status:${order?.order_status}`);
      if (!order) {
        return Response.json({ error: `Order not found: ${orderIds[i]}` }, { status: 404 });
      }
      if (user.role !== 'platform_admin' && order.tenant_id !== tenantId) {
        return Response.json({ error: 'Forbidden: Order does not belong to your tenant' }, { status: 403 });
      }
      if (user.role === 'user' && order.user_email !== user.email) {
        return Response.json({ error: 'Forbidden: You can only pay your own orders' }, { status: 403 });
      }
    }

    // Fetch live rates + settings + alipay config in parallel
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

    const jpy_cny_base      = liveRates.data?.jpy_cny || 0.048;
    const jpy_cny_increment = settingsMap.jpy_cny_increment || 0;
    const jpy_cny_rate      = jpy_cny_base + jpy_cny_increment;
    console.log('[DIAG][generateAlipayPaymentLink] jpy_cny_rate:', jpy_cny_rate, '(base:', jpy_cny_base, '+ increment:', jpy_cny_increment, ')');

    // Determine total amount in CNY
    let total_amount_cny;
    if (amount) {
      const amount_jpy = Number(amount);
      total_amount_cny = (amount_jpy * jpy_cny_rate).toFixed(2);
    } else {
      // FIXED: reuse already-fetched orders instead of re-fetching with filter({id})
      let totalJpy = 0;
      for (const o of orders) {
        if (o) totalJpy += (o.prepayment_amount || 0);
      }
      total_amount_cny = (totalJpy * jpy_cny_rate).toFixed(2);
    }
    console.log('[DIAG][generateAlipayPaymentLink] total_amount_cny:', total_amount_cny);

    // Generate a unique out_trade_no
    const shortRef = orderIds.map(id => id.replace(/-/g, '').slice(0, 4).toUpperCase()).join('');
    const out_trade_no = `TY${shortRef.slice(0, 16)}${Date.now()}`;

    const appId_env = Deno.env.get('BASE44_APP_ID');
    // Build notify_url using Base44 public function URL: https://<app-domain>/functions/<function-name>
    const reqOriginHeader = req.headers.get('origin') || req.headers.get('referer') || '';
    let appDomain = '';
    try { appDomain = new URL(reqOriginHeader).origin; } catch (_) {}
    const notify_url = appDomain
      ? `${appDomain}/functions/handleAlipayPaymentCallback`
      : `https://api.base44.com/api/apps/${appId_env}/functions/handleAlipayPaymentCallback`;
    // Build return_url from Origin/Referer
    const origin = req.headers.get('origin') || req.headers.get('referer') || '';
    let frontendHost = '';
    try { frontendHost = new URL(origin).origin; } catch (_) {}
    const return_url = frontendHost
      ? `${frontendHost}/MyOrders`
      : `https://${appId_env}.base44.app/MyOrders`;

    console.log('[DIAG][generateAlipayPaymentLink] notify_url:', notify_url);
    console.log('[DIAG][generateAlipayPaymentLink] return_url:', return_url);
    console.log('[DIAG][generateAlipayPaymentLink] out_trade_no:', out_trade_no);

    const resolvedSubject = subject || `同一物流代购 - ${orderIds.length} 笔订单`;

    const bizContent = JSON.stringify({
      out_trade_no,
      total_amount: total_amount_cny,
      subject: resolvedSubject,
      product_code: 'FAST_INSTANT_TRADE_PAY',
    });

    const params = {
      app_id:      appId,
      method:      'alipay.trade.page.pay',
      format:      'JSON',
      charset:     'utf-8',
      sign_type:   'RSA2',
      timestamp:   new Date().toISOString().replace('T', ' ').slice(0, 19),
      version:     '1.0',
      notify_url,
      return_url,
      biz_content: bizContent,
    };

    const privateKey = await importPrivateKey(privateKeyPem);
    const sign = await signParams(params, privateKey);
    params.sign = sign;

    const query = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    const paymentUrl = `${gatewayUrl}?${query}`;

    // Update all orders: store out_trade_no, set awaiting_payment, and record the actual CNY amount + rate
    console.log('[DIAG][generateAlipayPaymentLink] updating orders with out_trade_no:', out_trade_no);
    await Promise.all(orders.map((order, idx) => {
      const id = orderIds[idx];
      // Calculate per-order CNY amount (proportional to prepayment_amount)
      let perOrderCny = null;
      if (orders.length === 1) {
        perOrderCny = parseFloat(total_amount_cny);
      } else if (order && order.prepayment_amount > 0) {
        const orderShare = order.prepayment_amount / orders.reduce((s, o) => s + (o?.prepayment_amount || 0), 0);
        perOrderCny = parseFloat((parseFloat(total_amount_cny) * orderShare).toFixed(2));
      }
      return base44.asServiceRole.entities.Order.update(id, {
        alipay_trade_no: out_trade_no,
        payment_status: 'awaiting_payment',
        order_status: 'payment_pending',
        // Record the pending CNY amount so callback can confirm it
        ...(perOrderCny !== null ? {
          prepayment_amount_cny: perOrderCny,
          prepayment_rate_jpy_cny: jpy_cny_rate,
        } : {}),
      });
    }));
    console.log('[DIAG][generateAlipayPaymentLink] orders updated successfully');

    return Response.json({ paymentUrl, out_trade_no });

  } catch (error) {
    console.error('[DIAG][generateAlipayPaymentLink] ERROR:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});