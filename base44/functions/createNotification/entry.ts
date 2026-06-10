import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * 创建系统通知
 * 可用于管理员发送通知给用户，或系统自动发送通知
 * 支持模板渲染和邮件发送
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = user.role === 'admin' || user.role === 'tenant_admin' || user.role === 'platform_admin';

    const data = await req.json();
    const {
      user_email,
      notification_type,
      notification_subtype,
      title,
      content,
      related_entity_type,
      related_entity_id,
      related_url,
      priority = 'normal',
      metadata = {},
      send_to_all = false,
      use_template = false,
      template_vars = {},
      send_email = false
    } = data;

    const userRecords = await base44.asServiceRole.entities.User.filter({ email: user.email });
    if (!userRecords || userRecords.length === 0) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const tenantId = userRecords[0].tenant_id;

    // Render title and content from template if needed
    let finalTitle = title;
    let finalContent = content;

    if (use_template && notification_type && notification_subtype) {
      const templates = await base44.asServiceRole.entities.NotificationTemplate.filter({
        notification_type,
        notification_subtype,
        is_active: true
      });

      if (templates && templates.length > 0) {
        const template = templates[0];
        finalTitle = renderTemplate(template.title_template, template_vars);
        finalContent = renderTemplate(template.content_template, template_vars);
      }
    }

    // Helper function to render template variables
    function renderTemplate(template, vars) {
      if (!template) return '';
      let result = template;
      for (const [key, value] of Object.entries(vars)) {
        result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
      }
      return result;
    }

    // Permission check: only admins can send to all users
    if (send_to_all && !isAdmin) {
      return Response.json({ error: 'Forbidden: Only admins can send notifications to all users' }, { status: 403 });
    }

    if (send_to_all) {
      // Send to all users in tenant
      const allUsers = await base44.asServiceRole.entities.User.filter({ tenant_id: tenantId });
      
      const notifications = [];
      for (const targetUser of allUsers) {
        const notification = await base44.asServiceRole.entities.Notification.create({
          tenant_id: tenantId,
          user_email: targetUser.email,
          notification_type,
          notification_subtype,
          icon: data.icon || 'Bell',
          title: finalTitle,
          content: finalContent,
          related_entity_type,
          related_entity_id,
          related_url,
          is_system: true,
          sender_email: user.email,
          priority,
          metadata,
          created_by: user.id
        });
        notifications.push(notification);

        // Send email if enabled
        if (send_email) {
          try {
            await base44.integrations.Core.SendEmail({
              to: [targetUser.email],
              subject: finalTitle,
              html: finalContent
            });
          } catch (emailError) {
            console.error('Failed to send email:', emailError);
          }
        }
      }

      return Response.json({
        success: true,
        sent_count: notifications.length
      });
    } else {
      // Send to specific user
      if (!user_email) {
        return Response.json({ error: 'user_email is required when send_to_all is false' }, { status: 400 });
      }

      // Verify target user exists in same tenant
      const targetUsers = await base44.asServiceRole.entities.User.filter({ 
        email: user_email,
        tenant_id: tenantId
      });

      if (!targetUsers || targetUsers.length === 0) {
        return Response.json({ error: 'Target user not found' }, { status: 404 });
      }

      const notification = await base44.asServiceRole.entities.Notification.create({
        tenant_id: tenantId,
        user_email,
        notification_type,
        notification_subtype,
        icon: data.icon || 'Bell',
        title: finalTitle,
        content: finalContent,
        related_entity_type,
        related_entity_id,
        related_url,
        is_system: isAdmin,
        sender_email: user.email,
        priority,
        metadata,
        created_by: user.id
      });

      // Send email if enabled
      if (send_email) {
        try {
          await base44.integrations.Core.SendEmail({
            to: [user_email],
            subject: finalTitle,
            html: finalContent
          });
        } catch (emailError) {
          console.error('Failed to send email:', emailError);
        }
      }

      return Response.json({
        success: true,
        notification_id: notification.id
      });
    }

  } catch (error) {
    console.error('createNotification error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});