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
    // 阻断标签优先级最高：拥有 block_<permission> 则强制禁止，覆盖任何允许项
    if (permissions.includes(`block_${permissionId}`)) return false;
    return permissions.includes(permissionId);
  };

  /**
   * Check if the user is explicitly blocked from a permission (block tag).
   * @param {string} permissionId  e.g. "order:submit_purchase_request"
   */
  const blocked = (permissionId) => {
    if (isAdmin) return false;
    return permissions.includes(`block_${permissionId}`);
  };

  /**
   * Check if the user has ANY of the given permissions.
   * @param {string[]} permissionIds
   */
  const canAny = (permissionIds) => {
    if (isAdmin) return true;
    return permissionIds.some(p => can(p));
  };

  return { can, canAny, blocked, permissions, isAdmin };
}