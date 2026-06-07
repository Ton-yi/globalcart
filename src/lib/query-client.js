import { QueryClient } from '@tanstack/react-query';

function retryDelay(attemptIndex) {
  // Exponential backoff: 1s, 2s, 4s — with jitter
  return Math.min(1000 * Math.pow(2, attemptIndex) + Math.random() * 300, 10000);
}

function shouldRetry(failureCount, error) {
  // Always retry 429 rate-limit errors up to 3 times
  const status = error?.response?.status || error?.status;
  const msg = error?.message || '';
  const isRateLimit = status === 429 || msg.includes('429') || msg.toLowerCase().includes('rate limit');
  if (isRateLimit) return failureCount < 3;
  // Default: retry once for other transient errors
  return failureCount < 1;
}

export const queryClientInstance = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: shouldRetry,
      retryDelay,
    },
    mutations: {
      retry: (failureCount, error) => {
        const status = error?.response?.status || error?.status;
        const isRateLimit = status === 429 || (error?.message || '').includes('429');
        return isRateLimit && failureCount < 2;
      },
      retryDelay,
    },
  },
});