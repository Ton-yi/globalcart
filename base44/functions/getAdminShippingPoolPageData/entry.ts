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
 * Page-level API for AdminShippingPool.
 * Resolves user + tenant once, then fetches all required data in parallel:
 * - ShippingPool (all tenant pools)
 * - TransitLocation
 * - Users (non-platform-admin)
 * - TransitShippingMethod
 * - AddonOption
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
    console.log(`[TIMING] getAdminShippingPoolPageData | auth+tenant: ${Date.now() - t0}ms`);

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

    const tenantId = userRecords[0].tenant_id;

    if (!tenantId && !isPlatformAdmin) {
      return Response.json({ pools: [], locations: [], users: [], transitMethods: [], addonOptions: [] });
    }

    const filter = isPlatformAdmin ? {} : { tenant_id: tenantId };

    // Helper: retry on 429 with exponential backoff
    const withRetry = async (fn, retries = 3) => {
      for (let i = 0; i < retries; i++) {
        try {
          return await fn();
        } catch (e) {
          if (e?.status === 429 && i < retries - 1) {
            await new Promise(r => setTimeout(r, 300 * (i + 1)));
          } else {
            throw e;
          }
        }
      }
    };

    const t1 = Date.now();
    // Batch 1: pools + users + edit requests (3 parallel)
    const [pools, allUsers, editRequests] = await Promise.all([
      withRetry(() => isPlatformAdmin
        ? base44.asServiceRole.entities.ShippingPool.list()
        : base44.asServiceRole.entities.ShippingPool.filter({ tenant_id: tenantId })),
      withRetry(() => base44.asServiceRole.entities.User.filter(isPlatformAdmin ? {} : { tenant_id: tenantId })),
      withRetry(() => isPlatformAdmin
        ? base44.asServiceRole.entities.ShippingEditRequest.filter({ status: 'pending' })
        : base44.asServiceRole.entities.ShippingEditRequest.filter({ tenant_id: tenantId, status: 'pending' })),
    ]);
    console.log(`[TIMING] getAdminShippingPoolPageData | batch1: ${Date.now() - t1}ms`);

    // Batch 2: config/settings data (4 parallel)
    const t2 = Date.now();
    const [locations, transitMethods, addonOptions, boxTemplates] = await Promise.all([
      withRetry(() => base44.asServiceRole.entities.TransitLocation.filter(filter)),
      withRetry(() => base44.asServiceRole.entities.TransitShippingMethod.filter(filter)),
      withRetry(() => base44.asServiceRole.entities.AddonOption.filter(filter)),
      withRetry(() => base44.asServiceRole.entities.BoxTemplate.filter(filter)),
    ]);
    console.log(`[TIMING] getAdminShippingPoolPageData | batch2: ${Date.now() - t2}ms`);

    // Batch 3: remaining config + orders (3 parallel)
    const t3 = Date.now();
    const [siteSettings, shippingMethods, userPreferences, orders] = await Promise.all([
      withRetry(() => base44.asServiceRole.entities.SiteSettings.filter(filter)),
      withRetry(() => base44.asServiceRole.entities.ShippingMethod.filter(filter)),
      withRetry(() => base44.asServiceRole.entities.UserPreference.filter(filter)),
      withRetry(() => isPlatformAdmin
        ? base44.asServiceRole.entities.Order.list()
        : base44.asServiceRole.entities.Order.filter({ tenant_id: tenantId })),
    ]);
    console.log(`[TIMING] getAdminShippingPoolPageData | batch3: ${Date.now() - t3}ms`);
    console.log(`[DEBUG] getAdminShippingPoolPageData | pending edit requests count: ${editRequests?.length || 0}`);
    console.log(`[DEBUG] getAdminShippingPoolPageData | pending edit requests:`, editRequests?.map(r => ({ id: r.id, pool_id: r.pool_id, order_id: r.order_id, status: r.status, edit_type: r.edit_type })));
    console.log(`[TIMING] getAdminShippingPoolPageData | TOTAL: ${Date.now() - t0}ms`);

    // Build userPreference map (email -> { display_name, avatar_url })
    const prefMap = {};
    (userPreferences || []).forEach(p => {
      if (p.user_email) {
        prefMap[p.user_email] = {
          display_name: p.display_name || null,
          avatar_url: p.avatar_url || null,
        };
      }
    });

    // Shape users like listNonAdminUsers, include display_name from UserPreference
    const formattedUsers = (allUsers || [])
      .filter(u => u.email !== user.email || isPlatformAdmin)
      .map(u => {
        const pref = prefMap[u.email] || {};
        return {
          id: u.id, email: u.email, full_name: u.full_name || '',
          display_name: pref.display_name || null,
          avatar_url: pref.avatar_url || null,
          role: u.role || 'user', tenant_id: u.tenant_id || null,
        };
      });

    // Extract packing fee defaults and ship-without-payment settings from site settings
    const settingsMap = {};
    (siteSettings || []).forEach(s => { settingsMap[s.key] = s.value; });
    const defaultPackingFeeSingle = parseFloat(settingsMap['default_packing_fee_single'] || '0') || 0;
    const defaultPackingFeeConsolidation = parseFloat(settingsMap['default_packing_fee_consolidation'] || '0') || 0;
    const allowShipWithoutPayment = settingsMap['allow_ship_without_payment'] === 'true';
    const allowShipWithoutPaymentSingle = settingsMap['allow_ship_without_payment_single'] === 'true';
    const allowShipWithoutPaymentUserPool = settingsMap['allow_ship_without_payment_user_pool'] === 'true';
    const allowShipWithoutPaymentOfficialPool = settingsMap['allow_ship_without_payment_official_pool'] === 'true';

    // Apply saved official pool order if present
    const officialPoolOrderSetting = (siteSettings || []).find(s => s.key === 'official_pool_order');
    let sortedPools = pools || [];
    if (officialPoolOrderSetting?.value) {
      try {
        const savedOrder = JSON.parse(officialPoolOrderSetting.value);
        const poolMap = {};
        sortedPools.forEach(p => { poolMap[p.id] = p; });
        const reordered = savedOrder.map(id => poolMap[id]).filter(Boolean);
        // New pools (not in saved order) go to the FRONT so they appear first
        const newPools = sortedPools.filter(p => !savedOrder.includes(p.id));
        sortedPools = [...newPools, ...reordered];
      } catch (e) {
        console.error('Failed to apply pool order:', e);
      }
    }

    return Response.json({
      pools: sortedPools,
      locations: locations || [],
      users: formattedUsers,
      transitMethods: (transitMethods || []).filter(m => m.is_active !== false),
      addonOptions: (addonOptions || []).filter(a => a.addon_type === 'shipping' && a.is_active !== false),
      pendingEditRequests: editRequests || [],
      boxTemplates: (boxTemplates || []).filter(b => b.is_active !== false),
      shippingMethods: (shippingMethods || []).filter(m => m.is_active !== false),
      defaultPackingFeeSingle,
      defaultPackingFeeConsolidation,
      allowShipWithoutPayment,
      allowShipWithoutPaymentSingle,
      allowShipWithoutPaymentUserPool,
      allowShipWithoutPaymentOfficialPool,
      orders: orders || [],
    });

  } catch (error) {
    console.error(`[TIMING] getAdminShippingPoolPageData | TOTAL (error): ${Date.now() - t0}ms`);
    console.error('getAdminShippingPoolPageData error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});