import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * 发送带邮件的通知
 * 创建站内通知并发送邮件（如果用户开启了邮件通知）
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
      send_to_all = false
    } = data;

    const userRecords = await base44.asServiceRole.entities.User.filter({ email: user.email });
    if (!userRecords || userRecords.length === 0) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const tenantId = userRecords[0].tenant_id;

    // 获取通知模板
    let template = null;
    if (notification_subtype) {
      const templates = await base44.asServiceRole.entities.NotificationTemplate.filter({
        notification_subtype,
        is_active: true
      });
      template = templates && templates.length > 0 ? templates[0] : null;
    }

    // 渲染模板内容
    let finalTitle = title;
    let finalContent = content;
    
    if (template) {
      finalTitle = renderTemplate(template.title_template, metadata);
      finalContent = renderTemplate(template.content_template, metadata);
    }

    const notifications = [];
    let emailSentCount = 0;

    if (send_to_all) {
      // 发送给所有用户
      const allUsers = await base44.asServiceRole.entities.User.filter({ tenant_id: tenantId });
      
      for (const targetUser of allUsers) {
        // 创建站内通知
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

        // 检查是否需要发送邮件
        const shouldSendEmail = await shouldSendEmailNotification(base44, targetUser.email, notification_type, notification_subtype);
        if (shouldSendEmail) {
          await sendEmailViaIntegration(base44, targetUser.email, finalTitle, finalContent, tenantId);
          emailSentCount++;
        }
      }

      return Response.json({
        success: true,
        sent_count: notifications.length,
        email_sent_count: emailSentCount
      });
    } else {
      // 发送给单个用户
      if (!user_email) {
        return Response.json({ error: 'user_email is required when send_to_all is false' }, { status: 400 });
      }

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
        is_system: user.role === 'admin' || user.role === 'tenant_admin' || user.role === 'platform_admin',
        sender_email: user.email,
        priority,
        metadata,
        created_by: user.id
      });

      // 检查是否需要发送邮件
      const shouldSendEmail = await shouldSendEmailNotification(base44, user_email, notification_type, notification_subtype);
      if (shouldSendEmail) {
        await sendEmailViaIntegration(base44, user_email, finalTitle, finalContent, tenantId);
        emailSentCount = 1;
      }

      return Response.json({
        success: true,
        notification_id: notification.id,
        email_sent_count: emailSentCount
      });
    }

  } catch (error) {
    console.error('createNotificationWithEmail error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * 渲染模板变量
 */
function renderTemplate(template, metadata) {
  if (!template) return '';
  
  let result = template;
  Object.keys(metadata).forEach(key => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, String(metadata[key]));
  });
  return result;
}

/**
 * 检查用户是否开启了邮件通知
 */
async function shouldSendEmailNotification(base44, userEmail, notificationType, notificationSubtype) {
  try {
    const prefs = await base44.asServiceRole.entities.NotificationPreference.filter({
      user_email: userEmail
    });

    if (!prefs || prefs.length === 0) {
      return true; // 默认开启
    }

    const pref = prefs[0];
    const settings = pref.notification_settings || {};

    // 检查全局邮件开关
    if (!pref.email_enabled) {
      return false;
    }

    // 检查特定类型的邮件开关
    const typeSettings = settings[notificationType];
    if (!typeSettings) {
      return pref.email_enabled;
    }

    // 检查子类型设置
    if (notificationSubtype && typeSettings.subtypes) {
      const subtypeSettings = typeSettings.subtypes[notificationSubtype];
      if (subtypeSettings) {
        return subtypeSettings.email || false;
      }
    }

    return typeSettings.email !== false;
  } catch (error) {
    console.error('Error checking email preference:', error);
    return true; // 出错时默认发送
  }
}

/**
 * 使用 SendEmail 集成发送邮件
 */
async function sendEmailViaIntegration(base44, toEmail, subject, content, tenantId) {
  try {
    // 获取租户邮箱设置（必须按 tenant_id 过滤）
    const tenantEmailSettings = await base44.asServiceRole.entities.TenantEmailSettings.filter({
      tenant_id: tenantId
    });
    const settings = tenantEmailSettings && tenantEmailSettings.length > 0 ? tenantEmailSettings[0] : null;

    // 使用 SMTP 发送
    if (settings?.email_provider === 'smtp' && settings?.smtp_enabled) {
      await base44.functions.invoke('sendEmailViaSMTP', {
        to: toEmail,
        subject: subject,
        body: content,
        from_name: settings.smtp_from_name || settings.sender_name || '通知中心',
        from_email: settings.smtp_from_email || settings.sender_email || null,
      });
    }
    // 使用 Gmail 发送
    else if (settings?.email_provider === 'gmail' && settings?.gmail_connection_enabled) {
      await base44.functions.invoke('sendEmailViaGmail', {
        to: toEmail,
        subject: subject,
        body: content,
        from_name: settings.sender_name || '通知中心',
        from_email: settings.sender_email || null,
      });
    }
    // 使用平台默认邮件服务
    else {
      await base44.integrations.Core.SendEmail({
        to: toEmail,
        subject: subject,
        body: content,
        body_type: 'html'
      });
    }
  } catch (error) {
    console.error('Failed to send email:', error);
    // 邮件发送失败不影响站内通知
  }
}