import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Fetch tenant-specific settings
 * Each tenant can have isolated configuration
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
    
    let filter = {};
    // Platform admins can query any tenant (must specify tenant_id in query)
    if (user.role === 'platform_admin') {
      const query = new URL(req.url).searchParams;
      const queryTenantId = query.get('tenant_id');
      if (queryTenantId) filter.tenant_id = queryTenantId;
    } else {
      // Regular users/staff only see their own tenant settings
      if (!tenantId) {
        return Response.json({ error: 'User has no tenant assigned' }, { status: 403 });
      }
      filter.tenant_id = tenantId;
    }

    const settings = await base44.asServiceRole.entities.SiteSettings.filter(filter);

    // Convert to key-value map for easier access
    const settingsMap = {};
    (settings || []).forEach(s => {
      settingsMap[s.key] = s.value;
    });

    return Response.json({ 
      settings: settingsMap,
      raw: settings || []
    });

  } catch (error) {
    console.error('getTenantSettings error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});