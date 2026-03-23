import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

function extractEmailFromJwt(req) {
  try {
    const auth = req.headers.get('authorization') || '';
    const token = auth.replace(/^Bearer\s+/i, '');
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload?.email || payload?.sub || null;
  } catch {
    return null;
  }
}

/**
 * Page-level API for MyOrders page.
 * Resolves user + tenant once, then fetches in parallel:
 * - Orders (user-scoped)
 * - ShippingPools (accessible to user)
 * - OnlineStoreTagRules (for store tag display)
 */
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
    console.log(`[TIMING] getMyOrdersPageData | auth+tenant: ${Date.now() - t0}ms`);

    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const userRecords = earlyUserRecords ?? await base44.asServiceRole.entities.User.filter({ email: user.email });
    if (!userRecords || userRecords.length === 0) {
      return Response.json({ error: 'User record not found' }, { status: 404 });
    }

    const tenantId = userRecords[0].tenant_id;
    if (!tenantId) {
      return Response.json({ orders: [], pools: [], storeTagRules: [] });
    }

    const t1 = Date.now();
    const [orders, allPools, storeTagRules] = await Promise.all([
      // Users always see only their own orders
      base44.asServiceRole.entities.Order.filter(
        { tenant_id: tenantId, user_email: user.email },
        '-updated_date',
        500
      ),
      base44.asServiceRole.entities.ShippingPool.filter({ tenant_id: tenantId }),
      base44.asServiceRole.entities.OnlineStoreTagRule.filter({ tenant_id: tenantId }),
    ]);
    console.log(`[TIMING] getMyOrdersPageData | 3x parallel queries: ${Date.now() - t1}ms`);
    console.log(`[TIMING] getMyOrdersPageData | TOTAL: ${Date.now() - t0}ms`);

    // Filter pools accessible to this user (same logic as getTenantShippingPools)
    const accessiblePools = (allPools || []).filter(pool => {
      if (pool.creator_email === user.email) return true;
      if (pool.is_admin_created && !pool.is_private) return true;
      if (pool.is_private && (pool.shared_with_emails || []).includes(user.email)) return true;
      return false;
    });

    return Response.json({
      orders: orders || [],
      pools: accessiblePools,
      storeTagRules: (storeTagRules || []).filter(r => r.is_active !== false),
    });

  } catch (error) {
    console.error(`[TIMING] getMyOrdersPageData | TOTAL (error): ${Date.now() - t0}ms`);
    console.error('getMyOrdersPageData error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});