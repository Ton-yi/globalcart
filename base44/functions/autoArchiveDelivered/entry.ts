/**
 * autoArchiveDelivered
 * Scheduled function: archives delivered orders and shipping pools.
 * Global tenant setting `auto_archive_delivered_days` (SiteSettings) takes priority.
 * Falls back to per-user UserPreference.auto_archive_order_days / auto_archive_pool_days.
 * Runs daily. Admin-only callable (for manual trigger); scheduled runs use service role.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

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
    // key: tenant_id → global archive days (or null if not set)
    const allSiteSettings = await base44.asServiceRole.entities.SiteSettings.filter({
      key: 'auto_archive_delivered_days',
    });
    const tenantGlobalDays = {};
    for (const s of allSiteSettings) {
      if (s.tenant_id) {
        const v = parseInt(s.value);
        tenantGlobalDays[s.tenant_id] = isNaN(v) ? null : v;
      }
    }

    // ── Fetch per-user preferences as fallback ───────────────────────────────
    const allPrefs = await base44.asServiceRole.entities.UserPreference.list();
    const prefMap = {};
    for (const pref of allPrefs) {
      if (pref.user_email) {
        prefMap[pref.user_email] = {
          orderDays: pref.auto_archive_order_days !== undefined ? Number(pref.auto_archive_order_days) : 7,
          poolDays: pref.auto_archive_pool_days !== undefined ? Number(pref.auto_archive_pool_days) : 7,
        };
      }
    }

    // Helper: resolve archive days for an order/pool
    const resolveOrderDays = (tenantId, userEmail) => {
      const global = tenantId ? tenantGlobalDays[tenantId] : null;
      if (global !== null && global !== undefined) return global;
      return prefMap[userEmail]?.orderDays ?? 3; // default 3 days
    };
    const resolvePoolDays = (tenantId, creatorEmail) => {
      const global = tenantId ? tenantGlobalDays[tenantId] : null;
      if (global !== null && global !== undefined) return global;
      return prefMap[creatorEmail]?.poolDays ?? 3; // default 3 days
    };

    // ── Archive delivered orders ──────────────────────────────────────────────
    const deliveredOrders = await base44.asServiceRole.entities.Order.filter({
      order_status: 'delivered',
      is_archived: false,
    });

    let archivedOrders = 0;
    for (const order of deliveredOrders) {
      const archiveDays = resolveOrderDays(order.tenant_id, order.user_email);

      // archiveDays === 0 → archive immediately (same day)
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
    const deliveredPools = await base44.asServiceRole.entities.ShippingPool.filter({
      status: 'delivered',
      is_archived: false,
    });

    let archivedPools = 0;
    for (const pool of deliveredPools) {
      const archiveDays = resolvePoolDays(pool.tenant_id, pool.creator_email);

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