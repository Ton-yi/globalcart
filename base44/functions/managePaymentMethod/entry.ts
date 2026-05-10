import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * managePaymentMethod - CRUD for PaymentMethod entity
 * Actions: list, create, update, delete, toggle
 * Enforces tenant isolation and admin-only access.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const isAdmin = user.role === 'admin' || user.role === 'platform_admin' || user.role === 'tenant_admin';

    const userRecords = await base44.asServiceRole.entities.User.filter({ email: user.email });
    if (!userRecords || userRecords.length === 0) return Response.json({ error: 'User not found' }, { status: 404 });
    const tenantId = userRecords[0].tenant_id;

    const body = await req.json().catch(() => ({}));
    const { action } = body;

    // === list === (all authenticated users in a tenant can list active payment methods)
    if (action === 'list') {
      if (!tenantId && user.role !== 'platform_admin') return Response.json({ methods: [] });
      const filter = tenantId ? { tenant_id: tenantId } : {};
      const methods = await base44.asServiceRole.entities.PaymentMethod.filter(filter);
      methods.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      // Non-admins only see active methods
      const result = isAdmin ? methods : methods.filter(m => m.is_active !== false);
      return Response.json({ methods: result });
    }

    // All other actions are admin-only
    if (!isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });
    if (!tenantId && user.role !== 'platform_admin') return Response.json({ error: 'No tenant assigned' }, { status: 400 });

    // === create ===
    if (action === 'create') {
      const { name, description, icon, color, image_url, payment_note, provider_key, sort_order } = body;
      if (!name) return Response.json({ error: 'name is required' }, { status: 400 });
      const record = await base44.asServiceRole.entities.PaymentMethod.create({
        tenant_id: tenantId,
        name,
        description: description || '',
        icon: icon || '',
        color: color || 'bg-gray-100 text-gray-700',
        image_url: image_url || '',
        payment_note: payment_note || '',
        provider_key: provider_key || '',
        is_active: true,
        sort_order: sort_order || 0,
      });
      return Response.json({ method: record });
    }

    // === update ===
    if (action === 'update') {
      const { id, ...fields } = body;
      if (!id) return Response.json({ error: 'id required' }, { status: 400 });
      delete fields.action;
      delete fields.tenant_id; // never trust from client
      await base44.asServiceRole.entities.PaymentMethod.update(id, fields);
      return Response.json({ success: true });
    }

    // === toggle ===
    if (action === 'toggle') {
      const { id } = body;
      if (!id) return Response.json({ error: 'id required' }, { status: 400 });
      const records = await base44.asServiceRole.entities.PaymentMethod.filter({ id });
      if (!records || records.length === 0) return Response.json({ error: 'Not found' }, { status: 404 });
      await base44.asServiceRole.entities.PaymentMethod.update(id, { is_active: !records[0].is_active });
      return Response.json({ success: true });
    }

    // === delete ===
    if (action === 'delete') {
      const { id } = body;
      if (!id) return Response.json({ error: 'id required' }, { status: 400 });
      await base44.asServiceRole.entities.PaymentMethod.delete(id);
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('managePaymentMethod error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});