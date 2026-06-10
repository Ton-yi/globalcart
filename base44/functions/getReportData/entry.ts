import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // 验证用户身份和权限
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        // 仅允许管理员访问
        if (user.role !== 'admin' && user.role !== 'platform_admin' && user.role !== 'tenant_admin' && user.role !== 'staff') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }
        
        // 解析请求参数
        let requestBody;
        try {
            requestBody = await req.json();
        } catch (e) {
            return Response.json({ error: 'Invalid JSON body', details: e.message }, { status: 400 });
        }
        
        const { startDate, endDate, dimension = 'order_status' } = requestBody;
        
        if (!startDate || !endDate) {
            return Response.json({ 
                error: 'Missing required parameters: startDate, endDate',
                received: requestBody
            }, { status: 400 });
        }
        
        // 获取租户上下文 - 从用户信息或租户列表获取
        let tenantId = null;
        
        // 如果是平台管理员，需要从用户信息中获取当前查看的租户
        if (user.role === 'platform_admin') {
            // 平台管理员可以查看所有租户，这里暂时返回 null 允许查询所有数据
            // 或者可以从请求参数中获取 tenant_id
            tenantId = null;
        } else {
            // 普通管理员/员工/用户，从用户信息获取租户
            try {
                const tenantContext = await base44.functions.invoke('getTenantContext', {});
                tenantId = tenantContext?.tenantId || user.tenant_id;
            } catch (e) {
                // 如果 getTenantContext 失败，尝试直接从用户对象获取
                tenantId = user.tenant_id;
            }
        }
        
        if (!tenantId && user.role !== 'platform_admin') {
            return Response.json({ 
                error: 'Tenant context not found',
                user_email: user.email,
                user_role: user.role
            }, { status: 400 });
        }
        
        // 查询订单数据（按时间范围过滤）
        const orderQuery = {
            submit_date: { $gte: startDate, $lte: endDate }
        };
        if (tenantId) {
            orderQuery.tenant_id = tenantId;
        }
        
        let orders;
        try {
            orders = await base44.entities.Order.filter(orderQuery);
        } catch (e) {
            console.error('Failed to query orders:', e);
            orders = [];
        }
        
        // 查询发货池数据
        const poolQuery = {
            created_date: { $gte: startDate, $lte: endDate }
        };
        if (tenantId) {
            poolQuery.tenant_id = tenantId;
        }
        
        let shippingPools;
        try {
            shippingPools = await base44.entities.ShippingPool.filter(poolQuery);
        } catch (e) {
            console.error('Failed to query shipping pools:', e);
            shippingPools = [];
        }
        
        // 构建报表数据
        const reportData = {
            summary: {
                total_orders: orders.length,
                total_shipping_pools: shippingPools.length,
                order_stage_payment_jpy: 0,
                refund_amount_jpy: 0,
                goods_cost_jpy: 0,
                order_stage_profit_jpy: 0,
                shipping_stage_income_jpy: 0,
                actual_international_shipping_cost_jpy: 0,
                box_charge_jpy: 0,
                box_actual_cost_jpy: 0,
                shipping_stage_profit_jpy: 0,
                total_profit_jpy: 0,
                orders_missing_cost_data: 0
            },
            byDimension: {}
        };
        
        // 计算订单阶段利润
        orders.forEach(order => {
            // 下单阶段数据
            const orderPayment = order.order_stage_payment_jpy || order.paid_amount || 0;
            const refund = order.refund_amount_jpy || 0;
            const goodsCost = order.estimated_jpy || 0;
            const orderProfit = orderPayment - refund - goodsCost;
            
            reportData.summary.order_stage_payment_jpy += orderPayment;
            reportData.summary.refund_amount_jpy += refund;
            reportData.summary.goods_amount_jpy += goodsCost;
            reportData.summary.order_stage_profit_jpy += orderProfit;
            
            // 按维度分组
            const dimensionValue = order[dimension] || 'unknown';
            if (!reportData.byDimension[dimensionValue]) {
                reportData.byDimension[dimensionValue] = {
                    order_count: 0,
                    order_stage_payment_jpy: 0,
                    refund_amount_jpy: 0,
                    goods_cost_jpy: 0,
                    order_stage_profit_jpy: 0,
                    shipping_stage_income_jpy: 0,
                    actual_international_shipping_cost_jpy: 0,
                    box_charge_jpy: 0,
                    box_actual_cost_jpy: 0,
                    shipping_stage_profit_jpy: 0,
                    total_profit_jpy: 0,
                    orders_missing_cost_data: 0
                };
            }
            
            reportData.byDimension[dimensionValue].order_count += 1;
            reportData.byDimension[dimensionValue].order_stage_payment_jpy += orderPayment;
            reportData.byDimension[dimensionValue].refund_amount_jpy += refund;
            reportData.byDimension[dimensionValue].goods_amount_jpy += goodsCost;
            reportData.byDimension[dimensionValue].order_stage_profit_jpy += orderProfit;
            
            // 检查成本数据完整性
            if (order.estimated_jpy && !order.order_stage_payment_jpy) {
                reportData.summary.orders_missing_cost_data += 1;
                reportData.byDimension[dimensionValue].orders_missing_cost_data += 1;
            }
        });
        
        // 计算发货阶段利润
        shippingPools.forEach(pool => {
            const shippingIncome = pool.shipping_stage_income_jpy || pool.shipping_fee_jpy || 0;
            const intlShippingCost = pool.actual_international_shipping_cost_jpy || 0;
            const boxCharge = pool.box_charge_jpy_snapshot || pool.box_price_jpy || 0;
            const boxCost = pool.box_actual_cost_jpy_snapshot || 0;
            const shippingProfit = shippingIncome - intlShippingCost - boxCost;
            
            reportData.summary.shipping_stage_income_jpy += shippingIncome;
            reportData.summary.actual_international_shipping_cost_jpy += intlShippingCost;
            reportData.summary.box_charge_jpy += boxCharge;
            reportData.summary.box_actual_cost_jpy += boxCost;
            reportData.summary.shipping_stage_profit_jpy += shippingProfit;
            
            // 外箱利润
            const boxProfit = boxCharge - boxCost;
            reportData.summary.box_profit_jpy = (reportData.summary.box_profit_jpy || 0) + boxProfit;
        });
        
        // 计算总利润
        reportData.summary.total_profit_jpy = 
            reportData.summary.order_stage_profit_jpy + reportData.summary.shipping_stage_profit_jpy;
        
        // 按维度汇总发货利润（简化处理，假设每个 pool 对应一个维度值）
        // 实际生产中需要从关联的 order 中获取维度值
        Object.keys(reportData.byDimension).forEach(dimensionValue => {
            const dimensionData = reportData.byDimension[dimensionValue];
            dimensionData.shipping_stage_profit_jpy = 
                (reportData.summary.shipping_stage_profit_jpy / orders.length) * dimensionData.order_count;
            dimensionData.total_profit_jpy = 
                dimensionData.order_stage_profit_jpy + dimensionData.shipping_stage_profit_jpy;
        });
        
        return Response.json({
            success: true,
            data: reportData,
            date_range: { startDate, endDate },
            dimension: dimension
        });
        
    } catch (error) {
        console.error('Report generation error:', error);
        return Response.json({ 
            error: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
});