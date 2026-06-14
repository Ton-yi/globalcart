import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * 列出本租户票务订单（is_ticket_order = true）。
 * 权限：platform_admin / admin / tenant_admin / staff。
 * 租户隔离：从认证用户派生 tenant_id，绝不信任客户端。
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const isPlatformAdmin = user.role === 'platform_admin';
    const isTenantAdmin = user.role === 'admin' || user.role === 'tenant_admin';
    const isStaff = user.role === 'staff';
    if (!isPlatformAdmin && !isTenantAdmin && !isStaff) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const userRecords = await base44.asServiceRole.entities.User.filter({ email: user.email });
    if (!userRecords || userRecords.length === 0) {
      return Response.json({ error: 'User record not found' }, { status: 404 });
    }
    const tenantId = userRecords[0].tenant_id || null;
    const filter = (isPlatformAdmin || !tenantId) ? { order_type: 'ticket' } : { tenant_id: tenantId, order_type: 'ticket' };

    const [orders, siteSettings] = await Promise.all([
      base44.asServiceRole.entities.Order.filter(filter, '-created_date'),
      base44.asServiceRole.entities.SiteSettings.filter(tenantId ? { tenant_id: tenantId, key: 'ticket_order_config' } : { key: 'ticket_order_config' }),
    ]);

    let ticketConfig = {};
    try { ticketConfig = JSON.parse(siteSettings?.[0]?.value || '{}'); } catch { ticketConfig = {}; }

    return Response.json({ orders: orders || [], ticketConfig });
  } catch (error) {
    console.error('getAdminTicketOrders error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});