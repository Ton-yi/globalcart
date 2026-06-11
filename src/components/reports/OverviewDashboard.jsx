import React from "react";
import MetricCard, { formatCurrency, formatNumber } from "./MetricCard";
import { TrendLineChart, TrendBarChart } from "./TrendChart";
import PieDistribution from "./PieDistribution";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    ShoppingBag, Users, TrendingUp, DollarSign,
    Clock, Package, Truck, AlertCircle
} from "lucide-react";

const STATUS_LABELS = {
    pending_confirmation: '待确认', payment_pending: '待付款', paid: '已付款',
    pending_purchase: '待采购', purchased: '已采购', in_warehouse: '已入库',
    in_storage: '仓储中', notified_shipment: '已通知发货', ready_to_ship: '待发货',
    shipped: '已发货', transit_shipped: '中转已发', delivered: '已送达', cancelled: '已取消', unknown: '未知'
};

export default function OverviewDashboard({ data }) {
    if (!data) return null;
    const { summary, timeSeries, topCustomers, storeTagCounts } = data;

    // 订单状态分布
    const statusPieData = Object.entries(summary.status_counts || {}).map(([k, v]) => ({
        name: STATUS_LABELS[k] || k, value: v
    }));

    // 收入来源分布
    const revenuePieData = [
        { name: '商品货款', value: summary.order_stage_payment_jpy || 0 },
        { name: '运费收入', value: summary.shipping_stage_income_jpy || 0 },
        { name: '增值服务', value: summary.addon_revenue_jpy || 0 },
        { name: '尺寸追加费', value: summary.item_size_extra_fee_jpy || 0 },
    ].filter(d => d.value > 0);

    // Top 5 客户
    const top5 = (topCustomers || []).slice(0, 5);

    // 下单网站
    const storeTagData = Object.entries(storeTagCounts || {}).map(([k, v]) => ({ name: k, value: v }));

    return (
        <div className="space-y-4">
            {/* KPI 卡片 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MetricCard title="期间订单数" value={summary.total_orders} icon={ShoppingBag} isCount subtitle={`待采购 ${summary.pending_purchase_count}`} />
                <MetricCard title="客户数" value={summary.total_customers} icon={Users} isCount subtitle={`新客 ${summary.new_customers} / 老客 ${summary.returning_customers}`} />
                <MetricCard title="总收入" value={summary.order_stage_payment_jpy} icon={DollarSign} subtitle={`退款：${formatCurrency(summary.refund_amount_jpy)}`} />
                <MetricCard title="总利润" value={summary.total_profit_jpy} icon={TrendingUp}
                    colorClass={summary.total_profit_jpy >= 0 ? 'text-green-600' : 'text-red-600'}
                    subtitle={`订单均价：${formatCurrency(summary.avg_order_value_jpy)}`} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MetricCard title="待付款订单" value={summary.pending_payment_count} icon={Clock} isCount />
                <MetricCard title="待采购订单" value={summary.pending_purchase_count} icon={Package} isCount />
                <MetricCard title="仓库待发货" value={summary.pending_ship_count} icon={Truck} isCount />
                <MetricCard title="运费利润" value={summary.shipping_stage_profit_jpy} icon={TrendingUp}
                    colorClass={summary.shipping_stage_profit_jpy >= 0 ? 'text-green-600' : 'text-red-600'}
                    subtitle={`收 ${formatCurrency(summary.shipping_stage_income_jpy)} - 支 ${formatCurrency(summary.actual_international_shipping_cost_jpy)}`} />
            </div>

            {/* 趋势图 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <TrendLineChart title="收入趋势" data={timeSeries}
                    lines={[{ key: 'revenue_jpy', name: '收入', color: '#3b82f6' }, { key: 'profit_jpy', name: '利润', color: '#10b981' }]} />
                <TrendBarChart title="订单数趋势" data={timeSeries}
                    bars={[{ key: 'order_count', name: '订单数', color: '#6366f1' }]} />
            </div>

            {/* 分布图 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <PieDistribution title="订单状态分布" data={statusPieData} />
                <PieDistribution title="收入来源分布" data={revenuePieData} />
                <PieDistribution title="下单网站分布" data={storeTagData} />
            </div>

            {/* Top 5 客户 */}
            <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Top 5 客户（期间消费）</CardTitle></CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {top5.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">暂无数据</p>}
                        {top5.map((c, i) => (
                            <div key={c.email} className="flex items-center gap-3">
                                <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600">{i + 1}</div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium truncate">{c.email}</div>
                                    <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                                        <div className="bg-blue-500 h-1.5 rounded-full"
                                            style={{ width: `${top5[0] ? (c.revenue_jpy / top5[0].revenue_jpy * 100) : 0}%` }} />
                                    </div>
                                </div>
                                <div className="text-sm font-semibold text-right">{formatCurrency(c.revenue_jpy)}</div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}