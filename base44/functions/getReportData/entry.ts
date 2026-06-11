import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ─── 白名单 ────────────────────────────────────────────────────────────────
const ALLOWED_GRANULARITIES = ['day', 'week', 'month', 'quarter', 'year'];
const ALLOWED_DIMENSIONS = [
    'order_status', 'payment_status', 'shipping_method', 'country',
    'online_store_tag', 'payment_method', 'is_refunded', 'item_size_title',
    'destination_country', 'user_email', 'addon_type', 'transit_location',
    'currency',
];

// ─── 维度取值 ────────────────────────────────────────────────────────────────
function getDimensionValue(order, pool, dimension) {
    switch (dimension) {
        case 'order_status':        return order.order_status || 'unknown';
        case 'payment_status':      return order.payment_status || 'unknown';
        case 'payment_method':      return order.payment_method || 'unknown';
        case 'online_store_tag':    return order.online_store_tag || '其它';
        case 'item_size_title':     return order.item_size_title || '无尺寸';
        case 'user_email':          return order.user_email || 'unknown';
        case 'currency':            return order.prepayment_currency || 'JPY';
        case 'is_refunded':         return (order.refund_amount_jpy && order.refund_amount_jpy > 0) ? '已退款' : '未退款';
        case 'transit_location':
            return pool?.transit_location_name
                || order.transit_location_name
                || order.pre_shipment?.transit_location_name
                || '无中转';
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
        case 'addon_type': {
            // 如果有增值服务取第一个（用于分组），或 '无增值服务'
            const addons = order.selected_addons || [];
            if (addons.length === 0) return '无增值服务';
            return addons.map(a => a.name || '未知').join('+');
        }
        default: return order[dimension] || 'unknown';
    }
}

// ─── 时间周期键 ────────────────────────────────────────────────────────────
function getPeriodKey(dateVal, granularity) {
    if (!dateVal) return 'unknown';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return 'unknown';
    if (granularity === 'day')     return d.toISOString().split('T')[0];
    if (granularity === 'week') {
        const s = new Date(d); s.setDate(d.getDate() - d.getDay());
        return s.toISOString().split('T')[0];
    }
    if (granularity === 'month')   return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    if (granularity === 'quarter') return `${d.getFullYear()}-Q${Math.floor(d.getMonth()/3)+1}`;
    return String(d.getFullYear());
}

// ─── 同比/环比偏移 ────────────────────────────────────────────────────────
function shiftDateRange(start, end, mode) {
    const s = new Date(start), e = new Date(end);
    const diffMs = e.getTime() - s.getTime();
    const diffDays = Math.round(diffMs / 86400000) + 1;

    if (mode === 'yoy') {
        // 同比：去年同期
        const ps = new Date(s); ps.setFullYear(ps.getFullYear() - 1);
        const pe = new Date(e); pe.setFullYear(pe.getFullYear() - 1);
        return [ps.toISOString().split('T')[0], pe.toISOString().split('T')[0]];
    }
    // 环比：上一个等长周期
    const ps = new Date(s.getTime() - diffDays * 86400000);
    const pe = new Date(e.getTime() - diffDays * 86400000);
    return [ps.toISOString().split('T')[0], pe.toISOString().split('T')[0]];
}

// ─── 移动平均 ─────────────────────────────────────────────────────────────
function calcMovingAverage(series, field, window = 7) {
    return series.map((pt, i) => {
        const slice = series.slice(Math.max(0, i - window + 1), i + 1);
        const avg = slice.reduce((s, p) => s + (p[field] || 0), 0) / slice.length;
        return { ...pt, [`${field}_ma${window}`]: Math.round(avg) };
    });
}

// ─── 累计值 ───────────────────────────────────────────────────────────────
function calcCumulative(series, fields) {
    const acc = {};
    fields.forEach(f => acc[f] = 0);
    return series.map(pt => {
        const out = { ...pt };
        fields.forEach(f => {
            acc[f] += (pt[f] || 0);
            out[`${f}_cum`] = acc[f];
        });
        return out;
    });
}

