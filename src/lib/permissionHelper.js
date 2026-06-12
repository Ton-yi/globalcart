/**
 * 权限检查助手库
 * 用于前端获取和缓存用户权限
 */

import { base44 } from '@/api/base44Client';

let permissionCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

/**
 * 获取当前用户的有效权限列表（支持多角色，采取允许覆盖策略）
 */
export async function getUserPermissions(forceRefresh = false) {
  const now = Date.now();

  // 如果缓存有效且未强制刷新，返回缓存
  if (!forceRefresh && permissionCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION) {
    return permissionCache;
  }

  try {
    const user = await base44.auth.me();
    if (!user || !user.roles || user.roles.length === 0) {
      permissionCache = [];
      cacheTimestamp = now;
      return [];
    }

    // 获取用户所有角色的有效权限（采取允许覆盖策略：合并所有权限）
    const allPermissions = new Set();

    for (const role of user.roles) {
      try {
        const res = await base44.functions.invoke('manageRoles', {
          action: 'getRoleWithEffectivePermissions',
          data: { role_name: role }
        });

        if (res.data.effective_permissions) {
          res.data.effective_permissions.forEach(p => allPermissions.add(p));
        }
      } catch (err) {
        console.warn(`Failed to load permissions for role ${role}`, err);
      }
    }

    permissionCache = Array.from(allPermissions);
    cacheTimestamp = now;
    return permissionCache;
  } catch (err) {
    console.error('Failed to load user permissions', err);
    return [];
  }
}

/**
 * 检查用户是否拥有指定权限
 */
export async function hasPermission(permissionId) {
  const permissions = await getUserPermissions();
  // 阻断标签优先级最高：拥有 block_<permission> 则强制禁止
  if (permissions.includes(`block_${permissionId}`)) return false;
  return permissions.includes(permissionId);
}

/**
 * 检查用户是否被阻断标签强制禁止指定权限
 */
export async function isPermissionBlocked(permissionId) {
  const permissions = await getUserPermissions();
  return permissions.includes(`block_${permissionId}`);
}

/**
 * 检查用户是否拥有指定权限中的任意一个
 */
export async function hasAnyPermission(permissionIds) {
  const permissions = await getUserPermissions();
  return permissionIds.some(p => !permissions.includes(`block_${p}`) && permissions.includes(p));
}

/**
 * 检查用户是否拥有指定权限中的全部
 */
export async function hasAllPermissions(permissionIds) {
  const permissions = await getUserPermissions();
  return permissionIds.every(p => !permissions.includes(`block_${p}`) && permissions.includes(p));
}

/**
 * 清除权限缓存（在用户权限更新后调用）
 */
export function clearPermissionCache() {
  permissionCache = null;
  cacheTimestamp = null;
}