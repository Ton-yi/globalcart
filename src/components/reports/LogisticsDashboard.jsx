import React from "react";
import MetricCard, { formatCurrency } from "./MetricCard";
import PieDistribution from "./PieDistribution";
import DimensionTable from "./DimensionTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck, DollarSign, TrendingUp, TrendingDown, Clock } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export default function LogisticsDashboard({ data, dimension }) {
    if (!data) return null;
    const { summary, byDimension } = data;

    // 运费收支对比（按运输方式维度）
    const shippingMethodData = dimension === 'shipping_method'
        ? Object.entries(byDimension || {}).map(([name, d]) => ({
            name,
            运费收入: Math.round(d.shipping_stage_income_jpy || 0),
            利润:     Math.round(d.shipping_stage_profit_jpy || 0),
        }))
        : [];

    // 目的地国家分布（从 summary 直接取，不依赖维度）
    const countryData = Object.entries(summary.country_distribution || {})
        .map(([k, v]) => ({ name: k, value: v }))
        .sort((a, b) => b.value - a.value);

    // 运输方式分布（从 summary 直接取）
    const methodData = Object.entries(summary.shipping_method_distribution || {})
        .map(([k, v]) => ({ name: k, value: v }))
        .sort((a, b) => b.value - a.value);

    // 中转地分布
    const transitData = Object.entries(summary.transit_location_distribution || {})
        .map(([k, v]) => ({ name: k, value: v }))
        .filter(d => d.name !== '无中转')
        .sort((a, b) => b.value - a.value);

    return (
        <div className="space-y-4">
            {/* 汇总指标 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MetricCard title="发货池数量" value={summary.total_shipping_pools}                 icon={Truck}        isCount />
                <MetricCard title="运费收入"   value={summary.shipping_stage_income_jpy}            icon={DollarSign} />
                <MetricCard title="运费支出"   value={summary.actual_international_shipping_cost_jpy} icon={TrendingDown} colorClass="text-red-500" />
                <MetricCard title="运费利润"   value={summary.shipping_stage_profit_jpy}            icon={TrendingUp}
                    colorClass={summary.shipping_stage_profit_jpy >= 0 ? 'text-green-600' : 'text-red-600'} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MetricCard title="外箱收入" value={summary.box_charge_jpy}    icon={DollarSign} />
                <MetricCard title="外箱利润" value={summary.box_profit_jpy}    icon={TrendingUp}
                    colorClass={summary.box_profit_jpy >= 0 ? 'text-green-600' : 'text-red-600'}
                    subtitle={`成本 ${formatCurrency(summary.box_actual_cost_jpy)}`} />
                <MetricCard title="待发货订单" value={summary.pending_ship_count} icon={Truck} isCount />
                <MetricCard title="平均发货时长" icon={Clock}
                    value={summary.avg_ship_days != null ? `${summary.avg_ship_days} 天` : '—'}
                    isCount={false} subtitle="入库→发货" />
            </div>

            {/* 运输方式分布 + 目的地国家分布 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {methodData.length > 0 && (
                    <PieDistribution title="发货运输方式分布" data={methodData} />
                )}
                {countryData.length > 0 && (
                    <PieDistribution title="目的地国家分布" data={countryData} />
                )}
            </div>

            {/* 中转地分布 */}
            {transitData.length > 0 && (
                <PieDistribution title="中转地使用分布" data={transitData} />
            )}

            {/* 运费收支对比图（需切换到运输方式维度） */}
            {shippingMethodData.length > 0 ? (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">运费收支对比（按运输方式）</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={240}>
                            <BarChart data={shippingMethodData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `¥${(v/1000).toFixed(0)}k`} width={55} />
                                <Tooltip formatter={v => `¥${v.toLocaleString('ja-JP')}`} />
                                <Legend />
                                <Bar dataKey="运费收入" fill="#3b82f6" />
                                <Bar dataKey="利润"     fill="#10b981" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardContent className="py-4 text-center text-sm text-muted-foreground">
                        切换上方维度为「运输方式」可查看各方式的收入 vs 利润对比
                    </CardContent>
                </Card>
            )}

            {/* 维度明细表 */}
            <DimensionTable title="按维度分析（物流）" data={byDimension} dimension={dimension} />
        </div>
    );
}