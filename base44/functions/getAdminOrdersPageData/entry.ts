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
 * Aggregated page-load API for AdminOrders.
 * Resolves user/tenant once, then fetches all required data in parallel:
 *   - orders (all tenant orders)
 *   - storeTagRules (for online store tag matching)
 *   - itemSizeTemplates (for the in-warehouse action in AdminOrderEditModal)
 *
 * Permissions: platform_admin, admin, tenant_admin, staff only.
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
    console.log(`[TIMING] getAdminOrdersPageData | auth.me + User.filter: ${Date.now() - t0}ms`);

    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const isPlatformAdmin = user.role === 'platform_admin';
    const isTenantAdmin = user.role === 'admin' || user.role === 'tenant_admin';
    const isStaff = user.role === 'staff';

    if (!isPlatformAdmin && !isTenantAdmin && !isStaff) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const userRecords = earlyUserRecords ?? await base44.asServiceRole.entities.User.filter({ email: user.email });
    if (!userRecords || userRecords.length === 0) {
      return Response.json({ error: 'User record not found' }, { status: 404 });
    }

    const tenantId = userRecords[0].tenant_id || null;
    const filter = (isPlatformAdmin || !tenantId) ? {} : { tenant_id: tenantId };

    const t1 = Date.now();
    const [orders, storeTagRules, itemSizeTemplates, pendingEditRequests, allTenantUsers] = await Promise.all([
      base44.asServiceRole.entities.Order.filter(filter),
      base44.asServiceRole.entities.OnlineStoreTagRule.filter({ ...filter, is_active: true }),
      base44.asServiceRole.entities.ItemSizeTemplate.filter({ ...filter, is_active: true }),
      base44.asServiceRole.entities.ShippingEditRequest.filter({ ...filter, status: 'pending' }),
      base44.asServiceRole.entities.User.filter(tenantId ? { tenant_id: tenantId } : {}),
    ]);
    console.log(`[TIMING] getAdminOrdersPageData | parallel fetches: ${Date.now() - t1}ms`);
    console.log(`[TIMING] getAdminOrdersPageData | TOTAL: ${Date.now() - t0}ms`);

    // Build email → { display_name, avatar_url } map
    const userProfileMap = {};
    for (const u of (allTenantUsers || [])) {
      if (u.email) userProfileMap[u.email] = { display_name: u.display_name || null, avatar_url: u.avatar_url || null };
    }

    // Sort store tag rules by priority descending (mirrors getOnlineStoreRules)
    const sortedRules = (storeTagRules || []).sort((a, b) => (b.priority || 0) - (a.priority || 0));

    return Response.json({
      orders: orders || [],
      storeTagRules: sortedRules,
      itemSizeTemplates: itemSizeTemplates || [],
      pendingEditRequests: pendingEditRequests || [],
      userProfileMap,
    });

  } catch (error) {
    console.error(`[TIMING] getAdminOrdersPageData | error: ${Date.now() - t0}ms`, error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});