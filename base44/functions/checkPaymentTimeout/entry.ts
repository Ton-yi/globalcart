import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * checkPaymentTimeout
 * 定时任务：扫描各租户付款超时设置，对超时未付款订单发送提醒或自动取消。
 *
 * SiteSettings:
 *   key=payment_timeout_enabled  value=true/false
 *   key=payment_timeout_rules    value=JSON [{hours, subtype, cancel}]
 *
 * 核心逻辑：
 *  - 规则按 hours 升序排列，每条规则独立处理（通过 Notification 记录做幂等）
 *  - 每条规则：若已发过通知 → 仅补执行取消（幂等）；若未发过 → 发通知，若 cancel=true 则同时取消
 *  - 这样 24h提醒 + 168h取消 能分别正确触发，用户先收到提醒再被取消
 *  - 取消后的订单（order_status=cancelled）跳过所有规则处理
 */

const PAGE_SIZE = 200;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // 允许定时器以 service role 调用（无用户）；也允许 admin 手动触发
    let tenantId = null;
    let isTenantAdmin = false;

    try {
      const user = await base44.auth.me();
      if (user) {
        const isAdmin = user.role === 'admin' || user.role === 'tenant_admin' || user.role === 'platform_admin';
        if (!isAdmin) return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });
        isTenantAdmin = user.role !== 'platform_admin';
        if (isTenantAdmin) {
          const userRecs = await base44.asServiceRole.entities.User.filter({ email: user.email });
          tenantId = userRecs?.[0]?.tenant_id || null;
        }
      }
    } catch {
      // No auth = scheduled context
    }

    const now = new Date();
    const results = { processed: 0, notified: 0, cancelled: 0, errors: [] };

    // 获取所有已启用的租户超时设置
    const enabledSettings = await base44.asServiceRole.entities.SiteSettings.filter({
      key: 'payment_timeout_enabled',
      value: 'true',
    });

    // 如果是 tenant admin 手动触发，只处理自己的租户
    const tenantsToProcess = (isTenantAdmin && tenantId)
      ? enabledSettings.filter(s => s.tenant_id === tenantId)
      : enabledSettings;

    // 终态订单状态（已取消/终态不再处理）
    const TERMINAL_STATUSES = new Set([
      'cancelled', 'expired', 'delivered', 'shipped', 'transit_shipped',
    ]);

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

      // 规则按 hours 升序排列，确保逐条按时间顺序处理
      const sortedRules = [...rules]
        .filter(r => parseFloat(r.hours) > 0)
        .sort((a, b) => (parseFloat(a.hours) || 0) - (parseFloat(b.hours) || 0));
      if (!sortedRules.length) continue;

      // 获取通知模板
      const templates = await base44.asServiceRole.entities.NotificationTemplate.filter({ tenant_id: tid });
      const templateMap = {};
      templates.forEach(t => { templateMap[t.notification_subtype] = t; });

      // 获取该租户的待付款订单（分页，排除已终态）
      let pendingOrders = [];
      let orderSkip = 0;
      while (true) {
        const page = await base44.asServiceRole.entities.Order.filter(
          {
            tenant_id: tid,
            payment_status: { $in: ['pending', 'awaiting_payment', 'underpaid'] },
          },
          '-created_date', PAGE_SIZE, orderSkip
        );
        if (!page || page.length === 0) break;
        pendingOrders.push(...page);
        if (page.length < PAGE_SIZE) break;
        orderSkip += PAGE_SIZE;
      }

      // 获取租户邮件设置
      const emailSettings = await base44.asServiceRole.entities.TenantEmailSettings.filter({ tenant_id: tid });
      const emailConf = emailSettings?.[0];

      for (const order of pendingOrders) {
        // 跳过已终态订单
        if (TERMINAL_STATUSES.has(order.order_status)) continue;

        const createdAt = new Date(order.created_date);
        const elapsedHours = (now.getTime() - createdAt.getTime()) / 3600000;

        // 逐条规则处理（按 hours 升序）
        // 每条规则独立幂等：已发通知 → 仅补执行取消；未发通知且满足时间 → 发通知+可选取消
        for (const rule of sortedRules) {
          const ruleHours = parseFloat(rule.hours) || 0;
          if (elapsedHours < ruleHours) break; // 时间未到，后续规则也不会满足

          const subtype = rule.subtype || 'order_payment_timeout';
          const shouldCancel = rule.cancel === true || rule.cancel === 'true';

          // 检查此订单是否已发过此规则对应的通知
          const alreadyNotified = await base44.asServiceRole.entities.Notification.filter({
            tenant_id: tid,
            recipient_email: order.user_email,
            notification_subtype: subtype,
            related_entity_id: order.id,
          });
          const notifiedBefore = alreadyNotified && alreadyNotified.length > 0;

          if (notifiedBefore) {
            // 已通知过此规则：若是取消规则且订单未取消，补执行取消（幂等）
            if (shouldCancel && order.order_status !== 'cancelled') {
              await base44.asServiceRole.entities.Order.update(order.id, {
                order_status: 'cancelled',
                cancel_reason: `付款超时自动取消（超过 ${ruleHours} 小时）`,
              });
              results.cancelled++;
              // 订单已取消，终止该订单后续规则
              break;
            }
            continue; // 不重复发通知，继续下一条规则
          }

          // ── 首次命中此规则：发通知 ────────────────────────────────────────────

          // 获取用户信息
          const userRecs = await base44.asServiceRole.entities.User.filter({
            tenant_id: tid,
            email: order.user_email,
          });
          const targetUser = userRecs?.[0];
          if (!targetUser) continue;

          // 构建通知内容（支持模板替换）
          const tmpl = templateMap[subtype];
          const defTitle = shouldCancel
            ? `订单 ${order.order_number || ''} 因未付款被取消`
            : `订单 ${order.order_number || ''} 待付款提醒`;
          const defContent = shouldCancel
            ? `您的订单 ${order.order_number || ''} 因超过 ${ruleHours} 小时未完成付款，已被系统自动取消。`
            : `您有一笔订单 ${order.order_number || ''} 已超过 ${ruleHours} 小时未付款，请及时完成支付，避免订单被取消。`;

          const replace = (s) => s
            .replace(/\{\{order_number\}\}/g, order.order_number || '')
            .replace(/\{\{hours\}\}/g, String(ruleHours))
            .replace(/\{\{amount\}\}/g, String(order.prepayment_amount_jpy || order.estimated_jpy || 0));

          const title = replace(tmpl?.title_template || defTitle);
          const content = replace(tmpl?.content_template || defContent);

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
          const shouldEmail = tmpl?.default_email !== false
            && emailConf?.email_provider
            && emailConf.email_provider !== 'platform';
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
            break; // 订单已取消，不再处理该订单的后续规则
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