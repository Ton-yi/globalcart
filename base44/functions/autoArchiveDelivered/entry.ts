/**
 * autoArchiveDelivered
 * Scheduled function: archives delivered orders and shipping pools.
 *
 * Priority logic:
 *   1. Global tenant setting `auto_archive_delivered_days` (SiteSettings) — if set, overrides everything.
 *      0 = archive immediately on same day as delivered.
 *   2. Per-user UserPreference.auto_archive_order_days / auto_archive_pool_days — as fallback.
 *      Per-user: 0 = opt-out (do NOT archive automatically). >0 = archive after N days.
 *
 * Runs daily. Admin-only callable (for manual trigger); scheduled runs use service role.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const PAGE_SIZE = 200; // pagination guard for large datasets

async function fetchAllPages(entityFilter, filterQuery) {
  const results = [];
  let skip = 0;
  while (true) {
    const page = await entityFilter(filterQuery, '-created_date', PAGE_SIZE, skip);
    if (!page || page.length === 0) break;
    results.push(...page);
    if (page.length < PAGE_SIZE) break;
    skip += PAGE_SIZE;
  }
  return results;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow both scheduled (no auth) and manual admin trigger
    try {
      const user = await base44.auth.me();
      if (user && user.role !== 'admin' && user.role !== 'tenant_admin' && user.role !== 'platform_admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    } catch {
      // No auth = scheduled context, proceed with service role
    }

    const now = new Date();

    // ── Fetch all tenant-level global archive settings ──────────────────────
    // SiteSettings key=auto_archive_delivered_days, value=number string
    // Semantics: 0 = archive immediately, >0 = archive after N days, absent = use per-user prefs
    const allSiteSettings = await base44.asServiceRole.entities.SiteSettings.filter({
      key: 'auto_archive_delivered_days',
    });
    // tenantGlobalDays[tid] = number | null (null = not configured for this tenant)
    const tenantGlobalDays = {};
    for (const s of allSiteSettings) {
      if (s.tenant_id) {
        const v = parseInt(s.value);
        tenantGlobalDays[s.tenant_id] = isNaN(v) ? null : Math.max(0, v);
      }
    }

    // ── Fetch per-user preferences as fallback ───────────────────────────────
    // Per-user semantics: 0 = opt-out (do NOT auto archive), >0 = archive after N days
    // Default is 7 days per entity schema.
    let allPrefs = [];
    let prefSkip = 0;
    while (true) {
      const page = await base44.asServiceRole.entities.UserPreference.list('-created_date', PAGE_SIZE, prefSkip);
      if (!page || page.length === 0) break;
      allPrefs.push(...page);
      if (page.length < PAGE_SIZE) break;
      prefSkip += PAGE_SIZE;
    }

    const prefMap = {};
    for (const pref of allPrefs) {
      if (pref.user_email) {
        prefMap[pref.user_email] = {
          orderDays: pref.auto_archive_order_days !== undefined ? Number(pref.auto_archive_order_days) : 7,
          poolDays: pref.auto_archive_pool_days !== undefined ? Number(pref.auto_archive_pool_days) : 7,
        };
      }
    }

    /**
     * Resolve how many days to wait before archiving.
     * Returns:
     *   null  → do NOT archive (user opted out)
     *   0     → archive immediately
     *   N>0   → archive after N days
     */
    const resolveArchiveDays = (tenantId, userEmail, type) => {
      // Global tenant setting overrides per-user prefs
      const globalDays = tenantId ? tenantGlobalDays[tenantId] : null;
      if (globalDays !== null && globalDays !== undefined) {
        // Global set: use it. 0 = immediately. No opt-out at global level.
        return globalDays;
      }
      // Fall back to per-user preference
      const prefs = prefMap[userEmail];
      const days = type === 'pool'
        ? (prefs?.poolDays ?? 7)
        : (prefs?.orderDays ?? 7);
      // Per-user: 0 means opt-out → return null
      if (days === 0) return null;
      return days;
    };

    // ── Archive delivered orders ──────────────────────────────────────────────
    let deliveredOrders = [];
    let orderSkip = 0;
    while (true) {
      const page = await base44.asServiceRole.entities.Order.filter(
        { order_status: 'delivered', is_archived: false },
        '-created_date', PAGE_SIZE, orderSkip
      );
      if (!page || page.length === 0) break;
      deliveredOrders.push(...page);
      if (page.length < PAGE_SIZE) break;
      orderSkip += PAGE_SIZE;
    }

    let archivedOrders = 0;
    for (const order of deliveredOrders) {
      const archiveDays = resolveArchiveDays(order.tenant_id, order.user_email, 'order');
      if (archiveDays === null) continue; // user opted out

      // Use shipped_date as delivery proxy; fall back to updated_date / created_date
      const deliveredDate = order.shipped_date
        ? new Date(order.shipped_date)
        : new Date(order.updated_date || order.created_date);

      const daysSince = (now - deliveredDate) / (1000 * 60 * 60 * 24);

      if (daysSince >= archiveDays) {
        await base44.asServiceRole.entities.Order.update(order.id, {
          is_archived: true,
          archived_at: now.toISOString(),
        });
        archivedOrders++;
      }
    }

    // ── Archive delivered shipping pools ──────────────────────────────────────
    let deliveredPools = [];
    let poolSkip = 0;
    while (true) {
      const page = await base44.asServiceRole.entities.ShippingPool.filter(
        { status: 'delivered', is_archived: false },
        '-created_date', PAGE_SIZE, poolSkip
      );
      if (!page || page.length === 0) break;
      deliveredPools.push(...page);
      if (page.length < PAGE_SIZE) break;
      poolSkip += PAGE_SIZE;
    }

    let archivedPools = 0;
    for (const pool of deliveredPools) {
      const archiveDays = resolveArchiveDays(pool.tenant_id, pool.creator_email, 'pool');
      if (archiveDays === null) continue; // user opted out

      const deliveredDate = pool.shipped_date
        ? new Date(pool.shipped_date)
        : new Date(pool.updated_date || pool.created_date);

      const daysSince = (now - deliveredDate) / (1000 * 60 * 60 * 24);

      if (daysSince >= archiveDays) {
        await base44.asServiceRole.entities.ShippingPool.update(pool.id, {
          is_archived: true,
          archived_at: now.toISOString(),
        });
        archivedPools++;
      }
    }

    return Response.json({
      success: true,
      archivedOrders,
      archivedPools,
      processedAt: now.toISOString(),
    });
  } catch (error) {
    console.error('autoArchiveDelivered error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});