// ─── 时序构建 ─────────────────────────────────────────────────────────────
function buildTimeSeries(orders, pools, granularity) {
    const buckets = {};
    const ensure = (key) => {
        if (!buckets[key]) buckets[key] = {
            period: key, order_count: 0, revenue_jpy: 0, profit_jpy: 0,
            refund_jpy: 0, shipping_income_jpy: 0, shipping_profit_jpy: 0,
            addon_revenue_jpy: 0, service_fee_jpy: 0,
        };
    };

    orders.forEach(order => {
        const key = getPeriodKey(order.submit_date || order.created_date, granularity);
        ensure(key);
        const payment = order.order_stage_payment_jpy || order.paid_amount || 0;
        const refund   = order.refund_amount_jpy || 0;
        const cost     = order.estimated_jpy || 0;
        const addon    = (order.selected_addons || []).reduce((s, a) => s + (a.fee || 0), 0);
        const svcFee   = order.service_fee_amount || 0;
        buckets[key].order_count     += 1;
        buckets[key].revenue_jpy     += payment;
        buckets[key].refund_jpy      += refund;
        buckets[key].profit_jpy      += payment - refund - cost;
        buckets[key].addon_revenue_jpy += addon;
        buckets[key].service_fee_jpy += svcFee;
    });

    pools.forEach(pool => {
        const key = getPeriodKey(pool.shipped_date || pool.created_date, granularity);
        ensure(key);
        const income  = pool.shipping_stage_income_jpy || pool.shipping_fee_jpy || 0;
        const intlCost = pool.actual_international_shipping_cost_jpy || 0;
        const boxCost  = pool.box_actual_cost_jpy_snapshot || 0;
        buckets[key].revenue_jpy         += income;
        buckets[key].shipping_income_jpy += income;
        buckets[key].shipping_profit_jpy += income - intlCost - boxCost;
        buckets[key].profit_jpy          += income - intlCost - boxCost;
    });

    let series = Object.values(buckets).sort((a, b) => a.period.localeCompare(b.period));
    // 计算移动平均（7期）
    series = calcMovingAverage(series, 'revenue_jpy', 7);
    series = calcMovingAverage(series, 'order_count', 7);
    // 计算累计值
    series = calcCumulative(series, ['revenue_jpy', 'profit_jpy', 'order_count']);
    return series;
}

