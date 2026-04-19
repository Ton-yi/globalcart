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

    const t1 = Date.now();
    const [pools, locations, allUsers, transitMethods, addonOptions, editRequests, boxTemplates, siteSettings, shippingMethods, orders] = await Promise.all([
      isPlatformAdmin
        ? base44.asServiceRole.entities.ShippingPool.list()
        : base44.asServiceRole.entities.ShippingPool.filter({ tenant_id: tenantId }),
      base44.asServiceRole.entities.TransitLocation.filter(filter),
      base44.asServiceRole.entities.User.filter(isPlatformAdmin ? {} : { tenant_id: tenantId }),
      base44.asServiceRole.entities.TransitShippingMethod.filter(filter),
      base44.asServiceRole.entities.AddonOption.filter(filter),
      isPlatformAdmin
        ? base44.asServiceRole.entities.ShippingEditRequest.filter({ status: 'pending' })
        : base44.asServiceRole.entities.ShippingEditRequest.filter({ tenant_id: tenantId, status: 'pending' }),
      base44.asServiceRole.entities.BoxTemplate.filter(filter),
      base44.asServiceRole.entities.SiteSettings.filter(filter),
      base44.asServiceRole.entities.ShippingMethod.filter(filter),
      isPlatformAdmin
        ? base44.asServiceRole.entities.Order.list()
        : base44.asServiceRole.entities.Order.filter({ tenant_id: tenantId }),
    ]);
    console.log(`[TIMING] getAdminShippingPoolPageData | 8x parallel queries: ${Date.now() - t1}ms`);
    console.log(`[TIMING] getAdminShippingPoolPageData | TOTAL: ${Date.now() - t0}ms`);

    // Shape users like listNonAdminUsers
    const formattedUsers = (allUsers || [])
      .filter(u => u.email !== user.email || isPlatformAdmin)
      .map(u => ({
        id: u.id, email: u.email, full_name: u.full_name || '',
        role: u.role || 'user', tenant_id: u.tenant_id || null,
      }));

    // Extract packing fee defaults from site settings
    const settingsMap = {};
    (siteSettings || []).forEach(s => { settingsMap[s.key] = s.value; });
    const defaultPackingFeeSingle = parseFloat(settingsMap['default_packing_fee_single'] || '0') || 0;
    const defaultPackingFeeConsolidation = parseFloat(settingsMap['default_packing_fee_consolidation'] || '0') || 0;

    return Response.json({
      pools: pools || [],
      locations: locations || [],
      users: formattedUsers,
      transitMethods: (transitMethods || []).filter(m => m.is_active !== false),
      addonOptions: (addonOptions || []).filter(a => a.addon_type === 'shipping' && a.is_active !== false),
      pendingEditRequests: editRequests || [],
      boxTemplates: (boxTemplates || []).filter(b => b.is_active !== false),
      shippingMethods: (shippingMethods || []).filter(m => m.is_active !== false),
      defaultPackingFeeSingle,
      defaultPackingFeeConsolidation,
      orders: orders || [],
    });

  } catch (error) {
    console.error(`[TIMING] getAdminShippingPoolPageData | TOTAL (error): ${Date.now() - t0}ms`);
    console.error('getAdminShippingPoolPageData error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});