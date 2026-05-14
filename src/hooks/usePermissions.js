/**
 * usePermissions — returns the current user's effective granular permissions
 * and helper functions to check them.
 *
 * Permissions are loaded once at app boot via getMyStatus and stored in AuthContext.
 * They reflect: base role direct_permissions + user-level permission_overrides.
 *
 * For platform_admin / tenant_admin users, all permission checks return true
 * (admins bypass granular checks).
 */
import { useAuth } from '@/lib/AuthContext';

export function usePermissions() {
  const { user, permissions } = useAuth();

  // Admins always have full access — no need to check granular perms
  const isAdmin = user?.role === 'platform_admin' ||
    user?.role === 'admin' ||
    user?.role === 'tenant_admin';

  /**
   * Check if the user has a specific permission.
   * @param {string} permissionId  e.g. "order:update"
   */
  const can = (permissionId) => {
    if (isAdmin) return true;
    return permissions.includes(permissionId);
  };

  /**
   * Check if the user has ANY of the given permissions.
   * @param {string[]} permissionIds
   */
  const canAny = (permissionIds) => {
    if (isAdmin) return true;
    return permissionIds.some(p => permissions.includes(p));
  };

  return { can, canAny, permissions, isAdmin };
}