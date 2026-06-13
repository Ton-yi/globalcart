import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Public endpoint — NO auth required.
 * Returns home page customization config (hero, quickActions, steps, faq, statusBoard)
 * for a given tenant identified by hostname.
 *
 * Called by the Home page for both logged-in and guest visitors.
 * No sensitive data is returned — only public UI configuration stored in SiteSettings.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const hostname = (body.hostname || '').toLowerCase().trim();

    if (!hostname) {
      return Response.json({ error: 'hostname required' }, { status: 400 });
    }

    // Resolve tenant from hostname (same logic as resolveTenantBySubdomain)
    const parts = hostname.split('.');
    const subdomain = parts.length >= 3 ? parts[0] : null;

    let tenant = null;

    if (subdomain && subdomain !== 'www') {
      const bySubdomain = await base44.asServiceRole.entities.Tenant.filter({ subdomain, is_active: true });
      if (bySubdomain?.length > 0) {
        tenant = bySubdomain[0];
      } else {
        const allTenants = await base44.asServiceRole.entities.Tenant.filter({ is_active: true });
        tenant = (allTenants || []).find(t => (t.code || '').toLowerCase() === subdomain) || null;
      }
    }

    if (!tenant) {
      const byCustomDomain = await base44.asServiceRole.entities.Tenant.filter({ custom_domain: hostname, is_active: true });
      if (byCustomDomain?.length > 0) tenant = byCustomDomain[0];
    }

    if (!tenant) {
      return Response.json({ raw: [], settings: {} });
    }

    const [settings, faqCategories] = await Promise.all([
      base44.asServiceRole.entities.SiteSettings.filter({ tenant_id: tenant.id }),
      base44.asServiceRole.entities.FaqCategory.filter({ tenant_id: tenant.id, is_active: true }),
    ]);

    const settingsMap = {};
    (settings || []).forEach(s => { settingsMap[s.key] = s.value; });

    const sortedCategories = (faqCategories || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    return Response.json({ settings: settingsMap, raw: settings || [], faqCategories: sortedCategories });

  } catch (error) {
    console.error('getPublicHomeConfig error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});