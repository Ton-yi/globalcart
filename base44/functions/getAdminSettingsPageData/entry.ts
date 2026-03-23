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
 * Aggregated page-load API for AdminSettings.
 * Returns: settings (raw array), addons, and live exchange rates.
 * Enforces tenant isolation — tenant_id derived from session, never from client.
 * Only admin/tenant_admin/platform_admin may call this.
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
    console.log(`[TIMING] getAdminSettingsPageData | auth.me + User.filter (parallel): ${Date.now()-t0}ms`);

    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const isPlatformAdmin = user.role === 'platform_admin';
    const isTenantAdmin = user.role === 'admin' || user.role === 'tenant_admin';
    if (!isPlatformAdmin && !isTenantAdmin) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const userRecords = earlyUserRecords ?? await base44.asServiceRole.entities.User.filter({ email: user.email });
    if (!userRecords || userRecords.length === 0) {
      return Response.json({ error: 'User record not found' }, { status: 404 });
    }

    const tenantId = userRecords[0].tenant_id;

    if (!tenantId && !isPlatformAdmin) {
      console.log(`[TIMING] getAdminSettingsPageData | TOTAL: ${Date.now()-t0}ms | no tenant`);
      return Response.json({ settings: [], addons: [], rates: null });
    }

    const filter = isPlatformAdmin && !tenantId ? {} : { tenant_id: tenantId };

    const t3 = Date.now();
    const [settings, addons, shippingMethods, transitMethods, itemSizeTemplates, storeTagRules, ratesRes] = await Promise.all([
      base44.asServiceRole.entities.SiteSettings.filter(filter),
      base44.asServiceRole.entities.AddonOption.filter(filter),
      base44.asServiceRole.entities.ShippingMethod.filter(filter),
      base44.asServiceRole.entities.TransitShippingMethod.filter(filter),
      base44.asServiceRole.entities.ItemSizeTemplate.filter(filter),
      base44.asServiceRole.entities.OnlineStoreTagRule.filter(filter),
      fetch('https://v6.exchangerate-api.com/v6/89e2f91c758d92aa2c06667b/latest/JPY').then(r => r.ok ? r.json() : null).catch(() => null),
    ]);
    console.log(`[TIMING] getAdminSettingsPageData | 6x entity queries + rates (parallel): ${Date.now()-t3}ms`);
    console.log(`[TIMING] getAdminSettingsPageData | TOTAL: ${Date.now()-t0}ms`);

    let rates = null;
    if (ratesRes?.result === 'success' && ratesRes?.conversion_rates) {
      rates = {
        jpy_usd: ratesRes.conversion_rates['USD'] || null,
        jpy_cny: ratesRes.conversion_rates['CNY'] || null,
      };
    }

    return Response.json({
      settings: settings || [],
      addons: addons || [],
      shippingMethods: shippingMethods || [],
      transitMethods: transitMethods || [],
      itemSizeTemplates: itemSizeTemplates || [],
      storeTagRules: storeTagRules || [],
      rates,
    });

  } catch (error) {
    console.error(`[TIMING] getAdminSettingsPageData | TOTAL (error): ${Date.now()-t0}ms`);
    console.error('getAdminSettingsPageData error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});