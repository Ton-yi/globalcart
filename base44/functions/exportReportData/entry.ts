/**
 * exportReportData - 导出报表数据为 Excel 或 CSV 格式
 * 支持导出：汇总数据、时间序列数据、维度明细数据
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import * as xlsx from 'npm:xlsx@0.18.5';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        // 权限检查：仅管理员可导出
        if (!user || (user.role !== 'admin' && user.role !== 'tenant_admin' && user.role !== 'staff' && user.role !== 'platform_admin')) {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        const { startDate, endDate, dimension, granularity, compare, filters, format = 'xlsx' } = await req.json();

        if (!startDate || !endDate) {
            return Response.json({ error: 'Missing required parameters: startDate, endDate' }, { status: 400 });
        }

        // 调用 getReportData 获取数据
        const reportResponse = await base44.functions.invoke('getReportData', {
            startDate, endDate, dimension, granularity, compare, filters,
        });

        const reportData = reportResponse?.data?.data ?? reportResponse?.data ?? reportResponse;

        if (!reportData?.summary) {
            return Response.json({ error: 'No data available for export' }, { status: 400 });
        }

        // 根据格式生成文件
        if (format === 'csv') {
            return generateCSV(reportData, startDate, endDate);
        } else {
            return generateExcel(reportData, startDate, endDate);
        }
    } catch (error) {
        console.error('[exportReportData] error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});

function generateCSV(data, startDate, endDate) {
    const rows = [];
    const summary = data.summary || {};

    // 汇总数据
    rows.push(['=== 汇总数据 ===']);
    rows.push(['指标', '数值', '说明']);
    rows.push(['下单收入 (JPY)', summary.order_stage_payment_jpy || 0, '用户下单阶段实际支付金额']);
    rows.push(['发货收入 (JPY)', summary.shipping_stage_income_jpy || 0, '发货阶段收取的运费收入']);
    rows.push(['总利润 (JPY)', summary.total_profit_jpy || 0, '下单利润 + 发货利润']);
    rows.push(['下单利润 (JPY)', summary.order_stage_profit_jpy || 0, '下单收入 - 退款 - 商品成本']);
    rows.push(['发货利润 (JPY)', summary.shipping_stage_profit_jpy || 0, '运费收入 - 国际运费 - 外箱成本']);
    rows.push(['服务费收入 (JPY)', summary.service_fee_revenue_jpy || 0, '代购服务费收入']);
    rows.push(['增值服务收入 (JPY)', summary.addon_revenue_jpy || 0, '打包/验货/拍照等收入']);
    rows.push(['退款合计 (JPY)', summary.refund_amount_jpy || 0, '期间退款总金额']);
    rows.push(['商品成本 (JPY)', summary.goods_cost_jpy || 0, '商品采购成本']);
    rows.push(['订单总数', summary.total_orders || 0, '期间创建的订单总数']);
    rows.push(['活跃客户数', summary.total_customers || 0, '期间有下单的客户数（去重）']);
    rows.push(['新客户数', summary.new_customers || 0, '期间首次下单的客户数']);
    rows.push(['平均订单金额 (JPY)', summary.avg_order_value_jpy || 0, '客单价']);
    rows.push(['待付款订单数', summary.pending_payment_count || 0, '待确认/待付款订单']);
    rows.push(['待采购订单数', summary.pending_purchase_count || 0, '订单状态为待采购']);
    rows.push(['待发货订单数', summary.pending_ship_count || 0, '已入库/仓储中订单']);
    rows.push([]);

    // 时间序列数据
    if (data.timeSeries && data.timeSeries.length > 0) {
        rows.push(['=== 时间序列数据 ===']);
        rows.push(['日期', '收入 (JPY)', '利润 (JPY)', '服务费 (JPY)', '运费收入 (JPY)', '增值服务 (JPY)', '订单数', '退款 (JPY)']);
        data.timeSeries.forEach(ts => {
            rows.push([
                ts.period,
                ts.revenue_jpy || 0,
                ts.profit_jpy || 0,
                ts.service_fee_jpy || 0,
                ts.shipping_income_jpy || 0,
                ts.addon_revenue_jpy || 0,
                ts.order_count || 0,
                ts.refund_jpy || 0,
            ]);
        });
        rows.push([]);
    }

    // 维度分布数据
    if (data.byDimension && Object.keys(data.byDimension).length > 0) {
        rows.push(['=== 维度明细 ===']);
        rows.push(['维度值', '订单数', '收入 (JPY)', '利润 (JPY)', '服务费 (JPY)', '退款 (JPY)']);
        Object.entries(data.byDimension).forEach(([dimKey, dimData]) => {
            rows.push([
                dimKey,
                dimData.order_count || 0,
                dimData.revenue_jpy || 0,
                dimData.profit_jpy || 0,
                dimData.service_fee_jpy || 0,
                dimData.refund_jpy || 0,
            ]);
        });
        rows.push([]);
    }

    // 对比期间数据（如果有）
    if (data.compare_period) {
        rows.push(['=== 对比期间数据 ===']);
        rows.push(['指标', '当前期间', '对比期间', '变化率']);
        const cp = data.compare_period;
        if (cp.summary) {
            rows.push(['下单收入 (JPY)', summary.order_stage_payment_jpy || 0, cp.summary.order_stage_payment_jpy || 0, formatPercent(cp.changes?.order_stage_payment_jpy)]);
            rows.push(['总利润 (JPY)', summary.total_profit_jpy || 0, cp.summary.total_profit_jpy || 0, formatPercent(cp.changes?.total_profit_jpy)]);
            rows.push(['订单总数', summary.total_orders || 0, cp.summary.total_orders || 0, formatPercent(cp.changes?.total_orders)]);
        }
    }

    // 转换为 CSV
    const csvContent = rows.map(row => row.map(formatCSVCell).join(',')).join('\n');

    const fileName = `report_export_${startDate}_to_${endDate}.csv`;
    return new Response(csvContent, {
        status: 200,
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${fileName}"`,
        },
    });
}

function generateExcel(data, startDate, endDate) {
    const wb = xlsx.utils.book_new();

    // Sheet 1: 汇总数据
    const summaryData = [
        ['报表导出', `${startDate} 至 ${endDate}`],
        [],
        ['=== 汇总数据 ==='],
        ['指标', '数值'],
    ];

    const summary = data.summary;
    summaryData.push(['下单收入 (JPY)', summary.order_stage_payment_jpy || 0]);
    summaryData.push(['发货收入 (JPY)', summary.shipping_stage_income_jpy || 0]);
    summaryData.push(['总利润 (JPY)', summary.total_profit_jpy || 0]);
    summaryData.push(['下单利润 (JPY)', summary.order_stage_profit_jpy || 0]);
    summaryData.push(['发货利润 (JPY)', summary.shipping_stage_profit_jpy || 0]);
    summaryData.push(['服务费收入 (JPY)', summary.service_fee_revenue_jpy || 0]);
    summaryData.push(['增值服务收入 (JPY)', summary.addon_revenue_jpy || 0]);
    summaryData.push(['退款合计 (JPY)', summary.refund_amount_jpy || 0]);
    summaryData.push(['商品成本 (JPY)', summary.goods_cost_jpy || 0]);
    summaryData.push(['订单总数', summary.total_orders || 0]);
    summaryData.push(['活跃客户数', summary.total_customers || 0]);
    summaryData.push(['新客户数', summary.new_customers || 0]);
    summaryData.push(['平均订单金额 (JPY)', summary.avg_order_value_jpy || 0]);
    summaryData.push(['待付款订单数', summary.pending_payment_count || 0]);
    summaryData.push(['待采购订单数', summary.pending_purchase_count || 0]);
    summaryData.push(['待发货订单数', summary.pending_ship_count || 0]);

    const wsSummary = xlsx.utils.aoa_to_sheet(summaryData);
    xlsx.utils.book_append_sheet(wb, wsSummary, '汇总数据');

    // Sheet 2: 时间序列
    if (data.timeSeries && data.timeSeries.length > 0) {
        const timeHeaders = [['日期', '收入 (JPY)', '利润 (JPY)', '服务费 (JPY)', '运费收入 (JPY)', '增值服务 (JPY)', '订单数', '退款 (JPY)']];
        const timeData = data.timeSeries.map(ts => [
            ts.period,
            ts.revenue_jpy || 0,
            ts.profit_jpy || 0,
            ts.service_fee_jpy || 0,
            ts.shipping_income_jpy || 0,
            ts.addon_revenue_jpy || 0,
            ts.order_count || 0,
            ts.refund_jpy || 0,
        ]);
        const wsTime = xlsx.utils.aoa_to_sheet([...timeHeaders, ...timeData]);
        xlsx.utils.book_append_sheet(wb, wsTime, '时间序列');
    }

    // Sheet 3: 维度明细
    if (data.byDimension && Object.keys(data.byDimension).length > 0) {
        const dimHeaders = [['维度值', '订单数', '收入 (JPY)', '利润 (JPY)', '服务费 (JPY)', '退款 (JPY)']];
        const dimData = Object.entries(data.byDimension).map(([dimKey, dimData]) => [
            dimKey,
            dimData.order_count || 0,
            dimData.revenue_jpy || 0,
            dimData.profit_jpy || 0,
            dimData.service_fee_jpy || 0,
            dimData.refund_jpy || 0,
        ]);
        const wsDim = xlsx.utils.aoa_to_sheet([...dimHeaders, ...dimData]);
        xlsx.utils.book_append_sheet(wb, wsDim, '维度明细');
    }

    // Sheet 4: 对比数据（如果有）
    if (data.compare_period && data.compare_period.summary) {
        const compareData = [
            ['=== 对比期间数据 ==='],
            ['指标', '当前期间', '对比期间', '变化率'],
        ];
        const cp = data.compare_period;
        compareData.push(['下单收入 (JPY)', summary.order_stage_payment_jpy || 0, cp.summary.order_stage_payment_jpy || 0, formatPercent(cp.changes?.order_stage_payment_jpy)]);
        compareData.push(['总利润 (JPY)', summary.total_profit_jpy || 0, cp.summary.total_profit_jpy || 0, formatPercent(cp.changes?.total_profit_jpy)]);
        compareData.push(['订单总数', summary.total_orders || 0, cp.summary.total_orders || 0, formatPercent(cp.changes?.total_orders)]);

        const wsCompare = xlsx.utils.aoa_to_sheet(compareData);
        xlsx.utils.book_append_sheet(wb, wsCompare, '对比分析');
    }

    // 生成 buffer - xlsx.write 返回的是数组，需要转换为 Uint8Array
    const buffer = xlsx.write(wb, { type: 'array', bookType: 'xlsx' });
    const uint8Array = new Uint8Array(buffer);

    const fileName = `report_export_${startDate}_to_${endDate}.xlsx`;
    return new Response(uint8Array, {
        status: 200,
        headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${fileName}"`,
        },
    });
}

function formatPercent(value) {
    if (value === null || value === undefined) return '';
    return `${(value * 100).toFixed(2)}%`;
}

// 修复 CSV 中的 undefined/null 值
function formatCSVCell(cell) {
    if (cell === null || cell === undefined) return '';
    const str = String(cell);
    if (str.includes(',') || str.includes('\n') || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}