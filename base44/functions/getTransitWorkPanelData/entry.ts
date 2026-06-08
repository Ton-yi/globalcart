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
 * Get transit location work panel data for transit managers.
 * Returns shipping pools assigned to this transit location.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const emailHint = extractEmailFromJwt(req);
    const userRecords = await base44.asServiceRole.entities.User.filter({ email: emailHint || user.email });
    
    if (!userRecords || userRecords.length === 0) {
      return Response.json({ error: 'User record not found' }, { status: 404 });
    }

    const tenantId = userRecords[0].tenant_id;

    if (!tenantId) {
      return Response.json({ error: 'User not assigned to tenant' }, { status: 403 });
    }

    // Get transit locations where this user is the manager
    const locations = await base44.asServiceRole.entities.TransitLocation.filter({ 
      tenant_id: tenantId,
      manager_email: user.email,
      is_active: true
    });

    if (!locations || locations.length === 0) {
      return Response.json({ 
        error: 'Forbidden: Not a transit location manager', 
        status: 403 
      });
    }

    const locationIds = locations.map(l => l.id);

    // Get all shipping pools for these transit locations
    const pools = await base44.asServiceRole.entities.ShippingPool.filter({
      tenant_id: tenantId,
      consolidation_type: 'transit',
      transit_location_id: locationIds.length === 1 ? locationIds[0] : locationIds
    });

    // Get related data
    const [orders, transitMethods, addonOptions, boxTemplates, shippingMethods] = await Promise.all([
      base44.asServiceRole.entities.Order.filter({ tenant_id: tenantId }),
      base44.asServiceRole.entities.TransitShippingMethod.filter({ tenant_id: tenantId }),
      base44.asServiceRole.entities.AddonOption.filter({ tenant_id: tenantId }),
      base44.asServiceRole.entities.BoxTemplate.filter({ tenant_id: tenantId }),
      base44.asServiceRole.entities.ShippingMethod.filter({ tenant_id: tenantId }),
    ]);

    return Response.json({
      pools: pools || [],
      locations: locations || [],
      orders: orders || [],
      transitMethods: transitMethods || [],
      addonOptions: addonOptions || [],
      boxTemplates: boxTemplates || [],
      shippingMethods: shippingMethods || [],
    });
  } catch (error) {
    console.error('Error in getTransitWorkPanelData:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});