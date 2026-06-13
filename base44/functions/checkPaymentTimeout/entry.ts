import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * checkPaymentTimeout
 * 定时任务：扫描各租户付款超时设置，对超时未付款订单发送提醒或自动取消。
 *
 * SiteSettings:
 *   key=payment_timeout_enabled  value=true/false
 *   key=payment_timeout_rules    value=JSON [{hours, subtype, cancel}]
 *
 * 修复：
 *  1. 跳过已取消/已终态订单（防重复取消）
 *  2. 取消时同步 payment_status='pending'→保持但order_status=cancelled，防止下次再捞
 *  3. 每个订单每次扫描只处理"满足阈值中最高优先级(hours最大)"的一条规则，避免同轮多规则重复触发
 *  4. 取消规则执行后打上 cancel_reason 含 "付款超时" 标记，后续通知检查可识别
 *  5. tenantId 通过 User.filter({email}) 稳健获取
 */
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
          // 稳健地从 User 记录获取 tenant_id
          const userRecs = await base44.asServiceRole.entities.User.filter({ email: user.email });
          tenantId = userRecs?.[0]?.tenant_id || null;
        }
      }
      // else: scheduled context, tenantId=null → process all tenants
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

    // 终态订单状态（这些状态不应再被超时处理）
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

      // 规则按 hours 升序排列（方便后面找"最大满足规则"）
      const sortedRules = [...rules].sort((a, b) => (parseFloat(a.hours) || 0) - (parseFloat(b.hours) || 0));

      // 获取通知模板
      const templates = await base44.asServiceRole.entities.NotificationTemplate.filter({ tenant_id: tid });
      const templateMap = {};
      templates.forEach(t => { templateMap[t.notification_subtype] = t; });

      // 获取该租户的待付款订单（排除已终态）
      // payment_status in (pending, awaiting_payment, underpaid) AND order_status 排除终态
      const pendingOrders = await base44.asServiceRole.entities.Order.filter({
        tenant_id: tid,
        payment_status: { $in: ['pending', 'awaiting_payment', 'underpaid'] },
      });

      // 获取租户邮件设置（一次获取，复用）
      const emailSettings = await base44.asServiceRole.entities.TenantEmailSettings.filter({ tenant_id: tid });
      const emailConf = emailSettings?.[0];

      for (const order of pendingOrders) {
        // 跳过已终态订单（payment_status 可能未同步，但 order_status 是准确的）
        if (TERMINAL_STATUSES.has(order.order_status)) continue;

        const createdAt = new Date(order.created_date);
        const elapsedHours = (now.getTime() - createdAt.getTime()) / 3600000;

        // 找出当前时间满足的所有规则（elapsedHours >= rule.hours）
        const matchedRules = sortedRules.filter(r => {
          const rh = parseFloat(r.hours) || 0;
          return rh > 0 && elapsedHours >= rh;
        });
        if (!matchedRules.length) continue;

        // 策略：每次扫描只处理"小时数最大的那条规则"
        // 这样可避免在同一次扫描中重复处理多条规则
        const rule = matchedRules[matchedRules.length - 1];
        const ruleHours = parseFloat(rule.hours) || 0;
        const subtype = rule.subtype || 'order_payment_timeout';
        const shouldCancel = rule.cancel === true || rule.cancel === 'true';

        // 防重复发送通知：检查是否已发过该类型通知
        const alreadyNotified = await base44.asServiceRole.entities.Notification.filter({
          tenant_id: tid,
          recipient_email: order.user_email,
          notification_subtype: subtype,
          related_entity_id: order.id,
        });
        const notifiedBefore = alreadyNotified && alreadyNotified.length > 0;

        if (notifiedBefore) {
          // 已通知过：若是取消规则且订单未取消，补执行取消（幂等）
          if (shouldCancel && order.order_status !== 'cancelled') {
            await base44.asServiceRole.entities.Order.update(order.id, {
              order_status: 'cancelled',
              cancel_reason: `付款超时自动取消（超过 ${ruleHours} 小时）`,
            });
            results.cancelled++;
          }
          continue; // 不重复发通知
        }

        // ── 首次命中：发通知 ──────────────────────────────────────────────────

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
        }

        results.processed++;
      }
    }

    return Response.json({ success: true, ...results });
  } catch (error) {
    console.error('checkPaymentTimeout error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});