import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Fetch all tenant configuration data (templates, rules, methods, locations, etc.)
 * with proper tenant isolation
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user record to find tenant_id
    const userRecord = await base44.asServiceRole.entities.User.filter({ email: user.email });
    if (!userRecord || userRecord.length === 0) {
      return Response.json({ error: 'User record not found' }, { status: 404 });
    }

    const tenantId = userRecord[0].tenant_id;
    
    let filter = {};
    if (user.role === 'platform_admin') {
      // Platform admins can see all (no filter)
    } else {
      if (!tenantId) {
        return Response.json({ error: 'User has no tenant assigned' }, { status: 403 });
      }
      filter.tenant_id = tenantId;
    }

    // Fetch all tenant-scoped configuration in parallel
    const [
      itemSizeTemplates,
      storeTagRules,
      shippingMethods,
      transitMethods,
      transitLocations,
      addons,
      announcements
    ] = await Promise.all([
      base44.asServiceRole.entities.ItemSizeTemplate.filter(filter),
      base44.asServiceRole.entities.OnlineStoreTagRule.filter(filter),
      base44.asServiceRole.entities.ShippingMethod.filter(filter),
      base44.asServiceRole.entities.TransitShippingMethod.filter(filter),
      base44.asServiceRole.entities.TransitLocation.filter(filter),
      base44.asServiceRole.entities.AddonOption.filter(filter),
      // For announcements, include both tenant-specific and platform-wide
      base44.asServiceRole.entities.Announcement.filter({
        ...filter,
        is_active: true
      })
    ]);

    return Response.json({
      itemSizeTemplates: itemSizeTemplates || [],
      storeTagRules: storeTagRules || [],
      shippingMethods: shippingMethods || [],
      transitMethods: transitMethods || [],
      transitLocations: transitLocations || [],
      addons: addons || [],
      announcements: announcements || []
    });

  } catch (error) {
    console.error('getTenantConfigData error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});