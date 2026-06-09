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

    // Fetch GroupBuyRequests for this transit location
    const filter = {
      tenant_id: location.tenant_id,
      transit_location_id: transitLocationId
    };

    const allRequests = await base44.asServiceRole.entities.GroupBuyRequest.filter(filter);
    
    // Include ALL requests regardless of status - as long as they have transit_location_id assigned
    // This ensures transit managers can see pending, completed, arrived, and forwarded requests
    const requests = (allRequests || [])
      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    
    console.log('[getTransitLocationWorkPageData] Found', requests.length, 'requests for transit location', transitLocationId);

    // Fetch entries for all requests
    const requestIds = requests.map(r => r.id);
    const allEntries = await base44.asServiceRole.entities.GroupBuyEntry.filter({ 
      request_id: { $in: requestIds }
    });
    
    // Group entries by request_id
    const entriesByRequest = {};
    requestIds.forEach(rid => { entriesByRequest[rid] = []; });
    (allEntries || []).forEach(entry => {
      if (entriesByRequest[entry.request_id]) {
        entriesByRequest[entry.request_id].push(entry);
      }
    });
    
    // Enrich requests with entry counts and totals
    const enrichedRequests = requests.map(request => {
      const entries = entriesByRequest[request.id] || [];
      const activeEntries = entries.filter(e => e.status === 'active');
      const completedEntries = entries.filter(e => e.status === 'completed');
      
      return {
        ...request,
        entry_count: entries.length,
        active_entry_count: activeEntries.length,
        completed_entry_count: completedEntries.length,
        entries: entries, // Include entries for display
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