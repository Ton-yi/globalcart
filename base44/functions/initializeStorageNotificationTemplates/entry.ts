import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * 初始化库存存放期限相关的通知模板
 * 仅管理员可访问
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 权限验证
    if (user.role !== 'admin' && user.role !== 'tenant_admin' && user.role !== 'platform_admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const templates = [
      {
        notification_type: 'other',
        notification_subtype: 'storage_upcoming_deadline',
        title_template: '订单 {{order_number}} 即将超过仓储期限',
        content_template: '尊敬的 {{user_name}}：\n\n您的订单 {{order_number}} 自 {{in_warehouse_date}} 入库以来，已存放 {{storage_days}} 天。\n\n仓储期限为 {{deadline_days}} 天，即将到期。请您尽快处理发货事宜，避免产生额外费用。\n\n如有任何问题，请联系客服。',
        default_in_app: true,
        default_email: true,
        is_active: true,
        updated_by: user.email
      },
      {
        notification_type: 'other',
        notification_subtype: 'storage_expired',
        title_template: '订单 {{order_number}} 已超过仓储期限',
        content_template: '尊敬的 {{user_name}}：\n\n您的订单 {{order_number}} 自 {{in_warehouse_date}} 入库以来，已超过仓储期限 {{overdue_days}} 天。\n\n订单状态已更新为「已超时」。请您尽快联系客服处理后续事宜。\n\n谢谢配合。',
        default_in_app: true,
        default_email: true,
        is_active: true,
        updated_by: user.email
      },
      {
        notification_type: 'other',
        notification_subtype: 'storage_fee_required',
        title_template: '订单 {{order_number}} 需要支付逾期仓储费',
        content_template: '尊敬的 {{user_name}}：\n\n您的订单 {{order_number}} 已超过仓储期限，产生逾期仓储费 {{accrued_fee}} JPY。\n\n此费用将在您下次支付运费时一并结算。请您尽快处理发货事宜。\n\n如有任何问题，请联系客服。',
        default_in_app: true,
        default_email: true,
        is_active: true,
        updated_by: user.email
      }
    ];

    // 检查现有模板
    const existingTemplates = await base44.asServiceRole.entities.NotificationTemplate.filter({
      tenant_id: user.tenant_id
    });

    for (const template of templates) {
      const existing = existingTemplates.find(t => 
        t.notification_subtype === template.notification_subtype
      );

      if (existing) {
        // 更新现有模板
        await base44.asServiceRole.entities.NotificationTemplate.update(existing.id, {
          ...template,
          tenant_id: user.tenant_id
        });
      } else {
        // 创建新模板
        await base44.asServiceRole.entities.NotificationTemplate.create({
          ...template,
          tenant_id: user.tenant_id
        });
      }
    }

    return Response.json({ 
      success: true,
      message: '已初始化 3 个库存存放期限通知模板',
      templates: templates.map(t => t.notification_subtype)
    });

  } catch (error) {
    console.error('[initializeStorageNotificationTemplates] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});