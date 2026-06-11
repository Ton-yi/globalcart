import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// 白名单维度
const ALLOWED_DIMENSIONS = [
    'order_status', 'payment_status', 'shipping_method', 'country',
    'online_store_tag', 'payment_method', 'is_refunded', 'item_size_title',
    'destination_country', 'user_email'
];

function getDimensionValue(order, pool, dimension) {
    switch (dimension) {
        case 'order_status': return order.order_status || 'unknown';
        case 'payment_status': return order.payment_status || 'unknown';
        case 'payment_method': return order.payment_method || 'unknown';
        case 'online_store_tag': return order.online_store_tag || '其它';
        case 'item_size_title': return order.item_size_title || '无尺寸';
        case 'user_email': return order.user_email || 'unknown';
        case 'is_refunded': return (order.refund_amount_jpy && order.refund_amount_jpy > 0) ? '已退款' : '未退款';
        case 'country':
        case 'destination_country':
            return pool?.destination_country
                || order.destination_country
                || order.pre_shipment?.address?.country
                || order.pre_shipment?.transit_location_country
                || 'unknown';
        case 'shipping_method':
            return pool?.shipping_method
                || order.shipping_method
                || order.pre_shipment?.shipping_method
                || order.pre_shipment?.transit_shipping_method_name
                || 'unknown';
        default: return order[dimension] || 'unknown';
    }
}

function buildTimeSeries(orders, pools, granularity) {
    // group orders by period
    const buckets = {};
    orders.forEach(order => {
        const d = new Date(order.submit_date || order.created_date);
        let key;
        if (granularity === 'day') key = d.toISOString().split('T')[0];
        else if (granularity === 'week') {
            const startOfWeek = new Date(d);
            startOfWeek.setDate(d.getDate() - d.getDay());
            key = startOfWeek.toISOString().split('T')[0];
        } else if (granularity === 'month') key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        else if (granularity === 'quarter') key = `${d.getFullYear()}-Q${Math.floor(d.getMonth()/3)+1}`;
        else key = String(d.getFullYear());

        if (!buckets[key]) buckets[key] = { period: key, order_count: 0, revenue_jpy: 0, profit_jpy: 0, refund_jpy: 0 };
        buckets[key].order_count += 1;
        buckets[key].revenue_jpy += order.order_stage_payment_jpy || order.paid_amount || 0;
        buckets[key].refund_jpy += order.refund_amount_jpy || 0;
        const orderProfit = (order.order_stage_payment_jpy || order.paid_amount || 0)
            - (order.refund_amount_jpy || 0)
            - (order.estimated_jpy || 0);
        buckets[key].profit_jpy += orderProfit;
    });

    return Object.values(buckets).sort((a, b) => a.period.localeCompare(b.period));
}

