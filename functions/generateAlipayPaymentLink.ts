import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// ── Helpers ────────────────────────────────────────────────────────────────

function pemToBinary(pem) {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----|-----END [^-]+-----|\s/g, '');
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
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    // Support both single order (orderId) and bulk orders (orderIds array)
    const orderIds = body.orderIds || (body.orderId ? [body.orderId] : null);
    const { amount, subject, paymentType } = body;

    if (!orderIds || orderIds.length === 0) {
      return Response.json({ error: 'Missing required parameter: orderId or orderIds' }, { status: 400 });
    }

    const appId         = Deno.env.get('ALIPAY_APP_ID');
    const privateKeyPem = Deno.env.get('ALIPAY_PRIVATE_KEY');
    const gatewayUrl    = Deno.env.get('ALIPAY_GATEWAY_URL') || 'https://openapi.alipay.com/gateway.do';

    // Fetch live rates with increments from settings
    const [liveRates, settingsList] = await Promise.all([
      base44.asServiceRole.functions.invoke('fetchExchangeRates', {}),
      base44.asServiceRole.entities.SiteSettings.list()
    ]);

    const settingsMap = {};
    settingsList.forEach(s => { settingsMap[s.key] = parseFloat(s.value) || 0; });

    const jpy_cny_base      = liveRates.data?.jpy_cny || 0.048;
    const jpy_cny_increment = settingsMap.jpy_cny_increment || 0;
    const jpy_cny_rate      = jpy_cny_base + jpy_cny_increment;

    // Determine total amount in CNY
    let total_amount_cny;
    if (amount) {
      // Caller supplied explicit amount (single order flow or shipping fee)
      const amount_jpy = Number(amount);
      total_amount_cny = (amount_jpy * jpy_cny_rate).toFixed(2);
    } else {
      // Bulk: fetch each order and sum up
      const ordersData = await Promise.all(
        orderIds.map(id => base44.asServiceRole.entities.Order.filter({ id }))
      );
      let totalJpy = 0;
      for (const result of ordersData) {
        const o = Array.isArray(result) ? result[0] : result;
        if (o) totalJpy += (o.prepayment_amount || 0);
      }
      total_amount_cny = (totalJpy * jpy_cny_rate).toFixed(2);
    }

    // Generate a unique out_trade_no referencing all order IDs
    const shortRef = orderIds.map(id => id.replace(/-/g, '').slice(0, 4).toUpperCase()).join('');
    const out_trade_no = `TY${shortRef.slice(0, 16)}${Date.now()}`;

    const appId_env = Deno.env.get('BASE44_APP_ID');
    const appBaseUrl = `https://api.base44.com/api/apps/${appId_env}/functions`;
    // Pass app_id as query param so the callback can init the SDK without the Base44-App-Id header
    const notify_url = `${appBaseUrl}/handleAlipayPaymentCallback?app_id=${appId_env}`;
    const return_url = `https://${req.headers.get('host') || 'app'}/MyOrders`;

    const resolvedSubject = subject || `同一物流代购 - ${orderIds.length} 笔订单`;

    const bizContent = JSON.stringify({
      out_trade_no,
      total_amount: total_amount_cny,
      subject: resolvedSubject,
      product_code: 'FAST_INSTANT_TRADE_PAY',
      body: `订单IDs: ${orderIds.join(',')}`,
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

    // Update all orders: store out_trade_no and set awaiting_payment
    await Promise.all(orderIds.map(id =>
      base44.asServiceRole.entities.Order.update(id, {
        alipay_trade_no: out_trade_no,
        payment_status: 'awaiting_payment',
        order_status: 'payment_pending',
      })
    ));

    return Response.json({ paymentUrl, out_trade_no });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});