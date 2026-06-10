import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * 创建平台级跨租户通知
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'platform_admin') {
      return Response.json({ error: 'Unauthorized: Platform admin only' }, { status: 403 });
    }

    const data = await req.json();
    const {
      notification_type,
      notification_subtype,
      title,
      content,
      related_entity_type,
      related_entity_id,
      related_url,
      priority = 'normal',
      metadata = {},
      send_to_all_tenants = false,
      send_to_admins_only = true,
      target_tenant_ids = [],
      send_email = false
    } = data;

    // 获取目标租户列表
    let tenantIds = [];
    if (send_to_all_tenants) {
      const allTenants = await base44.asServiceRole.entities.Tenant.filter({ is_active: true });
      tenantIds = allTenants.map(t => t.id);
    } else {
      tenantIds = target_tenant_ids;
    }

    if (tenantIds.length === 0) {
      return Response.json({ error: 'No target tenants selected' }, { status: 400 });
    }

    // 获取目标租户的用户（根据 send_to_admins_only 过滤）
    let allUsers = [];
    if (send_to_admins_only) {
      // 只获取管理员
      const adminUsers = await base44.asServiceRole.entities.User.filter({
        tenant_id: tenantIds,
        role: 'admin'
      });
      const tenantAdminUsers = await base44.asServiceRole.entities.User.filter({
        tenant_id: tenantIds,
        role: 'tenant_admin'
      });
      const platformAdminUsers = await base44.asServiceRole.entities.User.filter({
        role: 'platform_admin'
      });
      // 去重合并
      const userMap = new Map();
      [...(adminUsers || []), ...(tenantAdminUsers || []), ...(platformAdminUsers || [])].forEach(u => {
        userMap.set(u.id, u);
      });
      allUsers = Array.from(userMap.values());
    } else {
      // 获取所有用户
      allUsers = await base44.asServiceRole.entities.User.filter({
        tenant_id: tenantIds
      });
    }

    const notifications = [];
    let emailSentCount = 0;

    // 为每个用户创建通知
    for (const targetUser of allUsers) {
      // 创建站内通知
      const notification = await base44.asServiceRole.entities.Notification.create({
        tenant_id: targetUser.tenant_id,
        user_email: targetUser.email,
        notification_type,
        notification_subtype,
        icon: data.icon || 'Globe',
        title,
        content,
        related_entity_type,
        related_entity_id,
        related_url,
        is_system: true,
        is_platform: true,
        sender_email: user.email,
        priority,
        metadata,
        created_by: user.id
      });
      notifications.push(notification);

      // 检查是否需要发送邮件
      if (send_email) {
        const shouldSendEmail = await shouldSendEmailNotification(base44, targetUser.email, notification_type, notification_subtype);
        if (shouldSendEmail) {
          await sendEmailViaIntegration(base44, targetUser.email, title, content);
          emailSentCount++;
        }
      }
    }

    // 统计租户数量
    const uniqueTenantIds = [...new Set(notifications.map(n => n.tenant_id))];

    return Response.json({
      success: true,
      sent_count: notifications.length,
      tenant_count: uniqueTenantIds.length,
      email_sent_count: emailSentCount
    });

  } catch (error) {
    console.error('createPlatformNotification error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

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
async function sendEmailViaIntegration(base44, toEmail, subject, content) {
  try {
    await base44.integrations.Core.SendEmail({
      to: toEmail,
      subject: subject,
      body: content,
      body_type: 'html'
    });
  } catch (error) {
    console.error('Failed to send email:', error);
    // 邮件发送失败不影响站内通知
  }
}