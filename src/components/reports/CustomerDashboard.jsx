import React from "react";
import MetricCard, { formatCurrency, formatNumber } from "./MetricCard";
import { TrendBarChart } from "./TrendChart";
import PieDistribution from "./PieDistribution";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserPlus, RepeatIcon, DollarSign } from "lucide-react";

export default function CustomerDashboard({ data }) {
    if (!data) return null;
    const { summary, topCustomers, storeTagCounts } = data;

    const top10 = topCustomers || [];
    const maxRevenue = top10[0]?.revenue_jpy || 1;

    // 新老客户比例
    const newOldData = [
        { name: '新客', value: summary.new_customers || 0 },
        { name: '老客', value: summary.returning_customers || 0 },
    ];

    // 客户下单网站偏好（以下单网站区分）
    const storeData = Object.entries(storeTagCounts || {}).map(([k, v]) => ({ name: k, value: v }));

    const avgRevenuePerCustomer = summary.total_customers > 0
        ? Math.round((summary.order_stage_payment_jpy || 0) / summary.total_customers) : 0;

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MetricCard title="活跃客户数" value={summary.total_customers} icon={Users} isCount />
                <MetricCard title="新客户" value={summary.new_customers} icon={UserPlus} isCount colorClass="text-blue-600" />
                <MetricCard title="老客户" value={summary.returning_customers} icon={RepeatIcon} isCount colorClass="text-green-600" />
                <MetricCard title="客均消费" value={avgRevenuePerCustomer} icon={DollarSign} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <PieDistribution title="新客 / 老客比例" data={newOldData} />
                <PieDistribution title="客户下单网站偏好" data={storeData} />
            </div>

            {/* 客户消费排行 */}
            <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">客户消费排行（Top 10）</CardTitle></CardHeader>
                <CardContent>
                    {top10.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">暂无数据</p>}
                    <div className="space-y-3">
                        {top10.map((c, i) => (
                            <div key={c.email} className="flex items-center gap-3">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                                    ${i === 0 ? 'bg-yellow-100 text-yellow-700' : i === 1 ? 'bg-gray-100 text-gray-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-gray-50 text-gray-500'}`}>
                                    {i + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium truncate">{c.email}</div>
                                    <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                                        <div className="bg-blue-500 h-1.5 rounded-full transition-all"
                                            style={{ width: `${(c.revenue_jpy / maxRevenue) * 100}%` }} />
                                    </div>
                                </div>
                                <div className="text-sm font-semibold text-right whitespace-nowrap">{formatCurrency(c.revenue_jpy)}</div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}