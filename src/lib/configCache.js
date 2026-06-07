/**
 * Module-level cache for tenant config data.
 * Avoids re-fetching getTenantConfigData on every page/component mount.
 * TTL: 30 seconds — fresh enough for admin changes to propagate quickly.
 * Cache is keyed per-session (module singleton).
 */

let _cache = null;
let _cacheTs = 0;
const TTL_MS = 60_000; // Match React Query staleTime

export function getTenantConfigCache() {
  if (_cache && Date.now() - _cacheTs < TTL_MS) return _cache;
  return null;
}

export function setTenantConfigCache(data) {
  _cache = data;
  _cacheTs = Date.now();
}

export function invalidateTenantConfigCache() {
  _cache = null;
  _cacheTs = 0;
}