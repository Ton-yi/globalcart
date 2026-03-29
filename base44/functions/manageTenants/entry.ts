import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Tenant management — create, list, update, update_branding.
 * - platform_admin: full access including subdomain changes
 * - admin / tenant_admin: can only update their own tenant's branding (not subdomain/code)
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

    // ── create (platform_admin only) ─────────────────────────────────────
    if (action === 'create') {
      if (!isPlatformAdmin) return Response.json({ error: 'Forbidden: only platform_admin can create tenants' }, { status: 403 });

      const { name, code, branding_name, timezone, subdomain, login_title, login_subtitle, logo_url, favicon_url, theme_color, contact_info } = body;
      if (!name || !code) return Response.json({ error: 'name and code are required' }, { status: 400 });

      const normalizedCode = code.toUpperCase();
      const normalizedSubdomain = (subdomain || code).toLowerCase().replace(/[^a-z0-9-]/g, '');

      // Enforce unique code
      const existingCode = await base44.asServiceRole.entities.Tenant.filter({ code: normalizedCode });
      if (existingCode?.length > 0) return Response.json({ error: `Code "${normalizedCode}" is already in use` }, { status: 409 });

      // Enforce unique subdomain
      const existingSubdomain = await base44.asServiceRole.entities.Tenant.filter({ subdomain: normalizedSubdomain });
      if (existingSubdomain?.length > 0) return Response.json({ error: `Subdomain "${normalizedSubdomain}" is already in use` }, { status: 409 });

      const tenant = await base44.asServiceRole.entities.Tenant.create({
        name,
        code: normalizedCode,
        subdomain: normalizedSubdomain,
        branding_name: branding_name || name,
        timezone: timezone || 'Asia/Tokyo',
        login_title: login_title || branding_name || name,
        login_subtitle: login_subtitle || '',
        logo_url: logo_url || '',
        favicon_url: favicon_url || '',
        theme_color: theme_color || '#dc2626',
        contact_info: contact_info || '',
        is_active: true,
      });
      return Response.json({ tenant });
    }

    // ── update (platform_admin: all fields; admin: branding only, own tenant) ──
    if (action === 'update') {
      const { id, ...fields } = body;
      if (!id) return Response.json({ error: 'id required' }, { status: 400 });
      delete fields.action;

      if (!isPlatformAdmin) {
        // Tenant admin: must own this tenant
        const userRecords = await base44.asServiceRole.entities.User.filter({ email: user.email });
        const userRecord = userRecords?.[0];
        if (!userRecord?.tenant_id || userRecord.tenant_id !== id) {
          return Response.json({ error: 'Forbidden: you can only edit your own tenant' }, { status: 403 });
        }
        // Restrict: cannot change subdomain, code, is_active
        delete fields.subdomain;
        delete fields.code;
        delete fields.is_active;
      } else {
        // platform_admin: if subdomain is being changed, enforce uniqueness
        if (fields.subdomain) {
          const normalizedSubdomain = fields.subdomain.toLowerCase().replace(/[^a-z0-9-]/g, '');
          fields.subdomain = normalizedSubdomain;
          const existing = await base44.asServiceRole.entities.Tenant.filter({ subdomain: normalizedSubdomain });
          const conflict = (existing || []).find(t => t.id !== id);
          if (conflict) return Response.json({ error: `Subdomain "${normalizedSubdomain}" is already in use` }, { status: 409 });
        }
        if (fields.code) {
          const normalizedCode = fields.code.toUpperCase();
          fields.code = normalizedCode;
          const existing = await base44.asServiceRole.entities.Tenant.filter({ code: normalizedCode });
          const conflict = (existing || []).find(t => t.id !== id);
          if (conflict) return Response.json({ error: `Code "${normalizedCode}" is already in use` }, { status: 409 });
        }
      }

      const tenant = await base44.asServiceRole.entities.Tenant.update(id, fields);
      return Response.json({ tenant });
    }

    // ── assign_all: set tenant_id on every user missing it (platform_admin only) ──
    if (action === 'assign_all') {
      if (!isPlatformAdmin && !isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });
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