import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Returns minimal public display info (email, full_name, avatar_url) for all
 * users belonging to the same tenant as the authenticated caller.
 * Safe for use in UI components that need avatar / name display.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const userRecords = await base44.asServiceRole.entities.User.filter({ email: user.email });
    if (!userRecords || userRecords.length === 0) {
      return Response.json({ error: 'User record not found' }, { status: 404 });
    }

    const tenantId = userRecords[0].tenant_id;
    const isPlatformAdmin = user.role === 'platform_admin';

    if (!tenantId && !isPlatformAdmin) {
      return Response.json({ error: 'User has no tenant assigned' }, { status: 403 });
    }

    const filter = isPlatformAdmin ? {} : { tenant_id: tenantId };
    const [allUsers, allPrefs] = await Promise.all([
      base44.asServiceRole.entities.User.filter(filter),
      base44.asServiceRole.entities.UserPreference.filter(tenantId ? { tenant_id: tenantId } : {}),
    ]);

    // Build a map from email -> pref
    const prefMap = {};
    (allPrefs || []).forEach(p => { prefMap[p.user_email] = p; });

    const isAdminCaller = user.role === 'admin' || user.role === 'platform_admin';

    // Return only safe public display fields — never full user records
    const publicUsers = (allUsers || []).map(u => {
      const pref = prefMap[u.email] || {};
      const contactPublic = pref.contact_public !== false; // default true
      return {
        email: u.email,
        full_name: u.full_name || '',
        display_name: u.display_name || '',
        avatar_url: u.avatar_url || '',
        // contact_info: only expose if public OR caller is admin
        contact_info: (contactPublic || isAdminCaller) ? (pref.contact_info || '') : '',
        contact_public: contactPublic,
      };
    });

    return Response.json({ users: publicUsers });
  } catch (error) {
    console.error('getTenantUsers error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});