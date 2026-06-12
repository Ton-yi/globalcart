import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Simple exchange rate fetch (JPY base)
async function fetchRates() {
  try {
    const res = await fetch('https://v6.exchangerate-api.com/v6/89e2f91c758d92aa2c06667b/latest/JPY');
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.result === 'success' && data?.conversion_rates) {
      return data.conversion_rates; // e.g. { CNY: 0.046, USD: 0.0065, ... }
    }
  } catch (_) {}
  return null;
}

Deno.serve(async (req) => {
  console.log('[DIAG][getPaymentPageData] === REQUEST START ===');
  console.log('[DIAG][getPaymentPageData] Base44-App-Id header:', req.headers.get('Base44-App-Id'));
  console.log('[DIAG][getPaymentPageData] origin:', req.headers.get('origin'));

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    console.log('[DIAG][getPaymentPageData] auth user:', user?.email, '| role:', user?.role);

    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { order_id } = body;
    console.log('[DIAG][getPaymentPageData] order_id requested:', order_id);

    if (!order_id) return Response.json({ error: 'Missing order_id' }, { status: 400 });

    // Resolve tenant via user record
    const userRecords = await base44.asServiceRole.entities.User.filter({ email: user.email });
    const userRecord = userRecords?.[0];
    const tenantId = userRecord?.tenant_id || null;
    console.log('[DIAG][getPaymentPageData] tenantId:', tenantId, '| is_active:', userRecord?.is_active);

    if (!tenantId) {
      console.error('[DIAG][getPaymentPageData] No tenantId found for user:', user.email);
      return Response.json({ error: 'User has no tenant assigned' }, { status: 403 });
    }

    // Fetch all user orders for tenant, then find by id
    const [allOrders, siteSettings, paymentMethods] = await Promise.all([
      base44.asServiceRole.entities.Order.filter({ tenant_id: tenantId, user_email: user.email }),
      base44.asServiceRole.entities.SiteSettings.filter({ tenant_id: tenantId }),
      base44.asServiceRole.entities.PaymentMethod.filter({ tenant_id: tenantId, is_active: true }),
    ]);
    console.log('[DIAG][getPaymentPageData] orders fetched for user:', allOrders?.length, '| settings:', siteSettings?.length);

    const order = (allOrders || []).find(o => o.id === order_id);
    console.log('[DIAG][getPaymentPageData] order found:', !!order, '| status:', order?.order_status, '| payment_status:', order?.payment_status, '| alipay_trade_no:', order?.alipay_trade_no);

    if (!order) {
      // Log all order ids to diagnose mismatch
      const ids = (allOrders || []).map(o => o.id);
      console.error('[DIAG][getPaymentPageData] ORDER NOT FOUND. Requested:', order_id, '| Available ids:', ids.join(', '));
      return Response.json({ error: 'Order not found' }, { status: 404 });
    }

    const isAdmin = user.role === 'admin' || user.role === 'platform_admin' || user.role === 'tenant_admin';
    if (!isAdmin && order.user_email !== user.email) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const settings = {};
    (siteSettings || []).forEach(s => { settings[s.key] = s.value; });

    // Sort payment methods by sort_order
    const sortedMethods = (paymentMethods || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    // Fetch exchange rates for currency conversion display
    const rates = await fetchRates();
    console.log('[DIAG][getPaymentPageData] rates fetched:', rates ? `OK (CNY=${rates.CNY}, USD=${rates.USD})` : 'FAILED/NULL');

    // Apply tenant exchange rate increments to the raw rates
    const adjustedRates = rates ? { ...rates } : null;
    if (adjustedRates) {
      const jpyCnyIncrement = parseFloat(settings['jpy_cny_increment'] || '0');
      const jpyUsdIncrement = parseFloat(settings['jpy_usd_increment'] || '0');
      if (jpyCnyIncrement && adjustedRates.CNY) adjustedRates.CNY = adjustedRates.CNY + jpyCnyIncrement;
      if (jpyUsdIncrement && adjustedRates.USD) adjustedRates.USD = adjustedRates.USD + jpyUsdIncrement;
    }

    // Calculate one-time payment amount if enabled
    const fullpayOnceConfig = order.pre_shipment?.fullpay_once_config || order.fullpay_once_config;
    const isFullPayOnce = !!fullpayOnceConfig;
    const estimatedShippingFee = fullpayOnceConfig?.estimated_shipping_fee_jpy || 0;
    
    // Determine payment amount based on payment status
    let paymentAmountJpy = order.prepayment_amount || 0;
    let paymentBreakdown = {
      product_fee: order.estimated_jpy || 0,
      service_fee: order.service_fee_amount || 0,
      shipping_fee: 0,
      total: order.prepayment_amount || 0
    };
    
    if (isFullPayOnce) {
      // One-time payment mode
      if (order.payment_status === "paid" || order.paid_amount >= (order.estimated_jpy || 0) + (order.service_fee_amount || 0)) {
        // Product fee already paid, only need to pay shipping fee
        paymentAmountJpy = estimatedShippingFee;
        paymentBreakdown = {
          product_fee: 0,
          service_fee: 0,
          shipping_fee: estimatedShippingFee,
          total: estimatedShippingFee
        };
      } else {
        // Product fee not paid, pay total (product + service + shipping)
        paymentAmountJpy = (order.estimated_jpy || 0) + (order.service_fee_amount || 0) + estimatedShippingFee;
        paymentBreakdown = {
          product_fee: order.estimated_jpy || 0,
          service_fee: order.service_fee_amount || 0,
          shipping_fee: estimatedShippingFee,
          total: paymentAmountJpy
        };
      }
    }

    // Supplement (补款): admin requested an additional payment — that's the amount due now
    const supplementAmount = parseFloat(order.supplement_amount) || 0;
    const isSupplement = !isFullPayOnce && !!order.supplement_requested && supplementAmount > 0;
    if (isSupplement) {
      paymentAmountJpy = supplementAmount;
      paymentBreakdown = { product_fee: 0, service_fee: 0, shipping_fee: 0, total: supplementAmount };
    }

    console.log('[DIAG][getPaymentPageData] One-time payment:', { 
      isFullPayOnce, 
      estimatedShippingFee, 
      paymentAmountJpy, 
      paymentBreakdown,
      orderPaymentStatus: order.payment_status,
      orderPaidAmount: order.paid_amount 
    });

    return Response.json({ 
      order, 
      settings, 
      paymentMethods: sortedMethods, 
      rates: adjustedRates,
      isFullPayOnce,
      estimatedShippingFee,
      paymentAmountJpy,
      paymentBreakdown,
      isSupplement
    });

  } catch (error) {
    console.error('[DIAG][getPaymentPageData] ERROR:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});