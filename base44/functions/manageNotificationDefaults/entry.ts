import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * 管理通知默认设置（租户级或平台级）
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 权限检查：平台管理员或租户管理员
    if (user.role !== 'platform_admin' && user.role !== 'tenant_admin' && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    const data = await req.json();
    const {
      action,
      defaults_id,
      in_app_enabled,
      email_enabled,
      notification_settings,
      description
    } = data;

    // 获取用户租户上下文
    const userRecords = await base44.asServiceRole.entities.User.filter({ email: user.email });
    if (!userRecords || userRecords.length === 0) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const tenantId = userRecords[0].tenant_id;
    const isPlatformAdmin = user.role === 'platform_admin';

    // 平台管理员可以设置平台级或租户级默认值
    // 租户管理员只能设置自己租户的默认值
    const targetTenantId = isPlatformAdmin && data.tenant_id ? data.tenant_id : tenantId;

    if (action === 'get') {
      // 获取默认设置
      const defaults = await base44.asServiceRole.entities.NotificationPreferenceDefaults.filter({
        tenant_id: targetTenantId || null
      });

      if (defaults && defaults.length > 0) {
        return Response.json({ defaults: defaults[0] });
      }

      // 返回默认值
      return Response.json({
        defaults: {
          tenant_id: targetTenantId || null,
          in_app_enabled: true,
          email_enabled: true,
          notification_settings: {
            payment: { in_app: true, email: true },
            shipping_request: { in_app: true, email: true },
            order_status: { 
              in_app: true, 
              email: false,
              subtypes: {
                order_created: { in_app: false, email: false },
                order_payment_confirmed: { in_app: true, email: false },
                order_purchased: { in_app: true, email: false },
                order_in_warehouse: { in_app: true, email: false },
                order_added_to_pool: { in_app: false, email: false }
              }
            },
            message: { in_app: true, email: true },
            other: { in_app: true, email: false }
          },
          description: ''
        }
      });

    } else if (action === 'save') {
      // 保存默认设置
      const existing = await base44.asServiceRole.entities.NotificationPreferenceDefaults.filter({
        tenant_id: targetTenantId || null
      });

      const defaultsData = {
        tenant_id: targetTenantId || null,
        in_app_enabled: in_app_enabled ?? true,
        email_enabled: email_enabled ?? true,
        notification_settings: notification_settings || {},
        description: description || '',
        updated_by: user.email
      };

      if (existing && existing.length > 0) {
        // 更新
        const updated = await base44.asServiceRole.entities.NotificationPreferenceDefaults.update(
          existing[0].id,
          defaultsData
        );
        return Response.json({ success: true, defaults: updated });
      } else {
        // 创建
        const created = await base44.asServiceRole.entities.NotificationPreferenceDefaults.create(defaultsData);
        return Response.json({ success: true, defaults: created });
      }

    } else {
      return Response.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('manageNotificationDefaults error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});