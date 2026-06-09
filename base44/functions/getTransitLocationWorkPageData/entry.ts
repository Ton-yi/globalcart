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

    // Get transit_location_id from query param or JSON body
    let transitLocationId = null;
    try {
      const url = new URL(req.url);
      transitLocationId = url.searchParams.get('transit_location_id');
      if (!transitLocationId) {
        const body = await req.json();
        transitLocationId = body.transit_location_id;
      }
    } catch {
      const body = await req.json();
      transitLocationId = body.transit_location_id;
    }

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

    // Fetch pools for this transit location
    const filter = {
      tenant_id: location.tenant_id,
      transit_location_id: transitLocationId,
      consolidation_type: "transit"
    };

    const allPools = await base44.asServiceRole.entities.ShippingPool.filter(filter);
    
    // Deduplicate pools by id (defensive programming)
    const uniquePoolsMap = new Map();
    (allPools || []).forEach(p => {
      if (!uniquePoolsMap.has(p.id)) {
        uniquePoolsMap.set(p.id, p);
      }
    });
    const pools = Array.from(uniquePoolsMap.values());
    
    // Fetch related data
    const [orders, transitMethods, addonOptions] = await Promise.all([
      base44.asServiceRole.entities.Order.filter({ tenant_id: location.tenant_id }),
      base44.asServiceRole.entities.TransitShippingMethod.filter({ tenant_id: location.tenant_id }),
      base44.asServiceRole.entities.AddonOption.filter({ tenant_id: location.tenant_id, addon_type: 'shipping' }),
    ]);

    return Response.json({
      location,
      pools: pools || [],
      orders: orders || [],
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