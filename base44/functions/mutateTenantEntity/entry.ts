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
 * Generic tenant-safe CRUD for frequently mutated config entities.
 */

const ALLOWED_ENTITIES = [
  'Order',
  'ShippingPool', 'ShippingRequest', 'ShippingEditRequest',
  'UserPreference', 'ItemSizeTemplate', 'OnlineStoreTagRule',
  'ShippingMethod', 'TransitShippingMethod', 'TransitLocation',
  'AddonOption', 'SiteSettings', 'Announcement', 'BoxTemplate',
];

const ADMIN_ONLY_WRITE = [
  'ItemSizeTemplate', 'OnlineStoreTagRule', 'ShippingMethod',
  'TransitShippingMethod', 'TransitLocation', 'AddonOption',
  'SiteSettings', 'Announcement', 'BoxTemplate',
];

const ADMIN_ONLY_DELETE = ['Order'];

Deno.serve(async (req) => {
  const t0 = Date.now();
  try {
    const base44 = createClientFromRequest(req);

    const emailHint = extractEmailFromJwt(req);
    const [user, earlyUserRecords, body] = await Promise.all([
      base44.auth.me(),
      emailHint
        ? base44.asServiceRole.entities.User.filter({ email: emailHint })
        : Promise.resolve(null),
      req.json(),
    ]);
    console.log(`[TIMING] mutateTenantEntity | auth.me + User.filter + body (parallel): ${Date.now()-t0}ms`);

    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { entity, action, id, data = {}, filter = {} } = body;

    if (!ALLOWED_ENTITIES.includes(entity)) {
      return Response.json({ error: `Entity "${entity}" not allowed` }, { status: 400 });
    }
    if (!['create', 'update', 'delete', 'list'].includes(action)) {
      return Response.json({ error: `Action "${action}" not allowed` }, { status: 400 });
    }

    const userRecords = earlyUserRecords ?? await base44.asServiceRole.entities.User.filter({ email: user.email });
    console.log(`[TIMING] mutateTenantEntity | user context ready | entity: ${entity} action: ${action}`);
    const userRecord = userRecords?.[0];
    if (!userRecord) return Response.json({ error: 'User record not found' }, { status: 404 });

    const tenantId = userRecord.tenant_id;
    const isPlatformAdmin = user.role === 'platform_admin';
    const isTenantAdmin = user.role === 'admin' || user.role === 'tenant_admin';
    const isStaff = user.role === 'staff';

    if (!tenantId && !isPlatformAdmin) {
      if (action === 'list') {
        console.warn(`mutateTenantEntity: user ${user.email} (role=${user.role}) has no tenant_id — returning empty list for ${entity}`);
        return Response.json({ results: [] });
      }
      const roleLabel = isTenantAdmin ? 'tenant admin' : isStaff ? 'staff' : 'user';
      console.error(`mutateTenantEntity: ${roleLabel} ${user.email} attempted ${action} on ${entity} but has no tenant_id assigned`);
      return Response.json({
        error: `Your account (${user.email}) has no tenant assigned. ` +
               `A platform admin or tenant admin must assign your tenant via Admin → Users → Tenant Assignment Diagnostics.`,
        code: 'NO_TENANT_ASSIGNED',
        user_email: user.email,
        role: user.role,
      }, { status: 403 });
    }

    if (['create', 'update', 'delete'].includes(action) && ADMIN_ONLY_WRITE.includes(entity)) {
      if (!isPlatformAdmin && !isTenantAdmin && !isStaff) {
        return Response.json({ error: 'Forbidden: Admin access required for this entity' }, { status: 403 });
      }
    }

    const entityRef = base44.asServiceRole.entities[entity];
    if (!entityRef) return Response.json({ error: `Entity ${entity} not found` }, { status: 400 });

    const t3 = Date.now();

    if (action === 'list') {
      // UserPreference: scope by user_email for regular users (not just tenant_id),
      // because legacy records may have been created without tenant_id.
      let q;
      if (isPlatformAdmin) {
        q = filter;
      } else if (entity === 'UserPreference' && !isTenantAdmin && !isStaff) {
        // Regular users can only see their own preferences; don't require tenant_id match
        // so that legacy records without tenant_id are still accessible.
        q = { ...filter, user_email: user.email };
      } else {
        q = { ...filter, tenant_id: tenantId };
      }
      const results = await entityRef.filter(q);
      console.log(`[TIMING] mutateTenantEntity | ${entity}.filter (list): ${Date.now()-t3}ms | count: ${results?.length}`);
      console.log(`[TIMING] mutateTenantEntity | TOTAL: ${Date.now()-t0}ms | ${entity} ${action}`);
      return Response.json({ results: results || [] });
    }

    if (action === 'create') {
      delete data.tenant_id;
      const newRecord = await entityRef.create({ ...data, tenant_id: tenantId || null });
      console.log(`[TIMING] mutateTenantEntity | ${entity}.create: ${Date.now()-t3}ms`);
      console.log(`[TIMING] mutateTenantEntity | TOTAL: ${Date.now()-t0}ms | ${entity} ${action}`);
      return Response.json({ result: newRecord });
    }

    if (action === 'update') {
      if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });
      const t4 = Date.now();
      const existing = await entityRef.filter({ id });
      console.log(`[TIMING] mutateTenantEntity | ${entity}.filter (ownership check): ${Date.now()-t4}ms`);
      const record = existing?.[0];
      if (!record) return Response.json({ error: 'Record not found' }, { status: 404 });
      // For UserPreference, allow update if user_email matches (covers legacy records without tenant_id)
      if (entity === 'UserPreference') {
        if (!isPlatformAdmin && record.user_email !== user.email) {
          return Response.json({ error: 'Forbidden: Can only update your own preferences' }, { status: 403 });
        }
      } else if (!isPlatformAdmin && record.tenant_id !== tenantId) {
        return Response.json({ error: 'Forbidden: Record does not belong to your tenant' }, { status: 403 });
      }
      if (entity === 'ShippingPool' && !isTenantAdmin && !isPlatformAdmin && !isStaff) {
        if (record.creator_email !== user.email) {
          return Response.json({ error: 'Forbidden: Can only update your own shipping pools' }, { status: 403 });
        }
      }
      delete data.tenant_id;
      const t5 = Date.now();
      const updated = await entityRef.update(id, data);
      console.log(`[TIMING] mutateTenantEntity | ${entity}.update: ${Date.now()-t5}ms`);
      console.log(`[TIMING] mutateTenantEntity | TOTAL: ${Date.now()-t0}ms | ${entity} ${action}`);
      return Response.json({ result: updated });
    }

    if (action === 'delete') {
      if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });
      if (ADMIN_ONLY_DELETE.includes(entity) && !isPlatformAdmin && !isTenantAdmin && !isStaff) {
        return Response.json({ error: 'Forbidden: Admin access required to delete this entity' }, { status: 403 });
      }
      const t4 = Date.now();
      const existing = await entityRef.filter({ id });
      console.log(`[TIMING] mutateTenantEntity | ${entity}.filter (ownership check): ${Date.now()-t4}ms`);
      const record = existing?.[0];
      if (!record) return Response.json({ error: 'Record not found' }, { status: 404 });
      if (!isPlatformAdmin && record.tenant_id !== tenantId) {
        return Response.json({ error: 'Forbidden: Record does not belong to your tenant' }, { status: 403 });
      }
      const t5 = Date.now();
      await entityRef.delete(id);
      console.log(`[TIMING] mutateTenantEntity | ${entity}.delete: ${Date.now()-t5}ms`);
      console.log(`[TIMING] mutateTenantEntity | TOTAL: ${Date.now()-t0}ms | ${entity} ${action}`);
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Unhandled action' }, { status: 400 });

  } catch (error) {
    console.error(`[TIMING] mutateTenantEntity | TOTAL (error): ${Date.now()-t0}ms`);
    console.error('mutateTenantEntity error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});