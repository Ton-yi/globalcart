/**
 * CompareBar — 同比/环比对比横幅
 * 展示当前期 vs 对比期的关键指标变化率
 */
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatCurrency } from "./MetricCard";

function pctChange(curr, prev) {
    if (!prev || prev === 0) return null;
    return ((curr - prev) / Math.abs(prev)) * 100;
}

function DeltaBadge({ curr, prev, isCount = false }) {
    const pct = pctChange(curr, prev);
    if (pct === null) return <span className="text-xs text-muted-foreground">—</span>;
    const positive = pct >= 0;
    const Icon = pct === 0 ? Minus : positive ? TrendingUp : TrendingDown;
    const color = pct === 0 ? 'text-gray-500' : positive ? 'text-green-600' : 'text-red-500';
    return (
        <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${color}`}>
            <Icon className="w-3 h-3" />
            {Math.abs(pct).toFixed(1)}%
        </span>
    );
}

const METRICS = [
    { key: 'total_orders',             label: '订单数',   isCount: true },
    { key: 'total_customers',          label: '客户数',   isCount: true },
    { key: 'order_stage_payment_jpy',  label: '商品收入' },
    { key: 'shipping_stage_income_jpy',label: '运费收入' },
    { key: 'total_profit_jpy',         label: '总利润' },
];

export default function CompareBar({ summary, compareSummary, comparePeriod, compare }) {
    if (!compareSummary || !compare) return null;

    const label = compare === 'yoy' ? '同比' : '环比';
    const periodStr = comparePeriod
        ? `${comparePeriod.startDate} ~ ${comparePeriod.endDate}`
        : '';

    return (
        <Card className="border-blue-100 bg-blue-50/50">
            <CardContent className="py-3">
                <div className="flex items-center gap-1 mb-2">
                    <span className="text-xs font-medium text-blue-700">{label}对比</span>
                    {periodStr && <span className="text-xs text-blue-500">（对比期：{periodStr}）</span>}
                </div>
                <div className="flex flex-wrap gap-4">
                    {METRICS.map(m => {
                        const curr = summary?.[m.key] || 0;
                        const prev = compareSummary?.[m.key] || 0;
                        return (
                            <div key={m.key} className="flex flex-col gap-0.5 min-w-[80px]">
                                <span className="text-xs text-muted-foreground">{m.label}</span>
                                <span className="text-sm font-semibold">
                                    {m.isCount ? curr.toLocaleString() : formatCurrency(curr)}
                                </span>
                                <div className="flex items-center gap-1">
                                    <span className="text-xs text-muted-foreground">
                                        上期：{m.isCount ? prev.toLocaleString() : formatCurrency(prev)}
                                    </span>
                                    <DeltaBadge curr={curr} prev={prev} isCount={m.isCount} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}