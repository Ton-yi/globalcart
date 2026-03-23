import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Fetch all tenant configuration data (templates, rules, methods, locations, etc.)
 * with proper tenant isolation
 */
Deno.serve(async (req) => {
  const t0 = Date.now();
  try {
    const base44 = createClientFromRequest(req);

    const t1 = Date.now();
    const user = await base44.auth.me();
    console.log(`[TIMING] getTenantConfigData | auth.me: ${Date.now()-t1}ms`);
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const t2 = Date.now();
    const userRecord = await base44.asServiceRole.entities.User.filter({ email: user.email });
    console.log(`[TIMING] getTenantConfigData | User.filter (tenant lookup): ${Date.now()-t2}ms`);

    if (!userRecord || userRecord.length === 0) {
      return Response.json({ error: 'User record not found' }, { status: 404 });
    }

    const tenantId = userRecord[0].tenant_id;
    const isPlatformAdmin = user.role === 'platform_admin';

    if (!tenantId && !isPlatformAdmin) {
      console.log(`[TIMING] getTenantConfigData | TOTAL: ${Date.now()-t0}ms | no tenant`);
      return Response.json({
        itemSizeTemplates: [], storeTagRules: [], shippingMethods: [],
        transitMethods: [], transitLocations: [], addons: [], announcements: []
      });
    }

    let filter = {};
    if (!isPlatformAdmin) {
      filter.tenant_id = tenantId;
    }

    const t3 = Date.now();
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
      base44.asServiceRole.entities.Announcement.filter({ ...filter, is_active: true })
    ]);
    console.log(`[TIMING] getTenantConfigData | 7x parallel entity queries: ${Date.now()-t3}ms`);
    console.log(`[TIMING] getTenantConfigData | TOTAL: ${Date.now()-t0}ms`);

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
    console.error(`[TIMING] getTenantConfigData | TOTAL (error): ${Date.now()-t0}ms`);
    console.error('getTenantConfigData error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});