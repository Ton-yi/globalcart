import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import moment from 'npm:moment@2.30.1';

/**
 * 检查并处理超期订单
 * 此函数应该作为 scheduled automation 每日运行
 * 仅管理员可访问
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    // 如果是自动化调用，可能没有用户上下文
    const isAutomated = !user;
    
    // 自动化模式下使用 service role
    const serviceBase44 = isAutomated ? base44.asServiceRole : base44;

    // 获取所有启用库存管理的租户
    const storageSettingsList = await serviceBase44.entities.StorageSettings.filter({
      storage_enabled: true
    });

    if (!storageSettingsList || storageSettingsList.length === 0) {
      return Response.json({ 
        success: true, 
        message: '没有租户启用库存管理',
        processed_tenants: 0,
        processed_orders: 0
      });
    }

    let processedTenants = 0;
    let processedOrders = 0;
    let sentReminders = 0;
    let changedStatuses = 0;
    let addedFees = 0;

    for (const settings of storageSettingsList) {
      const tenantId = settings.tenant_id;
      
      try {
        // 获取该租户下所有在库订单
        const orders = await serviceBase44.entities.Order.filter({
          tenant_id: tenantId,
          order_status: 'in_storage'
        });

        if (!orders || orders.length === 0) {
          continue;
        }

        processedTenants++;
        const today = moment();
        const reminderDays = settings.default_reminder_days || 60;
        const deadlineDays = settings.default_storage_days || 90;

        for (const order of orders) {
          if (!order.in_warehouse_date) continue;

          const inWarehouseDate = moment(order.in_warehouse_date);
          const storageDays = today.diff(inWarehouseDate, 'days');
          const overdueDays = Math.max(0, storageDays - deadlineDays);

          // 检查是否需要发送提醒（即将到期）
          if (storageDays >= reminderDays && storageDays < deadlineDays && !order.storage_reminder_sent) {
            await sendReminderNotification(serviceBase44, order, settings, 'upcoming');
            await serviceBase44.entities.Order.update(order.id, { storage_reminder_sent: true });
            sentReminders++;
          }

          // 检查是否已到期
          if (storageDays >= deadlineDays) {
            const updates = {
              storage_days_overdue: overdueDays
            };

            // 发送已到期通知
            if (!order.storage_expired_sent) {
              await sendReminderNotification(serviceBase44, order, settings, 'expired');
              updates.storage_expired_sent = true;
              sentReminders++;
            }

            // 根据设置追加仓储费
            if (settings.on_deadline_action.includes('add_fee')) {
              let storageFeePerDay = settings.default_storage_fee_per_day || 0;
              
              // 检查外箱模板设置
              if (order.pre_shipment?.box_template_id) {
                const boxTemplate = await serviceBase44.entities.BoxTemplate.get(order.pre_shipment.box_template_id);
                if (boxTemplate && boxTemplate.storage_fee_per_day > 0) {
                  storageFeePerDay = boxTemplate.storage_fee_per_day;
                }
              }

              if (storageFeePerDay > 0) {
                const accruedFee = overdueDays * storageFeePerDay;
                updates.accrued_storage_fee_jpy = accruedFee;
                addedFees++;

                // 发送费用通知
                await sendReminderNotification(serviceBase44, order, settings, 'fee_required');
              }
            }

            // 根据设置更新订单状态
            if (settings.on_deadline_action.includes('change_status')) {
              const newStatus = settings.deadline_status || 'expired';
              updates.order_status = newStatus;
              changedStatuses++;
            }

            // 更新订单
            await serviceBase44.entities.Order.update(order.id, updates);
            processedOrders++;
          }
        }
      } catch (error) {
        console.error(`[checkExpiredOrders] 处理租户 ${tenantId} 时出错:`, error);
      }
    }

    return Response.json({ 
      success: true, 
      message: '超期订单检查完成',
      processed_tenants: processedTenants,
      processed_orders: processedOrders,
      sent_reminders: sentReminders,
      changed_statuses: changedStatuses,
      added_fees: addedFees
    });

  } catch (error) {
    console.error('[checkExpiredOrders] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * 发送库存相关通知
 */
async function sendReminderNotification(base44, order, settings, type) {
  try {
    let templateId = null;
    let notificationType = 'other';
    let notificationSubtype = 'storage_reminder';

    if (type === 'upcoming') {
      templateId = settings.deadline_reminder_template_id;
      notificationSubtype = 'storage_upcoming_deadline';
    } else if (type === 'expired') {
      templateId = settings.expired_reminder_template_id;
      notificationSubtype = 'storage_expired';
    } else if (type === 'fee_required') {
      templateId = settings.fee_reminder_template_id;
      notificationSubtype = 'storage_fee_required';
    }

    // 构建通知内容
    const title = getNotificationTitle(type, order.order_number);
    const content = getNotificationContent(type, order, settings);

    await base44.functions.invoke('createNotificationWithEmail', {
      tenant_id: order.tenant_id,
      notifications: [{
        user_email: order.user_email,
        notification_type: notificationType,
        notification_subtype: notificationSubtype,
        title: title,
        content: content,
        related_entity_type: 'Order',
        related_entity_id: order.id,
        related_url: `/MyOrders`,
        metadata: {
          order_number: order.order_number,
          storage_days: order.storage_days_overdue || 0,
          accrued_fee: order.accrued_storage_fee_jpy || 0
        }
      }]
    });
  } catch (error) {
    console.error('[sendReminderNotification] error:', error);
  }
}

function getNotificationTitle(type, orderNumber) {
  if (type === 'upcoming') {
    return `订单 ${orderNumber} 即将超过仓储期限`;
  } else if (type === 'expired') {
    return `订单 ${orderNumber} 已超过仓储期限`;
  } else if (type === 'fee_required') {
    return `订单 ${orderNumber} 需要支付逾期仓储费`;
  }
  return '仓储期限通知';
}

function getNotificationContent(type, order, settings) {
  const inWarehouseDate = order.in_warehouse_date;
  const deadlineDays = settings.default_storage_days || 90;
  const reminderDays = settings.default_reminder_days || 60;

  if (type === 'upcoming') {
    return `尊敬的 ${order.user_name}：\n\n您的订单 ${order.order_number} 自 ${inWarehouseDate} 入库以来，已存放 ${reminderDays} 天。\n\n仓储期限为 ${deadlineDays} 天，即将到期。请您尽快处理发货事宜，避免产生额外费用。\n\n如有任何问题，请联系客服。`;
  } else if (type === 'expired') {
    const overdueDays = order.storage_days_overdue || 0;
    return `尊敬的 ${order.user_name}：\n\n您的订单 ${order.order_number} 自 ${inWarehouseDate} 入库以来，已超过仓储期限 ${overdueDays} 天。\n\n订单状态已更新为「已超时」。请您尽快联系客服处理后续事宜。\n\n谢谢配合。`;
  } else if (type === 'fee_required') {
    const accruedFee = order.accrued_storage_fee_jpy || 0;
    return `尊敬的 ${order.user_name}：\n\n您的订单 ${order.order_number} 已超过仓储期限，产生逾期仓储费 ${accruedFee} JPY。\n\n此费用将在您下次支付运费时一并结算。请您尽快处理发货事宜。\n\n如有任何问题，请联系客服。`;
  }
  return '';
}