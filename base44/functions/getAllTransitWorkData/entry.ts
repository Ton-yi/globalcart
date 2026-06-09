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
    if (tenants && tenants.length > 0) {
      tenantId = tenants[0].id;
    } else {
      // Try to find tenant via user's tenant assignment
      const allTenants = await base44.asServiceRole.entities.Tenant.list();
      const matched = allTenants.find(t => t.admin_email === user.email || (t.staff_emails || []).includes(user.email));
      tenantId = matched?.id || null;
    }

    const locationFilter = tenantId ? { tenant_id: tenantId } : {};
    const locations = await base44.asServiceRole.entities.TransitLocation.filter(locationFilter);

    if (!locations || locations.length === 0) {
      return Response.json({ locations: [], poolsByLocation: {} });
    }

    // Use tenant_id from first location if not resolved
    const resolvedTenantId = tenantId || locations[0]?.tenant_id;

    // Fetch all GroupBuyRequests for this tenant
    const [allRequests, allUsers, transitMethods, addonOptions] = await Promise.all([
      base44.asServiceRole.entities.GroupBuyRequest.filter({ tenant_id: resolvedTenantId }),
      base44.asServiceRole.entities.User.filter({ tenant_id: resolvedTenantId }),
      base44.asServiceRole.entities.TransitShippingMethod.filter({ tenant_id: resolvedTenantId }),
      base44.asServiceRole.entities.AddonOption.filter({ tenant_id: resolvedTenantId, addon_type: 'shipping' }),
    ]);

    console.log('[getAllTransitWorkData] Total GroupBuyRequests:', allRequests?.length || 0);
    
    // Include ALL requests with transit_location_id assigned, regardless of status
    // This ensures admin can see pending, completed, cancelled, expired requests
    const transitRequests = (allRequests || []).filter(r => {
      const hasTransit = !!r.transit_location_id;
      if (hasTransit) {
        console.log('[getAllTransitWorkData] Request with transit:', {
          id: r.id,
          title: r.title,
          transit_location_id: r.transit_location_id,
          status: r.status,
        });
      }
      return hasTransit;
    });
    
    console.log('[getAllTransitWorkData] Requests with transit location:', transitRequests.length);

    // Group requests by transit_location_id
    const requestsByLocation = {};
    for (const loc of locations) {
      requestsByLocation[loc.id] = transitRequests.filter(r => r.transit_location_id === loc.id);
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
      entries: allEntries,
      users: (allUsers || []).filter(u => u.role === 'admin'),
      transitMethods: (transitMethods || []).filter(m => m.is_active !== false),
      addonOptions: (addonOptions || []).filter(a => a.is_active !== false),
    });

  } catch (error) {
    console.error('getAllTransitWorkData error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});