function calcAddonRevenue(orders) {
    let total = 0;
    orders.forEach(order => {
        (order.selected_addons || []).forEach(addon => {
            // convert to JPY if needed (simplify: assume JPY unless explicitly CNY at fixed rate)
            total += addon.fee || 0;
        });
    });
    return total;
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        if (!['admin', 'platform_admin', 'tenant_admin', 'staff'].includes(user.role)) {
            return Response.json({ error: 'Forbidden' }, { status: 403 });
        }

        let requestBody;
        try { requestBody = await req.json(); }
        catch (e) { return Response.json({ error: 'Invalid JSON body' }, { status: 400 }); }

        const {
            startDate, endDate,
            dimension = 'order_status',
            granularity = 'day'  // day / week / month / quarter / year
        } = requestBody;

        if (!startDate || !endDate) {
            return Response.json({ error: 'Missing startDate or endDate' }, { status: 400 });
        }

        if (!ALLOWED_DIMENSIONS.includes(dimension)) {
            return Response.json({ error: `Invalid dimension: ${dimension}` }, { status: 400 });
        }

        // 解析 tenant
        let tenantId = null;
        if (user.role === 'platform_admin') {
            tenantId = requestBody.tenant_id || null;
        } else {
            try {
                const userRecords = await base44.asServiceRole.entities.User.filter({ id: user.id });
                tenantId = userRecords?.[0]?.tenant_id || user.tenant_id;
            } catch { tenantId = user.tenant_id; }
        }

        if (!tenantId && user.role !== 'platform_admin') {
            return Response.json({ error: 'Tenant context not found' }, { status: 400 });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        const baseFilter = tenantId ? { tenant_id: tenantId } : {};

        // 并行加载订单和发货池
        const [allOrders, allPools] = await Promise.all([
            base44.asServiceRole.entities.Order.filter(baseFilter),
            base44.asServiceRole.entities.ShippingPool.filter(baseFilter),
        ]);

        // 过滤时间范围
        const orders = allOrders.filter(o => {
            const d = new Date(o.submit_date || o.created_date);
            return d >= start && d <= end;
        });

        const pools = allPools.filter(p => {
            const d = new Date(p.created_date);
            return d >= start && d <= end;
        });

        console.log(`Orders in range: ${orders.length}, Pools in range: ${pools.length}`);

        // 客户分析：所有用户（去重）
        const allUserEmails = new Set(orders.map(o => o.user_email).filter(Boolean));
        const totalCustomers = allUserEmails.size;

        // 获取客户首单日期（用于新老客户区分）
        const customerFirstOrder = {};
        allOrders.forEach(o => {
            if (!o.user_email) return;
            const d = new Date(o.submit_date || o.created_date);
            if (!customerFirstOrder[o.user_email] || d < customerFirstOrder[o.user_email]) {
                customerFirstOrder[o.user_email] = d;
            }
        });

        // 新客 = 期间内首单日期在时间范围内的客户
        let newCustomers = 0;
        allUserEmails.forEach(email => {
            const firstOrder = customerFirstOrder[email];
            if (firstOrder && firstOrder >= start && firstOrder <= end) newCustomers++;
        });

        // 汇总指标初始化
        const summary = {
            total_orders: orders.length,
            total_customers: totalCustomers,
            new_customers: newCustomers,
            returning_customers: totalCustomers - newCustomers,
            total_shipping_pools: pools.length,
            order_stage_payment_jpy: 0,
            refund_amount_jpy: 0,
            goods_cost_jpy: 0,
            order_stage_profit_jpy: 0,
            addon_revenue_jpy: 0,
            item_size_extra_fee_jpy: 0,
            shipping_stage_income_jpy: 0,
            actual_international_shipping_cost_jpy: 0,
            box_charge_jpy: 0,
            box_actual_cost_jpy: 0,
            box_profit_jpy: 0,
            shipping_stage_profit_jpy: 0,
            total_profit_jpy: 0,
            avg_order_value_jpy: 0,
            orders_missing_cost_data: 0,
            // 订单状态分布
            status_counts: {},
            // 待处理汇总
            pending_payment_count: 0,
            pending_purchase_count: 0,
            pending_ship_count: 0,
        };

        const byDimension = {};

        // 为发货池关联，构建订单ID→池的映射
        const orderIdToPool = {};
        allPools.forEach(pool => {
            (pool.order_ids || []).forEach(oid => { orderIdToPool[oid] = pool; });
        });

        // 计算订单阶段指标
        orders.forEach(order => {
            const orderPayment = order.order_stage_payment_jpy || order.paid_amount || 0;
            const refund = order.refund_amount_jpy || 0;
            const goodsCost = order.estimated_jpy || 0;
            const addonRevenue = (order.selected_addons || []).reduce((s, a) => s + (a.fee || 0), 0);
            const itemSizeExtraFee = order.item_size_extra_fee || 0;
            const orderProfit = orderPayment - refund - goodsCost;

            summary.order_stage_payment_jpy += orderPayment;
            summary.refund_amount_jpy += refund;
            summary.goods_cost_jpy += goodsCost;
            summary.order_stage_profit_jpy += orderProfit;
            summary.addon_revenue_jpy += addonRevenue;
            summary.item_size_extra_fee_jpy += itemSizeExtraFee;

            // 订单状态分布
            const status = order.order_status || 'unknown';
            summary.status_counts[status] = (summary.status_counts[status] || 0) + 1;

            // 待处理统计
            if (['pending_confirmation', 'payment_pending', 'paid'].includes(status)) summary.pending_payment_count++;
            if (status === 'pending_purchase') summary.pending_purchase_count++;
            if (['in_warehouse', 'in_storage'].includes(status)) summary.pending_ship_count++;

            if (!order.order_stage_payment_jpy && !order.paid_amount) summary.orders_missing_cost_data++;

            // 维度分组
            const pool = orderIdToPool[order.id];
            const dimValue = getDimensionValue(order, pool, dimension);
            if (!byDimension[dimValue]) {
                byDimension[dimValue] = {
                    order_count: 0, order_stage_payment_jpy: 0, refund_amount_jpy: 0,
                    goods_cost_jpy: 0, order_stage_profit_jpy: 0, addon_revenue_jpy: 0,
                    shipping_stage_profit_jpy: 0, total_profit_jpy: 0, orders_missing_cost_data: 0
                };
            }
            byDimension[dimValue].order_count++;
            byDimension[dimValue].order_stage_payment_jpy += orderPayment;
            byDimension[dimValue].refund_amount_jpy += refund;
            byDimension[dimValue].goods_cost_jpy += goodsCost;
            byDimension[dimValue].order_stage_profit_jpy += orderProfit;
            byDimension[dimValue].addon_revenue_jpy += addonRevenue;
            if (!order.order_stage_payment_jpy && !order.paid_amount) byDimension[dimValue].orders_missing_cost_data++;
        });

        // 计算发货阶段指标
        pools.forEach(pool => {
            const shippingIncome = pool.shipping_stage_income_jpy || pool.shipping_fee_jpy || 0;
            const intlCost = pool.actual_international_shipping_cost_jpy || 0;
            const boxCharge = pool.box_charge_jpy_snapshot || pool.box_price_jpy || 0;
            const boxCost = pool.box_actual_cost_jpy_snapshot || 0;
            const shippingProfit = shippingIncome - intlCost - boxCost;
            const boxProfit = boxCharge - boxCost;

            summary.shipping_stage_income_jpy += shippingIncome;
            summary.actual_international_shipping_cost_jpy += intlCost;
            summary.box_charge_jpy += boxCharge;
            summary.box_actual_cost_jpy += boxCost;
            summary.shipping_stage_profit_jpy += shippingProfit;
            summary.box_profit_jpy += boxProfit;

            // 分配发货利润到维度
            const orderIds = pool.order_ids || [];
            const relatedOrders = orders.filter(o => orderIds.includes(o.id));
            if (relatedOrders.length > 0) {
                const profitPerOrder = shippingProfit / relatedOrders.length;
                relatedOrders.forEach(order => {
                    const dimValue = getDimensionValue(order, pool, dimension);
                    if (byDimension[dimValue]) {
                        byDimension[dimValue].shipping_stage_profit_jpy += profitPerOrder;
                    }
                });
            }
        });

        // 统一计算维度总利润
        Object.values(byDimension).forEach(d => {
            d.total_profit_jpy = d.order_stage_profit_jpy + d.shipping_stage_profit_jpy;
        });

        // 汇总总利润和客单价
        summary.total_profit_jpy = summary.order_stage_profit_jpy + summary.shipping_stage_profit_jpy;
        summary.avg_order_value_jpy = summary.total_orders > 0
            ? Math.round(summary.order_stage_payment_jpy / summary.total_orders)
            : 0;

        // 客户消费排行（Top 10）
        const customerRevenue = {};
        orders.forEach(o => {
            if (!o.user_email) return;
            const amt = o.order_stage_payment_jpy || o.paid_amount || 0;
            customerRevenue[o.user_email] = (customerRevenue[o.user_email] || 0) + amt;
        });
        const topCustomers = Object.entries(customerRevenue)
            .map(([email, revenue]) => ({ email, revenue_jpy: revenue }))
            .sort((a, b) => b.revenue_jpy - a.revenue_jpy)
            .slice(0, 10);

        // 下单网站分布
        const storeTagCounts = {};
        orders.forEach(o => {
            const tag = o.online_store_tag || '其它';
            storeTagCounts[tag] = (storeTagCounts[tag] || 0) + 1;
        });

        // 时间趋势
        const timeSeries = buildTimeSeries(orders, pools, granularity);

        return Response.json({
            success: true,
            data: {
                summary,
                byDimension,
                timeSeries,
                topCustomers,
                storeTagCounts,
            },
            date_range: { startDate, endDate },
            dimension,
            granularity,
        });

    } catch (error) {
        console.error('Report error:', error);
        return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
});