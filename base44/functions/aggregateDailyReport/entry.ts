import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * 每日报表汇总定时任务
 * 每天凌晨 2 点执行，聚合前一天的订单和发货池数据
 * 
 * 调用方式：
 * 1. 创建 scheduled automation，每天 2 点执行
 * 2. 或手动调用：base44.functions.invoke('aggregateDailyReport', { targetDate: '2024-01-15' })
 */
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        // 仅允许 admin 触发
        if (!user || !['admin', 'platform_admin', 'tenant_admin', 'staff'].includes(user.role)) {
            return Response.json({ error: 'Forbidden' }, { status: 403 });
        }

        let requestBody;
        try { 
            requestBody = await req.json(); 
        } catch { 
            // 无 body 时默认为昨天
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            requestBody = { targetDate: yesterday.toISOString().split('T')[0] };
        }

        const { targetDate } = requestBody;
        if (!targetDate) {
            return Response.json({ error: 'Missing targetDate' }, { status: 400 });
        }

        // 租户解析
        let tenantId = null;
        if (user.role === 'platform_admin') {
            tenantId = requestBody.tenant_id || null;
        } else {
            try {
                const records = await base44.asServiceRole.entities.User.filter({ id: user.id });
                tenantId = records?.[0]?.tenant_id || user.tenant_id;
            } catch { 
                tenantId = user.tenant_id; 
            }
        }

        if (!tenantId && user.role !== 'platform_admin') {
            return Response.json({ error: 'Tenant context not found' }, { status: 400 });
        }

        const target = new Date(targetDate);
        const start = new Date(target);
        start.setHours(0, 0, 0, 0);
        const end = new Date(target);
        end.setHours(23, 59, 59, 999);

        console.log(`[aggregateDailyReport] tenant=${tenantId} date=${targetDate}`);

        // 获取租户所有订单和发货池
        const baseFilter = tenantId ? { tenant_id: tenantId } : {};
        const [allOrders, allPools] = await Promise.all([
            base44.asServiceRole.entities.Order.filter(baseFilter),
            base44.asServiceRole.entities.ShippingPool.filter(baseFilter),
        ]);

        // 过滤出目标日期的数据
        const orders = allOrders.filter(o => {
            const d = new Date(o.submit_date || o.created_date);
            return d >= start && d <= end;
        });

        const pools = allPools.filter(p => {
            const d = new Date(p.created_date);
            return d >= start && d <= end;
        });

        if (orders.length === 0 && pools.length === 0) {
            console.log(`[aggregateDailyReport] no data for ${targetDate}`);
            return Response.json({ 
                success: true, 
                message: '当日无数据',
                aggregated: false 
            });
        }

        // 计算汇总数据
        const summary = calculateDailySummary(orders, pools, allOrders);

        // 检查是否已存在该日期的汇总
        const existing = await base44.asServiceRole.entities.DailyReportSummary.filter({
            tenant_id: tenantId,
            date: targetDate,
        });

        const now = new Date().toISOString();
        const record = {
            tenant_id: tenantId,
            date: targetDate,
            order_count: summary.order_count,
            customer_count: summary.customer_count,
            new_customer_count: summary.new_customer_count,
            order_stage_payment_jpy: summary.order_stage_payment_jpy,
            goods_cost_jpy: summary.goods_cost_jpy,
            refund_amount_jpy: summary.refund_amount_jpy,
            service_fee_revenue_jpy: summary.service_fee_revenue_jpy,
            addon_revenue_jpy: summary.addon_revenue_jpy,
            item_size_extra_fee_jpy: summary.item_size_extra_fee_jpy,
            order_stage_profit_jpy: summary.order_stage_profit_jpy,
            shipping_stage_income_jpy: summary.shipping_stage_income_jpy,
            actual_international_shipping_cost_jpy: summary.actual_international_shipping_cost_jpy,
            box_charge_jpy: summary.box_charge_jpy,
            box_actual_cost_jpy: summary.box_actual_cost_jpy,
            shipping_stage_profit_jpy: summary.shipping_stage_profit_jpy,
            total_profit_jpy: summary.total_profit_jpy,
            unpaid_amount_jpy: summary.unpaid_amount_jpy,
            pending_payment_count: summary.pending_payment_count,
            pending_purchase_count: summary.pending_purchase_count,
            pending_ship_count: summary.pending_ship_count,
            status_counts: summary.status_counts,
            online_store_tag_counts: summary.online_store_tag_counts,
            updated_at: now,
        };

        if (existing && existing.length > 0) {
            // 更新已有记录
            await base44.asServiceRole.entities.DailyReportSummary.update(existing[0].id, record);
            console.log(`[aggregateDailyReport] updated existing record for ${targetDate}`);
        } else {
            // 创建新记录
            record.created_at = now;
            await base44.asServiceRole.entities.DailyReportSummary.create(record);
            console.log(`[aggregateDailyReport] created new record for ${targetDate}`);
        }

        return Response.json({
            success: true,
            aggregated: true,
            date: targetDate,
            order_count: orders.length,
            pool_count: pools.length,
            total_profit_jpy: summary.total_profit_jpy,
        });

    } catch (error) {
        console.error('[aggregateDailyReport] error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});

/**
 * 计算每日汇总数据
 */
function calculateDailySummary(orders, pools, allOrders) {
    const summary = {
        order_count: orders.length,
        customer_count: 0,
        new_customer_count: 0,
        order_stage_payment_jpy: 0,
        goods_cost_jpy: 0,
        refund_amount_jpy: 0,
        service_fee_revenue_jpy: 0,
        addon_revenue_jpy: 0,
        item_size_extra_fee_jpy: 0,
        order_stage_profit_jpy: 0,
        shipping_stage_income_jpy: 0,
        actual_international_shipping_cost_jpy: 0,
        box_charge_jpy: 0,
        box_actual_cost_jpy: 0,
        shipping_stage_profit_jpy: 0,
        total_profit_jpy: 0,
        unpaid_amount_jpy: 0,
        pending_payment_count: 0,
        pending_purchase_count: 0,
        pending_ship_count: 0,
        status_counts: {},
        online_store_tag_counts: {},
    };

    // 客户统计
    const customers = new Set(orders.map(o => o.user_email).filter(Boolean));
    summary.customer_count = customers.size;

    // 新客户判断（基于全量订单）
    const customerFirstOrder = {};
    allOrders.forEach(o => {
        if (!o.user_email) return;
        const d = new Date(o.submit_date || o.created_date);
        if (!customerFirstOrder[o.user_email] || d < customerFirstOrder[o.user_email]) {
            customerFirstOrder[o.user_email] = d;
        }
    });

    const periodStart = new Date(orders.length > 0 
        ? Math.min(...orders.map(o => new Date(o.submit_date || o.created_date)))
        : new Date());
    
    customers.forEach(email => {
        const first = customerFirstOrder[email];
        if (first && first >= periodStart) {
            summary.new_customer_count++;
        }
    });

    // 订单汇总
    orders.forEach(order => {
        const payment = order.order_stage_payment_jpy || order.paid_amount || 0;
        const refund = order.refund_amount_jpy || 0;
        const cost = order.estimated_jpy || 0;
        const addon = (order.selected_addons || []).reduce((s, a) => s + (a.fee || 0), 0);
        const svcFee = order.service_fee_amount || 0;
        const itemExtra = order.item_size_extra_fee || 0;

        summary.order_stage_payment_jpy += payment;
        summary.goods_cost_jpy += cost;
        summary.refund_amount_jpy += refund;
        summary.service_fee_revenue_jpy += svcFee;
        summary.addon_revenue_jpy += addon;
        summary.item_size_extra_fee_jpy += itemExtra;
        summary.order_stage_profit_jpy += payment - refund - cost;

        // 状态分布
        const st = order.order_status || 'unknown';
        summary.status_counts[st] = (summary.status_counts[st] || 0) + 1;

        // 待处理统计
        if (['pending_confirmation','payment_pending','paid'].includes(st)) {
            summary.pending_payment_count++;
        }
        if (st === 'pending_purchase') {
            summary.pending_purchase_count++;
        }
        if (['in_warehouse','in_storage'].includes(st)) {
            summary.pending_ship_count++;
        }

        // 未收款
        if (['pending','awaiting_payment','awaiting_confirmation'].includes(order.payment_status)) {
            summary.unpaid_amount_jpy += order.prepayment_amount || order.estimated_jpy || 0;
        }

        // 下单网站分布
        const tag = order.online_store_tag || '其它';
        summary.online_store_tag_counts[tag] = (summary.online_store_tag_counts[tag] || 0) + 1;
    });

    // 发货池汇总
    pools.forEach(pool => {
        // 仅统计已确认收款的发货池收入（未付款发货/待付款不计收入；成本照常计入）
        const isPaid = pool.payment_status === 'paid';
        const income = isPaid ? (pool.shipping_stage_income_jpy || pool.shipping_fee_jpy || 0) : 0;
        const intlCost = pool.actual_international_shipping_cost_jpy || 0;
        const boxCharge = isPaid ? (pool.box_charge_jpy_snapshot || 0) : 0;
        const boxCost = pool.box_actual_cost_jpy_snapshot || 0;

        summary.shipping_stage_income_jpy += income;
        summary.actual_international_shipping_cost_jpy += intlCost;
        summary.box_charge_jpy += boxCharge;
        summary.box_actual_cost_jpy += boxCost;
        summary.shipping_stage_profit_jpy += income - intlCost - boxCost;
    });

    // 总利润
    summary.total_profit_jpy = summary.order_stage_profit_jpy + summary.shipping_stage_profit_jpy;

    return summary;
}