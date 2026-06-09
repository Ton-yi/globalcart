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
 * Get transit location work page data.
 * Only accessible by transit location managers.
 * Filters pools by transit_location_id and manager_email.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const transitLocationId = url.searchParams.get('transit_location_id');

    if (!transitLocationId) {
      return Response.json({ error: 'Missing transit_location_id' }, { status: 400 });
    }

    // Fetch transit location to verify user is manager
    const locations = await base44.asServiceRole.entities.TransitLocation.filter({ 
      id: transitLocationId 
    });
    
    if (!locations || locations.length === 0) {
      return Response.json({ error: 'Transit location not found' }, { status: 404 });
    }

    const location = locations[0];
    
    // Check if user is the manager
    const isManager = location.manager_email === user.email;
    const isAdmin = user.role === 'admin' || user.role === 'tenant_admin' || user.role === 'platform_admin';
    
    if (!isManager && !isAdmin) {
      return Response.json({ error: 'Forbidden: Not authorized for this transit location' }, { status: 403 });
    }

    // Fetch GroupBuyRequests AND ShippingPools for this transit location
    const filter = {
      tenant_id: location.tenant_id,
      transit_location_id: transitLocationId
    };

    console.log('[getTransitLocationWorkPageData] Fetching data for transit_location_id:', transitLocationId);
    console.log('[getTransitLocationWorkPageData] Location tenant_id:', location.tenant_id);
    console.log('[getTransitLocationWorkPageData] User email:', user.email);
    console.log('[getTransitLocationWorkPageData] Is manager:', location.manager_email === user.email);
    
    const [allGroupBuyRequests, allShippingPools] = await Promise.all([
      base44.asServiceRole.entities.GroupBuyRequest.filter(filter),
      base44.asServiceRole.entities.ShippingPool.filter(filter),
    ]);
    
    console.log('[getTransitLocationWorkPageData] GroupBuyRequests:', allGroupBuyRequests?.length || 0);
    console.log('[getTransitLocationWorkPageData] ShippingPools:', allShippingPools?.length || 0);
    console.log('[getTransitLocationWorkPageData] Combined requests:', (allGroupBuyRequests?.length || 0) + (allShippingPools?.length || 0));
    
    // Combine both arrays for unified handling
    const requests = [...(allGroupBuyRequests || []), ...(allShippingPools || [])]
      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    
    console.log('[getTransitLocationWorkPageData] Found', requests.length, 'requests for transit location', transitLocationId);

    // Fetch entries for GroupBuyRequests (ShippingPools don't have entries)
    const groupBuyRequestIds = (allGroupBuyRequests || []).map(r => r.id);
    let allEntries = [];
    if (groupBuyRequestIds.length > 0) {
      allEntries = await base44.asServiceRole.entities.GroupBuyEntry.filter({ 
        request_id: { $in: groupBuyRequestIds }
      });
    }
    
    // Group entries by request_id (only for GroupBuyRequests)
    const entriesByRequest = {};
    groupBuyRequestIds.forEach(rid => { entriesByRequest[rid] = []; });
    (allEntries || []).forEach(entry => {
      if (entriesByRequest[entry.request_id]) {
        entriesByRequest[entry.request_id].push(entry);
      }
    });
    
    // Enrich requests with entry counts and totals
    const enrichedRequests = requests.map(request => {
      const isRequest = !!request.title; // GroupBuyRequest has title, ShippingPool has pool_code
      const entries = entriesByRequest[request.id] || [];
      const orderCount = isRequest ? entries.length : (request.order_ids || []).length;
      
      return {
        ...request,
        entry_count: orderCount,
        active_entry_count: isRequest ? entries.filter(e => e.status === 'active').length : orderCount,
        completed_entry_count: isRequest ? entries.filter(e => e.status === 'completed').length : 0,
        entries: isRequest ? entries : [], // Include entries only for GroupBuyRequests
        order_count: orderCount, // For ShippingPools
      };
    });
    
    // Fetch related data
    const [transitMethods, addonOptions] = await Promise.all([
      base44.asServiceRole.entities.TransitShippingMethod.filter({ tenant_id: location.tenant_id }),
      base44.asServiceRole.entities.AddonOption.filter({ tenant_id: location.tenant_id, addon_type: 'shipping' }),
    ]);

    return Response.json({
      location,
      requests: enrichedRequests,
      transitMethods: (transitMethods || []).filter(m => m.is_active !== false),
      addonOptions: (addonOptions || []).filter(a => a.is_active !== false),
      isManager,
      isAdmin,
    });

  } catch (error) {
    console.error('getTransitLocationWorkPageData error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});