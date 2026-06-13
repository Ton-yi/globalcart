import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * 初始化默认通知模板（每个子类型一个）
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

    const userRecords = await base44.asServiceRole.entities.User.filter({ email: user.email });
    if (!userRecords || userRecords.length === 0) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const tenantId = userRecords[0].tenant_id;

    // 定义所有通知子类型的默认模板
    const defaultTemplates = [
      // 付款通知
      {
        notification_type: 'payment',
        notification_subtype: 'order_payment_required',
        title_template: '订单 {{order_number}} 需付款',
        content_template: '您的订单 {{order_number}} 需支付 {{amount}} JPY，请及时付款。',
        default_in_app: true,
        default_email: true,
      },
      {
        notification_type: 'payment',
        notification_subtype: 'order_supplement_required',
        title_template: '订单 {{order_number}} 需补款',
        content_template: '您的订单 {{order_number}} 需补款 {{amount}} JPY，请查看订单详情。',
        default_in_app: true,
        default_email: true,
      },
      {
        notification_type: 'payment',
        notification_subtype: 'shipping_fee_required',
        title_template: '发货申请需付运费',
        content_template: '您的发货申请需支付运费 {{amount}} {{currency}}，请及时付款。',
        default_in_app: true,
        default_email: true,
      },
      {
        notification_type: 'payment',
        notification_subtype: 'shipping_fee_supplement_required',
        title_template: '发货申请需补运费',
        content_template: '您的发货申请需补运费 {{amount}} {{currency}}，请查看。',
        default_in_app: true,
        default_email: true,
      },
      
      // 发货通知
      {
        notification_type: 'shipping_request',
        notification_subtype: 'shipping_request_sent',
        title_template: '发货申请已发出',
        content_template: '您的发货申请已提交，等待管理员处理。',
        default_in_app: true,
        default_email: false,
      },
      {
        notification_type: 'shipping_request',
        notification_subtype: 'shipping_request_arrived',
        title_template: '发货申请已送达中转地',
        content_template: '您的发货申请已送达中转地 {{transit_location_name}}，正在处理中。',
        default_in_app: true,
        default_email: true,
      },
      {
        notification_type: 'shipping_request',
        notification_subtype: 'transit_shipped',
        title_template: '中转地已发货',
        content_template: '您的货物已从中转地发出，运单号：{{tracking_number}}',
        default_in_app: true,
        default_email: true,
      },
      
      // 订单状态
      {
        notification_type: 'order_status',
        notification_subtype: 'order_created',
        title_template: '订单 {{order_number}} 已创建',
        content_template: '您的订单 {{order_number}} 已创建成功，等待管理员确认。',
        default_in_app: false,
        default_email: false,
      },
      {
        notification_type: 'order_status',
        notification_subtype: 'order_payment_confirmed',
        title_template: '订单 {{order_number}} 付款已确认',
        content_template: '您的订单 {{order_number}} 付款已确认，我们将尽快处理。',
        default_in_app: true,
        default_email: false,
      },
      {
        notification_type: 'order_status',
        notification_subtype: 'order_purchased',
        title_template: '订单 {{order_number}} 已下单',
        content_template: '您的订单 {{order_number}} 已成功下单，预计 {{estimated_days}} 天内入库。',
        default_in_app: true,
        default_email: false,
      },
      {
        notification_type: 'order_status',
        notification_subtype: 'order_in_warehouse',
        title_template: '订单 {{order_number}} 已入库',
        content_template: '您的订单 {{order_number}} 已入库，可以提交发货申请了。',
        default_in_app: true,
        default_email: false,
      },
      {
        notification_type: 'order_status',
        notification_subtype: 'order_added_to_pool',
        title_template: '订单已添加至发货申请',
        content_template: '您的订单 {{order_number}} 已添加到发货申请 {{pool_code}}。',
        default_in_app: false,
        default_email: false,
      },
      
      // 留言回复
      {
        notification_type: 'message',
        notification_subtype: 'new_reply',
        title_template: '订单/发货申请有新回复',
        content_template: '您的订单 {{order_number}} 或发货申请有新回复，请查看。',
        default_in_app: true,
        default_email: true,
      },
      
      // 其他通知
      {
        notification_type: 'other',
        notification_subtype: 'store_template_pending_review',
        title_template: '店铺模板待审核',
        content_template: '您有新的店铺模板提交，等待审核。',
        default_in_app: true,
        default_email: false,
      },
      {
        notification_type: 'other',
        notification_subtype: 'store_template_reviewed',
        title_template: '店铺模板审核结果',
        content_template: '您的店铺模板 {{template_name}} 审核{{review_result}}，请查看。',
        default_in_app: true,
        default_email: true,
      },
      // 付款超时提醒
      {
        notification_type: 'payment',
        notification_subtype: 'order_payment_timeout',
        title_template: '订单 {{order_number}} 待付款提醒',
        content_template: '您有一笔订单 {{order_number}} 已超过 {{hours}} 小时未付款，请及时完成支付，避免订单被取消。',
        default_in_app: true,
        default_email: true,
      },
      // 付款超时自动取消通知
      {
        notification_type: 'payment',
        notification_subtype: 'order_payment_cancel',
        title_template: '订单 {{order_number}} 因未付款被取消',
        content_template: '您的订单 {{order_number}} 因超过 {{hours}} 小时未完成付款，已被系统自动取消。如有疑问请联系客服。',
        default_in_app: true,
        default_email: true,
      },
    ];

    const created = [];
    const updated = [];

    // 检查并创建/更新模板
    for (const template of defaultTemplates) {
      const existing = await base44.asServiceRole.entities.NotificationTemplate.filter({
        tenant_id: tenantId,
        notification_type: template.notification_type,
        notification_subtype: template.notification_subtype
      });

      if (existing && existing.length > 0) {
        // 更新现有模板
        await base44.asServiceRole.entities.NotificationTemplate.update(
          existing[0].id,
          {
            ...template,
            is_active: true,
            updated_by: user.email
          }
        );
        updated.push(template.notification_subtype);
      } else {
        // 创建新模板
        await base44.asServiceRole.entities.NotificationTemplate.create({
          ...template,
          tenant_id: tenantId,
          is_active: true,
          updated_by: user.email
        });
        created.push(template.notification_subtype);
      }
    }

    return Response.json({
      success: true,
      created_count: created.length,
      updated_count: updated.length,
      created_subtypes: created,
      updated_subtypes: updated
    });

  } catch (error) {
    console.error('initializeDefaultNotificationTemplates error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});