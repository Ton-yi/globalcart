/**
 * Tenant-safe API helpers
 * All data access for tenant-owned entities goes through here.
 * Never trust tenant_id from client — backend functions derive it from session.
 */
import { base44 } from '@/api/base44Client';

// ─── Orders ──────────────────────────────────────────────────────────────────

export async function fetchMyOrders() {
  const res = await base44.functions.invoke('getTenantOrders', {});
  return res.data?.orders || [];
}

export async function fetchAllOrders() {
  // Admin-level: backend still enforces tenant isolation
  const res = await base44.functions.invoke('getTenantOrders', { all: true });
  return res.data?.orders || [];
}

export async function createOrder(data) {
  const res = await base44.functions.invoke('createTenantOrder', data);
  return res.data?.order;
}

export async function updateOrder(order_id, data) {
  const res = await base44.functions.invoke('updateTenantOrder', { order_id, ...data });
  return res.data?.order;
}

// ─── Shipping Pools ───────────────────────────────────────────────────────────

export async function fetchShippingPools() {
  const res = await base44.functions.invoke('getTenantShippingPools', {});
  return res.data?.pools || [];
}

// ─── Config Data (templates, rules, methods, locations, addons) ───────────────

export async function fetchTenantConfig() {
  const res = await base44.functions.invoke('getTenantConfigData', {});
  return res.data || {};
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export async function fetchTenantSettings() {
  const res = await base44.functions.invoke('getTenantSettings', {});
  return res.data?.settings || {};
}

// ─── Announcements ────────────────────────────────────────────────────────────

export async function fetchAnnouncements() {
  const res = await base44.functions.invoke('getTenantConfigData', {});
  return (res.data?.announcements || []).filter(a => a.is_active);
}

// ─── Convenience: order count query for order number generation ───────────────

export async function fetchOrderCountForPrefix(prefix) {
  // We need all orders to determine the next number. This uses the backend.
  const res = await base44.functions.invoke('getTenantOrders', { all: true });
  const orders = res.data?.orders || [];
  return orders.filter(o => (o.order_number || '').startsWith(prefix)).length;
}