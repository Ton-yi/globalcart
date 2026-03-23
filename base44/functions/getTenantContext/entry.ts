import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Helper function to get the tenant context from the authenticated user
 * Always derive tenant_id from the authenticated session, never from client request
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is platform admin (can access all tenants)
    if (user.role === 'platform_admin') {
      return Response.json({
        user,
        tenant_id: null, // platform admins can see all tenants
        is_platform_admin: true,
        can_manage: true
      });
    }

    // For other users, fetch their tenant_id from User entity
    const userRecord = await base44.asServiceRole.entities.User.filter({ email: user.email });
    if (!userRecord || userRecord.length === 0) {
      return Response.json({ error: 'User record not found' }, { status: 404 });
    }

    const tenantId = userRecord[0].tenant_id;
    if (!tenantId) {
      return Response.json({ error: 'User has no tenant assigned' }, { status: 403 });
    }

    // Fetch tenant info
    const tenant = await base44.asServiceRole.entities.Tenant.filter({ id: tenantId });
    if (!tenant || tenant.length === 0 || !tenant[0].is_active) {
      return Response.json({ error: 'Tenant not found or inactive' }, { status: 403 });
    }

    const can_manage = ['platform_admin', 'tenant_admin'].includes(user.role);

    return Response.json({
      user: { ...user, tenant_id: tenantId },
      tenant_id: tenantId,
      tenant: tenant[0],
      is_platform_admin: false,
      can_manage,
      user_role: user.role
    });

  } catch (error) {
    console.error('getTenantContext error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});