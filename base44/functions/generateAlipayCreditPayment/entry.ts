import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

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
 * Generate Alipay payment link for credit balance repayment.
 * The user pays back their current credit_balance_jpy.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Resolve tenant and user record
    const userRecords = await base44.asServiceRole.entities.User.filter({ email: user.email });
    if (!userRecords || userRecords.length === 0) {
      return Response.json({ error: 'User record not found' }, { status: 404 });
    }
    const userRecord = userRecords[0];
    const tenantId = userRecord.tenant_id;

    const amountJpy = parseFloat(userRecord.credit_balance_jpy) || 0;
    if (amountJpy <= 0) {
      return Response.json({ error: '当前无欠款，无需还款。' }, { status: 400 });
    }

    // Get exchange rate (JPY→CNY)
    const [liveRates, settingsList] = await Promise.all([
      base44.asServiceRole.functions.invoke('fetchExchangeRates', {}),
      base44.asServiceRole.entities.SiteSettings.filter({ tenant_id: tenantId }),
    ]);
    const settingsMap = {};
    (settingsList || []).forEach(s => { settingsMap[s.key] = parseFloat(s.value) || 0; });
    const jpy_cny_base = liveRates.data?.jpy_cny || 0.048;
    const jpy_cny_increment = settingsMap.jpy_cny_increment || 0;
    const jpy_cny_rate = jpy_cny_base + jpy_cny_increment;
    const total_amount_cny = (amountJpy * jpy_cny_rate).toFixed(2);

    console.log(`[generateAlipayCreditPayment] userEmail:${user.email} amountJpy:${amountJpy} cny:${total_amount_cny}`);

    // Alipay config
    const appId         = Deno.env.get('ALIPAY_APP_ID');
    const privateKeyPem = Deno.env.get('ALIPAY_PRIVATE_KEY');
    const gatewayUrl    = Deno.env.get('ALIPAY_GATEWAY_URL') || 'https://openapi.alipay.com/gateway.do';

    if (!appId || !privateKeyPem) {
      return Response.json({ error: '支付宝配置缺失，请联系管理员。' }, { status: 500 });
    }

    const out_trade_no = `CR${userRecord.id.replace(/-/g, '').slice(0, 12).toUpperCase()}${Date.now()}`;
    const subject = `同一物流记账还款 - ¥${amountJpy}`;

    const reqOriginHeader = req.headers.get('origin') || req.headers.get('referer') || '';
    let appDomain = '';
    try { appDomain = new URL(reqOriginHeader).origin; } catch (_) {}
    const appId_env = Deno.env.get('BASE44_APP_ID');
    const notify_url = appDomain
      ? `${appDomain}/functions/handleAlipayPaymentCallback`
      : `https://api.base44.com/api/apps/${appId_env}/functions/handleAlipayPaymentCallback`;
    const return_url = appDomain ? `${appDomain}/UserPreferences` : `https://${appId_env}.base44.app/UserPreferences`;

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

    return Response.json({ paymentUrl, out_trade_no });

  } catch (error) {
    console.error('[generateAlipayCreditPayment] ERROR:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});