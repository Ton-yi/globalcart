import React from "react";
import MetricCard, { formatCurrency } from "./MetricCard";
import { TrendLineChart } from "./TrendChart";
import PieDistribution from "./PieDistribution";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck, DollarSign, TrendingUp, TrendingDown } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export default function LogisticsDashboard({ data, dimension }) {
    if (!data) return null;
    const { summary, byDimension } = data;

    // 运费收支对比（按运输方式）
    const shippingMethodData = dimension === 'shipping_method'
        ? Object.entries(byDimension || {}).map(([name, d]) => ({
            name,
            收入: d.order_stage_payment_jpy || 0,
            利润: d.shipping_stage_profit_jpy || 0,
        }))
        : [];

    // 目的地分布
    const countryData = dimension === 'destination_country'
        ? Object.entries(byDimension || {}).map(([k, v]) => ({ name: k, value: v.order_count }))
        : [];

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MetricCard title="发货池数量" value={summary.total_shipping_pools} icon={Truck} isCount />
                <MetricCard title="运费收入" value={summary.shipping_stage_income_jpy} icon={DollarSign} />
                <MetricCard title="运费支出" value={summary.actual_international_shipping_cost_jpy} icon={TrendingDown} colorClass="text-red-500" />
                <MetricCard title="运费利润" value={summary.shipping_stage_profit_jpy} icon={TrendingUp}
                    colorClass={summary.shipping_stage_profit_jpy >= 0 ? 'text-green-600' : 'text-red-600'} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
                <MetricCard title="外箱收入" value={summary.box_charge_jpy} icon={DollarSign} />
                <MetricCard title="外箱利润" value={summary.box_profit_jpy} icon={TrendingUp}
                    colorClass={summary.box_profit_jpy >= 0 ? 'text-green-600' : 'text-red-600'}
                    subtitle={`成本 ${formatCurrency(summary.box_actual_cost_jpy)}`} />
            </div>

            {/* 运费收支对比 */}
            {shippingMethodData.length > 0 && (
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">运费收支对比（按运输方式）</CardTitle></CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={240}>
                            <BarChart data={shippingMethodData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `¥${(v/1000).toFixed(0)}k`} width={55} />
                                <Tooltip formatter={v => `¥${v.toLocaleString('ja-JP')}`} />
                                <Legend />
                                <Bar dataKey="收入" fill="#3b82f6" />
                                <Bar dataKey="利润" fill="#10b981" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}

            {/* 提示：切换到运输方式维度或目的地国家维度查看分布 */}
            {shippingMethodData.length === 0 && (
                <Card>
                    <CardContent className="py-6 text-center text-sm text-muted-foreground">
                        切换上方维度为「运输方式」或「目的地国家」可查看物流详细分布
                    </CardContent>
                </Card>
            )}
        </div>
    );
}