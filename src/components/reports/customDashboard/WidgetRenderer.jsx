/**
 * WidgetRenderer — 根据 widget.type 和 widget.config 渲染对应图表
 * reportData: 来自 getReportData 的完整数据对象
 */
import React from "react";
import MetricCard from "../MetricCard";
import { TrendLineChart, TrendBarChart } from "../TrendChart";
import PieDistribution from "../PieDistribution";
import DimensionTable from "../DimensionTable";
import { METRIC_FIELDS, PIE_SOURCES } from "./WidgetCatalog";
import { ShoppingBag } from "lucide-react";

const STATUS_LABELS = {
    pending_confirmation: '待确认', payment_pending: '待付款', paid: '已付款',
    pending_purchase: '待采购', purchased: '已采购', in_warehouse: '已入库',
    in_storage: '仓储中', notified_shipment: '已通知发货', ready_to_ship: '待发货',
    shipped: '已发货', transit_shipped: '中转已发', delivered: '已送达',
    cancelled: '已取消',
};

export default function WidgetRenderer({ widget, reportData, dimension }) {
    const { type, title, config = {} } = widget;

    // 报表数据未加载时显示占位
    if (!reportData?.summary) {
        return (
            <div className="border rounded-lg p-6 flex items-center justify-center text-muted-foreground text-sm bg-muted/30">
                等待报表数据加载...
            </div>
        );
    }

    const { summary, timeSeries, byDimension } = reportData;

    if (type === 'metric_card') {
        const fieldMeta = METRIC_FIELDS.find(f => f.value === config.field);
        const rawValue = summary[config.field];
        const isCount = config.isCount ?? fieldMeta?.isCount ?? false;
        return (
            <MetricCard
                title={title || fieldMeta?.label || config.field}
                value={rawValue}
                icon={ShoppingBag}
                isCount={isCount}
                raw={config.raw ?? fieldMeta?.raw ?? false}
                colorClass={config.colorClass}
                subtitle={config.subtitle}
            />
        );
    }

    if (type === 'trend_line') {
        return (
            <TrendLineChart
                title={title || '趋势折线图'}
                data={timeSeries || []}
                lines={config.lines || [{ key: 'revenue_jpy', name: '收入', color: '#3b82f6' }]}
            />
        );
    }

    if (type === 'trend_bar') {
        return (
            <TrendBarChart
                title={title || '趋势柱状图'}
                data={timeSeries || []}
                bars={config.bars || [{ key: 'order_count', name: '订单数', color: '#6366f1' }]}
            />
        );
    }

    if (type === 'pie_chart') {
        const sourceMeta = PIE_SOURCES.find(s => s.value === config.dataSource);
        const raw = sourceMeta?.from === 'root'
            ? (reportData[config.dataSource] || {})
            : (summary[config.dataSource] || {});
        const pieData = Object.entries(raw)
            .map(([k, v]) => ({ name: STATUS_LABELS[k] || k, value: v }))
            .filter(d => d.value > 0);
        return <PieDistribution title={title || (sourceMeta?.label || '分布图')} data={pieData} />;
    }

    if (type === 'dimension_table') {
        return (
            <DimensionTable
                title={title || '维度明细表'}
                data={byDimension}
                dimension={dimension}
            />
        );
    }

    return null;
}