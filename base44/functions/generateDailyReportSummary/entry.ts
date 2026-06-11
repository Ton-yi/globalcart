import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * 每日凌晨聚合报表数据
 * 计算前一天的订单、客户、收入、成本、利润等指标
 * 存储到 DailyReportSummary 实体
 */
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        // 仅允许 admin 或定时任务调用
        if (user && user.role !== 'platform_admin') {
            return Response.json({ error: 'Forbidden' }, { status: 403 });
        }

        // 计算昨天的日期范围
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const dateStr = yesterday.toISOString().split('T')[0];
        
        const start = new Date(dateStr);
        const end = new Date(dateStr);
        end.setHours(23, 59, 59, 999);

        // 获取所有租户
        const tenants = await base44.asServiceRole.entities.Tenant.filter({});
        
        const results = [];
        
        for (const tenant of tenants) {
            const tenantId = tenant.id;
            
            // 获取该租户昨天的订单和发货池
            const [orders, pools] = await Promise.all([
                base44.asServiceRole.entities.Order.filter({ tenant_id: tenantId }),
                base44.asServiceRole.entities.ShippingPool.filter({ tenant_id: tenantId }),
            ]);
            
            // 过滤日期范围
            const dayOrders = orders.filter(o => {
                const d = new Date(o.submit_date || o.created_date);
                return d >= start && d <= end;
            });
            
            const dayPools = pools.filter(p => {
                const d = new Date(p.created_date);
                return d >= start && d <= end;
            });
            
            // 计算汇总指标
            const summary = {
                tenant_id: tenantId,
                date: dateStr,
                order_count: dayOrders.length,
                customer_count: new Set(dayOrders.map(o => o.user_email).filter(Boolean)).size,
                new_customer_count: 0, // 需要全量数据判断，暂置 0
                order_stage_payment_jpy: 0,
                goods_cost_jpy: 0,
                service_fee_revenue_jpy: 0,
                addon_revenue_jpy: 0,
                refund_amount_jpy: 0,
                order_stage_profit_jpy: 0,
                shipping_stage_income_jpy: 0,
                shipping_stage_profit_jpy: 0,
                total_profit_jpy: 0,
                pending_payment_count: 0,
                pending_purchase_count: 0,
                pending_ship_count: 0,
                unpaid_amount_jpy: 0,
                status_counts: {},
                country_distribution: {},
                shipping_method_distribution: {},
            };
            
            // 订单指标
            dayOrders.forEach(order => {
                const payment = order.order_stage_payment_jpy || order.paid_amount || 0;
                const refund = order.refund_amount_jpy || 0;
                const cost = order.estimated_jpy || 0;
                const addon = (order.selected_addons || []).reduce((s, a) => s + (a.fee || 0), 0);
                const svcFee = order.service_fee_amount || 0;
                
                summary.order_stage_payment_jpy += payment;
                summary.goods_cost_jpy += cost;
                summary.service_fee_revenue_jpy += svcFee;
                summary.addon_revenue_jpy += addon;
                summary.refund_amount_jpy += refund;
                summary.order_stage_profit_jpy += payment - refund - cost;
                
                // 状态统计
                const status = order.order_status || 'unknown';
                summary.status_counts[status] = (summary.status_counts[status] || 0) + 1;
                
                // 待处理统计
                if (['pending_confirmation','payment_pending','paid'].includes(status)) {
                    summary.pending_payment_count++;
                }
                if (status === 'pending_purchase') {
                    summary.pending_purchase_count++;
                }
                if (['in_warehouse','in_storage'].includes(status)) {
                    summary.pending_ship_count++;
                }
                
                // 未收款
                if (['pending','awaiting_payment','awaiting_confirmation'].includes(order.payment_status)) {
                    summary.unpaid_amount_jpy += order.prepayment_amount || order.estimated_jpy || 0;
                }
            });
            
            // 发货池指标
            dayPools.forEach(pool => {
                const income = pool.shipping_stage_income_jpy || pool.shipping_fee_jpy || 0;
                const intlCost = pool.actual_international_shipping_cost_jpy || 0;
                const boxCost = pool.box_actual_cost_jpy_snapshot || 0;
                
                summary.shipping_stage_income_jpy += income;
                summary.shipping_stage_profit_jpy += income - intlCost - boxCost;
                
                // 国家分布
                const country = pool.destination_country || 'unknown';
                summary.country_distribution[country] = (summary.country_distribution[country] || 0) + 1;
                
                // 运输方式分布
                const method = pool.shipping_method || 'unknown';
                summary.shipping_method_distribution[method] = (summary.shipping_method_distribution[method] || 0) + 1;
            });
            
            // 总利润
            summary.total_profit_jpy = summary.order_stage_profit_jpy + summary.shipping_stage_profit_jpy;
            
            // 保存或更新汇总记录
            const existing = await base44.asServiceRole.entities.DailyReportSummary.filter({
                tenant_id: tenantId,
                date: dateStr,
            });
            
            if (existing.length > 0) {
                await base44.asServiceRole.entities.DailyReportSummary.update(existing[0].id, summary);
            } else {
                await base44.asServiceRole.entities.DailyReportSummary.create(summary);
            }
            
            results.push({
                tenant_id: tenantId,
                orders: dayOrders.length,
                pools: dayPools.length,
                profit: summary.total_profit_jpy,
            });
        }
        
        return Response.json({
            success: true,
            message: `已为 ${results.length} 个租户生成 ${dateStr} 的日报表`,
            results,
        });
        
    } catch (error) {
        console.error('Daily summary error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});