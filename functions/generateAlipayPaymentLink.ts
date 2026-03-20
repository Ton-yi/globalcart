import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

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
  // Sort keys alphabetically, build k=v&k=v string (exclude sign itself)
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

    const { orderId, amount, subject } = await req.json();

    if (!orderId || !amount || !subject) {
      return Response.json({ error: 'Missing required parameters: orderId, amount, subject' }, { status: 400 });
    }

    const appId       = Deno.env.get('ALIPAY_APP_ID');
    const privateKeyPem = Deno.env.get('ALIPAY_PRIVATE_KEY');
    const gatewayUrl  = Deno.env.get('ALIPAY_GATEWAY_URL') || 'https://openapi.alipay.com/gateway.do';

    // Generate unique out_trade_no  e.g. TY-<orderId-8chars>-<timestamp>
    const shortId = orderId.replace(/-/g, '').slice(0, 8).toUpperCase();
    const out_trade_no = `TY${shortId}${Date.now()}`;

    // Use amount directly as JPY for payment
    const total_amount = Number(amount).toFixed(0);

    // notify_url points to our callback function
    // Base44 function URLs follow: https://api.base44.com/api/apps/{APP_ID}/functions/{functionName}
    // We keep it relative so deployer can override; set APP_ID env if needed.
    const appBaseUrl = `https://api.base44.com/api/apps/${Deno.env.get('BASE44_APP_ID')}/functions`;
    const notify_url = `${appBaseUrl}/handleAlipayPaymentCallback`;
    const return_url = `https://${req.headers.get('host') || 'app'}/MyOrders`;

    // Build biz_content
    const bizContent = JSON.stringify({
      out_trade_no,
      total_amount,
      subject,
      product_code: 'FAST_INSTANT_TRADE_PAY',
      body: `订单ID: ${orderId}`,
    });

    // Build common params
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

    // Sign
    const privateKey = await importPrivateKey(privateKeyPem);
    const sign = await signParams(params, privateKey);
    params.sign = sign;

    // Build payment URL (GET form redirect — standard for alipay.trade.page.pay)
    const query = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    const paymentUrl = `${gatewayUrl}?${query}`;

    // Persist out_trade_no on the order
    await base44.asServiceRole.entities.Order.update(orderId, {
      alipay_trade_no: out_trade_no,
      payment_status: 'awaiting_payment',
      order_status: 'payment_pending',
    });

    return Response.json({ paymentUrl, out_trade_no });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});