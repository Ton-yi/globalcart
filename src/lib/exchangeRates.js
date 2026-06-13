import { base44 } from '@/api/base44Client';
// Note: getRatesWithIncrements delegates to getExchangeRates — increments applied server-side

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
const CACHE_TTL = 28800000; // 8 hours (API updates 3 times daily)

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
 * Get rates with tenant increments already applied (increments are applied server-side by fetchExchangeRates).
 * This is now an alias for getExchangeRates() since the backend handles increment application.
 */
export async function getRatesWithIncrements() {
  return getExchangeRates();
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