import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const DEFAULT_API_URL = 'https://v6.exchangerate-api.com/v6/89e2f91c758d92aa2c06667b/latest/JPY';
const RATE_KEYS = { USD: 'jpy_usd', CNY: 'jpy_cny', EUR: 'jpy_eur', GBP: 'jpy_gbp', AUD: 'jpy_aud', SGD: 'jpy_sgd', HKD: 'jpy_hkd', TWD: 'jpy_twd' };
const FALLBACKS = { jpy_usd: 0.0067, jpy_cny: 0.048, jpy_eur: 0.0062, jpy_gbp: 0.0050, jpy_aud: 0.0104, jpy_sgd: 0.0090, jpy_hkd: 0.052, jpy_twd: 0.22 };

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));

    // 平台级设置：汇率查询 API 地址 + 查询频率（缓存时长，分钟）
    const pick = arr => (arr || []).find(s => !s.tenant_id || s.tenant_id === '');
    const [urlSettings, freqSettings, cacheSettings] = await Promise.all([
      base44.asServiceRole.entities.SiteSettings.filter({ key: 'exchange_rate_api_url' }),
      base44.asServiceRole.entities.SiteSettings.filter({ key: 'exchange_rate_refresh_minutes' }),
      base44.asServiceRole.entities.SiteSettings.filter({ key: 'exchange_rate_cache' }),
    ]);
    const apiUrl = pick(urlSettings)?.value || DEFAULT_API_URL;
    const refreshMinutes = Math.max(5, parseFloat(pick(freqSettings)?.value) || 60);
    const cacheRecord = pick(cacheSettings);

    // 缓存命中：按全局查询频率限制对外部 API 的请求次数
    if (!body.force_refresh && cacheRecord?.value) {
      try {
        const cached = JSON.parse(cacheRecord.value);
        const ageMs = Date.now() - new Date(cached.fetched_at).getTime();
        if (cached.rates && ageMs >= 0 && ageMs < refreshMinutes * 60 * 1000) {
          // 缓存命中，但仍需叠加租户增量
          const rawRates = cached.rates;
          const rates = { ...rawRates };
          const userRecord = await base44.asServiceRole.entities.User.filter({ email: user.email });
          const tenantId = userRecord?.[0]?.tenant_id || '';
          if (tenantId) {
            const incrementSettings = await base44.asServiceRole.entities.SiteSettings.filter({ tenant_id: tenantId });
            const incMap = {};
            (incrementSettings || []).forEach(s => { incMap[s.key] = parseFloat(s.value) || 0; });
            Object.values(RATE_KEYS).forEach(key => {
              const inc = incMap[`${key}_increment`] || 0;
              if (inc !== 0) rates[key] = (rawRates[key] || 0) + inc;
            });
          }
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

    // 写入平台级缓存（原始汇率，不含增量）
    const cacheValue = JSON.stringify({ rates: rawRates, fetched_at: new Date().toISOString() });
    if (cacheRecord) {
      await base44.asServiceRole.entities.SiteSettings.update(cacheRecord.id, { value: cacheValue });
    } else {
      await base44.asServiceRole.entities.SiteSettings.create({
        key: 'exchange_rate_cache',
        value: cacheValue,
        description: '全局汇率查询缓存（自动维护）',
        category: 'general',
        tenant_id: '',
      });
    }

    // 读取租户级增量设置并叠加
    const userRecord = await base44.asServiceRole.entities.User.filter({ email: user.email });
    const tenantId = userRecord?.[0]?.tenant_id || '';
    const rates = { ...rawRates };
    if (tenantId) {
      const incrementKeys = Object.values(RATE_KEYS).map(k => `${k}_increment`);
      const incrementSettings = await base44.asServiceRole.entities.SiteSettings.filter({ tenant_id: tenantId });
      const incMap = {};
      (incrementSettings || []).forEach(s => { incMap[s.key] = parseFloat(s.value) || 0; });
      Object.values(RATE_KEYS).forEach(key => {
        const inc = incMap[`${key}_increment`] || 0;
        if (inc !== 0) rates[key] = (rawRates[key] || 0) + inc;
      });
    }

    return Response.json({ ...rates, rates, raw_rates: rawRates });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});