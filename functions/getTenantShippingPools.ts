import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Fetch shipping pools for the current tenant with proper isolation
 * Users see only their own and shared pools; staff/admin see all in tenant
 * Platform admins can see all pools
 */
Deno.serve(async (req) => {
  const t0 = Date.now();
  try {
    const base44 = createClientFromRequest(req);

    const t1 = Date.now();
    const user = await base44.auth.me();
    console.log(`[TIMING] getTenantShippingPools | auth.me: ${Date.now()-t1}ms`);
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const t2 = Date.now();
    const userRecord = await base44.asServiceRole.entities.User.filter({ email: user.email });
    console.log(`[TIMING] getTenantShippingPools | User.filter (tenant lookup): ${Date.now()-t2}ms`);

    if (!userRecord || userRecord.length === 0) {
      return Response.json({ error: 'User record not found' }, { status: 404 });
    }

    const tenantId = userRecord[0].tenant_id;
    
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
      if (user.role !== 'user') return true;
      if (pool.creator_email === user.email) return true;
      if (pool.is_admin_created && !pool.is_private) return true;
      if (pool.is_private && pool.shared_with_emails && pool.shared_with_emails.includes(user.email)) return true;
      return false;
    });

    console.log(`[TIMING] getTenantShippingPools | TOTAL: ${Date.now()-t0}ms | accessible: ${accessiblePools.length}`);
    return Response.json({ pools: accessiblePools });

  } catch (error) {
    console.error(`[TIMING] getTenantShippingPools | TOTAL (error): ${Date.now()-t0}ms`);
    console.error('getTenantShippingPools error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});