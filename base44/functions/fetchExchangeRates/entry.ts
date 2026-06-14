import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const DEFAULT_API_URL = 'https://v6.exchangerate-api.com/v6/89e2f91c758d92aa2c06667b/latest/JPY';
const RATE_KEYS = {
  USD: 'jpy_usd', CNY: 'jpy_cny', EUR: 'jpy_eur', GBP: 'jpy_gbp',
  AUD: 'jpy_aud', SGD: 'jpy_sgd', HKD: 'jpy_hkd', TWD: 'jpy_twd',
  KRW: 'jpy_krw', CAD: 'jpy_cad', THB: 'jpy_thb', MYR: 'jpy_myr',
};
const FALLBACKS = {
  jpy_usd: 0.0067, jpy_cny: 0.048, jpy_eur: 0.0062, jpy_gbp: 0.0050,
  jpy_aud: 0.0104, jpy_sgd: 0.0090, jpy_hkd: 0.052, jpy_twd: 0.22,
  jpy_krw: 8.9, jpy_cad: 0.0093, jpy_thb: 0.24, jpy_myr: 0.031,
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));

    // 解析租户 ID
    const pickPlat = arr => (arr || []).find(s => !s.tenant_id || s.tenant_id === '');
    const userRecords = await base44.asServiceRole.entities.User.filter({ email: user.email });
    const tenantId = userRecords?.[0]?.tenant_id || '';

    // 平台级设置 + 租户级 API 覆盖（并行）
    const [urlSettings, freqSettings, cacheSettings, tenantApiKeySettings, tenantFreqSettings] = await Promise.all([
      base44.asServiceRole.entities.SiteSettings.filter({ key: 'exchange_rate_api_url' }),
      base44.asServiceRole.entities.SiteSettings.filter({ key: 'exchange_rate_refresh_minutes' }),
      base44.asServiceRole.entities.SiteSettings.filter({ key: 'exchange_rate_cache' }),
      tenantId ? base44.asServiceRole.entities.SiteSettings.filter({ key: 'tenant_exchange_rate_api_key', tenant_id: tenantId }) : Promise.resolve([]),
      tenantId ? base44.asServiceRole.entities.SiteSettings.filter({ key: 'tenant_exchange_rate_refresh_minutes', tenant_id: tenantId }) : Promise.resolve([]),
    ]);

    const platformApiUrl = pickPlat(urlSettings)?.value || DEFAULT_API_URL;
    const platformRefreshMinutes = Math.max(5, parseFloat(pickPlat(freqSettings)?.value) || 60);

    // 租户自定义 API key 时，生成租户专属 API URL
    const tenantApiKey = tenantApiKeySettings?.[0]?.value?.trim() || '';
    const tenantRefreshMin = tenantFreqSettings?.[0]?.value ? Math.max(5, parseInt(tenantFreqSettings[0].value) || platformRefreshMinutes) : null;

    const apiUrl = tenantApiKey
      ? `https://v6.exchangerate-api.com/v6/${tenantApiKey}/latest/JPY`
      : platformApiUrl;
    const refreshMinutes = tenantRefreshMin ?? platformRefreshMinutes;

    // 租户有自己 API key 时，使用独立缓存；否则用平台共享缓存
    const pick = arr => (arr || []).find(s => !s.tenant_id || s.tenant_id === '');
    const cacheKey = tenantApiKey ? `exchange_rate_cache_${tenantId}` : 'exchange_rate_cache';
    const allCacheSettings = tenantApiKey
      ? await base44.asServiceRole.entities.SiteSettings.filter({ key: cacheKey, tenant_id: tenantId })
      : cacheSettings;
    const cacheRecord = tenantApiKey ? (allCacheSettings?.[0] || null) : pick(cacheSettings);

    // 辅助函数：叠加平台增量 + 租户增量（tenantId 已解析，避免重复查询）
    const applyIncrements = async (rawRates) => {
      const rates = { ...rawRates };
      const [platformSettings, tenantSettings] = await Promise.all([
        base44.asServiceRole.entities.SiteSettings.filter({ tenant_id: '' }),
        tenantId ? base44.asServiceRole.entities.SiteSettings.filter({ tenant_id: tenantId }) : Promise.resolve([]),
      ]);
      const platMap = {};
      (platformSettings || []).forEach(s => { platMap[s.key] = parseFloat(s.value) || 0; });
      const tenantMap = {};
      (tenantSettings || []).forEach(s => { tenantMap[s.key] = parseFloat(s.value) || 0; });
      Object.values(RATE_KEYS).forEach(key => {
        const platInc = platMap[`${key}_increment`] || 0;
        const tenantInc = tenantMap[`${key}_increment`] || 0;
        const total = platInc + tenantInc;
        if (total !== 0) rates[key] = (rawRates[key] || 0) + total;
      });
      return rates;
    };

    // 缓存命中：按全局查询频率限制对外部 API 的请求次数
    if (!body.force_refresh && cacheRecord?.value) {
      try {
        const cached = JSON.parse(cacheRecord.value);
        const ageMs = Date.now() - new Date(cached.fetched_at).getTime();
        if (cached.rates && ageMs >= 0 && ageMs < refreshMinutes * 60 * 1000) {
          const rawRates = cached.rates;
          const rates = await applyIncrements(rawRates);
          return Response.json({ ...rates, rates, raw_rates: rawRates, cached: true });
        }
      } catch { /* 缓存损坏则忽略，继续实时查询 */ }
    }

    const response = await fetch(apiUrl);
    if (!response.ok) {
      return Response.json({ error: 'Failed to fetch exchange rates' }, { status: 500 });
    }

    const data = await response.json();
    const conversion = data.conversion_rates || data.rates;
    if ((data.result && data.result !== 'success') || !conversion) {
      return Response.json({ error: 'API returned error: ' + (data['error-type'] || 'unexpected format') }, { status: 500 });
    }

    const rawRates = { timestamp: new Date().toISOString() };
    Object.entries(RATE_KEYS).forEach(([cur, key]) => { rawRates[key] = conversion[cur] || FALLBACKS[key]; });

    // 写入缓存（租户有独立 key 时写租户缓存，否则写平台共享缓存）
    const cacheValue = JSON.stringify({ rates: rawRates, fetched_at: new Date().toISOString() });
    if (cacheRecord) {
      await base44.asServiceRole.entities.SiteSettings.update(cacheRecord.id, { value: cacheValue });
    } else {
      await base44.asServiceRole.entities.SiteSettings.create({
        key: cacheKey,
        value: cacheValue,
        description: tenantApiKey ? `租户汇率缓存（${tenantId}）` : '全局汇率查询缓存（自动维护）',
        category: 'general',
        tenant_id: tenantApiKey ? tenantId : '',
      });
    }

    const rates = await applyIncrements(rawRates);
    return Response.json({ ...rates, rates, raw_rates: rawRates });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});