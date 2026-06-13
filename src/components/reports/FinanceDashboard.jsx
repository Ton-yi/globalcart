import React from "react";
import MetricCard, { formatCurrency } from "./MetricCard";
import { TrendLineChart } from "./TrendChart";
import PieDistribution from "./PieDistribution";
import DimensionTable from "./DimensionTable";
import CompareBar from "./CompareBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, TrendingDown, Package, Clock, XCircle } from "lucide-react";

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
        { name: '会员阶级收入', value: summary.tier_purchase_revenue_jpy || 0 },
    ].filter(d => d.value > 0);

    const expensePieData = [
        { name: '货款成本',     value: summary.goods_cost_jpy || 0 },
        { name: '国际运费支出', value: summary.actual_international_shipping_cost_jpy || 0 },
        { name: '外箱成本',     value: summary.box_actual_cost_jpy || 0 },
        { name: '退款',         value: summary.refund_amount_jpy || 0 },
    ].filter(d => d.value > 0);

    const totalIncome  = (summary.order_stage_payment_jpy || 0) + (summary.shipping_stage_income_jpy || 0)
        + (summary.addon_revenue_jpy || 0) + (summary.item_size_extra_fee_jpy || 0)
        + (summary.box_charge_jpy || 0) + (summary.service_fee_revenue_jpy || 0)
        + (summary.tier_purchase_revenue_jpy || 0);
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
                <MetricCard title="会员阶级收入" value={summary.tier_purchase_revenue_jpy || 0} icon={DollarSign}
                    subtitle={`已支付 ${summary.tier_purchase_count || 0} 笔`}
                    description="用户购买/升级会员阶级的已支付金额（含支付宝自动确认与管理员手动确认）。" />
                <MetricCard title="后付款笔数" value={summary.post_shipment_paid_count || 0} icon={Package} isCount
                    subtitle="发货后补付确认收款的发货池"
                    description="跳过付款先发货/待发货，事后确认收款的发货池数量。其收入在收款确认后才计入报表。" />
                <MetricCard title="超时取消订单" value={summary.timeout_cancelled_count || 0} icon={XCircle} isCount
                    subtitle="因付款超时被自动取消"
                    description="因超过设定付款时限被系统自动取消的订单数量。" />
                {summary.avg_goods_pay_hours !== null && summary.avg_goods_pay_hours !== undefined && (
                  <MetricCard title="平均付货款时间"
                    value={summary.avg_goods_pay_hours < 24
                      ? `${summary.avg_goods_pay_hours.toFixed(1)}h`
                      : `${(summary.avg_goods_pay_hours / 24).toFixed(1)}天`}
                    icon={Clock} isCount
                    subtitle="从下单到完成付货款"
                    description="所有已付款订单的平均付货款时间（下单到付款时点）。" />
                )}
            </div>

            {/* 利润趋势（含累计） */}
            <TrendLineChart title="收入 & 利润趋势"
                data={timeSeries}
                lines={[
                    { key: 'revenue_jpy',     name: '收入',     color: '#3b82f6' },
                    { key: 'profit_jpy',      name: '利润',     color: '#10b981' },
                    { key: 'refund_jpy',      name: '退款',     color: '#ef4444' },
                    { key: 'service_fee_jpy', name: '服务费',   color: '#f59e0b' },
                    { key: 'tier_revenue_jpy', name: '会员收入', color: '#8b5cf6' },
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
                    <p><strong>综合总利润</strong> = 下单阶段利润 + 运费结算利润 + 会员阶级收入</p>
                    <p><strong>会员阶级收入</strong> = 已支付的会员购买/升级差价（payable_jpy），按支付完成时间归属</p>
                    <p><strong>代购服务费</strong> = 订单计算快照中的 service_fee_amount（按规则自动计算）</p>
                </CardContent>
            </Card>
        </div>
    );
}