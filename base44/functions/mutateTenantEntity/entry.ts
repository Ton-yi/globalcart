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
  'MemberTier', 'CreditApplication', 'Role', 'TierTriggerRule',
];

const ADMIN_ONLY_WRITE = [
  'ItemSizeTemplate', 'OnlineStoreTagRule', 'ShippingMethod',
  'TransitShippingMethod', 'TransitLocation', 'AddonOption',
  'SiteSettings', 'Announcement', 'BoxTemplate',
  'MemberTier', 'Role', 'TierTriggerRule',
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
        const isCreator = record.creator_email === user.email;

        // Payment fields that any tenant user (participant) is allowed to write
        const PAYMENT_FIELDS = new Set([
          'payment_status', 'payment_method', 'payment_proof_url', 'status',
          'alipay_trade_no', 'alipay_transaction_id', 'per_user_payments',
        ]);
        // Fields that a user is allowed to write when joining an existing pool
        const JOIN_POOL_FIELDS = new Set([
          'order_ids', 'order_names', 'total_weight_g',
        ]);
        const updatingKeys = Object.keys(data);
        const isPaymentOnlyUpdate = updatingKeys.length > 0 && updatingKeys.every(k => PAYMENT_FIELDS.has(k));
        const isJoinPoolUpdate = updatingKeys.length > 0 && updatingKeys.every(k => JOIN_POOL_FIELDS.has(k));

        if (!isCreator && !isPaymentOnlyUpdate && !isJoinPoolUpdate) {
          return Response.json({ error: 'Forbidden: Can only update your own shipping pools' }, { status: 403 });
        }

        // ── Value-level hardening: users may never self-confirm payment or self-ship ──
        // (admin confirmation flag is admin-only)
        delete data.admin_confirmed_payment;
        // status: users may only move a pool into "awaiting_payment_confirmation"
        // (payment proof submitted), or cancel their own un-notified pool
        if ('status' in data && data.status !== record.status) {
          const allowedStatuses = [];
          // 提交付款：仅限待付款/待确认阶段（已发货的池子补付时不改变状态）
          if (['awaiting_payment', 'awaiting_payment_confirmation'].includes(record.status)) allowedStatuses.push('awaiting_payment_confirmation');
          if (record.status === 'pending') allowedStatuses.push('cancelled');
          // 用户确认收货
          if (record.status === 'shipped') allowedStatuses.push('delivered');
          if (!allowedStatuses.includes(data.status)) {
            return Response.json({ error: 'Forbidden: status change not allowed for users' }, { status: 403 });
          }
        }
        // payment_status: users may never set "paid" themselves (admin confirms payment)
        if ('payment_status' in data && data.payment_status !== record.payment_status) {
          if (!['unpaid', 'partial', 'awaiting_confirmation'].includes(data.payment_status)) {
            return Response.json({ error: 'Forbidden: payment status change not allowed for users' }, { status: 403 });
          }
        }
        // per_user_payments: users may not mark entries as "paid" that weren't already confirmed
        if (Array.isArray(data.per_user_payments)) {
          const prevPaid = new Set((record.per_user_payments || [])
            .filter(p => p.payment_status === 'paid').map(p => p.user_email));
          const forging = data.per_user_payments.some(p =>
            p.payment_status === 'paid' && !prevPaid.has(p.user_email));
          if (forging) {
            return Response.json({ error: 'Forbidden: cannot self-confirm payment' }, { status: 403 });
          }
          // users may only modify their OWN payment entry — other users' entries must stay unchanged
          const normalize = arr => JSON.stringify(
            (arr || [])
              .filter(p => p.user_email !== user.email)
              .sort((a, b) => (a.user_email || '').localeCompare(b.user_email || ''))
          );
          if (normalize(data.per_user_payments) !== normalize(record.per_user_payments)) {
            return Response.json({ error: "Forbidden: cannot modify other users' payment records" }, { status: 403 });
          }
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