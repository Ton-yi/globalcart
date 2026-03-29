import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Public endpoint — no auth required.
 * Resolves tenant branding from subdomain or custom_domain.
 * Called by the frontend on every page load to determine tenant context.
 *
 * Input:  { hostname: "tongyi.example.com" }  (sent from window.location.hostname)
 * Output: { tenant: { id, code, subdomain, branding_name, logo_url, favicon_url, theme_color, login_title, login_subtitle, contact_info } }
 *         or { tenant: null } if not found
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const hostname = (body.hostname || '').toLowerCase().trim();

    if (!hostname) {
      return Response.json({ tenant: null });
    }

    // Extract subdomain: "tongyi.example.com" → "tongyi"
    // If it's localhost or an IP, no subdomain
    const parts = hostname.split('.');
    // Must have at least 3 parts to have a subdomain (sub.domain.tld)
    const subdomain = parts.length >= 3 ? parts[0] : null;

    let tenant = null;

    if (subdomain && subdomain !== 'www') {
      // Try subdomain match first
      const bySubdomain = await base44.asServiceRole.entities.Tenant.filter({ subdomain, is_active: true });
      if (bySubdomain?.length > 0) {
        tenant = bySubdomain[0];
      } else {
        // Fallback: match by code (subdomain == code.toLowerCase())
        const allTenants = await base44.asServiceRole.entities.Tenant.filter({ is_active: true });
        tenant = (allTenants || []).find(t => (t.code || '').toLowerCase() === subdomain) || null;
      }
    }

    if (!tenant) {
      // Try custom_domain match
      const byCustomDomain = await base44.asServiceRole.entities.Tenant.filter({ custom_domain: hostname, is_active: true });
      if (byCustomDomain?.length > 0) {
        tenant = byCustomDomain[0];
      }
    }

    if (!tenant) {
      return Response.json({ tenant: null });
    }

    // Return only public branding fields — never expose internal data
    return Response.json({
      tenant: {
        id: tenant.id,
        code: tenant.code,
        subdomain: tenant.subdomain || tenant.code?.toLowerCase(),
        branding_name: tenant.branding_name || tenant.name,
        logo_url: tenant.logo_url || null,
        favicon_url: tenant.favicon_url || null,
        theme_color: tenant.theme_color || null,
        login_title: tenant.login_title || tenant.branding_name || tenant.name,
        login_subtitle: tenant.login_subtitle || null,
        contact_info: tenant.contact_info || null,
      }
    });

  } catch (error) {
    console.error('resolveTenantBySubdomain error:', error);
    return Response.json({ tenant: null });
  }
});