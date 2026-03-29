/**
 * Hook to access the resolved tenant branding from AuthContext.
 * Returns { tenant, isResolved } where tenant may be null if
 * no subdomain matched.
 */
import { useAuth } from '@/lib/AuthContext';

export function useTenantBranding() {
  const { tenantBranding } = useAuth();
  return {
    tenant: tenantBranding?.tenant || null,
    isResolved: !!tenantBranding,
  };
}