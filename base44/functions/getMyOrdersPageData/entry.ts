import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

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
 * - TransitLocations (for UserNotifyShipmentModal)
 * - AddonOptions - shipping type (for UserNotifyShipmentModal)
 * - TransitShippingMethods (for UserNotifyShipmentModal)
 * - UserPreference (for OrderDetailDrawer + UserNotifyShipmentModal)
 * - SiteSettings paid_order_reminder (for OrderDetailDrawer)
 * - Non-admin users list (for UserNotifyShipmentModal privacy system)
 */
Deno.serve(async (req) => {
  const t0 = Date.now();
  console.log('[DIAG][getMyOrdersPageData] === REQUEST START ===');
  console.log('[DIAG][getMyOrdersPageData] Base44-App-Id header:', req.headers.get('Base44-App-Id'));
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
    console.log('[DIAG][getMyOrdersPageData] user:', user?.email, '| tenantId:', tenantId);
    if (!tenantId) {
      return Response.json({
        orders: [], pools: [], storeTagRules: [],
        transitLocations: [], addons: [], transitMethods: [],
        userPreference: null, paidOrderReminder: null, nonAdminUsers: [],
      });
    }

    const tenantFilter = { tenant_id: tenantId };

    const t1 = Date.now();
    const [
      orders,
      allPools,
      storeTagRules,
      transitLocations,
      addons,
      transitMethods,
      shippingMethods,
      userPrefs,
      siteSettings,
      allTenantUsers,
      myEditRequests,
    ] = await Promise.all([
      base44.asServiceRole.entities.Order.filter(
        { tenant_id: tenantId, user_email: user.email },
        '-updated_date',
        50
      ),
      base44.asServiceRole.entities.ShippingPool.filter(tenantFilter, '-created_date', 50),
      base44.asServiceRole.entities.OnlineStoreTagRule.filter(tenantFilter, '-created_date', 50),
      base44.asServiceRole.entities.TransitLocation.filter(tenantFilter, '-created_date', 50),
      base44.asServiceRole.entities.AddonOption.filter({ ...tenantFilter, addon_type: 'shipping', is_active: true }, '-created_date', 50),
      base44.asServiceRole.entities.TransitShippingMethod.filter({ ...tenantFilter, is_active: true }, '-created_date', 50),
      base44.asServiceRole.entities.ShippingMethod.filter({ ...tenantFilter, is_active: true }, '-created_date', 50),
      // Filter by user_email only (not tenant_id) so legacy records without tenant_id are also found
      base44.asServiceRole.entities.UserPreference.filter({ user_email: user.email }, '-created_date', 50),
      base44.asServiceRole.entities.SiteSettings.filter({ tenant_id: tenantId }, '-created_date', 50),
      base44.asServiceRole.entities.User.filter(tenantFilter, '-created_date', 50),
      base44.asServiceRole.entities.ShippingEditRequest.filter({ tenant_id: tenantId, user_email: user.email, status: 'pending' }, '-created_date', 50),
    ]);
    console.log(`[TIMING] getMyOrdersPageData | 10x parallel queries: ${Date.now() - t1}ms`);
    console.log(`[TIMING] getMyOrdersPageData | TOTAL: ${Date.now() - t0}ms`);
    console.log(`[DIAG][getMyOrdersPageData] orders returned: ${orders?.length} | pools: ${allPools?.length}`);

    // Filter pools accessible to this user (mirrors getTenantShippingPools logic)
    const accessiblePools = (allPools || []).filter(pool => {
      // Staff, admin, tenant_admin see all pools in the tenant
      if (user.role !== 'user') return true;
      // Owner always sees their own pool
      if (pool.creator_email === user.email) return true;
      // Private pool: only visible to owner (above) and explicitly shared users
      if (pool.is_private) return (pool.shared_with_emails || []).includes(user.email);
      // Non-private pools are visible to all users in the tenant
      return true;
    });

    // Non-admin users for UserNotifyShipmentModal privacy system (mirrors listNonAdminUsers logic)
    const nonAdminRoles = ['user', 'staff', 'transit_manager'];
    const nonAdminUsers = (allTenantUsers || []).filter(u =>
      u.email !== user.email && nonAdminRoles.includes(u.role)
    );

    // Fetch UserPreferences for all tenant users to get avatar_url (stored in UserPreference, not User)
    const allTenantEmails = (allTenantUsers || []).map(u => u.email).filter(Boolean);
    let tenantUserPrefs = [];
    if (allTenantEmails.length > 0) {
      tenantUserPrefs = await base44.asServiceRole.entities.UserPreference.filter({ tenant_id: tenantId }, '-created_date', 50);
    }
    const prefsByEmail = {};
    for (const p of tenantUserPrefs) {
      if (p.user_email) prefsByEmail[p.user_email] = p;
    }

    // Build email → { display_name, avatar_url } map for message thread rendering
    const userProfileMap = {};
    for (const u of (allTenantUsers || [])) {
      if (u.email) {
        const pref = prefsByEmail[u.email] || {};
        userProfileMap[u.email] = {
          display_name: u.display_name || u.full_name || null,
          avatar_url: pref.avatar_url || u.avatar_url || null,
        };
      }
    }

    const settingsMap = {};
    for (const s of (siteSettings || [])) { settingsMap[s.key] = s.value; }

    return Response.json({
      orders: orders || [],
      pools: accessiblePools,
      storeTagRules: (storeTagRules || []).filter(r => r.is_active !== false),
      transitLocations: (transitLocations || []).filter(l => l.is_active !== false),
      addons: addons || [],
      transitMethods: transitMethods || [],
      shippingMethods: shippingMethods || [],
      userPreference: userPrefs?.[0] || null,
      paidOrderReminder: settingsMap['paid_order_reminder'] || null,
      allowUserRewarehouse: settingsMap['allow_user_rewarehouse_from_fee_pending'] === 'true',
      defaultRewarehouseFee: parseFloat(settingsMap['default_rewarehouse_fee_jpy'] || '0') || 0,
      allowSplitAfterWarehouse: settingsMap['allow_order_split_after_warehouse'] === 'true',
      hazmatText: settingsMap['customs_hazmat_text'] || null,
      nonAdminUsers,
      pendingEditRequests: myEditRequests || [],
      userProfileMap,
    });

  } catch (error) {
    console.error(`[TIMING] getMyOrdersPageData | TOTAL (error): ${Date.now() - t0}ms`);
    console.error('getMyOrdersPageData error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});