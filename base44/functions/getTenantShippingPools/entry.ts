import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

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
 * Fetch shipping pools for the current tenant with proper isolation.
 * Users see only their own and shared pools; staff/admin see all in tenant.
 * Platform admins can see all pools.
 */
Deno.serve(async (req) => {
  const t0 = Date.now();
  try {
    const base44 = createClientFromRequest(req);

    const emailHint = extractEmailFromJwt(req);
    const [user, earlyUserRecords] = await Promise.all([
      base44.auth.me(),
      emailHint
        ? base44.asServiceRole.entities.User.filter({ email: emailHint })
        : Promise.resolve(null),
    ]);
    console.log(`[TIMING] getTenantShippingPools | auth.me + User.filter (parallel): ${Date.now()-t0}ms`);

    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const userRecords = earlyUserRecords ?? await base44.asServiceRole.entities.User.filter({ email: user.email });

    if (!userRecords || userRecords.length === 0) {
      return Response.json({ error: 'User record not found' }, { status: 404 });
    }

    const tenantId = userRecords[0].tenant_id;

    const t3 = Date.now();
    if (user.role === 'platform_admin') {
      const allPools = await base44.asServiceRole.entities.ShippingPool.list();
      console.log(`[TIMING] getTenantShippingPools | ShippingPool.list (platform_admin): ${Date.now()-t3}ms | count: ${allPools?.length}`);
      console.log(`[TIMING] getTenantShippingPools | TOTAL: ${Date.now()-t0}ms`);
      return Response.json({ pools: allPools || [] });
    }

    if (!tenantId) {
      console.log(`[TIMING] getTenantShippingPools | TOTAL: ${Date.now()-t0}ms | no tenant`);
      return Response.json({ pools: [] });
    }

    const tenantPools = await base44.asServiceRole.entities.ShippingPool.filter({ tenant_id: tenantId });
    console.log(`[TIMING] getTenantShippingPools | ShippingPool.filter (tenant): ${Date.now()-t3}ms | count: ${tenantPools?.length}`);

    const accessiblePools = (tenantPools || []).filter(pool => {
      // Staff, admin, tenant_admin see all pools in the tenant
      if (user.role !== 'user') return true;
      // Owner always sees their own pool
      if (pool.creator_email === user.email) return true;
      // Private pool: only visible to owner (above) and explicitly shared users
      if (pool.is_private) return (pool.shared_with_emails || []).includes(user.email);
      // Non-private pools are visible to all users in the tenant
      return true;
    });

    console.log(`[TIMING] getTenantShippingPools | TOTAL: ${Date.now()-t0}ms | accessible: ${accessiblePools.length}`);
    return Response.json({ pools: accessiblePools });

  } catch (error) {
    console.error(`[TIMING] getTenantShippingPools | TOTAL (error): ${Date.now()-t0}ms`);
    console.error('getTenantShippingPools error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});