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
 * Fetch tenant-specific settings.
 * Each tenant can have isolated configuration.
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
    console.log(`[TIMING] getTenantSettings | auth.me + User.filter (parallel): ${Date.now()-t0}ms`);

    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const userRecords = earlyUserRecords ?? await base44.asServiceRole.entities.User.filter({ email: user.email });

    if (!userRecords || userRecords.length === 0) {
      return Response.json({ error: 'User record not found' }, { status: 404 });
    }

    const tenantId = userRecords[0].tenant_id;
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
    (settings || []).forEach(s => { settingsMap[s.key] = s.value; });

    return Response.json({ settings: settingsMap, raw: settings || [] });

  } catch (error) {
    console.error(`[TIMING] getTenantSettings | TOTAL (error): ${Date.now()-t0}ms`);
    console.error('getTenantSettings error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});