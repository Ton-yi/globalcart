import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * 初始化库存存放期限功能
 * - 创建通知模板并返回 ID
 * - 更新 StorageSettings 关联模板
 * - 建议创建 scheduled automation
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

    const tenantId = user.tenant_id;
    
    // 1. 创建或更新通知模板
    const templates = [
      {
        notification_type: 'other',
        notification_subtype: 'storage_upcoming_deadline',
        title_template: '订单 {{order_number}} 即将超过仓储期限',
        content_template: '尊敬的 {{user_name}}：\n\n您的订单 {{order_number}} 自 {{in_warehouse_date}} 入库以来，已存放 {{storage_days}} 天。\n\n仓储期限为 {{deadline_days}} 天，即将到期。请您尽快处理发货事宜，避免产生额外费用。\n\n如有任何问题，请联系客服。',
        default_in_app: true,
        default_email: true,
      },
      {
        notification_type: 'other',
        notification_subtype: 'storage_expired',
        title_template: '订单 {{order_number}} 已超过仓储期限',
        content_template: '尊敬的 {{user_name}}：\n\n您的订单 {{order_number}} 自 {{in_warehouse_date}} 入库以来，已超过仓储期限 {{overdue_days}} 天。\n\n订单状态已更新为「已超时」。请您尽快联系客服处理后续事宜。\n\n谢谢配合。',
        default_in_app: true,
        default_email: true,
      },
      {
        notification_type: 'other',
        notification_subtype: 'storage_fee_required',
        title_template: '订单 {{order_number}} 需要支付逾期仓储费',
        content_template: '尊敬的 {{user_name}}：\n\n您的订单 {{order_number}} 已超过仓储期限，产生逾期仓储费 {{accrued_fee}} JPY。\n\n此费用将在您下次支付运费时一并结算。请您尽快处理发货事宜。\n\n如有任何问题，请联系客服。',
        default_in_app: true,
        default_email: true,
      }
    ];

    const templateIds = {};
    
    for (const templateData of templates) {
      const existing = await base44.asServiceRole.entities.NotificationTemplate.filter({
        tenant_id: tenantId,
        notification_subtype: templateData.notification_subtype
      });

      if (existing && existing.length > 0) {
        // 更新现有模板
        await base44.asServiceRole.entities.NotificationTemplate.update(existing[0].id, {
          ...templateData,
          updated_by: user.email
        });
        templateIds[templateData.notification_subtype] = existing[0].id;
      } else {
        // 创建新模板
        const created = await base44.asServiceRole.entities.NotificationTemplate.create({
          ...templateData,
          tenant_id: tenantId,
          updated_by: user.email
        });
        templateIds[templateData.notification_subtype] = created.id;
      }
    }

    // 2. 更新或创建 StorageSettings，关联模板 ID
    const existingSettings = await base44.asServiceRole.entities.StorageSettings.filter({
      tenant_id: tenantId
    });

    if (existingSettings && existingSettings.length > 0) {
      await base44.asServiceRole.entities.StorageSettings.update(existingSettings[0].id, {
        deadline_reminder_template_id: templateIds['storage_upcoming_deadline'],
        expired_reminder_template_id: templateIds['storage_expired'],
        fee_reminder_template_id: templateIds['storage_fee_required'],
        updated_by: user.email,
        updated_at: new Date().toISOString()
      });
    } else {
      await base44.asServiceRole.entities.StorageSettings.create({
        tenant_id: tenantId,
        storage_enabled: false,
        default_storage_days: 90,
        default_reminder_days: 60,
        default_storage_fee_per_day: 0,
        storage_fee_currency: 'JPY',
        on_deadline_action: 'change_status',
        deadline_status: 'expired',
        deadline_reminder_template_id: templateIds['storage_upcoming_deadline'],
        expired_reminder_template_id: templateIds['storage_expired'],
        fee_reminder_template_id: templateIds['storage_fee_required'],
        updated_by: user.email,
        updated_at: new Date().toISOString()
      });
    }

    return Response.json({ 
      success: true,
      message: '库存存放期限功能初始化完成',
      template_ids: templateIds,
      next_steps: [
        '1. 在 AdminSettings → 库存存放 中启用功能',
        '2. 配置存放期限、提醒天数和仓储费率',
        '3. 在 Dashboard → Code → Automations 中创建 scheduled automation',
        '   - Function: checkExpiredOrders',
        '   - Schedule: 每日凌晨 2 点',
        '   - Repeat: 每天，start_time: "02:00"'
      ]
    });

  } catch (error) {
    console.error('[initializeStorageFeature] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});