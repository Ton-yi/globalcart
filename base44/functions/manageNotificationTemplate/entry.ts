import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * 管理通知模板（创建/更新/删除）
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 权限检查：只有管理员可以管理模板
    const isAdmin = user.role === 'admin' || user.role === 'tenant_admin' || user.role === 'platform_admin';
    if (!isAdmin) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const userRecords = await base44.asServiceRole.entities.User.filter({ email: user.email });
    if (!userRecords || userRecords.length === 0) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const tenantId = userRecords[0].tenant_id;

    const data = await req.json();
    const { action, template_id, ...templateData } = data;

    if (action === 'create') {
      const template = await base44.asServiceRole.entities.NotificationTemplate.create({
        tenant_id: tenantId,
        notification_type: templateData.notification_type,
        notification_subtype: templateData.notification_subtype,
        title_template: templateData.title_template,
        content_template: templateData.content_template,
        default_in_app: templateData.default_in_app !== false,
        default_email: templateData.default_email || false,
        is_active: true,
        updated_by: user.email
      });

      return Response.json({
        success: true,
        template_id: template.id
      });
    }

    if (action === 'update') {
      if (!template_id) {
        return Response.json({ error: 'template_id is required' }, { status: 400 });
      }

      const updateData = {};
      if (templateData.title_template !== undefined) updateData.title_template = templateData.title_template;
      if (templateData.content_template !== undefined) updateData.content_template = templateData.content_template;
      if (templateData.default_in_app !== undefined) updateData.default_in_app = templateData.default_in_app;
      if (templateData.default_email !== undefined) updateData.default_email = templateData.default_email;
      if (templateData.is_active !== undefined) updateData.is_active = templateData.is_active;
      updateData.updated_by = user.email;

      await base44.asServiceRole.entities.NotificationTemplate.update(template_id, updateData);

      return Response.json({ success: true });
    }

    if (action === 'delete') {
      if (!template_id) {
        return Response.json({ error: 'template_id is required' }, { status: 400 });
      }

      await base44.asServiceRole.entities.NotificationTemplate.delete(template_id);

      return Response.json({ success: true });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('manageNotificationTemplate error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});