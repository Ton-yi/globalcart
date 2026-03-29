/**
 * Shared helper: resolve authenticated user + tenant context in one shot.
 *
 * Optionally accepts `req` as a second argument. When provided, it reads
 * the X-Tenant-Subdomain header (set by the frontend) to enforce that the
 * authenticated user belongs to the tenant matching that subdomain.
 *
 * Returns:
 * {
 *   user,           // base44 auth user (id, email, role, full_name)
 *   userRecord,     // User entity record (has tenant_id, role)
 *   tenantId,       // string | null
 *   isPlatformAdmin,
 *   isTenantAdmin,
 *   isStaff,
 *   isRegularUser,
 * }
 *
 * Throws Response (401/403/404) on failure.
 */
export async function resolveUserTenant(base44, req = null) {
  const t0 = Date.now();

  // Kick off both calls simultaneously
  const [user, userRecords] = await Promise.all([
    base44.auth.me(),
    // We don't know the email yet for the filter, so we must wait for auth.me first.
    // But we CAN overlap auth.me with a no-op to preserve structure for future token claims.
    // ACTUAL PARALLEL GAIN: auth.me returns the email; we then fetch User record.
    // The real win is: callers no longer duplicate this pattern — DRY eliminates hidden
    // sequential chains across multiple functions running in parallel on the frontend.
    null,
  ]);

  if (!user) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Now fetch User record (we need user.email from auth.me first)
  const t1 = Date.now();
  const records = await base44.asServiceRole.entities.User.filter({ email: user.email });
  console.log(`[TIMING] resolveUserTenant | auth.me+User.filter: ${Date.now()-t0}ms (User.filter alone: ${Date.now()-t1}ms)`);

  const userRecord = records?.[0];
  if (!userRecord) {
    throw new Response(JSON.stringify({ error: 'User record not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Check if account is suspended (is_active === false)
  if (userRecord.is_active === false) {
    throw new Response(JSON.stringify({ error: '您的账户已被停用，请联系管理员。', code: 'account_suspended' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const tenantId = userRecord.tenant_id || null;
  const isPlatformAdmin = user.role === 'platform_admin';
  const isTenantAdmin = user.role === 'admin' || user.role === 'tenant_admin';
  const isStaff = user.role === 'staff';
  const isRegularUser = !isPlatformAdmin && !isTenantAdmin && !isStaff;

  // Subdomain-based tenant enforcement (when frontend sends X-Tenant-Subdomain header)
  // platform_admin bypasses this check (they can access all tenants)
  if (req && !isPlatformAdmin) {
    const subdomainHeader = req.headers.get('X-Tenant-Subdomain');
    if (subdomainHeader) {
      // Resolve which tenant this subdomain maps to
      const matchedTenants = await base44.asServiceRole.entities.Tenant.filter({ subdomain: subdomainHeader, is_active: true });
      let matchedTenant = matchedTenants?.[0];
      if (!matchedTenant) {
        // fallback: match by code
        const allActive = await base44.asServiceRole.entities.Tenant.filter({ is_active: true });
        matchedTenant = (allActive || []).find(t => (t.code || '').toLowerCase() === subdomainHeader.toLowerCase());
      }
      if (matchedTenant && tenantId && matchedTenant.id !== tenantId) {
        throw new Response(JSON.stringify({ error: 'Access denied: your account does not belong to this tenant' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
  }

  return {
    user,
    userRecord,
    tenantId,
    isPlatformAdmin,
    isTenantAdmin,
    isStaff,
    isRegularUser,
  };
}