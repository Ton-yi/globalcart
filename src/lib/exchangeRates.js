import { base44 } from '@/api/base44Client';

// Default rates (fallback)
const DEFAULT_RATES = {
  jpy_usd: 0.0067,
  jpy_cny: 0.048,
  jpy_eur: 0.0062,
  jpy_gbp: 0.0050,
  jpy_aud: 0.0104,
  jpy_sgd: 0.0090,
  jpy_hkd: 0.052,
  jpy_twd: 0.22,
};

let cachedRates = null;
let cacheTimestamp = 0;
const CACHE_TTL = 3600000; // 1 hour

/**
 * Get live exchange rates for JPY
 * Fetches from API, caches for 1 hour
 */
export async function getExchangeRates() {
  const now = Date.now();
  
  // Return cached rates if still valid
  if (cachedRates && (now - cacheTimestamp < CACHE_TTL)) {
    return cachedRates;
  }

  try {
    const res = await base44.functions.invoke('fetchExchangeRates', {});
    if (res.data && res.data.jpy_usd) {
      cachedRates = res.data;
      cacheTimestamp = now;
      return cachedRates;
    }
  } catch (error) {
    console.warn('Failed to fetch live rates, using defaults:', error);
  }

  return DEFAULT_RATES;
}

/**
 * Get settings and merge with live rates
 * Returns: { jpy_usd: base_rate, jpy_cny: base_rate, ... }
 * Plus increments from settings: jpy_usd_increment, jpy_cny_increment
 */
export async function getRatesWithIncrements() {
  const [liveRates, settings] = await Promise.all([
    getExchangeRates(),
    base44.entities.SiteSettings.list()
  ]);

  const settingsMap = {};
  settings.forEach(s => { settingsMap[s.key] = parseFloat(s.value) || 0; });

  return {
    jpy_usd: (liveRates.jpy_usd || DEFAULT_RATES.jpy_usd) + (settingsMap.jpy_usd_increment || 0),
    jpy_cny: (liveRates.jpy_cny || DEFAULT_RATES.jpy_cny) + (settingsMap.jpy_cny_increment || 0),
    jpy_eur: (liveRates.jpy_eur || DEFAULT_RATES.jpy_eur) + (settingsMap.jpy_eur_increment || 0),
    jpy_gbp: (liveRates.jpy_gbp || DEFAULT_RATES.jpy_gbp) + (settingsMap.jpy_gbp_increment || 0),
    jpy_aud: (liveRates.jpy_aud || DEFAULT_RATES.jpy_aud) + (settingsMap.jpy_aud_increment || 0),
    jpy_sgd: (liveRates.jpy_sgd || DEFAULT_RATES.jpy_sgd) + (settingsMap.jpy_sgd_increment || 0),
    jpy_hkd: (liveRates.jpy_hkd || DEFAULT_RATES.jpy_hkd) + (settingsMap.jpy_hkd_increment || 0),
    jpy_twd: (liveRates.jpy_twd || DEFAULT_RATES.jpy_twd) + (settingsMap.jpy_twd_increment || 0),
  };
}

/**
 * Convert JPY to target currency using live rates
 */
export async function convertJpyTo(jpy, targetCurrency) {
  const rates = await getRatesWithIncrements();
  const rateKey = `jpy_${targetCurrency.toLowerCase()}`;
  const rate = rates[rateKey] || DEFAULT_RATES[rateKey] || 1;
  return jpy * rate;
}