// ─── 汇总计算 ────────────────────────────────────────────────────────────
function calcSummary(orders, pools, allPools, allOrders) {
    const s = {
        total_orders: orders.length,
        total_shipping_pools: pools.length,
        total_customers: 0,
        new_customers: 0,
        returning_customers: 0,
        order_stage_payment_jpy: 0,
        refund_amount_jpy: 0,
        goods_cost_jpy: 0,
        service_fee_revenue_jpy: 0,   // 代购服务费（已计算的快照）
        addon_revenue_jpy: 0,
        item_size_extra_fee_jpy: 0,
        order_stage_profit_jpy: 0,
        shipping_stage_income_jpy: 0,
        actual_international_shipping_cost_jpy: 0,
        box_charge_jpy: 0,
        box_actual_cost_jpy: 0,
        box_profit_jpy: 0,
        shipping_stage_profit_jpy: 0,
        total_profit_jpy: 0,
        avg_order_value_jpy: 0,
        orders_missing_cost_data: 0,
        status_counts: {},
        // 待处理
        pending_payment_count: 0,
        pending_purchase_count: 0,
        pending_ship_count: 0,
        // 未收款
        unpaid_amount_jpy: 0,
        // 平均发货时长（天）
        avg_ship_days: null,
        // 增值服务分布
        addon_distribution: {},
        // 目的地国家分布（不依赖维度）
        country_distribution: {},
        // 运输方式分布（不依赖维度）
        shipping_method_distribution: {},
        // 中转地使用
        transit_location_distribution: {},
    };

    // 客户首单日期（用于新老客户）
    const customerFirstOrder = {};
    allOrders.forEach(o => {
        if (!o.user_email) return;
        const d = new Date(o.submit_date || o.created_date);
        if (!customerFirstOrder[o.user_email] || d < customerFirstOrder[o.user_email]) {
            customerFirstOrder[o.user_email] = d;
        }
    });

    // 发货时长计算
    const shipDays = [];

    const allUserEmails = new Set(orders.map(o => o.user_email).filter(Boolean));
    s.total_customers = allUserEmails.size;

    // 期间日期范围（用于新客判断）
    const periodStart = orders.length > 0
        ? new Date(Math.min(...orders.map(o => new Date(o.submit_date || o.created_date))))
        : new Date();
    const periodEnd = orders.length > 0
        ? new Date(Math.max(...orders.map(o => new Date(o.submit_date || o.created_date))))
        : new Date();

    allUserEmails.forEach(email => {
        const first = customerFirstOrder[email];
        if (first && first >= periodStart && first <= periodEnd) s.new_customers++;
        else s.returning_customers++;
    });

    orders.forEach(order => {
        const payment    = order.order_stage_payment_jpy || order.paid_amount || 0;
        const refund     = order.refund_amount_jpy || 0;
        const cost       = order.estimated_jpy || 0;
        const addon      = (order.selected_addons || []).reduce((sum, a) => sum + (a.fee || 0), 0);
        const svcFee     = order.service_fee_amount || 0;
        const itemExtra  = order.item_size_extra_fee || 0;

        s.order_stage_payment_jpy  += payment;
        s.refund_amount_jpy        += refund;
        s.goods_cost_jpy           += cost;
        s.service_fee_revenue_jpy  += svcFee;
        s.addon_revenue_jpy        += addon;
        s.item_size_extra_fee_jpy  += itemExtra;
        s.order_stage_profit_jpy   += payment - refund - cost;

        // 状态分布
        const st = order.order_status || 'unknown';
        s.status_counts[st] = (s.status_counts[st] || 0) + 1;

        // 待处理
        if (['pending_confirmation','payment_pending','paid'].includes(st)) s.pending_payment_count++;
        if (st === 'pending_purchase') s.pending_purchase_count++;
        if (['in_warehouse','in_storage'].includes(st)) s.pending_ship_count++;

        // 未收款：payment_status=pending/awaiting
        if (['pending','awaiting_payment','awaiting_confirmation'].includes(order.payment_status)) {
            s.unpaid_amount_jpy += order.prepayment_amount || order.estimated_jpy || 0;
        }

        // 数据缺失
        if (!order.order_stage_payment_jpy && !order.paid_amount) s.orders_missing_cost_data++;

        // 增值服务分布
        (order.selected_addons || []).forEach(a => {
            const name = a.name || '未知';
            s.addon_distribution[name] = (s.addon_distribution[name] || 0) + 1;
        });

        // 入库尺寸分布
        if (order.item_size_title) {
            if (!s.item_size_distribution) s.item_size_distribution = {};
            s.item_size_distribution[order.item_size_title] = (s.item_size_distribution[order.item_size_title] || 0) + 1;
        }

        // 发货时长
        if (order.in_warehouse_date && order.shipped_date) {
            const d1 = new Date(order.in_warehouse_date), d2 = new Date(order.shipped_date);
            const days = Math.round((d2 - d1) / 86400000);
            if (days >= 0 && days < 365) shipDays.push(days);
        }
    });

    // 发货池指标
    pools.forEach(pool => {
        const income   = pool.shipping_stage_income_jpy || pool.shipping_fee_jpy || 0;
        const intlCost = pool.actual_international_shipping_cost_jpy || 0;
        const boxCharge = pool.box_charge_jpy_snapshot || 0;
        const boxCost  = pool.box_actual_cost_jpy_snapshot || 0;

        s.shipping_stage_income_jpy             += income;
        s.actual_international_shipping_cost_jpy += intlCost;
        s.box_charge_jpy                        += boxCharge;
        s.box_actual_cost_jpy                   += boxCost;
        s.shipping_stage_profit_jpy             += income - intlCost - boxCost;
        s.box_profit_jpy                        += boxCharge - boxCost;

        // 目的地国家分布
        const country = pool.destination_country || 'unknown';
        s.country_distribution[country] = (s.country_distribution[country] || 0) + 1;

        // 运输方式分布
        const method = pool.shipping_method || 'unknown';
        s.shipping_method_distribution[method] = (s.shipping_method_distribution[method] || 0) + 1;

        // 中转地分布
        const transit = pool.transit_location_name || '无中转';
        s.transit_location_distribution[transit] = (s.transit_location_distribution[transit] || 0) + 1;
    });

    // 汇总
    s.total_profit_jpy  = s.order_stage_profit_jpy + s.shipping_stage_profit_jpy;
    s.avg_order_value_jpy = s.total_orders > 0
        ? Math.round(s.order_stage_payment_jpy / s.total_orders) : 0;
    s.avg_ship_days = shipDays.length > 0
        ? Math.round(shipDays.reduce((a, b) => a + b, 0) / shipDays.length) : null;

    return s;
}

