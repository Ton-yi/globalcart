import React from "react";
import MetricCard, { formatCurrency } from "./MetricCard";
import { TrendLineChart } from "./TrendChart";
import PieDistribution from "./PieDistribution";
import DimensionTable from "./DimensionTable";
import CompareBar from "./CompareBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, TrendingDown, Package } from "lucide-react";

export default function FinanceDashboard({ data, dimension, compare }) {
    if (!data) return null;
    const { summary, byDimension, timeSeries, compareSummary } = data;

    const incomePieData = [
        { name: '商品货款收入', value: summary.order_stage_payment_jpy || 0 },
        { name: '运费收入',     value: summary.shipping_stage_income_jpy || 0 },
        { name: '代购服务费',   value: summary.service_fee_revenue_jpy || 0 },
        { name: '增值服务费',   value: summary.addon_revenue_jpy || 0 },
        { name: '尺寸追加费',   value: summary.item_size_extra_fee_jpy || 0 },
        { name: '外箱收费',     value: summary.box_charge_jpy || 0 },
    ].filter(d => d.value > 0);

    const expensePieData = [
        { name: '货款成本',     value: summary.goods_cost_jpy || 0 },
        { name: '国际运费支出', value: summary.actual_international_shipping_cost_jpy || 0 },
        { name: '外箱成本',     value: summary.box_actual_cost_jpy || 0 },
        { name: '退款',         value: summary.refund_amount_jpy || 0 },
    ].filter(d => d.value > 0);

    const totalIncome  = (summary.order_stage_payment_jpy || 0) + (summary.shipping_stage_income_jpy || 0)
        + (summary.addon_revenue_jpy || 0) + (summary.item_size_extra_fee_jpy || 0)
        + (summary.box_charge_jpy || 0) + (summary.service_fee_revenue_jpy || 0);
    const totalExpense = (summary.goods_cost_jpy || 0) + (summary.actual_international_shipping_cost_jpy || 0)
        + (summary.box_actual_cost_jpy || 0) + (summary.refund_amount_jpy || 0);

    return (
        <div className="space-y-4">
            {/* 同比/环比 */}
            {compareSummary && (
                <CompareBar
                    summary={summary}
                    compareSummary={compareSummary}
                    comparePeriod={data.compare_period}
                    compare={compare}
                />
            )}

            {/* 财务汇总 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MetricCard title="总收入" value={totalIncome} icon={DollarSign}
                    subtitle={`货款 ${formatCurrency(summary.order_stage_payment_jpy)}`} />
                <MetricCard title="总支出" value={totalExpense} icon={TrendingDown} colorClass="text-red-600"
                    subtitle={`货款成本 ${formatCurrency(summary.goods_cost_jpy)}`} />
                <MetricCard title="下单阶段利润" value={summary.order_stage_profit_jpy} icon={TrendingUp}
                    colorClass={summary.order_stage_profit_jpy >= 0 ? 'text-green-600' : 'text-red-600'}
                    subtitle="收入 - 退款 - 成本" />
                <MetricCard title="运费结算利润" value={summary.shipping_stage_profit_jpy} icon={TrendingUp}
                    colorClass={summary.shipping_stage_profit_jpy >= 0 ? 'text-green-600' : 'text-red-600'}
                    subtitle={`${formatCurrency(summary.shipping_stage_income_jpy)} - ${formatCurrency(summary.actual_international_shipping_cost_jpy)}`} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MetricCard title="代购服务费" value={summary.service_fee_revenue_jpy} icon={DollarSign} />
                <MetricCard title="增值服务收入" value={summary.addon_revenue_jpy} icon={DollarSign} />
                <MetricCard title="外箱利润" value={summary.box_profit_jpy} icon={Package}
                    subtitle={`收 ${formatCurrency(summary.box_charge_jpy)} - 成本 ${formatCurrency(summary.box_actual_cost_jpy)}`} />
                <MetricCard title="综合总利润" value={summary.total_profit_jpy} icon={TrendingUp}
                    colorClass={summary.total_profit_jpy >= 0 ? 'text-green-600' : 'text-red-600'} />
            </div>

            {/* 利润趋势（含累计） */}
            <TrendLineChart title="收入 & 利润趋势"
                data={timeSeries}
                lines={[
                    { key: 'revenue_jpy',     name: '收入',     color: '#3b82f6' },
                    { key: 'profit_jpy',      name: '利润',     color: '#10b981' },
                    { key: 'refund_jpy',      name: '退款',     color: '#ef4444' },
                    { key: 'service_fee_jpy', name: '服务费',   color: '#f59e0b' },
                ]} />

            <TrendLineChart title="累计收入趋势"
                data={timeSeries}
                lines={[
                    { key: 'revenue_jpy_cum', name: '累计收入', color: '#6366f1' },
                    { key: 'profit_jpy_cum',  name: '累计利润', color: '#10b981' },
                ]} />

            {/* 收入/支出分布 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <PieDistribution title="收入来源分布" data={incomePieData} />
                <PieDistribution title="支出分布"     data={expensePieData} />
            </div>

            {/* 维度分析表 */}
            <DimensionTable title="按维度分析（财务）" data={byDimension} dimension={dimension} />

            {/* 指标说明 */}
            <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">指标说明</CardTitle></CardHeader>
                <CardContent className="text-xs text-muted-foreground space-y-1">
                    <p><strong>下单阶段利润</strong> = 用户下单实付金额 - 退款金额 - 日元货款成本</p>
                    <p><strong>运费结算利润</strong> = 运费收入 - 实际国际运费 - 外箱成本</p>
                    <p><strong>外箱利润</strong> = 外箱收取金额 - 外箱实际成本</p>
                    <p><strong>综合总利润</strong> = 下单阶段利润 + 运费结算利润</p>
                    <p><strong>代购服务费</strong> = 订单计算快照中的 service_fee_amount（按规则自动计算）</p>
                </CardContent>
            </Card>
        </div>
    );
}