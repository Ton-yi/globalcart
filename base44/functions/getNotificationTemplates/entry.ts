import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * 获取通知模板列表
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRecords = await base44.asServiceRole.entities.User.filter({ email: user.email });
    if (!userRecords || userRecords.length === 0) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const tenantId = userRecords[0].tenant_id;
    const isAdmin = user.role === 'admin' || user.role === 'tenant_admin' || user.role === 'platform_admin';

    // 获取模板列表
    const filter = isAdmin ? { tenant_id: tenantId } : { tenant_id: tenantId, is_active: true };
    const templates = await base44.asServiceRole.entities.NotificationTemplate.filter(filter, '-updated_date');

    return Response.json({
      templates: templates || []
    });

  } catch (error) {
    console.error('getNotificationTemplates error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});