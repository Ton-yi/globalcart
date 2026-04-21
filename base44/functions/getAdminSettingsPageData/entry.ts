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

// Module-level exchange rate cache (5-minute TTL)
// Avoids gating every page load on an external HTTP call
let _ratesCache = null;
let _ratesCacheTs = 0;
const RATES_TTL_MS = 5 * 60 * 1000;

async function fetchRatesCached() {
  const now = Date.now();
  if (_ratesCache && now - _ratesCacheTs < RATES_TTL_MS) {
    return _ratesCache;
  }
  try {
    const res = await fetch('https://v6.exchangerate-api.com/v6/89e2f91c758d92aa2c06667b/latest/JPY');
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.result === 'success' && data?.conversion_rates) {
      _ratesCache = { jpy_usd: data.conversion_rates['USD'] || null, jpy_cny: data.conversion_rates['CNY'] || null };
      _ratesCacheTs = now;
      return _ratesCache;
    }
  } catch {
    // ignore — rates are non-critical
  }
  return _ratesCache; // return stale cache on failure rather than null
}

/**
 * Aggregated page-load API for AdminSettings.
 * Returns: settings, addons, all config entity types, and live exchange rates (cached 5min).
 * Announcements are also included so Layout can populate its cache without a separate getTenantConfigData call.
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
    console.log(`[TIMING] getAdminSettingsPageData | auth.me + User.filter: ${Date.now()-t0}ms`);

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
      return Response.json({ settings: [], addons: [], rates: null, announcements: [] });
    }

    const filter = isPlatformAdmin && !tenantId ? {} : { tenant_id: tenantId };

    const t3 = Date.now();
    // Kick off rates fetch immediately (non-blocking — uses cache when warm)
    const ratesPromise = fetchRatesCached();

    const [settings, addons, shippingMethods, transitMethods, itemSizeTemplates, storeTagRules, announcements, boxTemplates, memberTiers, paymentMethods] = await Promise.all([
      base44.asServiceRole.entities.SiteSettings.filter(filter),
      base44.asServiceRole.entities.AddonOption.filter(filter),
      base44.asServiceRole.entities.ShippingMethod.filter(filter),
      base44.asServiceRole.entities.TransitShippingMethod.filter(filter),
      base44.asServiceRole.entities.ItemSizeTemplate.filter(filter),
      base44.asServiceRole.entities.OnlineStoreTagRule.filter(filter),
      base44.asServiceRole.entities.Announcement.filter({ ...filter, is_active: true }),
      base44.asServiceRole.entities.BoxTemplate.filter(filter),
      base44.asServiceRole.entities.MemberTier.filter(filter),
      base44.asServiceRole.entities.PaymentMethod.filter(filter),
    ]);
    console.log(`[TIMING] getAdminSettingsPageData | 10x entity queries: ${Date.now()-t3}ms`);

    // Rates resolve independently — if already cached this is instant
    const rates = await ratesPromise;
    console.log(`[TIMING] getAdminSettingsPageData | TOTAL: ${Date.now()-t0}ms`);

    return Response.json({
      settings: settings || [],
      addons: addons || [],
      shippingMethods: shippingMethods || [],
      transitMethods: transitMethods || [],
      itemSizeTemplates: itemSizeTemplates || [],
      storeTagRules: storeTagRules || [],
      announcements: announcements || [],
      boxTemplates: boxTemplates || [],
      memberTiers: memberTiers || [],
      paymentMethods: paymentMethods || [],
      rates,
    });

  } catch (error) {
    console.error(`[TIMING] getAdminSettingsPageData | TOTAL (error): ${Date.now()-t0}ms`);
    console.error('getAdminSettingsPageData error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});