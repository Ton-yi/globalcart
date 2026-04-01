import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

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

    const publicKeyPem = Deno.env.get('ALIPAY_PUBLIC_KEY');
    console.log('[DIAG][handleAlipayPaymentCallback] ALIPAY_PUBLIC_KEY present:', !!publicKeyPem);
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
      // DIAG: temporarily skip sig verification to test order lookup and update
      const skipSigForDiag = Deno.env.get('ALIPAY_SKIP_SIG_VERIFY') === 'true';
      console.log('[DIAG][handleAlipayPaymentCallback] ALIPAY_SKIP_SIG_VERIFY:', skipSigForDiag);
      if (!skipSigForDiag) {
        return new Response('fail', { status: 200 });
      }
      console.warn('[DIAG][handleAlipayPaymentCallback] SKIPPING SIG VERIFY FOR DIAGNOSIS — proceeding');
    }

    // 2. Only process successful trades
    if (trade_status !== 'TRADE_SUCCESS' && trade_status !== 'TRADE_FINISHED') {
      console.log('[DIAG][handleAlipayPaymentCallback] trade_status not success/finished, skipping');
      return new Response('success', { status: 200 });
    }

    // 3. Find matching orders — list all and filter manually (SDK filter() unreliable for custom fields)
    console.log('[DIAG][handleAlipayPaymentCallback] fetching all orders to match out_trade_no:', out_trade_no);
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
    await Promise.all(pendingOrders.map(order => {
      const isShippingPayment = order.shipping_alipay_trade_no === out_trade_no;
      let updates;
      if (isShippingPayment) {
        updates = {
          payment_status: 'confirmed',
          order_status: 'ready_to_ship',
          alipay_transaction_id: trade_no,
          payment_method: 'alipay',
          admin_note: [
            order.admin_note,
            `运费支付宝自动确认 | 买家:${buyer_logon_id || '-'} | 流水号:${trade_no} | ${new Date().toISOString()}`
          ].filter(Boolean).join('\n'),
        };
      } else {
        updates = {
          payment_status: 'paid',
          order_status: 'paid',
          paid_amount: (order.prepayment_amount || 0),
          alipay_transaction_id: trade_no,
          payment_method: 'alipay',
          admin_note: [
            order.admin_note,
            `支付宝自动确认 | 买家:${buyer_logon_id || '-'} | 流水号:${trade_no} | ${new Date().toISOString()}`
          ].filter(Boolean).join('\n'),
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