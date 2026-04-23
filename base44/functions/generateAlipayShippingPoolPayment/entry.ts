import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ── Multi-tenant Alipay config resolver ────────────────────────────────────
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
    gatewayUrl: map['alipay_key_gateway_url']  || Deno.env.get('ALIPAY_GATEWAY_URL') || 'https://openapi.alipay.com/gateway.do',
  };
}

function pemToBinary(pem) {
  const b64 = pem.replace(/-----BEGIN [^-]+-----|-----END [^-]+-----|\s/g, '');
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
  const sig = await crypto.subtle.sign({ name: 'RSASSA-PKCS1-v1_5' }, privateKey, data);
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

/**
 * Generate Alipay payment link for a ShippingPool fee.
 * Derives amount from fee_breakdown_per_user (current user's total_jpy)
 * or falls back to pool.shipping_fee_jpy.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Resolve tenant
    const userRecords = await base44.asServiceRole.entities.User.filter({ email: user.email });
    if (!userRecords || userRecords.length === 0) {
      return Response.json({ error: 'User record not found' }, { status: 404 });
    }
    const tenantId = userRecords[0].tenant_id;

    const body = await req.json();
    const { poolId } = body;
    if (!poolId) return Response.json({ error: 'Missing poolId' }, { status: 400 });

    // Load the pool
    const allPools = await base44.asServiceRole.entities.ShippingPool.filter({ tenant_id: tenantId });
    const pool = (allPools || []).find(p => p.id === poolId);
    if (!pool) return Response.json({ error: 'ShippingPool not found' }, { status: 404 });
    if (pool.tenant_id !== tenantId) return Response.json({ error: 'Forbidden' }, { status: 403 });

    // Determine amount in JPY for this user.
    // If supplement_amount_per_user is set (admin requested a top-up), charge only the diff.
    // Otherwise charge the full fee from fee_breakdown_per_user (or shipping_fee_jpy fallback).
    let amountJpy = 0;
    const supplements = pool.supplement_amount_per_user || [];
    if (supplements.length > 0) {
      const mySupplement = supplements.find(s => s.user_email === user.email);
      if (mySupplement) {
        amountJpy = mySupplement.supplement_jpy || 0;
      } else {
        // supplement list exists but no entry for this user — nothing to pay
        amountJpy = 0;
      }
    } else {
      const breakdowns = pool.fee_breakdown_per_user || [];
      if (breakdowns.length > 0) {
        const myBreakdown = breakdowns.find(b => b.user_email === user.email);
        amountJpy = myBreakdown ? (myBreakdown.total_jpy || 0) : (pool.shipping_fee_jpy || 0);
      } else {
        amountJpy = pool.shipping_fee_jpy || 0;
      }
    }

    if (!amountJpy || amountJpy <= 0) {
      return Response.json({ error: '运费金额无效，请联系管理员确认费用明细。' }, { status: 400 });
    }

    // Get exchange rate, settings, and alipay config in parallel
    const [liveRates, settingsList, alipayConfig] = await Promise.all([
      base44.asServiceRole.functions.invoke('fetchExchangeRates', {}),
      base44.asServiceRole.entities.SiteSettings.filter({ tenant_id: tenantId }),
      getAlipayConfig(base44, tenantId),
    ]);
    const settingsMap = {};
    (settingsList || []).forEach(s => { settingsMap[s.key] = parseFloat(s.value) || 0; });
    const jpy_cny_base = liveRates.data?.jpy_cny || 0.048;
    const jpy_cny_increment = settingsMap.jpy_cny_increment || 0;
    const jpy_cny_rate = jpy_cny_base + jpy_cny_increment;
    const total_amount_cny = (amountJpy * jpy_cny_rate).toFixed(2);

    console.log(`[generateAlipayShippingPoolPayment] poolId:${poolId} userEmail:${user.email} amountJpy:${amountJpy} cny:${total_amount_cny}`);

    const { appId, privateKey: privateKeyPem, gatewayUrl } = alipayConfig;
    if (!appId || !privateKeyPem) {
      return Response.json({ error: '支付宝配置缺失，请管理员在网站设置中配置支付宝密钥。' }, { status: 500 });
    }

    const out_trade_no = `SP${poolId.replace(/-/g, '').slice(0, 12).toUpperCase()}${Date.now()}`;
    const subject = `同一物流运费 - ${pool.pool_code || poolId.slice(-6).toUpperCase()}`;

    const reqOriginHeader = req.headers.get('origin') || req.headers.get('referer') || '';
    let appDomain = '';
    try { appDomain = new URL(reqOriginHeader).origin; } catch (_) {}
    const appId_env = Deno.env.get('BASE44_APP_ID');
    const notify_url = appDomain
      ? `${appDomain}/functions/handleAlipayPaymentCallback`
      : `https://api.base44.com/api/apps/${appId_env}/functions/handleAlipayPaymentCallback`;
    const return_url = appDomain ? `${appDomain}/ShippingPool` : `https://${appId_env}.base44.app/ShippingPool`;

    const bizContent = JSON.stringify({
      out_trade_no,
      total_amount: total_amount_cny,
      subject,
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

    // Save trade no and mark awaiting confirmation
    await base44.asServiceRole.entities.ShippingPool.update(poolId, {
      alipay_trade_no: out_trade_no,
      payment_status: 'awaiting_confirmation',
      payment_method: 'alipay',
    });

    return Response.json({ paymentUrl, out_trade_no });

  } catch (error) {
    console.error('[generateAlipayShippingPoolPayment] ERROR:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});