import React from "react";
import MetricCard, { formatCurrency, formatNumber } from "./MetricCard";
import { TrendBarChart } from "./TrendChart";
import PieDistribution from "./PieDistribution";
import DimensionTable from "./DimensionTable";
import { ShoppingBag, XCircle, CheckCircle, Clock } from "lucide-react";

const STATUS_LABELS = {
    pending_confirmation: '待确认', payment_pending: '待付款', paid: '已付款',
    pending_purchase: '待采购', purchased: '已采购', in_warehouse: '已入库',
    in_storage: '仓储中', notified_shipment: '已通知发货', ready_to_ship: '待发货',
    shipped: '已发货', transit_shipped: '中转已发', delivered: '已送达', cancelled: '已取消', unknown: '未知'
};

export default function OrderDashboard({ data, dimension }) {
    if (!data) return null;
    const { summary, byDimension, timeSeries } = data;

    const deliveredCount = summary.status_counts?.delivered || 0;
    const cancelledCount = summary.status_counts?.cancelled || 0;

    const statusPieData = Object.entries(summary.status_counts || {}).map(([k, v]) => ({
        name: STATUS_LABELS[k] || k, value: v
    }));

    const storeTagData = data.storeTagCounts
        ? Object.entries(data.storeTagCounts).map(([k, v]) => ({ name: k, value: v }))
        : [];

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MetricCard title="总订单数" value={summary.total_orders} icon={ShoppingBag} isCount />
                <MetricCard title="已完成" value={deliveredCount} icon={CheckCircle} isCount colorClass="text-green-600" />
                <MetricCard title="已取消" value={cancelledCount} icon={XCircle} isCount colorClass="text-red-500" />
                <MetricCard title="待处理（入库）" value={summary.pending_ship_count} icon={Clock} isCount />
            </div>

            {/* 订单数趋势 */}
            <TrendBarChart title="订单数量趋势" data={timeSeries}
                bars={[{ key: 'order_count', name: '订单数', color: '#6366f1' }]} />

            {/* 分布 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <PieDistribution title="订单状态分布" data={statusPieData} />
                <PieDistribution title="下单网站分布" data={storeTagData} />
            </div>

            {/* 维度明细表 */}
            <DimensionTable title="按维度分析（订单）" data={byDimension} dimension={dimension} />
        </div>
    );
}