import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import moment from 'npm:moment@2.30.1';

/**
 * 计算订单的仓储管理费
 * 从入库日开始计算，超过存放期限的天数按日计费
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await req.json();
    const { order_id } = data;

    if (!order_id) {
      return Response.json({ error: 'order_id 是必填参数', success: false }, { status: 400 });
    }

    // 获取订单
    const order = await base44.asServiceRole.entities.Order.get(order_id);
    if (!order) {
      return Response.json({ error: '订单不存在', success: false }, { status: 404 });
    }

    // 验证租户权限
    if (order.tenant_id !== user.tenant_id && user.role !== 'platform_admin') {
      return Response.json({ error: '无权访问此订单', success: false }, { status: 403 });
    }

    // 获取租户库存设置
    const storageSettings = await base44.asServiceRole.entities.StorageSettings.filter({
      tenant_id: user.tenant_id,
      storage_enabled: true
    });

    if (!storageSettings || storageSettings.length === 0) {
      // 功能未启用
      return Response.json({
        success: true,
        storage_fee: 0,
        storage_days: 0,
        overdue_days: 0,
        enabled: false
      });
    }

    const settings = storageSettings[0];
    
    // 检查订单是否已入库
    if (!order.in_warehouse_date) {
      return Response.json({
        success: true,
        storage_fee: 0,
        storage_days: 0,
        overdue_days: 0,
        message: '订单尚未入库'
      });
    }

    // 获取外箱模板（如果订单使用了外箱）
    let storageFeePerDay = settings.default_storage_fee_per_day || 0;
    
    if (order.pre_shipment?.box_template_id) {
      const boxTemplate = await base44.asServiceRole.entities.BoxTemplate.get(order.pre_shipment.box_template_id);
      if (boxTemplate && boxTemplate.storage_fee_per_day > 0) {
        // 外箱模板设置的仓储费优先级更高
        storageFeePerDay = boxTemplate.storage_fee_per_day;
      }
    }

    // 计算存储天数
    const inWarehouseDate = moment(order.in_warehouse_date);
    const today = moment();
    const storageDays = today.diff(inWarehouseDate, 'days');
    
    // 计算超期天数
    const deadlineDays = settings.default_storage_days || 90;
    const overdueDays = Math.max(0, storageDays - deadlineDays);
    
    // 计算仓储费
    const storageFee = overdueDays * storageFeePerDay;

    return Response.json({
      success: true,
      storage_fee: storageFee,
      storage_fee_per_day: storageFeePerDay,
      storage_days: storageDays,
      overdue_days: overdueDays,
      deadline_days: deadlineDays,
      in_warehouse_date: order.in_warehouse_date,
      enabled: true
    });

  } catch (error) {
    console.error('[calculateStorageFee] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});