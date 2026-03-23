import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Fetch tenant-specific settings
 * Each tenant can have isolated configuration
 */
Deno.serve(async (req) => {
  const t0 = Date.now();
  try {
    const base44 = createClientFromRequest(req);

    const t1 = Date.now();
    const user = await base44.auth.me();
    console.log(`[TIMING] getTenantSettings | auth.me: ${Date.now()-t1}ms`);
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const t2 = Date.now();
    const userRecord = await base44.asServiceRole.entities.User.filter({ email: user.email });
    console.log(`[TIMING] getTenantSettings | User.filter (tenant lookup): ${Date.now()-t2}ms`);

    if (!userRecord || userRecord.length === 0) {
      return Response.json({ error: 'User record not found' }, { status: 404 });
    }

    const tenantId = userRecord[0].tenant_id;
    const isPlatformAdmin = user.role === 'platform_admin';

    if (!tenantId && !isPlatformAdmin) {
      console.log(`[TIMING] getTenantSettings | TOTAL: ${Date.now()-t0}ms | no tenant`);
      return Response.json({ settings: {}, raw: [] });
    }

    let filter = {};
    if (isPlatformAdmin) {
      const query = new URL(req.url).searchParams;
      const queryTenantId = query.get('tenant_id');
      if (queryTenantId) filter.tenant_id = queryTenantId;
      else if (tenantId) filter.tenant_id = tenantId;
    } else {
      filter.tenant_id = tenantId;
    }

    const t3 = Date.now();
    const settings = await base44.asServiceRole.entities.SiteSettings.filter(filter);
    console.log(`[TIMING] getTenantSettings | SiteSettings.filter: ${Date.now()-t3}ms | count: ${settings?.length}`);
    console.log(`[TIMING] getTenantSettings | TOTAL: ${Date.now()-t0}ms`);

    const settingsMap = {};
    (settings || []).forEach(s => {
      settingsMap[s.key] = s.value;
    });

    return Response.json({ 
      settings: settingsMap,
      raw: settings || []
    });

  } catch (error) {
    console.error(`[TIMING] getTenantSettings | TOTAL (error): ${Date.now()-t0}ms`);
    console.error('getTenantSettings error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});