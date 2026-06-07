/**
 * Tenant-safe API helpers
 * All data access for tenant-owned entities goes through here.
 * Never trust tenant_id from client — backend functions derive it from session.
 */
import { base44 } from '@/api/base44Client';
import { getTenantConfigCache, setTenantConfigCache } from '@/lib/configCache';
import { invokeWithRetry } from '@/lib/apiUtils';

// ─── Orders ──────────────────────────────────────────────────────────────────

export async function fetchMyOrders() {
  const res = await invokeWithRetry('getTenantOrders', {});
  return res.data?.orders || [];
}

export async function fetchAllOrders() {
  const res = await invokeWithRetry('getTenantOrders', { all: true });
  return res.data?.orders || [];
}

export async function createOrder(data) {
  const res = await invokeWithRetry('createTenantOrder', data);
  return res.data?.order;
}

export async function updateOrder(order_id, data) {
  const res = await invokeWithRetry('updateTenantOrder', { order_id, ...data });
  return res.data?.order;
}

// ─── Shipping Pools ───────────────────────────────────────────────────────────

export async function fetchShippingPools() {
  const res = await invokeWithRetry('getTenantShippingPools', {});
  return res.data?.pools || [];
}

// ─── Config Data (templates, rules, methods, locations, addons) ───────────────

export async function fetchTenantConfig({ force = false } = {}) {
  if (!force) {
    const cached = getTenantConfigCache();
    if (cached) return cached;
  }
  const res = await invokeWithRetry('getTenantConfigData', {});
  const data = res.data || {};
  setTenantConfigCache(data);
  return data;
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export async function fetchTenantSettings() {
  const res = await invokeWithRetry('getTenantSettings', {});
  return res.data?.settings || {};
}

// ─── Announcements ────────────────────────────────────────────────────────────

export async function fetchAnnouncements() {
  const config = await fetchTenantConfig();
  return (config.announcements || []).filter(a => a.is_active);
}

// ─── Generic tenant-safe entity mutations ─────────────────────────────────────

async function mutate(entity, action, opts = {}) {
  const res = await invokeWithRetry('mutateTenantEntity', { entity, action, ...opts });
  if (res.data?.error) throw new Error(res.data.error);
  return res.data;
}

export const tenantEntity = {
  list:   (entity, filter = {}) => mutate(entity, 'list', { filter }).then(r => r.results || []),
  create: (entity, data)        => mutate(entity, 'create', { data }).then(r => r.result),
  update: (entity, id, data)    => mutate(entity, 'update', { id, data }).then(r => r.result),
  delete: (entity, id)          => mutate(entity, 'delete', { id }),
};

// ─── ShippingPool shortcuts ───────────────────────────────────────────────────

export const shippingPoolApi = {
  list:   (filter) => tenantEntity.list('ShippingPool', filter),
  create: (data)   => tenantEntity.create('ShippingPool', data),
  update: (id, d)  => tenantEntity.update('ShippingPool', id, d),
  delete: (id)     => tenantEntity.delete('ShippingPool', id),
};

// ─── UserPreference shortcuts ─────────────────────────────────────────────────

export const userPrefApi = {
  list:   (filter) => tenantEntity.list('UserPreference', filter),
  create: (data)   => tenantEntity.create('UserPreference', data),
  update: (id, d)  => tenantEntity.update('UserPreference', id, d),
  delete: (id)     => tenantEntity.delete('UserPreference', id),
};

// ─── Page-level aggregated APIs ───────────────────────────────────────────────

export async function fetchMyOrdersPageData() {
  const res = await invokeWithRetry('getMyOrdersPageData', {});
  return res.data || { orders: [], pools: [], storeTagRules: [] };
}

export async function fetchAdminShippingPoolPageData() {
  const res = await invokeWithRetry('getAdminShippingPoolPageData', {});
  return res.data || { pools: [], locations: [], users: [], transitMethods: [], addonOptions: [] };
}

export async function fetchSubmitOrderPageData() {
  const res = await invokeWithRetry('getSubmitOrderPageData', {});
  return res.data || { addons: [], settings: {}, rates: null };
}