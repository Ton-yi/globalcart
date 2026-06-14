import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * migrateTicketOrders
 * 一次性迁移脚本：将所有 is_ticket_order=true 的历史订单更新为 order_type='ticket'
 * 仅平台管理员可执行
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'platform_admin') {
      return Response.json({ error: 'Forbidden: 仅平台管理员可执行迁移' }, { status: 403 });
    }

    // Fetch all orders with is_ticket_order=true
    const ticketOrders = await base44.asServiceRole.entities.Order.filter({ is_ticket_order: true });
    
    if (!ticketOrders || ticketOrders.length === 0) {
      return Response.json({ 
        success: true, 
        migrated_count: 0,
        message: '无需迁移的订单'
      });
    }

    // Update each order to use order_type='ticket'
    let migratedCount = 0;
    let errors = [];
    
    for (const order of ticketOrders) {
      try {
        await base44.asServiceRole.entities.Order.update(order.id, {
          order_type: 'ticket',
        });
        migratedCount++;
      } catch (err) {
        errors.push({ order_id: order.id, order_number: order.order_number, error: err.message });
      }
    }

    return Response.json({
      success: true,
      migrated_count: migratedCount,
      total_found: ticketOrders.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `成功迁移 ${migratedCount}/${ticketOrders.length} 个票务订单`
    });

  } catch (error) {
    console.error('migrateTicketOrders error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});