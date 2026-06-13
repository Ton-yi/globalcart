import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function extractEmailFromJwt(req) {
  try {
    const auth = req.headers.get('authorization') || '';
    const token = auth.replace(/^Bearer\s+/i, '');
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload?.email || payload?.sub || null;
  } catch { return null; }
}

Deno.serve(async (req) => {
  const t0 = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    const emailHint = extractEmailFromJwt(req);
    const [user, earlyUserRecords] = await Promise.all([
      base44.auth.me(),
      emailHint
        ? base44.asServiceRole.entities.User.filter({ email: emailHint })
        : Promise.resolve(null),
    ]);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const userRecords = earlyUserRecords ?? await base44.asServiceRole.entities.User.filter({ email: user.email });
    const userRecord = userRecords?.[0];
    const tenantId = userRecord?.tenant_id;
    const isPlatformAdmin = userRecord?.role === 'platform_admin';
    const isAdmin = ['admin', 'tenant_admin', 'platform_admin', 'staff'].includes(userRecord?.role);

    if (!isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const orderFilter = isPlatformAdmin ? {} : (tenantId ? { tenant_id: tenantId } : null);
    const tenantFilter = isPlatformAdmin ? {} : (tenantId ? { tenant_id: tenantId } : null);

    if (!orderFilter) {
      return Response.json({
        orders: [], pools: [], users: [], faqQuestions: [], recentMessages: []
      });
    }

    const [allUsers, orders, pools, faqQuestions] = await Promise.all([
      base44.asServiceRole.entities.User.filter(tenantFilter),
      base44.asServiceRole.entities.Order.filter(orderFilter, '-updated_date', 1000),
      base44.asServiceRole.entities.ShippingPool.filter(tenantFilter, '-updated_date', 500),
      base44.asServiceRole.entities.FaqQuestion.filter({ ...tenantFilter, status: 'pending' }),
    ]);

    // Non-admin users (new registrations = registered within last 7 days with user role)
    const nonAdminRoles = ['user'];
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const newUsers = (allUsers || []).filter(u =>
      nonAdminRoles.includes(u.role) && u.created_date >= sevenDaysAgo
    );
    const allNonAdminUsers = (allUsers || []).filter(u => nonAdminRoles.includes(u.role));

    // Orders with unread messages for admin (where 'user' role sent last message)
    const ordersWithUnreadMessages = (orders || []).filter(o => {
      if (!o.messages || o.messages.length === 0) return false;
      const unread = o.unread_roles || [];
      return unread.includes('admin') || unread.includes('tenant_admin');
    });

    // Pools with unread messages for admin
    const poolsWithUnreadMessages = (pools || []).filter(p => {
      const unread = p.unread_roles || [];
      return unread.includes('admin') || unread.includes('tenant_admin');
    });

    // Active (non-archived) orders only
    const activeOrders = (orders || []).filter(o => !o.is_archived);

    // Pending payment confirmation (user uploaded proof, awaiting admin confirm)
    const pendingPaymentConfirm = activeOrders.filter(o =>
      o.payment_status === 'awaiting_confirmation'
    );

    // Pending purchase
    const pendingPurchase = activeOrders.filter(o =>
      o.order_status === 'pending_purchase'
    );

    // In warehouse - needs shipping arrangement
    const inWarehouse = activeOrders.filter(o =>
      ['in_warehouse', 'in_storage'].includes(o.order_status)
    );

    // Notified shipment fee pending (user chose pool, waiting for fee calc)
    const notifiedShipmentFeePending = activeOrders.filter(o =>
      o.order_status === 'notified_shipment_fee_pending'
    );

    // Ready to ship
    const readyToShip = activeOrders.filter(o =>
      o.order_status === 'ready_to_ship'
    );

    // Pools - pending initial processing (status: pending)
    const poolsPendingInit = (pools || []).filter(p =>
      !p.is_archived && p.status === 'pending' && !p.is_pending_pool
    );

    // Pools - awaiting payment confirmation
    const poolsAwaitingPaymentConfirm = (pools || []).filter(p =>
      !p.is_archived && p.status === 'awaiting_payment_confirmation'
    );

    // Pools - ready to ship (admin confirmed payment, needs to ship)
    const poolsReadyToShip = (pools || []).filter(p =>
      !p.is_archived && p.status === 'ready_to_ship'
    );

    console.log(`[TIMING] getAdminTodoData | TOTAL: ${Date.now()-t0}ms`);
    return Response.json({
      // Pending confirm section
      newUsers,
      allNonAdminUsers,
      ordersWithUnreadMessages,
      poolsWithUnreadMessages,
      pendingFaqQuestions: faqQuestions || [],
      // Pending order processing
      pendingPaymentConfirm,
      pendingPurchase,
      inWarehouse,
      notifiedShipmentFeePending,
      readyToShip,
      // Pending pool processing
      poolsPendingInit,
      poolsAwaitingPaymentConfirm,
      poolsReadyToShip,
      // Summary
      totalActiveOrders: activeOrders.length,
      totalPools: (pools || []).filter(p => !p.is_archived).length,
      totalUsers: allNonAdminUsers.length,
    });

  } catch (error) {
    console.error('[getAdminTodoData] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});