// ─── 维度分析 ─────────────────────────────────────────────────────────────
function buildDimensions(orders, pools, dimension, allOrderMap) {
    const byDimension = {};

    const ensure = (key) => {
        if (!byDimension[key]) byDimension[key] = {
            order_count: 0,
            order_stage_payment_jpy: 0, refund_amount_jpy: 0,
            goods_cost_jpy: 0, service_fee_revenue_jpy: 0,
            order_stage_profit_jpy: 0, addon_revenue_jpy: 0,
            shipping_stage_income_jpy: 0, shipping_stage_profit_jpy: 0,
            total_profit_jpy: 0, orders_missing_cost_data: 0,
        };
    };

    // 构建订单ID→池映射
    const orderIdToPool = {};
    pools.forEach(pool => (pool.order_ids || []).forEach(id => { orderIdToPool[id] = pool; }));

    orders.forEach(order => {
        const pool = orderIdToPool[order.id];
        const dim  = getDimensionValue(order, pool, dimension);
        ensure(dim);

        const payment  = order.order_stage_payment_jpy || order.paid_amount || 0;
        const refund   = order.refund_amount_jpy || 0;
        const cost     = order.estimated_jpy || 0;
        const addon    = (order.selected_addons || []).reduce((s, a) => s + (a.fee || 0), 0);
        const svcFee   = order.service_fee_amount || 0;

        byDimension[dim].order_count++;
        byDimension[dim].order_stage_payment_jpy += payment;
        byDimension[dim].refund_amount_jpy        += refund;
        byDimension[dim].goods_cost_jpy           += cost;
        byDimension[dim].service_fee_revenue_jpy  += svcFee;
        byDimension[dim].order_stage_profit_jpy   += payment - refund - cost;
        byDimension[dim].addon_revenue_jpy        += addon;
        if (!order.order_stage_payment_jpy && !order.paid_amount) byDimension[dim].orders_missing_cost_data++;
    });

    // 分配发货利润到维度（使用全量订单映射，不受时间过滤影响）
    pools.forEach(pool => {
        const income      = pool.shipping_stage_income_jpy || pool.shipping_fee_jpy || 0;
        const intlCost    = pool.actual_international_shipping_cost_jpy || 0;
        const boxCost     = pool.box_actual_cost_jpy_snapshot || 0;
        const profit      = income - intlCost - boxCost;
        const relatedOrders = (pool.order_ids || []).map(id => allOrderMap[id]).filter(Boolean);
        if (relatedOrders.length === 0) return;
        const profitPer = profit / relatedOrders.length;
        const incomePer = income / relatedOrders.length;
        relatedOrders.forEach(order => {
            const dim = getDimensionValue(order, pool, dimension);
            if (byDimension[dim]) {
                byDimension[dim].shipping_stage_profit_jpy += profitPer;
                byDimension[dim].shipping_stage_income_jpy += incomePer;
            }
        });
    });

    Object.values(byDimension).forEach(d => {
        d.total_profit_jpy = d.order_stage_profit_jpy + d.shipping_stage_profit_jpy;
        d.shipping_stage_profit_jpy = Math.round(d.shipping_stage_profit_jpy);
        d.shipping_stage_income_jpy = Math.round(d.shipping_stage_income_jpy);
        d.total_profit_jpy = Math.round(d.total_profit_jpy);
    });

    return byDimension;
}

