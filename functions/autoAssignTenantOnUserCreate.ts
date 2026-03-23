import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Entity automation: fires on User create events.
 * If the new user has no tenant_id, attempt to infer one from:
 *   1. The inviting admin's tenant_id (most reliable — user was invited by a tenant admin)
 *   2. If only one active tenant exists, assign it automatically (bootstrap convenience)
 *
 * This is a safety net only — normal assignment goes through adminAssignTenant.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Automation payloads are sent as service-role webhooks — no user auth token.
    // We use asServiceRole for all operations here.
    let body = {};
    try { body = await req.json(); } catch { /* empty body */ }

    const { event, data } = body;

    // Only act on create events
    if (event?.type !== 'create') {
      return Response.json({ skipped: true, reason: 'not a create event' });
    }

    const newUser = data;
    if (!newUser?.id || !newUser?.email) {
      console.warn('autoAssignTenant: missing user data in payload');
      return Response.json({ skipped: true, reason: 'missing user data' });
    }

    // Already has a tenant — nothing to do
    if (newUser.tenant_id) {
      return Response.json({ skipped: true, reason: 'user already has tenant_id' });
    }

    // Fetch active tenants
    const tenants = await base44.asServiceRole.entities.Tenant.filter({ is_active: true });
    if (!tenants || tenants.length === 0) {
      console.warn(`autoAssignTenant: no active tenants found, cannot assign for user ${newUser.email}`);
      return Response.json({ skipped: true, reason: 'no active tenants' });
    }

    // Strategy 1: Only one tenant exists — assign automatically
    if (tenants.length === 1) {
      await base44.asServiceRole.entities.User.update(newUser.id, { tenant_id: tenants[0].id });
      console.log(`autoAssignTenant: assigned single tenant ${tenants[0].code} to new user ${newUser.email}`);
      return Response.json({ assigned: true, tenant_id: tenants[0].id, reason: 'single_tenant' });
    }

    // Strategy 2: Multiple tenants — try to find the inviting admin's tenant.
    // Look for the most recently active admin/tenant_admin who is not this user.
    // This is a best-effort heuristic; manual assignment via adminAssignTenant is the fallback.
    const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
    const tenantAdmins = await base44.asServiceRole.entities.User.filter({ role: 'tenant_admin' });
    const allAdmins = [...(admins || []), ...(tenantAdmins || [])].filter(
      a => a.tenant_id && a.email !== newUser.email
    );

    if (allAdmins.length === 1) {
      // Only one admin with a tenant — safe to assign their tenant
      await base44.asServiceRole.entities.User.update(newUser.id, { tenant_id: allAdmins[0].tenant_id });
      console.log(`autoAssignTenant: assigned tenant ${allAdmins[0].tenant_id} from sole admin to ${newUser.email}`);
      return Response.json({ assigned: true, tenant_id: allAdmins[0].tenant_id, reason: 'sole_admin_tenant' });
    }

    // Multiple tenants, multiple admins — cannot safely infer, log for manual resolution
    console.warn(
      `autoAssignTenant: new user ${newUser.email} has no tenant_id and could not be auto-assigned ` +
      `(${tenants.length} tenants, ${allAdmins.length} admins). ` +
      `Use AdminUsers → Tenant Assignment Diagnostics to assign manually.`
    );
    return Response.json({ skipped: true, reason: 'ambiguous_tenant', user_email: newUser.email });

  } catch (error) {
    console.error('autoAssignTenantOnUserCreate error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});