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
    // Batch 1: 4 critical queries
    const [orders, storeTagRules, itemSizeTemplates, allTenantUsers] = await Promise.all([
      base44.asServiceRole.entities.Order.filter(filter),
      base44.asServiceRole.entities.OnlineStoreTagRule.filter({ ...filter, is_active: true }),
      base44.asServiceRole.entities.ItemSizeTemplate.filter({ ...filter, is_active: true }),
      base44.asServiceRole.entities.User.filter(tenantId ? { tenant_id: tenantId } : {}),
    ]);
    console.log(`[TIMING] getAdminOrdersPageData | batch1: ${Date.now() - t1}ms`);

    const t2 = Date.now();
    // Batch 2: 4 more queries
    const [pendingEditRequests, shippingPools, boxTemplates, transitLocations] = await Promise.all([
      base44.asServiceRole.entities.ShippingEditRequest.filter({ ...filter, status: 'pending' }),
      base44.asServiceRole.entities.ShippingPool.filter(filter),
      base44.asServiceRole.entities.BoxTemplate.filter({ ...filter, is_active: true }),
      base44.asServiceRole.entities.TransitLocation.filter({ ...filter, is_active: true }),
    ]);
    console.log(`[TIMING] getAdminOrdersPageData | batch2: ${Date.now() - t2}ms`);

    const t3 = Date.now();
    // Batch 3: 4 final queries
    const [transitShippingMethods, siteSettings, shippingMethods, userPreferences] = await Promise.all([
      base44.asServiceRole.entities.TransitShippingMethod.filter({ ...filter, is_active: true }),
      base44.asServiceRole.entities.SiteSettings.filter(filter),
      base44.asServiceRole.entities.ShippingMethod.filter({ ...filter, is_active: true }),
      base44.asServiceRole.entities.UserPreference.filter(filter),
    ]);
    console.log(`[TIMING] getAdminOrdersPageData | batch3: ${Date.now() - t3}ms`);
    console.log(`[TIMING] getAdminOrdersPageData | TOTAL: ${Date.now() - t0}ms (batched to avoid rate limits)`);

    // Build email → { display_name, avatar_url } map
    // UserPreference has avatar_url and display_name; User has full_name as fallback
    const prefMap = {};
    for (const p of (userPreferences || [])) {
      if (p.user_email) prefMap[p.user_email] = p;
    }
    const userProfileMap = {};
    for (const u of (allTenantUsers || [])) {
      if (u.email) {
        const pref = prefMap[u.email] || {};
        userProfileMap[u.email] = {
          display_name: u.display_name || pref.display_name || u.full_name || null,
          avatar_url: pref.avatar_url || u.avatar_url || null,
        };
      }
    }

    // Sort store tag rules by priority descending (mirrors getOnlineStoreRules)
    const sortedRules = (storeTagRules || []).sort((a, b) => (b.priority || 0) - (a.priority || 0));

    // Extract packing fee defaults from site settings
    const settingsMap = {};
    for (const s of (siteSettings || [])) { settingsMap[s.key] = s.value; }
    const defaultPackingFeeSingle = parseFloat(settingsMap['default_packing_fee_single'] || '0') || 0;
    const defaultPackingFeeConsolidation = parseFloat(settingsMap['default_packing_fee_consolidation'] || '0') || 0;

    // 票务订单有独立视图（票务 Tab），普通订单列表只展示实物订单
    const physicalOrders = (orders || []).filter(o => !o.is_ticket_order);

    return Response.json({
      orders: physicalOrders,
      storeTagRules: sortedRules,
      itemSizeTemplates: itemSizeTemplates || [],
      pendingEditRequests: pendingEditRequests || [],
      userProfileMap,
      boxTemplates: boxTemplates || [],
      transitLocations: (transitLocations || []),
      transitShippingMethods: (transitShippingMethods || []),
      shippingMethods: (shippingMethods || []),
      defaultPackingFeeSingle,
      defaultPackingFeeConsolidation,
      shippingPools: (shippingPools || []).map(p => ({
        id: p.id, pool_code: p.pool_code, status: p.status,
        consolidation_type: p.consolidation_type, order_ids: p.order_ids || [],
        transit_location_name: p.transit_location_name,
      })),
    });

  } catch (error) {
    console.error(`[TIMING] getAdminOrdersPageData | error: ${Date.now() - t0}ms`, error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});