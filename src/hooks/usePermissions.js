/**
 * usePermissions — granular permission checker
 *
 * Permissions are loaded at app boot via getMyStatus (AuthContext).
 * They reflect: base role direct_permissions + user-level permission_overrides.
 * Calculated in backend (functions/getMyStatus.js).
 *
 * For admins (platform_admin, tenant_admin, staff), all checks return true.
 * Regular users ('user' role) go through granular permission checks.
 *
 * TODO: Add permission checks to:
 * - SubmitOrder: order:submit_purchase_request
 * - ShippingPool/MyOrders: shipping:notify_shipment
 * - OrderMessageThread: message:send_message
 * - UserPreferences: profile:change_avatar, profile:change_auto_archive_settings
 */
import { useAuth } from '@/lib/AuthContext';

export function usePermissions() {
  const { user, permissions } = useAuth();

  // Admins always have full access
  const isAdmin = user?.role === 'platform_admin' ||
    user?.role === 'admin' ||
    user?.role === 'tenant_admin' ||
    user?.role === 'staff';

  /**
   * Check if the user has a specific permission.
   * @param {string} permissionId  e.g. "user:edit_user_permissions"
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