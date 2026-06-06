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

// Default rates (fallback when live fetch fails)
const DEFAULT_RATES = {
  jpy_usd: 0.0067, jpy_cny: 0.048, jpy_eur: 0.0062,
  jpy_gbp: 0.0050, jpy_aud: 0.0104, jpy_sgd: 0.0090,
  jpy_hkd: 0.052,  jpy_twd: 0.22,
};

async function fetchLiveRates() {
  try {
    // Base = JPY, so rates.USD = how many USD 1 JPY buys (~0.0067)
    const res = await fetch('https://open.er-api.com/v6/latest/JPY');
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.rates) return null;
    const r = data.rates;
    return {
      jpy_usd: r.USD || null,
      jpy_cny: r.CNY || null,
      jpy_eur: r.EUR || null,
      jpy_gbp: r.GBP || null,
      jpy_aud: r.AUD || null,
      jpy_sgd: r.SGD || null,
      jpy_hkd: r.HKD || null,
      jpy_twd: r.TWD || null,
    };
  } catch {
    return null;
  }
}

/**
 * Page-level API for SubmitOrder page.
 * Resolves user + tenant once, then fetches in parallel:
 * - AddonOptions (order type, active)
 * - SiteSettings (service_fee_rate, prepay_rate, etc.)
 * - Live exchange rates (with increment adjustments)
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
    console.log(`[TIMING] getSubmitOrderPageData | auth+tenant: ${Date.now() - t0}ms`);

    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const userRecords = earlyUserRecords ?? await base44.asServiceRole.entities.User.filter({ email: user.email });
    if (!userRecords || userRecords.length === 0) {
      return Response.json({ error: 'User record not found' }, { status: 404 });
    }

    const tenantId = userRecords[0].tenant_id;
    if (!tenantId) {
      return Response.json({ addons: [], settings: {}, rates: DEFAULT_RATES });
    }

    const t1 = Date.now();
    const [addons, siteSettings, feeRules, liveRates] = await Promise.all([
      base44.asServiceRole.entities.AddonOption.filter({ tenant_id: tenantId }, '-created_date', 50),
      base44.asServiceRole.entities.SiteSettings.filter({ tenant_id: tenantId }, '-created_date', 50),
      base44.asServiceRole.entities.ServiceFeeRule.filter({ tenant_id: tenantId }, '-created_date', 50),
      fetchLiveRates(),
    ]);
    console.log(`[TIMING] getSubmitOrderPageData | 4x parallel queries: ${Date.now() - t1}ms`);
    console.log(`[TIMING] getSubmitOrderPageData | TOTAL: ${Date.now() - t0}ms`);

    // Build settings map
    const settingsMap = {};
    (siteSettings || []).forEach(s => { settingsMap[s.key] = s.value; });

    // Pick active order-phase fee rule
    const now = new Date().toISOString().slice(0, 10);
    const activeRule = (feeRules || [])
      .filter(r => !r.is_archived && r.status === 'active' && r.fee_phase !== 'shipping')
      .filter(r => !r.effective_from || r.effective_from <= now)
      .filter(r => !r.effective_until || r.effective_until >= now)
      .sort((a, b) => (parseFloat(b.priority) || 0) - (parseFloat(a.priority) || 0))[0] || null;

    // Merge live rates with increment adjustments from settings
    const baseRates = liveRates || DEFAULT_RATES;
    const rates = {
      jpy_usd: (baseRates.jpy_usd ?? DEFAULT_RATES.jpy_usd) + (parseFloat(settingsMap.jpy_usd_increment) || 0),
      jpy_cny: (baseRates.jpy_cny ?? DEFAULT_RATES.jpy_cny) + (parseFloat(settingsMap.jpy_cny_increment) || 0),
      jpy_eur: (baseRates.jpy_eur ?? DEFAULT_RATES.jpy_eur) + (parseFloat(settingsMap.jpy_eur_increment) || 0),
      jpy_gbp: (baseRates.jpy_gbp ?? DEFAULT_RATES.jpy_gbp) + (parseFloat(settingsMap.jpy_gbp_increment) || 0),
      jpy_aud: (baseRates.jpy_aud ?? DEFAULT_RATES.jpy_aud) + (parseFloat(settingsMap.jpy_aud_increment) || 0),
      jpy_sgd: (baseRates.jpy_sgd ?? DEFAULT_RATES.jpy_sgd) + (parseFloat(settingsMap.jpy_sgd_increment) || 0),
      jpy_hkd: (baseRates.jpy_hkd ?? DEFAULT_RATES.jpy_hkd) + (parseFloat(settingsMap.jpy_hkd_increment) || 0),
      jpy_twd: (baseRates.jpy_twd ?? DEFAULT_RATES.jpy_twd) + (parseFloat(settingsMap.jpy_twd_increment) || 0),
    };

    return Response.json({
      addons: (addons || []).filter(a => (!a.addon_type || a.addon_type === 'order') && a.is_active !== false),
      settings: settingsMap,
      rates,
      activeRule,  // null means fall back to settings.service_fee_rate
    });

  } catch (error) {
    console.error(`[TIMING] getSubmitOrderPageData | TOTAL (error): ${Date.now() - t0}ms`);
    console.error('getSubmitOrderPageData error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});