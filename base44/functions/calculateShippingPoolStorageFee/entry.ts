import moment from 'npm:moment@2.30.1';

/**
 * 计算订单的仓储费（包含在运费结算中）
 * 用于运费结算页面调用
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await req.json();
    const { order_ids } = data;

    if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0) {
      return Response.json({ error: 'order_ids 是必填参数', success: false }, { status: 400 });
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
        total_storage_fee: 0,
        orders: [],
        enabled: false
      });
    }

    const settings = storageSettings[0];
    const today = moment();
    let totalStorageFee = 0;
    const orderDetails = [];

    for (const orderId of order_ids) {
      const order = await base44.asServiceRole.entities.Order.get(orderId);
      if (!order || !order.in_warehouse_date) continue;

      // 验证租户权限
      if (order.tenant_id !== user.tenant_id && user.role !== 'platform_admin') {
        continue;
      }

      // 获取仓储费率（优先使用外箱模板）
      let storageFeePerDay = settings.default_storage_fee_per_day || 0;
      
      if (order.pre_shipment?.box_template_id) {
        const boxTemplate = await base44.asServiceRole.entities.BoxTemplate.get(order.pre_shipment.box_template_id);
        if (boxTemplate && boxTemplate.storage_fee_per_day > 0) {
          storageFeePerDay = boxTemplate.storage_fee_per_day;
        }
      }

      if (storageFeePerDay === 0) continue;

      // 计算存储天数和超期天数
      const inWarehouseDate = moment(order.in_warehouse_date);
      const storageDays = today.diff(inWarehouseDate, 'days');
      const deadlineDays = settings.default_storage_days || 90;
      const overdueDays = Math.max(0, storageDays - deadlineDays);

      if (overdueDays === 0) continue;

      // 计算费用
      const storageFee = overdueDays * storageFeePerDay;
      totalStorageFee += storageFee;

      orderDetails.push({
        order_id: orderId,
        order_number: order.order_number,
        storage_days: storageDays,
        overdue_days: overdueDays,
        storage_fee_per_day: storageFeePerDay,
        storage_fee: storageFee
      });
    }

    return Response.json({
      success: true,
      total_storage_fee: totalStorageFee,
      order_count: orderDetails.length,
      orders: orderDetails,
      enabled: true
    });

  } catch (error) {
    console.error('[calculateShippingPoolStorageFee] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});