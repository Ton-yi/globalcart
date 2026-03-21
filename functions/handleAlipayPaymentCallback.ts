import { createClient } from 'npm:@base44/sdk@0.8.21';

// ── Helpers ────────────────────────────────────────────────────────────────

function pemToBinary(pem) {
  const b64 = pem.replace(/-----BEGIN [^-]+-----|-----END [^-]+-----|\s/g, '');
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf;
}

async function importPublicKey(pemOrRaw) {
  // Alipay public key may come WITHOUT PEM headers — wrap if needed
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

  // Build sign string: sorted keys, exclude sign & sign_type
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

// Parse application/x-www-form-urlencoded body into plain object
async function parseFormBody(req) {
  const text = await req.text();
  const obj = {};
  for (const pair of text.split('&')) {
    const [k, v] = pair.split('=');
    if (k) obj[decodeURIComponent(k)] = decodeURIComponent((v || '').replace(/\+/g, ' '));
  }
  return obj;
}

// ── Main handler ───────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Alipay sends POST with application/x-www-form-urlencoded
    const params = await parseFormBody(req);

    const publicKeyPem = Deno.env.get('ALIPAY_PUBLIC_KEY');

    // 1. Verify signature
    const valid = await verifyAlipaySign(params, publicKeyPem);
    if (!valid) {
      console.error('Alipay callback signature verification failed');
      return new Response('fail', { status: 200 }); // must return 200 to stop retries
    }

    const { trade_status, out_trade_no, trade_no, buyer_logon_id, total_amount } = params;

    // 2. Only process successful trades
    if (trade_status !== 'TRADE_SUCCESS' && trade_status !== 'TRADE_FINISHED') {
      return new Response('success', { status: 200 });
    }

    // 3. Find order by alipay_trade_no (out_trade_no)
    const orders = await base44.asServiceRole.entities.Order.filter({ alipay_trade_no: out_trade_no });
    if (!orders || orders.length === 0) {
      console.error(`Order not found for out_trade_no: ${out_trade_no}`);
      return new Response('success', { status: 200 }); // return success to stop retries
    }

    const order = orders[0];

    // 4. Idempotency check — skip if already confirmed
    if (order.payment_status === 'paid' || order.payment_status === 'confirmed') {
      return new Response('success', { status: 200 });
    }

    // 5. Determine if this is a shipping fee payment or order payment
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
        paid_amount: parseFloat(total_amount) || order.prepayment_amount,
        alipay_transaction_id: trade_no,
        payment_method: 'alipay',
        admin_note: [
          order.admin_note,
          `支付宝自动确认 | 买家:${buyer_logon_id || '-'} | 流水号:${trade_no} | ${new Date().toISOString()}`
        ].filter(Boolean).join('\n'),
      };
    }

    await base44.asServiceRole.entities.Order.update(order.id, updates);

    console.log(`Order ${order.id} payment confirmed via Alipay. trade_no: ${trade_no}`);

    // 6. MUST return plain text "success"
    return new Response('success', { status: 200 });

  } catch (error) {
    console.error('Alipay callback error:', error.message);
    // Still return success to prevent Alipay retry storm on our side errors
    return new Response('success', { status: 200 });
  }
});