// ─── 对比期计算（精简版：仅汇总指标）────────────────────────────────────
function calcCompareSummary(orders, pools) {
    const payment = orders.reduce((s, o) => s + (o.order_stage_payment_jpy || o.paid_amount || 0), 0);
    const refund  = orders.reduce((s, o) => s + (o.refund_amount_jpy || 0), 0);
    const cost    = orders.reduce((s, o) => s + (o.estimated_jpy || 0), 0);
    const income  = pools.reduce((s, p) => s + (p.shipping_stage_income_jpy || p.shipping_fee_jpy || 0), 0);
    const intlCost = pools.reduce((s, p) => s + (p.actual_international_shipping_cost_jpy || 0), 0);
    const boxCost  = pools.reduce((s, p) => s + (p.box_actual_cost_jpy_snapshot || 0), 0);
    return {
        total_orders: orders.length,
        total_customers: new Set(orders.map(o => o.user_email).filter(Boolean)).size,
        order_stage_payment_jpy: payment,
        refund_amount_jpy: refund,
        goods_cost_jpy: cost,
        order_stage_profit_jpy: payment - refund - cost,
        shipping_stage_income_jpy: income,
        shipping_stage_profit_jpy: income - intlCost - boxCost,
        total_profit_jpy: (payment - refund - cost) + (income - intlCost - boxCost),
    };
}

// ─── 客户排行 ─────────────────────────────────────────────────────────────
function buildTopCustomers(orders, limit = 10) {
    const rev = {}, cnt = {};
    orders.forEach(o => {
        if (!o.user_email) return;
        rev[o.user_email] = (rev[o.user_email] || 0) + (o.order_stage_payment_jpy || o.paid_amount || 0);
        cnt[o.user_email] = (cnt[o.user_email] || 0) + 1;
    });
    return Object.entries(rev)
        .map(([email, revenue_jpy]) => ({ email, revenue_jpy, order_count: cnt[email] || 0 }))
        .sort((a, b) => b.revenue_jpy - a.revenue_jpy)
        .slice(0, limit);
}

