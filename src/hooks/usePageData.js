/**
 * usePageData — React Query powered hook for page-level backend function calls.
 *
 * Caches results globally so navigating away and back does NOT re-fetch
 * within the staleTime window (60s default). The cache is shared across
 * all components/pages via the global QueryClient.
 *
 * Usage:
 *   const { data, loading, error, refetch } = usePageData('getMyOrdersPageData', {});
 *
 * The `queryKey` is derived from [fnName, payload] so different payloads get
 * separate cache entries automatically.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { invokeWithRetry } from '@/lib/apiUtils';

export function usePageData(fnName, payload = {}, options = {}) {
  const {
    enabled = true,
    staleTime,   // override per-call if needed (e.g. 0 for always-fresh)
    select,      // transform the raw response data
  } = options;

  // Stable key: serialise payload so object identity doesn't break cache hits
  const queryKey = [fnName, JSON.stringify(payload)];

  const result = useQuery({
    queryKey,
    queryFn: () => invokeWithRetry(fnName, payload).then(r => r.data || {}),
    enabled,
    ...(staleTime !== undefined ? { staleTime } : {}),
    select,
  });

  return {
    data: result.data ?? null,
    loading: result.isLoading,
    error: result.error,
    refetch: result.refetch,
    isFetching: result.isFetching,
  };
}

/**
 * Imperatively invalidate a cached page so the next mount re-fetches.
 * Call after mutations that change the data a page depends on.
 *
 * Usage (inside a component):
 *   const invalidate = useInvalidatePageData();
 *   await invalidate('getMyOrdersPageData');
 */
export function useInvalidatePageData() {
  const qc = useQueryClient();
  return (fnName) => qc.invalidateQueries({ queryKey: [fnName] });
}