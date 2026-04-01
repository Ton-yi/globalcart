import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

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
    const [allOrders, siteSettings] = await Promise.all([
      base44.asServiceRole.entities.Order.filter({ tenant_id: tenantId, user_email: user.email }),
      base44.asServiceRole.entities.SiteSettings.filter({ tenant_id: tenantId }),
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

    console.log('[DIAG][getPaymentPageData] SUCCESS returning order:', order.id);
    return Response.json({ order, settings });

  } catch (error) {
    console.error('[DIAG][getPaymentPageData] ERROR:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});