import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Manage FAQ categories for the help center.
 * Admin-only for mutations; public read via getPublicHomeConfig.
 *
 * Actions: list, create, update, delete
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const userRecords = await base44.asServiceRole.entities.User.filter({ email: user.email });
    if (!userRecords?.length) return Response.json({ error: 'User not found' }, { status: 404 });

    const tenantId = userRecords[0].tenant_id;
    const isAdmin = user.role === 'admin' || user.role === 'tenant_admin' || user.role === 'platform_admin';

    if (!tenantId && !isAdmin) return Response.json({ error: 'No tenant context' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { action, id, data } = body;

    if (action === 'list') {
      const filter = tenantId ? { tenant_id: tenantId } : {};
      const categories = await base44.asServiceRole.entities.FaqCategory.filter(filter);
      return Response.json({ categories: (categories || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)) });
    }

    // Mutations require admin
    if (!isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });

    if (action === 'create') {
      const record = await base44.asServiceRole.entities.FaqCategory.create({ ...data, tenant_id: tenantId });
      return Response.json({ category: record });
    }

    if (action === 'update') {
      if (!id) return Response.json({ error: 'id required' }, { status: 400 });
      // Verify ownership
      const existing = await base44.asServiceRole.entities.FaqCategory.filter({ id });
      if (!existing?.length || existing[0].tenant_id !== tenantId) {
        return Response.json({ error: 'Not found' }, { status: 404 });
      }
      const record = await base44.asServiceRole.entities.FaqCategory.update(id, data);
      return Response.json({ category: record });
    }

    if (action === 'delete') {
      if (!id) return Response.json({ error: 'id required' }, { status: 400 });
      const existing = await base44.asServiceRole.entities.FaqCategory.filter({ id });
      if (!existing?.length || existing[0].tenant_id !== tenantId) {
        return Response.json({ error: 'Not found' }, { status: 404 });
      }
      await base44.asServiceRole.entities.FaqCategory.delete(id);
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    console.error('manageFaqCategories error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});