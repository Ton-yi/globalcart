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
        // 使用 created_date 过滤（因为 submit_date 大部分为空）
        const orderQuery = tenantId ? { tenant_id: tenantId } : {};
        
        let orders;
        try {
            orders = await base44.entities.Order.filter(orderQuery);
            console.log(`Found ${orders.length} total orders for tenant ${tenantId}`);
            
            // 在内存中按日期过滤
            const start = new Date(startDate);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            
            orders = orders.filter(order => {
                const orderDate = new Date(order.submit_date || order.created_date);
                return orderDate >= start && orderDate <= end;
            });
            console.log(`Filtered to ${orders.length} orders in date range`);
        } catch (e) {
            console.error('Failed to query orders:', e);
            orders = [];
        }
        
        // 查询发货池数据（按创建日期过滤）
        const poolQuery = tenantId ? { tenant_id: tenantId } : {};
        
        let shippingPools;
        try {
            shippingPools = await base44.entities.ShippingPool.filter(poolQuery);
            console.log(`Found ${shippingPools.length} total shipping pools for tenant ${tenantId}`);
            
            // 在内存中按日期过滤
            const start = new Date(startDate);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            
            shippingPools = shippingPools.filter(pool => {
                const poolDate = new Date(pool.created_date);
                return poolDate >= start && poolDate <= end;
            });
            console.log(`Filtered to ${shippingPools.length} shipping pools in date range`);
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
                box_profit_jpy: 0,
                shipping_stage_profit_jpy: 0,
                total_profit_jpy: 0,
                orders_missing_cost_data: 0
            },
            byDimension: {}
        };
        
        // 计算订单阶段利润
        orders.forEach(order => {
            // 下单阶段数据 - 优先使用 order_stage_payment_jpy，否则使用 paid_amount
            const orderPayment = order.order_stage_payment_jpy || order.paid_amount || 0;
            const refund = order.refund_amount_jpy || 0;
            // 商品成本：使用 estimated_jpy（日元货款）
            const goodsCost = order.estimated_jpy || 0;
            const orderProfit = orderPayment - refund - goodsCost;
            
            reportData.summary.order_stage_payment_jpy += orderPayment;
            reportData.summary.refund_amount_jpy += refund;
            reportData.summary.goods_cost_jpy += goodsCost;
            reportData.summary.order_stage_profit_jpy += orderProfit;
            
            // 按维度分组 - 根据维度类型从订单或关联的发货池获取
            let dimensionValue = 'unknown';
            if (dimension === 'order_status') {
                dimensionValue = order.order_status || 'unknown';
            } else if (dimension === 'payment_status') {
                dimensionValue = order.payment_status || 'unknown';
            } else if (dimension === 'payment_method') {
                dimensionValue = order.payment_method || 'unknown';
            } else if (dimension === 'online_store_tag') {
                dimensionValue = order.online_store_tag || '其它';
            } else if (dimension === 'country') {
                // 从 pre_shipment.address 或 destination_country 获取
                dimensionValue = order.pre_shipment?.address?.country || order.destination_country || 'unknown';
            } else if (dimension === 'shipping_method') {
                // 从 pre_shipment 或订单获取
                dimensionValue = order.pre_shipment?.shipping_method || order.shipping_method || 'unknown';
            } else if (dimension === 'is_refunded') {
                dimensionValue = (order.refund_amount_jpy && order.refund_amount_jpy > 0) ? '已退款' : '未退款';
            } else {
                dimensionValue = order[dimension] || 'unknown';
            }
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
            reportData.byDimension[dimensionValue].goods_cost_jpy += goodsCost;
            reportData.byDimension[dimensionValue].order_stage_profit_jpy += orderProfit;
            
            // 检查成本数据完整性
            if (order.estimated_jpy && !order.order_stage_payment_jpy) {
                reportData.summary.orders_missing_cost_data += 1;
                reportData.byDimension[dimensionValue].orders_missing_cost_data += 1;
            }
        });
        
        // 计算发货阶段利润
        shippingPools.forEach(pool => {
            // 运费收入：优先使用 shipping_stage_income_jpy，否则使用 shipping_fee_jpy
            const shippingIncome = pool.shipping_stage_income_jpy || pool.shipping_fee_jpy || 0;
            // 实际国际运费支出
            const intlShippingCost = pool.actual_international_shipping_cost_jpy || 0;
            // 外箱收费：优先使用 snapshot，否则使用 box_price_jpy
            const boxCharge = pool.box_charge_jpy_snapshot || pool.box_price_jpy || 0;
            // 外箱实际成本
            const boxCost = pool.box_actual_cost_jpy_snapshot || 0;
            // 发货利润 = 运费收入 - 国际运费 - 外箱成本
            const shippingProfit = shippingIncome - intlShippingCost - boxCost;
            
            reportData.summary.shipping_stage_income_jpy += shippingIncome;
            reportData.summary.actual_international_shipping_cost_jpy += intlShippingCost;
            reportData.summary.box_charge_jpy += boxCharge;
            reportData.summary.box_actual_cost_jpy += boxCost;
            reportData.summary.shipping_stage_profit_jpy += shippingProfit;
            
            // 外箱利润 = 外箱收费 - 外箱成本
            const boxProfit = boxCharge - boxCost;
            reportData.summary.box_profit_jpy += boxProfit;
            
            // 按维度分组发货利润 - 从关联订单获取维度值
            // 简化处理：根据 pool 中的订单平均分配发货利润
            const orderIds = pool.order_ids || [];
            const relatedOrders = orders.filter(o => orderIds.includes(o.id));
            
            if (relatedOrders.length > 0) {
                // 计算每个维度的订单数
                const dimensionCount = {};
                relatedOrders.forEach(order => {
                    let dimValue = 'unknown';
                    if (dimension === 'order_status') {
                        dimValue = order.order_status || 'unknown';
                    } else if (dimension === 'payment_status') {
                        dimValue = order.payment_status || 'unknown';
                    } else if (dimension === 'payment_method') {
                        dimValue = order.payment_method || 'unknown';
                    } else if (dimension === 'online_store_tag') {
                        dimValue = order.online_store_tag || '其它';
                    } else if (dimension === 'country') {
                        dimValue = order.pre_shipment?.address?.country || order.destination_country || 'unknown';
                    } else if (dimension === 'shipping_method') {
                        dimValue = order.pre_shipment?.shipping_method || order.shipping_method || 'unknown';
                    } else if (dimension === 'is_refunded') {
                        dimValue = (order.refund_amount_jpy && order.refund_amount_jpy > 0) ? '已退款' : '未退款';
                    } else {
                        dimValue = order[dimension] || 'unknown';
                    }
                    
                    if (!dimensionCount[dimValue]) {
                        dimensionCount[dimValue] = 0;
                    }
                    dimensionCount[dimValue] += 1;
                });
                
                // 按订单数比例分配发货利润到各维度
                const profitPerOrder = shippingProfit / relatedOrders.length;
                Object.entries(dimensionCount).forEach(([dimValue, count]) => {
                    if (!reportData.byDimension[dimValue]) {
                        reportData.byDimension[dimValue] = {
                            order_count: 0,
                            order_stage_payment_jpy: 0,
                            refund_amount_jpy: 0,
                            goods_cost_jpy: 0,
                            order_stage_profit_jpy: 0,
                            shipping_stage_profit_jpy: 0,
                            total_profit_jpy: 0,
                            orders_missing_cost_data: 0
                        };
                    }
                    reportData.byDimension[dimValue].shipping_stage_profit_jpy += profitPerOrder * count;
                    reportData.byDimension[dimValue].total_profit_jpy = 
                        reportData.byDimension[dimValue].order_stage_profit_jpy + 
                        reportData.byDimension[dimValue].shipping_stage_profit_jpy;
                });
            }
        });
        
        // 计算总利润
        reportData.summary.total_profit_jpy = 
            reportData.summary.order_stage_profit_jpy + reportData.summary.shipping_stage_profit_jpy;
        
        // 补充未分配完的发货利润（处理没有关联订单的 pool）
        // 这些利润平均分配到所有维度
        const allocatedShippingProfit = Object.values(reportData.byDimension)
            .reduce((sum, d) => sum + (d.shipping_stage_profit_jpy || 0), 0);
        const unallocatedProfit = reportData.summary.shipping_stage_profit_jpy - allocatedShippingProfit;
        
        if (unallocatedProfit !== 0 && Object.keys(reportData.byDimension).length > 0) {
            // 将未分配的利润平均分配到所有维度
            const profitPerDimension = unallocatedProfit / Object.keys(reportData.byDimension).length;
            Object.values(reportData.byDimension).forEach(dimensionData => {
                dimensionData.shipping_stage_profit_jpy += profitPerDimension;
                dimensionData.total_profit_jpy = 
                    dimensionData.order_stage_profit_jpy + dimensionData.shipping_stage_profit_jpy;
            });
        }
        
        const result = {
            success: true,
            data: reportData,
            date_range: { startDate, endDate },
            dimension: dimension
        };
        
        console.log('Report result:', JSON.stringify(result, null, 2));
        
        return Response.json(result);
        
    } catch (error) {
        console.error('Report generation error:', error);
        return Response.json({ 
            error: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
});