import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Extract email claim from a JWT Bearer token without verification.
 * Used only to fire User.filter in parallel with auth.me().
 * auth.me() is still the authoritative auth check.
 */
function extractEmailFromJwt(req) {
  try {
    const auth = req.headers.get('authorization') || '';
    const token = auth.replace(/^Bearer\s+/i, '');
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload?.email || payload?.sub || null;
  } catch {
    return null;
  }
}

/**
 * Fetch orders for the current tenant with proper isolation.
 * Body/query: { all: bool } — admins/staff may request all tenant orders.
 * Users always see only their own. Platform admins see everything.
 */
Deno.serve(async (req) => {
  const t0 = Date.now();
  try {
    const base44 = createClientFromRequest(req);

    // Fire auth.me() and User.filter() in parallel using JWT email claim
    const emailHint = extractEmailFromJwt(req);
    const [user, earlyUserRecords] = await Promise.all([
      base44.auth.me(),
      emailHint
        ? base44.asServiceRole.entities.User.filter({ email: emailHint })
        : Promise.resolve(null),
    ]);
    console.log(`[TIMING] getTenantOrders | auth.me + User.filter (parallel): ${Date.now()-t0}ms`);

    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Use parallel result; fall back to sequential if email hint was unavailable
    const userRecords = earlyUserRecords ?? await base44.asServiceRole.entities.User.filter({ email: user.email });

    if (!userRecords || userRecords.length === 0) {
      return Response.json({ error: 'User record not found' }, { status: 404 });
    }

    let body = {};
    try { body = await req.json(); } catch { /* GET with no body */ }

    const tenantId = userRecords[0].tenant_id;
    const isPlatformAdmin = user.role === 'platform_admin';
    const isTenantAdmin = user.role === 'admin' || user.role === 'tenant_admin';
    const isStaff = user.role === 'staff';
    const canSeeAll = isPlatformAdmin || isTenantAdmin || isStaff;

    const t3 = Date.now();
    let orders;
    if (isPlatformAdmin) {
      orders = await base44.asServiceRole.entities.Order.list('-updated_date', 50);
      console.log(`[TIMING] getTenantOrders | Order.list (platform_admin): ${Date.now()-t3}ms`);
      console.log(`[TIMING] getTenantOrders | TOTAL: ${Date.now()-t0}ms | count: ${orders?.length}`);
      return Response.json({ orders: orders || [] });
    }

    if (!tenantId) {
      if (isTenantAdmin || isStaff) {
        console.warn(`getTenantOrders: ${user.role} ${user.email} has no tenant_id — returning empty orders.`);
      }
      console.log(`[TIMING] getTenantOrders | TOTAL: ${Date.now()-t0}ms | no tenant`);
      return Response.json({ orders: [] });
    }

    // If a pool_id is supplied, load only the orders in that pool (if the user has access to it).
    // This allows non-admin users to see all orders inside a shipping pool they are a participant of
    // or have been shared access to — privacy masking is handled client-side.
    if (!canSeeAll && body.pool_id) {
      const pools = await base44.asServiceRole.entities.ShippingPool.filter({ tenant_id: tenantId });
      const pool = pools.find(p => p.id === body.pool_id);
      // User must be a participant (has their own order in it), the creator, or it's shared with them
      const isParticipant = pool && (
        pool.creator_email === user.email ||
        (pool.shared_with_emails || []).includes(user.email) ||
        !pool.is_private
      );
      if (pool && isParticipant) {
        const poolOrderIds = pool.order_ids || [];
        if (poolOrderIds.length === 0) {
          return Response.json({ orders: [] });
        }
        // Fetch all tenant orders and filter to those in the pool
        const allTenantOrders = await base44.asServiceRole.entities.Order.filter({ tenant_id: tenantId }, '-updated_date', 50);
        const poolOrders = allTenantOrders.filter(o => poolOrderIds.includes(o.id));
        console.log(`[TIMING] getTenantOrders | pool_id scoped fetch: ${Date.now()-t3}ms | count: ${poolOrders.length}`);
        return Response.json({ orders: poolOrders });
      }
      // Fall through to own-orders-only filter if pool not found or no access
    }

    let filter = { tenant_id: tenantId };
    if (!canSeeAll) {
      filter.user_email = user.email;
    }

    orders = await base44.asServiceRole.entities.Order.filter(filter, '-updated_date', 50);
    console.log(`[TIMING] getTenantOrders | Order.filter (tenant): ${Date.now()-t3}ms | count: ${orders?.length} | all: ${!!body.all}`);
    console.log(`[TIMING] getTenantOrders | TOTAL: ${Date.now()-t0}ms`);
    return Response.json({ orders: orders || [] });

  } catch (error) {
    console.error(`[TIMING] getTenantOrders | TOTAL (error): ${Date.now()-t0}ms`);
    console.error('getTenantOrders error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});