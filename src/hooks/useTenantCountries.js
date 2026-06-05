/**
 * useTenantCountries
 * Reads tenant country config from the shared config cache.
 * Returns an ordered, filtered list of countries for use in all country selectors.
 *
 * Config format (stored in SiteSettings key="tenant_countries_config"):
 *   JSON array: [{ code: "CN", enabled: true }, ...]
 *   The order in this array determines display order.
 *
 * If no config is set, falls back to ALL_COUNTRIES in default order.
 */
import { useState, useEffect } from "react";
import { ALL_COUNTRIES } from "@/lib/countries";
import { fetchTenantConfig } from "@/lib/tenantApi";

let _cache = null;

export function useTenantCountries() {
  const [countries, setCountries] = useState(_cache || ALL_COUNTRIES);
  const [loading, setLoading] = useState(!_cache);

  useEffect(() => {
    if (_cache) {
      setLoading(false);
      return;
    }
    fetchTenantConfig()
      .then(cfg => {
        const result = buildCountryList(cfg?.countriesConfig);
        _cache = result;
        setCountries(result);
      })
      .catch(() => setCountries(ALL_COUNTRIES))
      .finally(() => setLoading(false));
  }, []);

  return { countries, loading };
}

/**
 * Build an ordered, filtered country list from the stored config.
 * Config entries that are disabled are excluded.
 * Countries not in the config are appended at the end.
 */
export function buildCountryList(config) {
  if (!config || !Array.isArray(config) || config.length === 0) {
    return ALL_COUNTRIES;
  }
  // All codes that appear in config (enabled OR disabled)
  const allConfigCodes = new Set(config.map(c => c.code));
  // Only keep enabled ones, in config order
  const enabled = config.filter(c => c.enabled !== false);
  const inConfig = enabled.map(c => ALL_COUNTRIES.find(ac => ac.code === c.code)).filter(Boolean);
  // Countries not in config at all (newly added to ALL_COUNTRIES) — append at end
  const rest = ALL_COUNTRIES.filter(c => !allConfigCodes.has(c.code));
  return [...inConfig, ...rest];
}

/** Clear the module-level cache (call after config is saved) */
export function invalidateTenantCountriesCache() {
  _cache = null;
}