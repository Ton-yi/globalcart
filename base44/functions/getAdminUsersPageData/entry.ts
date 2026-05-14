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
 * Aggregated page-load API for AdminUsers.
 * Resolves user/tenant once, then fetches all required data in parallel:
 *   - users (non-admin list, tenant-scoped)
 *   - orders (for order count / paid amount stats)
 *   - tenants (for tenant name map)
 *   - diagnose data (missing-tenant users + tenant list)
 *
 * Permissions: platform_admin, admin, tenant_admin, staff only.
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
    console.log(`[TIMING] getAdminUsersPageData | auth.me + User.filter: ${Date.now() - t0}ms`);

    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const isPlatformAdmin = user.role === 'platform_admin';
    const isTenantAdmin = user.role === 'admin' || user.role === 'tenant_admin';
    const isStaff = user.role === 'staff';

    if (!isPlatformAdmin && !isTenantAdmin && !isStaff) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const userRecords = earlyUserRecords ?? await base44.asServiceRole.entities.User.filter({ email: user.email });
    if (!userRecords || userRecords.length === 0) {
      return Response.json({ error: 'User record not found' }, { status: 404 });
    }

    const callerRecord = userRecords[0];
    const tenantId = callerRecord.tenant_id || null;
    const userFilter = (isPlatformAdmin || !tenantId) ? {} : { tenant_id: tenantId };
    const orderFilter = (isPlatformAdmin || !tenantId) ? {} : { tenant_id: tenantId };

    const t1 = Date.now();
    const roleFilter = tenantId ? { tenant_id: tenantId, is_archived: false } : { is_archived: false };
    const [allUsers, allOrders, allTenants, tenantRolesRes] = await Promise.all([
      base44.asServiceRole.entities.User.filter(userFilter),
      base44.asServiceRole.entities.Order.filter(orderFilter),
      (isPlatformAdmin || isTenantAdmin) ? base44.asServiceRole.entities.Tenant.list() : Promise.resolve([]),
      (isPlatformAdmin || isTenantAdmin) ? base44.asServiceRole.entities.Role.filter(roleFilter) : Promise.resolve([]),
    ]);
    console.log(`[TIMING] getAdminUsersPageData | parallel fetches: ${Date.now() - t1}ms`);

    // Full user list (excluding caller's own record)
    const users = (allUsers || [])
      .filter(u => u.email !== user.email)
      .map(u => ({
        id: u.id, email: u.email, full_name: u.full_name || '',
        role: u.role || 'user', tenant_id: u.tenant_id || null,
        is_active: u.is_active !== false,
        created_date: u.created_date,
        // Credit & tier fields
        credit_enabled: u.credit_enabled || false,
        credit_limit_jpy: u.credit_limit_jpy || 0,
        credit_cycle: u.credit_cycle || null,
        credit_balance_jpy: u.credit_balance_jpy || 0,
        member_tier_id: u.member_tier_id || null,
        member_tier_name: u.member_tier_name || null,
        // Assigned role IDs
        assigned_role_ids: u.assigned_role_ids || [],
      }));

    // Tenant map: id -> { id, name, code }
    const tenants = (allTenants || []).map(t => ({ id: t.id, name: t.name, code: t.code }));

    // Diagnose data (mirrors adminAssignTenant diagnose logic) — only for admins
    let diagnose = null;
    if (isPlatformAdmin || isTenantAdmin) {
      const missingUsers = (allUsers || [])
        .filter(u => !u.tenant_id)
        .map(u => ({ id: u.id, email: u.email, full_name: u.full_name || '', role: u.role || 'user' }));

      const tenantOptions = isPlatformAdmin
        ? tenants
        : callerRecord.tenant_id
          ? tenants.filter(t => t.id === callerRecord.tenant_id)
          : tenants;

      diagnose = {
        missing_tenant_users: missingUsers,
        total_users: (allUsers || []).length,
        tenants: tenantOptions,
        caller_tenant_id: tenantId,
      };
    }

    // Orders — pass only the fields the page needs (email, paid_amount)
    const orders = (allOrders || []).map(o => ({
      user_email: o.user_email,
      paid_amount: o.paid_amount || 0,
    }));

    // Tenant-owned roles (created when tenant was initialized from global platform roles)
    const tenantRoles = tenantRolesRes || [];

    console.log(`[TIMING] getAdminUsersPageData | TOTAL: ${Date.now() - t0}ms`);
    return Response.json({ users, orders, tenants, diagnose, roles: tenantRoles });

  } catch (error) {
    console.error(`[TIMING] getAdminUsersPageData | error: ${Date.now() - t0}ms`, error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});