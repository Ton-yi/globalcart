import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Get all transit locations + their pools for admin work panel.
 * Admin only.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = user.role === 'admin' || user.role === 'tenant_admin' || user.role === 'platform_admin';
    if (!isAdmin) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Resolve tenant_id
    const tenants = await base44.asServiceRole.entities.Tenant.filter({ admin_email: user.email });
    let tenantId = null;
    let tenantIdFromUser = null;
    if (tenants && tenants.length > 0) {
      tenantId = tenants[0].id;
      tenantIdFromUser = tenantId;
    } else {
      // Try to find tenant via user's tenant assignment
      const allTenants = await base44.asServiceRole.entities.Tenant.list();
      const matched = allTenants.find(t => t.admin_email === user.email || (t.staff_emails || []).includes(user.email));
      tenantId = matched?.id || null;
      tenantIdFromUser = tenantId;
    }

    const locationFilter = tenantId ? { tenant_id: tenantId } : {};
    const locations = await base44.asServiceRole.entities.TransitLocation.filter(locationFilter);
    
    console.log('[getAllTransitWorkData] Resolved tenantId:', tenantId);
    console.log('[getAllTransitWorkData] Locations found:', locations?.length || 0);
    if (locations && locations.length > 0) {
      console.log('[getAllTransitWorkData] Location IDs:', locations.map(l => l.id));
    }

    if (!locations || locations.length === 0) {
      return Response.json({ locations: [], poolsByLocation: {} });
    }

    // Use tenant_id from first location if not resolved
    const resolvedTenantId = tenantId || locations[0]?.tenant_id;

    // Fetch all GroupBuyRequests AND ShippingPools for this tenant
    const [allGroupBuyRequests, allShippingPools, allUsers, transitMethods, addonOptions] = await Promise.all([
      base44.asServiceRole.entities.GroupBuyRequest.filter({ tenant_id: resolvedTenantId }),
      base44.asServiceRole.entities.ShippingPool.filter({ tenant_id: resolvedTenantId }),
      base44.asServiceRole.entities.User.filter({ tenant_id: resolvedTenantId }),
      base44.asServiceRole.entities.TransitShippingMethod.filter({ tenant_id: resolvedTenantId }),
      base44.asServiceRole.entities.AddonOption.filter({ tenant_id: resolvedTenantId, addon_type: 'shipping' }),
    ]);

    console.log('[getAllTransitWorkData] Total GroupBuyRequests:', allGroupBuyRequests?.length || 0);
    console.log('[getAllTransitWorkData] Total ShippingPools:', allShippingPools?.length || 0);
    
    // Include ALL requests/pools with transit_location_id assigned
    const transitGroupBuyRequests = (allGroupBuyRequests || []).filter(r => {
      const hasTransit = !!r.transit_location_id;
      if (hasTransit) {
        console.log('[getAllTransitWorkData] GroupBuyRequest with transit:', {
          id: r.id,
          title: r.title,
          transit_location_id: r.transit_location_id,
          status: r.status,
        });
      }
      return hasTransit;
    });
    
    const transitShippingPools = (allShippingPools || []).filter(p => {
      const hasTransit = !!p.transit_location_id;
      if (hasTransit) {
        console.log('[getAllTransitWorkData] ShippingPool with transit:', {
          id: p.id,
          title: p.pool_code || p.title,
          transit_location_id: p.transit_location_id,
          status: p.status,
        });
      }
      return hasTransit;
    });
    
    console.log('[getAllTransitWorkData] GroupBuyRequests with transit:', transitGroupBuyRequests.length);
    console.log('[getAllTransitWorkData] ShippingPools with transit:', transitShippingPools.length);
    
    // Combine both arrays for unified handling
    const transitRequests = [...transitGroupBuyRequests, ...transitShippingPools];

    // Group requests by transit_location_id
    const requestsByLocation = {};
    for (const loc of locations) {
      const reqsForLoc = transitRequests.filter(r => r.transit_location_id === loc.id);
      requestsByLocation[loc.id] = reqsForLoc;
      console.log(`[getAllTransitWorkData] Location ${loc.name} (${loc.id}): ${reqsForLoc.length} requests`);
    }

    console.log('[getAllTransitWorkData] transitRequests array:', transitRequests.length);
    if (transitRequests.length > 0) {
      console.log('[getAllTransitWorkData] First request sample:', transitRequests[0]);
    }
    
    // Fetch entries for all requests
    const requestIds = transitRequests.map(r => r.id);
    let allEntries = [];
    if (requestIds.length > 0) {
      // Fetch entries in batches if needed
      for (const requestId of requestIds) {
        const entries = await base44.asServiceRole.entities.GroupBuyEntry.filter({ request_id: requestId });
        allEntries = allEntries.concat(entries || []);
      }
    }
    
    console.log('[getAllTransitWorkData] Total entries:', allEntries.length);

    // Also return poolsByLocation for backward compatibility with frontend AdminTransitWork
    const poolsByLocation = requestsByLocation;

    return Response.json({
      locations: locations || [],
      requestsByLocation,
      poolsByLocation,
      requests: transitRequests,
      groupBuyRequests: transitGroupBuyRequests,
      shippingPools: transitShippingPools,
      entries: allEntries,
      users: (allUsers || []).filter(u => u.role === 'admin'),
      transitMethods: (transitMethods || []).filter(m => m.is_active !== false),
      addonOptions: (addonOptions || []).filter(a => a.is_active !== false),
      // Debug info
      debug: {
        resolvedTenantId,
        tenantIdFromUser,
        locationsCount: locations?.length || 0,
        locationIds: locations?.map(l => l.id) || [],
        totalGroupBuyRequests: allGroupBuyRequests?.length || 0,
        totalShippingPools: allShippingPools?.length || 0,
        groupBuyRequestsWithTransit: transitGroupBuyRequests?.length || 0,
        shippingPoolsWithTransit: transitShippingPools?.length || 0,
        totalRequestsWithTransit: transitRequests?.length || 0,
      },
    });

  } catch (error) {
    console.error('getAllTransitWorkData error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});