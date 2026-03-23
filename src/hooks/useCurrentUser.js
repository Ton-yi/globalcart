/**
 * useCurrentUser — returns the authenticated user from AuthContext.
 * Avoids redundant base44.auth.me() calls on every page mount.
 * The user is already fetched once at app boot by AuthProvider.
 */
import { useAuth } from '@/lib/AuthContext';

export function useCurrentUser() {
  const { user, isLoadingAuth } = useAuth();
  return { user, loading: isLoadingAuth };
}