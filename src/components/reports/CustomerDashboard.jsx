import React from "react";
import MetricCard, { formatCurrency } from "./MetricCard";
import PieDistribution from "./PieDistribution";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserPlus, Repeat2, DollarSign, ShoppingBag } from "lucide-react";

export default function CustomerDashboard({ data }) {
    if (!data) return null;
    const { summary, topCustomers, storeTagCounts } = data;

    const top10 = topCustomers || [];
    const maxRevenue = top10[0]?.revenue_jpy || 1;

    const newOldData = [
        { name: '新客', value: summary.new_customers || 0 },
        { name: '老客', value: summary.returning_customers || 0 },
    ];

    const storeData = Object.entries(storeTagCounts || {}).map(([k, v]) => ({ name: k, value: v }));

    // 国家/地区分布（从 summary 取）
    const countryData = Object.entries(summary.country_distribution || {})
        .map(([k, v]) => ({ name: k, value: v }))
        .sort((a, b) => b.value - a.value);

    const avgRevenuePerCustomer = summary.total_customers > 0
        ? Math.round((summary.order_stage_payment_jpy || 0) / summary.total_customers) : 0;

    // 复购率：老客 / 总客户
    const repurchaseRate = summary.total_customers > 0
        ? ((summary.returning_customers || 0) / summary.total_customers * 100).toFixed(1)
        : 0;

    return (
        <div className="space-y-4">
            {/* 汇总指标 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MetricCard title="活跃客户数" value={summary.total_customers}        icon={Users}    isCount />
                <MetricCard title="新客户"      value={summary.new_customers}          icon={UserPlus} isCount colorClass="text-blue-600" />
                <MetricCard title="老客户"      value={summary.returning_customers}    icon={Repeat2}  isCount colorClass="text-green-600" />
                <MetricCard title="客均消费"    value={avgRevenuePerCustomer}          icon={DollarSign} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MetricCard title="复购率" value={`${repurchaseRate}%`} icon={Repeat2}
                    isCount={false} colorClass="text-green-600" subtitle="老客 / 总客户" />
                <MetricCard title="客均订单数" icon={ShoppingBag}
                    value={summary.total_customers > 0 ? (summary.total_orders / summary.total_customers).toFixed(1) : 0}
                    isCount={false} subtitle="单/客户" />
                <MetricCard title="总订单数" value={summary.total_orders} icon={ShoppingBag} isCount />
                <MetricCard title="客均利润" icon={DollarSign}
                    value={summary.total_customers > 0 ? Math.round(summary.total_profit_jpy / summary.total_customers) : 0}
                    colorClass={summary.total_profit_jpy >= 0 ? 'text-green-600' : 'text-red-600'} />
            </div>

            {/* 分布图 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <PieDistribution title="新客 / 老客比例"     data={newOldData} />
                <PieDistribution title="客户下单网站偏好" data={storeData} />
            </div>

            {countryData.length > 0 && (
                <PieDistribution title="客户目的地国家 / 地区分布" data={countryData} />
            )}

            {/* 客户消费排行 Top 10 */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">客户消费排行（Top 10）</CardTitle>
                </CardHeader>
                <CardContent>
                    {top10.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">暂无数据</p>}
                    <div className="space-y-3">
                        {top10.map((c, i) => (
                            <div key={c.email} className="flex items-center gap-3">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                                    ${i === 0 ? 'bg-yellow-100 text-yellow-700' : i === 1 ? 'bg-gray-200 text-gray-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-gray-50 text-gray-500'}`}>
                                    {i + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium truncate">{c.email}</div>
                                    <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                                        <div className="bg-blue-500 h-1.5 rounded-full transition-all"
                                            style={{ width: `${(c.revenue_jpy / maxRevenue) * 100}%` }} />
                                    </div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <div className="text-sm font-semibold">{formatCurrency(c.revenue_jpy)}</div>
                                    <div className="text-xs text-muted-foreground">{c.order_count} 单</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}