import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const BUILTIN_USER_PERMISSIONS = [
  "order:submit_purchase_request",
  "shipping:notify_shipment",
  "shipping:direct_shipment",
  "message:send_message",
  "message:send_order_message",
  "message:send_shipping_message",
  "message:send_image",
  "payment:self_pay",
  "payment:manual_pay",
  "payment:pre_pay",
  "payment:pay_full_amount",
  "order:archive_order",
  "profile:change_display_name",
  "profile:change_avatar",
  "profile:change_auto_archive_settings",
  "view:my_orders_module",
  "addon:select_value_added_services",
  "addon:select_order_value_added_services",
  "addon:select_shipping_value_added_services",
];

async function ensureTenantBuiltinRoles(base44, tenantId) {
  const existing = await base44.asServiceRole.entities.Role.filter({ tenant_id: tenantId, is_predefined: true });
  const existingKeys = (existing || []).map(r => r.predefined_key);

  if (!existingKeys.includes('builtin_user')) {
    await base44.asServiceRole.entities.Role.create({
      tenant_id: tenantId,
      name: '用户',
      description: '普通用户内置角色，新注册用户默认分配',
      color: '#6b7280',
      is_global: false,
      is_predefined: true,
      predefined_key: 'builtin_user',
      direct_permissions: BUILTIN_USER_PERMISSIONS,
      overridden_permissions: [],
    });
    console.log(`[ensureTenantBuiltinRoles] Created builtin_user for tenant ${tenantId}`);
  }

  if (!existingKeys.includes('builtin_admin')) {
    await base44.asServiceRole.entities.Role.create({
      tenant_id: tenantId,
      name: '管理员',
      description: '租户管理员内置角色，拥有全部权限',
      color: '#dc2626',
      is_global: false,
      is_predefined: true,
      predefined_key: 'builtin_admin',
      direct_permissions: [],
      overridden_permissions: [],
    });
    console.log(`[ensureTenantBuiltinRoles] Created builtin_admin for tenant ${tenantId}`);
  }
}

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
    const roleFilter = tenantId ? { tenant_id: tenantId, is_archived: false, is_global: false } : { is_archived: false, is_global: false };
    const [allUsers, allOrders, allTenants, tenantRolesRes] = await Promise.all([
      base44.asServiceRole.entities.User.filter(userFilter, '-created_date', 50),
      base44.asServiceRole.entities.Order.filter(orderFilter, '-created_date', 50),
      (isPlatformAdmin || isTenantAdmin) ? base44.asServiceRole.entities.Tenant.list('-created_date', 50) : Promise.resolve([]),
      (isPlatformAdmin || isTenantAdmin) ? base44.asServiceRole.entities.Role.filter(roleFilter, '-created_date', 50) : Promise.resolve([]),
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
        // Assigned role IDs and permission overrides
        assigned_role_ids: u.assigned_role_ids || [],
        permission_overrides: u.permission_overrides || {},
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

    // Auto-init builtin roles for existing tenants that predate the feature (idempotent, fire-and-forget)
    if (tenantId && (isPlatformAdmin || isTenantAdmin)) {
      const hasBuiltin = tenantRoles.some(r => r.is_predefined);
      if (!hasBuiltin) {
        ensureTenantBuiltinRoles(base44, tenantId).catch(e =>
          console.warn('[getAdminUsersPageData] ensureTenantBuiltinRoles failed:', e.message)
        );
      }
    }

    console.log(`[TIMING] getAdminUsersPageData | TOTAL: ${Date.now() - t0}ms`);
    return Response.json({ users, orders, tenants, diagnose, roles: tenantRoles });

  } catch (error) {
    console.error(`[TIMING] getAdminUsersPageData | error: ${Date.now() - t0}ms`, error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});