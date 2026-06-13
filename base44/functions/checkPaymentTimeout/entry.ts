import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * checkPaymentTimeout
 * 定时任务：扫描各租户付款超时设置，对超时未付款订单发送提醒或自动取消。
 * 
 * 超时设置结构（SiteSettings）:
 *   key=payment_timeout_enabled  value=true/false
 *   key=payment_timeout_rules    value=JSON 数组 [{hours, subtype, cancel}]
 *     cancel=true 时自动将订单改为 cancelled
 * 
 * 需要付款的订单状态：payment_status in (pending, awaiting_payment, underpaid)
 * 且 order_status NOT IN (cancelled, expired, delivered, shipped)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // 允许定时器以 service role 调用（无用户）；也允许 admin 手动触发
    let isScheduled = false;
    let tenantId = null;
    let isTenantAdmin = false;

    try {
      const user = await base44.auth.me();
      if (user) {
        const isAdmin = user.role === 'admin' || user.role === 'tenant_admin' || user.role === 'platform_admin';
        if (!isAdmin) return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });
        isTenantAdmin = user.role !== 'platform_admin';
        if (isTenantAdmin) {
          const userRec = await base44.asServiceRole.entities.User.filter({ email: user.email });
          tenantId = userRec?.[0]?.tenant_id || null;
        }
      } else {
        isScheduled = true; // scheduled call (no auth header)
      }
    } catch {
      isScheduled = true;
    }

    const now = new Date();
    const results = { processed: 0, notified: 0, cancelled: 0, errors: [] };

    // 获取所有需要处理的租户设置
    let settingsQuery = { key: 'payment_timeout_enabled', value: 'true' };
    const enabledSettings = await base44.asServiceRole.entities.SiteSettings.filter(settingsQuery);

    // 如果是 tenant admin 手动触发，只处理自己的租户
    const tenantsToProcess = (isTenantAdmin && tenantId)
      ? enabledSettings.filter(s => s.tenant_id === tenantId)
      : enabledSettings;

    for (const setting of tenantsToProcess) {
      const tid = setting.tenant_id;
      if (!tid) continue;

      // 获取该租户的规则配置
      const rulesSettings = await base44.asServiceRole.entities.SiteSettings.filter({
        tenant_id: tid,
        key: 'payment_timeout_rules',
      });
      const rulesRaw = rulesSettings?.[0]?.value;
      let rules = [];
      try { rules = rulesRaw ? JSON.parse(rulesRaw) : []; } catch { continue; }
      if (!rules.length) continue;

      // 获取通知模板
      const templates = await base44.asServiceRole.entities.NotificationTemplate.filter({ tenant_id: tid });
      const templateMap = {};
      templates.forEach(t => { templateMap[t.notification_subtype] = t; });

      // 获取该租户的待付款订单
      const pendingOrders = await base44.asServiceRole.entities.Order.filter({
        tenant_id: tid,
        payment_status: { $in: ['pending', 'awaiting_payment', 'underpaid'] },
      });

      const TERMINAL_STATUSES = new Set(['cancelled', 'expired', 'delivered', 'shipped', 'transit_shipped']);

      for (const order of pendingOrders) {
        if (TERMINAL_STATUSES.has(order.order_status)) continue;
        // 计算订单已等待付款的小时数（从 created_date 起算）
        const createdAt = new Date(order.created_date);
        const elapsedHours = (now.getTime() - createdAt.getTime()) / 3600000;

        for (const rule of rules) {
          const ruleHours = parseFloat(rule.hours) || 0;
          if (!ruleHours || elapsedHours < ruleHours) continue;

          const subtype = rule.subtype || 'order_payment_timeout';
          const shouldCancel = rule.cancel === true || rule.cancel === 'true';

          // 防止重复发送：检查是否已发过该类型通知
          const alreadyNotified = await base44.asServiceRole.entities.Notification.filter({
            tenant_id: tid,
            recipient_email: order.user_email,
            notification_subtype: subtype,
            related_entity_id: order.id,
          });
          if (alreadyNotified && alreadyNotified.length > 0) {
            // 已通知过：如果是取消规则且订单未取消，仍然执行取消
            if (shouldCancel && order.order_status !== 'cancelled') {
              await base44.asServiceRole.entities.Order.update(order.id, {
                order_status: 'cancelled',
                cancel_reason: `付款超时自动取消（超过 ${ruleHours} 小时）`,
              });
              results.cancelled++;
            }
            continue;
          }

          // 获取用户信息
          const userRecs = await base44.asServiceRole.entities.User.filter({
            tenant_id: tid,
            email: order.user_email,
          });
          const targetUser = userRecs?.[0];
          if (!targetUser) continue;

          // 构建通知内容
          const tmpl = templateMap[subtype];
          const defTitle = subtype === 'order_payment_cancel'
            ? `订单 ${order.order_number || ''} 因未付款被取消`
            : `订单 ${order.order_number || ''} 待付款提醒`;
          const defContent = subtype === 'order_payment_cancel'
            ? `您的订单 ${order.order_number || ''} 因超过 ${ruleHours} 小时未完成付款，已被系统自动取消。`
            : `您有一笔订单 ${order.order_number || ''} 已超过 ${ruleHours} 小时未付款，请及时完成支付，避免订单被取消。`;

          const titleRaw = tmpl?.title_template || defTitle;
          const contentRaw = tmpl?.content_template || defContent;
          const title = titleRaw
            .replace(/\{\{order_number\}\}/g, order.order_number || '')
            .replace(/\{\{hours\}\}/g, String(ruleHours));
          const content = contentRaw
            .replace(/\{\{order_number\}\}/g, order.order_number || '')
            .replace(/\{\{hours\}\}/g, String(ruleHours))
            .replace(/\{\{amount\}\}/g, String(order.prepayment_amount_jpy || order.estimated_jpy || 0));

          // 获取租户邮件设置
          const emailSettings = await base44.asServiceRole.entities.TenantEmailSettings.filter({ tenant_id: tid });
          const emailConf = emailSettings?.[0];
          const shouldEmail = tmpl?.default_email !== false && emailConf?.email_provider && emailConf.email_provider !== 'platform';

          // 创建站内通知
          await base44.asServiceRole.entities.Notification.create({
            tenant_id: tid,
            recipient_email: order.user_email,
            recipient_user_id: targetUser.id,
            notification_type: 'payment',
            notification_subtype: subtype,
            title,
            content,
            is_read: false,
            related_entity_type: 'Order',
            related_entity_id: order.id,
            related_url: `/ja/MyOrders`,
            delivery_channel: 'in_app',
          });
          results.notified++;

          // 发送邮件通知
          if (shouldEmail && targetUser.email) {
            try {
              if (emailConf.email_provider === 'gmail') {
                await base44.asServiceRole.integrations.Core.SendEmail({
                  to: targetUser.email,
                  subject: title,
                  body: content,
                  from_name: emailConf.sender_name || tid,
                });
              } else if (emailConf.email_provider === 'smtp') {
                await base44.functions.invoke('sendEmailViaSMTP', {
                  to: targetUser.email,
                  subject: title,
                  body: content,
                  tenant_id: tid,
                });
              }
            } catch (emailErr) {
              results.errors.push(`email to ${targetUser.email}: ${emailErr.message}`);
            }
          }

          // 自动取消订单
          if (shouldCancel) {
            await base44.asServiceRole.entities.Order.update(order.id, {
              order_status: 'cancelled',
              cancel_reason: `付款超时自动取消（超过 ${ruleHours} 小时）`,
            });
            results.cancelled++;
          }

          results.processed++;
        }
      }
    }

    return Response.json({ success: true, ...results });
  } catch (error) {
    console.error('checkPaymentTimeout error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});