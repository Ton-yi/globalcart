import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Fetch shipping pools for the current tenant with proper isolation
 * Users see only their own and shared pools; staff/admin see all in tenant
 * Platform admins can see all pools
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user record to find tenant_id
    const userRecord = await base44.asServiceRole.entities.User.filter({ email: user.email });
    if (!userRecord || userRecord.length === 0) {
      return Response.json({ error: 'User record not found' }, { status: 404 });
    }

    const tenantId = userRecord[0].tenant_id;
    
    // Platform admins can see all pools
    if (user.role === 'platform_admin') {
      const allPools = await base44.asServiceRole.entities.ShippingPool.list();
      return Response.json({ pools: allPools || [] });
    }

    // Non-platform users must have a tenant
    if (!tenantId) {
      return Response.json({ error: 'User has no tenant assigned' }, { status: 403 });
    }

    // Get all pools in tenant
    const tenantPools = await base44.asServiceRole.entities.ShippingPool.filter({ tenant_id: tenantId });

    // Filter based on visibility and role
    const accessiblePools = (tenantPools || []).filter(pool => {
      // Admins/staff see all pools in tenant
      if (user.role !== 'user') return true;
      
      // Users see:
      // 1. Their own pools
      if (pool.creator_email === user.email) return true;
      
      // 2. Admin-created pools (public)
      if (pool.is_admin_created && !pool.is_private) return true;
      
      // 3. Private pools shared with them
      if (pool.is_private && pool.shared_with_emails && pool.shared_with_emails.includes(user.email)) return true;
      
      return false;
    });

    return Response.json({ pools: accessiblePools });

  } catch (error) {
    console.error('getTenantShippingPools error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});