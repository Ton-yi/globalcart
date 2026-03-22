import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Tenant management — create, list, update.
 * Only platform_admin or admin (bootstrapping) may call this.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const isPlatformAdmin = user.role === 'platform_admin';
    const isAdmin = user.role === 'admin' || user.role === 'tenant_admin';
    if (!isPlatformAdmin && !isAdmin) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { action } = body;

    // ── list ──────────────────────────────────────────────────────────────
    if (action === 'list') {
      const tenants = await base44.asServiceRole.entities.Tenant.list();
      return Response.json({ tenants: tenants || [] });
    }

    // ── create ────────────────────────────────────────────────────────────
    if (action === 'create') {
      const { name, code, branding_name, timezone } = body;
      if (!name || !code) return Response.json({ error: 'name and code are required' }, { status: 400 });

      // Enforce unique code
      const existing = await base44.asServiceRole.entities.Tenant.filter({ code });
      if (existing?.length > 0) return Response.json({ error: `Code "${code}" is already in use` }, { status: 409 });

      const tenant = await base44.asServiceRole.entities.Tenant.create({
        name,
        code: code.toUpperCase(),
        branding_name: branding_name || name,
        timezone: timezone || 'Asia/Tokyo',
        is_active: true,
      });
      return Response.json({ tenant });
    }

    // ── update ────────────────────────────────────────────────────────────
    if (action === 'update') {
      const { id, ...fields } = body;
      if (!id) return Response.json({ error: 'id required' }, { status: 400 });
      delete fields.action;
      const tenant = await base44.asServiceRole.entities.Tenant.update(id, fields);
      return Response.json({ tenant });
    }

    // ── assign_all: set tenant_id on every user missing it ───────────────
    if (action === 'assign_all') {
      const { tenant_id } = body;
      if (!tenant_id) return Response.json({ error: 'tenant_id required' }, { status: 400 });

      const allUsers = await base44.asServiceRole.entities.User.list();
      const missing = (allUsers || []).filter(u => !u.tenant_id);
      await Promise.all(missing.map(u =>
        base44.asServiceRole.entities.User.update(u.id, { tenant_id })
      ));
      return Response.json({ assigned: missing.length, tenant_id });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    console.error('manageTenants error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});