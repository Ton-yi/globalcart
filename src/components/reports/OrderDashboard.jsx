import React from "react";
import MetricCard, { formatNumber } from "./MetricCard";
import { TrendBarChart } from "./TrendChart";
import PieDistribution from "./PieDistribution";
import DimensionTable from "./DimensionTable";
import { ShoppingBag, XCircle, CheckCircle, Clock } from "lucide-react";

const STATUS_LABELS = {
    pending_confirmation: '待确认', payment_pending: '待付款', paid: '已付款',
    pending_purchase: '待采购', purchased: '已采购', in_warehouse: '已入库',
    in_storage: '仓储中', notified_shipment: '已通知发货', ready_to_ship: '待发货',
    shipped: '已发货', transit_shipped: '中转已发', delivered: '已送达',
    cancelled: '已取消', unknown: '未知'
};

export default function OrderDashboard({ data, dimension }) {
    if (!data) return null;
    const { summary, byDimension, timeSeries } = data;

    const deliveredCount = summary.status_counts?.delivered || 0;
    const cancelledCount = summary.status_counts?.cancelled || 0;

    const statusPieData = Object.entries(summary.status_counts || {})
        .map(([k, v]) => ({ name: STATUS_LABELS[k] || k, value: v }));

    const storeTagData = data.storeTagCounts
        ? Object.entries(data.storeTagCounts).map(([k, v]) => ({ name: k, value: v }))
        : [];

    // 增值服务分布
    const addonData = Object.entries(summary.addon_distribution || {})
        .map(([k, v]) => ({ name: k, value: v }))
        .sort((a, b) => b.value - a.value);

    // 入库尺寸分布
    const sizeData = Object.entries(summary.item_size_distribution || {})
        .map(([k, v]) => ({ name: k, value: v }))
        .sort((a, b) => b.value - a.value);

    return (
        <div className="space-y-4">
            {/* 汇总指标 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MetricCard title="总订单数"      value={summary.total_orders}           icon={ShoppingBag} isCount />
                <MetricCard title="已完成"        value={deliveredCount}                 icon={CheckCircle} isCount colorClass="text-green-600" />
                <MetricCard title="已取消"        value={cancelledCount}                 icon={XCircle}     isCount colorClass="text-red-500" />
                <MetricCard title="仓库待发货"    value={summary.pending_ship_count}     icon={Clock}       isCount />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MetricCard title="待付款"   value={summary.pending_payment_count}   icon={Clock} isCount />
                <MetricCard title="待采购"   value={summary.pending_purchase_count}  icon={ShoppingBag} isCount />
                <MetricCard title="活跃客户" value={summary.total_customers}         icon={ShoppingBag} isCount />
                <MetricCard title="客均订单" value={
                    summary.total_customers > 0
                        ? (summary.total_orders / summary.total_customers).toFixed(1)
                        : 0
                } icon={ShoppingBag} isCount={false} subtitle="单/客户" />
            </div>

            {/* 订单数趋势 */}
            <TrendBarChart title="订单数量趋势" data={timeSeries}
                bars={[{ key: 'order_count', name: '订单数', color: '#6366f1' }]} />

            {/* 分布图 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <PieDistribution title="订单状态分布" data={statusPieData} />
                <PieDistribution title="下单网站分布" data={storeTagData} />
            </div>

            {/* 增值服务 & 入库尺寸分布 */}
            {(addonData.length > 0 || sizeData.length > 0) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {addonData.length > 0 && (
                        <PieDistribution title="增值服务选用分布" data={addonData} />
                    )}
                    {sizeData.length > 0 && (
                        <PieDistribution title="入库尺寸分布" data={sizeData} />
                    )}
                </div>
            )}

            {/* 维度明细表 */}
            <DimensionTable title="按维度分析（订单）" data={byDimension} dimension={dimension} />
        </div>
    );
}