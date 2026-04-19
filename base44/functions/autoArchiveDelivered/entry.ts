/**
 * autoArchiveDelivered
 * Scheduled function: archives delivered orders and shipping pools
 * based on each user's auto_archive_order_days / auto_archive_pool_days preference.
 * Runs daily. Admin-only callable (for manual trigger); scheduled runs use service role.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow both scheduled (no auth) and manual admin trigger
    let isScheduled = false;
    try {
      const user = await base44.auth.me();
      if (user && user.role !== 'admin' && user.role !== 'platform_admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    } catch {
      // No auth = scheduled context, proceed with service role
      isScheduled = true;
    }

    const now = new Date();

    // Fetch all UserPreferences to get per-user archive settings
    const allPrefs = await base44.asServiceRole.entities.UserPreference.list();

    // Build a map: user_email -> { auto_archive_order_days, auto_archive_pool_days }
    const prefMap = {};
    for (const pref of allPrefs) {
      if (pref.user_email) {
        prefMap[pref.user_email] = {
          orderDays: pref.auto_archive_order_days !== undefined ? Number(pref.auto_archive_order_days) : 7,
          poolDays: pref.auto_archive_pool_days !== undefined ? Number(pref.auto_archive_pool_days) : 7,
        };
      }
    }

    // Fetch all delivered, non-archived orders
    const deliveredOrders = await base44.asServiceRole.entities.Order.filter({
      order_status: 'delivered',
      is_archived: false,
    });

    let archivedOrders = 0;
    for (const order of deliveredOrders) {
      const email = order.user_email;
      const prefs = prefMap[email] || { orderDays: 7 };
      if (prefs.orderDays === 0) continue; // user opted out

      // Determine how long ago it was delivered
      // Use shipped_date or updated_date as approximation for delivery date
      const deliveredDate = order.shipped_date
        ? new Date(order.shipped_date)
        : new Date(order.updated_date || order.created_date);

      const daysSince = (now - deliveredDate) / (1000 * 60 * 60 * 24);
      if (daysSince >= prefs.orderDays) {
        await base44.asServiceRole.entities.Order.update(order.id, {
          is_archived: true,
          archived_at: now.toISOString(),
        });
        archivedOrders++;
      }
    }

    // Fetch all delivered, non-archived shipping pools
    const deliveredPools = await base44.asServiceRole.entities.ShippingPool.filter({
      status: 'delivered',
      is_archived: false,
    });

    let archivedPools = 0;
    for (const pool of deliveredPools) {
      const email = pool.creator_email;
      const prefs = prefMap[email] || { poolDays: 7 };
      if (prefs.poolDays === 0) continue;

      const deliveredDate = pool.shipped_date
        ? new Date(pool.shipped_date)
        : new Date(pool.updated_date || pool.created_date);

      const daysSince = (now - deliveredDate) / (1000 * 60 * 60 * 24);
      if (daysSince >= prefs.poolDays) {
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