// ─── Main Handler ─────────────────────────────────────────────────────────
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
        catch { return Response.json({ error: 'Invalid JSON body' }, { status: 400 }); }

        const {
            startDate, endDate,
            dimension   = 'order_status',
            granularity = 'day',
            compare     = null,  // 'yoy' | 'mom' | null
        } = requestBody;

        if (!startDate || !endDate) return Response.json({ error: 'Missing startDate or endDate' }, { status: 400 });
        if (startDate > endDate)    return Response.json({ error: 'startDate must be <= endDate' }, { status: 400 });
        
        // 安全限制：最大查询 365 天
        const queryStart = new Date(startDate);
        const queryEnd   = new Date(endDate);
        const diffDays = Math.round((queryEnd - queryStart) / 86400000);
        if (diffDays > 365) {
            return Response.json({ error: '最大查询范围为 365 天，请缩小时间范围' }, { status: 400 });
        }
        
        if (!ALLOWED_DIMENSIONS.includes(dimension))    return Response.json({ error: `Invalid dimension` }, { status: 400 });
        if (!ALLOWED_GRANULARITIES.includes(granularity)) return Response.json({ error: `Invalid granularity` }, { status: 400 });
        if (compare && !['yoy', 'mom'].includes(compare)) return Response.json({ error: `Invalid compare` }, { status: 400 });

        // 租户解析
        let tenantId = null;
        if (user.role === 'platform_admin') {
            tenantId = requestBody.tenant_id || null;
        } else {
            try {
                const records = await base44.asServiceRole.entities.User.filter({ id: user.id });
                tenantId = records?.[0]?.tenant_id || user.tenant_id;
            } catch { tenantId = user.tenant_id; }
        }
        if (!tenantId && user.role !== 'platform_admin') {
            return Response.json({ error: 'Tenant context not found' }, { status: 400 });
        }

        const start = new Date(startDate);
        const end   = new Date(endDate); end.setHours(23, 59, 59, 999);

        const baseFilter = tenantId ? { tenant_id: tenantId } : {};

        // 并行拉取全量数据（按租户）
        const [allOrders, allPools] = await Promise.all([
            base44.asServiceRole.entities.Order.filter(baseFilter),
            base44.asServiceRole.entities.ShippingPool.filter(baseFilter),
        ]);

        // 时间过滤
        const orders = allOrders.filter(o => {
            const d = new Date(o.submit_date || o.created_date);
            return d >= start && d <= end;
        });
        const pools = allPools.filter(p => {
            const d = new Date(p.created_date);
            return d >= start && d <= end;
        });

        // 构建全量订单 Map（维度分配用）
        const allOrderMap = {};
        allOrders.forEach(o => { allOrderMap[o.id] = o; });

        // 汇总
        const summary      = calcSummary(orders, pools, allPools, allOrders);
        const byDimension  = buildDimensions(orders, pools, dimension, allOrderMap);
        const timeSeries   = buildTimeSeries(orders, pools, granularity);
        const topCustomers = buildTopCustomers(orders, 10);
        const storeTagCounts = {};
        orders.forEach(o => {
            const t = o.online_store_tag || '其它';
            storeTagCounts[t] = (storeTagCounts[t] || 0) + 1;
        });

        // 对比期
        let compareSummary = null;
        let comparePeriod  = null;
        if (compare) {
            const [cStart, cEnd] = shiftDateRange(startDate, endDate, compare);
            const cStartDate = new Date(cStart);
            const cEndDate   = new Date(cEnd); cEndDate.setHours(23, 59, 59, 999);
            const cOrders = allOrders.filter(o => {
                const d = new Date(o.submit_date || o.created_date);
                return d >= cStartDate && d <= cEndDate;
            });
            const cPools = allPools.filter(p => {
                const d = new Date(p.created_date);
                return d >= cStartDate && d <= cEndDate;
            });
            compareSummary = calcCompareSummary(cOrders, cPools);
            comparePeriod  = { startDate: cStart, endDate: cEnd };
        }

        // 数据量警告
        const dataQualityWarnings = [];
        if (orders.length > 5000) {
            dataQualityWarnings.push(`查询到 ${orders.length} 条订单，数据量较大，建议缩小时间范围`);
        }
        if (pools.length > 2000) {
            dataQualityWarnings.push(`查询到 ${pools.length} 个发货池，数据量较大`);
        }

        console.log(`[getReportData] orders=${orders.length} pools=${pools.length} dim=${dimension} gran=${granularity}`);

        return Response.json({
            success: true,
            data: {
                summary,
                byDimension,
                timeSeries,
                topCustomers,
                storeTagCounts,
                compareSummary,
                compare_period: comparePeriod,   // 放进 data 内，前端直接读 data.compare_period
                dataQualityWarnings,
            },
            date_range: { startDate, endDate },
            dimension,
            granularity,
            compare,
        });

    } catch (error) {
        console.error('Report error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});