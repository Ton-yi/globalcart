import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Generic tenant-safe CRUD for frequently mutated config entities.
 * Supported entities: ShippingPool, ShippingRequest, ShippingEditRequest,
 *   UserPreference, ItemSizeTemplate, OnlineStoreTagRule,
 *   ShippingMethod, TransitShippingMethod, TransitLocation,
 *   AddonOption, SiteSettings, Announcement
 *
 * Body: { entity, action, id?, data? }
 * action: "create" | "update" | "delete" | "list"
 */

const ALLOWED_ENTITIES = [
  'Order',
  'ShippingPool', 'ShippingRequest', 'ShippingEditRequest',
  'UserPreference', 'ItemSizeTemplate', 'OnlineStoreTagRule',
  'ShippingMethod', 'TransitShippingMethod', 'TransitLocation',
  'AddonOption', 'SiteSettings', 'Announcement',
];

// Entities that only admins/staff can create/update/delete
const ADMIN_ONLY_WRITE = [
  'ItemSizeTemplate', 'OnlineStoreTagRule', 'ShippingMethod',
  'TransitShippingMethod', 'TransitLocation', 'AddonOption',
  'SiteSettings', 'Announcement',
];

// Entities only admins/staff can delete
const ADMIN_ONLY_DELETE = ['Order'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { entity, action, id, data = {}, filter = {} } = body;

    if (!ALLOWED_ENTITIES.includes(entity)) {
      return Response.json({ error: `Entity "${entity}" not allowed` }, { status: 400 });
    }
    if (!['create', 'update', 'delete', 'list'].includes(action)) {
      return Response.json({ error: `Action "${action}" not allowed` }, { status: 400 });
    }

    // Get user record for tenant_id
    const userRecords = await base44.asServiceRole.entities.User.filter({ email: user.email });
    const userRecord = userRecords?.[0];
    if (!userRecord) return Response.json({ error: 'User record not found' }, { status: 404 });

    const tenantId = userRecord.tenant_id;
    const isPlatformAdmin = user.role === 'platform_admin';
    const isTenantAdmin = user.role === 'admin' || user.role === 'tenant_admin';
    const isStaff = user.role === 'staff';

    if (!tenantId && !isPlatformAdmin) {
      return Response.json({ error: 'User has no tenant assigned' }, { status: 403 });
    }

    // Admin-only write check
    if (['create', 'update', 'delete'].includes(action) && ADMIN_ONLY_WRITE.includes(entity)) {
      if (!isPlatformAdmin && !isTenantAdmin && !isStaff) {
        return Response.json({ error: 'Forbidden: Admin access required for this entity' }, { status: 403 });
      }
    }

    const entityRef = base44.asServiceRole.entities[entity];
    if (!entityRef) return Response.json({ error: `Entity ${entity} not found` }, { status: 400 });

    if (action === 'list') {
      const q = isPlatformAdmin ? filter : { ...filter, tenant_id: tenantId };
      const results = await entityRef.filter(q);
      return Response.json({ results: results || [] });
    }

    if (action === 'create') {
      // Strip any client-provided tenant_id; auto-assign
      delete data.tenant_id;
      const newRecord = await entityRef.create({
        ...data,
        tenant_id: tenantId || null,
      });
      return Response.json({ result: newRecord });
    }

    if (action === 'update') {
      if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });
      // Verify tenant ownership
      const existing = await entityRef.filter({ id });
      const record = existing?.[0];
      if (!record) return Response.json({ error: 'Record not found' }, { status: 404 });
      if (!isPlatformAdmin && record.tenant_id !== tenantId) {
        return Response.json({ error: 'Forbidden: Record does not belong to your tenant' }, { status: 403 });
      }
      // Validate per-entity user-scope rules
      if (entity === 'UserPreference' && !isTenantAdmin && !isPlatformAdmin) {
        if (record.user_email !== user.email) {
          return Response.json({ error: 'Forbidden: Can only update your own preferences' }, { status: 403 });
        }
      }
      if (entity === 'ShippingPool' && !isTenantAdmin && !isPlatformAdmin && !isStaff) {
        if (record.creator_email !== user.email) {
          return Response.json({ error: 'Forbidden: Can only update your own shipping pools' }, { status: 403 });
        }
      }
      delete data.tenant_id;
      const updated = await entityRef.update(id, data);
      return Response.json({ result: updated });
    }

    if (action === 'delete') {
      if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });
      const existing = await entityRef.filter({ id });
      const record = existing?.[0];
      if (!record) return Response.json({ error: 'Record not found' }, { status: 404 });
      if (!isPlatformAdmin && record.tenant_id !== tenantId) {
        return Response.json({ error: 'Forbidden: Record does not belong to your tenant' }, { status: 403 });
      }
      await entityRef.delete(id);
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Unhandled action' }, { status: 400 });

  } catch (error) {
    console.error('mutateTenantEntity error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});