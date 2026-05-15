/**
 * 权限检查助手库 — 已弃用
 * 
 * 当前权限系统已精简：核心权限由 getMyStatus 通过 assigned_role_ids + permission_overrides 计算
 * 用户角色权限通过 manageRoles 后端函数管理，前端通过 usePermissions() hook 访问
 * 
 * 本文件仅作备份，实际权限检查在 hooks/usePermissions.js 中进行
 */

// 已弃用 - 保留以兼容旧代码
export async function getUserPermissions(forceRefresh = false) {
  console.warn('getUserPermissions is deprecated. Use usePermissions() hook instead.');
  return [];
}

/**
 * 检查用户是否拥有指定权限
 */
export async function hasPermission(permissionId) {
  const permissions = await getUserPermissions();
  return permissions.includes(permissionId);
}

/**
 * 检查用户是否拥有指定权限中的任意一个
 */
export async function hasAnyPermission(permissionIds) {
  const permissions = await getUserPermissions();
  return permissionIds.some(p => permissions.includes(p));
}

/**
 * 检查用户是否拥有指定权限中的全部
 */
export async function hasAllPermissions(permissionIds) {
  const permissions = await getUserPermissions();
  return permissionIds.every(p => permissions.includes(p));
}

/**
 * 清除权限缓存（已弃用）
 */
export function clearPermissionCache() {
  console.warn('clearPermissionCache is deprecated.');
}