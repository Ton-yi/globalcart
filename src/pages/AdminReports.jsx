import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Download, TrendingUp, Package, DollarSign, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

export default function AdminReports() {
    const [startDate, setStartDate] = useState(() => {
        const date = new Date();
        date.setMonth(date.getMonth() - 1);
        return date.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => {
        const date = new Date();
        return date.toISOString().split('T')[0];
    });
    const [dimension, setDimension] = useState("order_status");

    const { data: reportData, isLoading, error } = useQuery({
        queryKey: ['reports', startDate, endDate, dimension],
        queryFn: async () => {
            console.log('Fetching reports with params:', { startDate, endDate, dimension });
            try {
                const response = await base44.functions.invoke('getReportData', {
                    startDate,
                    endDate,
                    dimension
                });
                console.log('Report response:', response);
                return response.data;
            } catch (err) {
                console.error('Report fetch error:', err);
                throw err;
            }
        }
    });

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('ja-JP', {
            style: 'currency',
            currency: 'JPY'
        }).format(amount || 0);
    };

    const MetricCard = ({ title, value, icon: Icon, trend, subtitle }) => (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(value)}</div>
                {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
            </CardContent>
        </Card>
    );

    if (error) {
        return (
            <div className="p-6">
                <Card className="border-red-200 bg-red-50">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-2 text-red-600">
                            <AlertTriangle className="h-5 w-5" />
                            <p>报表加载失败：{error.message}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">财务报表</h1>
                    <p className="text-muted-foreground mt-1">订单利润与运费结算分析</p>
                </div>
                <Button variant="outline" className="gap-2">
                    <Download className="h-4 w-4" />
                    导出报表
                </Button>
            </div>

            {/* 过滤器 */}
            <Card>
                <CardHeader>
                    <CardTitle>筛选条件</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <Label>开始日期</Label>
                            <Input 
                                type="date" 
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>结束日期</Label>
                            <Input 
                                type="date" 
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>维度分析</Label>
                            <Select value={dimension} onValueChange={setDimension}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="order_status">订单状态</SelectItem>
                                    <SelectItem value="payment_status">支付状态</SelectItem>
                                    <SelectItem value="shipping_method">运输方式</SelectItem>
                                    <SelectItem value="country">目的地国家</SelectItem>
                                    <SelectItem value="online_store_tag">下单网站</SelectItem>
                                    <SelectItem value="payment_method">支付方式</SelectItem>
                                    <SelectItem value="is_refunded">是否退款</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-end">
                            <Button className="w-full">
                                更新报表
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
                </div>
            ) : reportData ? (
                <>
                    {/* 汇总指标 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <MetricCard 
                            title="下单阶段利润" 
                            value={reportData.summary.order_stage_profit_jpy} 
                            icon={TrendingUp}
                            subtitle={`收入：${formatCurrency(reportData.summary.order_stage_payment_jpy)} - 退款：${formatCurrency(reportData.summary.refund_amount_jpy)} - 成本：${formatCurrency(reportData.summary.goods_cost_jpy)}`}
                        />
                        <MetricCard 
                            title="运费结算利润" 
                            value={reportData.summary.shipping_stage_profit_jpy} 
                            icon={DollarSign}
                            subtitle={`运费收入：${formatCurrency(reportData.summary.shipping_stage_income_jpy)} - 运费支出：${formatCurrency(reportData.summary.actual_international_shipping_cost_jpy)}`}
                        />
                        <MetricCard 
                            title="外箱利润" 
                            value={reportData.summary.box_profit_jpy || 0} 
                            icon={Package}
                            subtitle={`收费：${formatCurrency(reportData.summary.box_charge_jpy)} - 成本：${formatCurrency(reportData.summary.box_actual_cost_jpy)}`}
                        />
                        <MetricCard 
                            title="总利润" 
                            value={reportData.summary.total_profit_jpy} 
                            icon={TrendingUp}
                            subtitle={`订单数：${reportData.summary.total_orders}`}
                        />
                    </div>

                    {/* 成本缺失提醒 */}
                    {reportData.summary.orders_missing_cost_data > 0 && (
                        <Card className="border-yellow-200 bg-yellow-50">
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-2 text-yellow-800">
                                    <AlertTriangle className="h-5 w-5" />
                                    <p>
                                        <strong>注意：</strong>
                                        有 {reportData.summary.orders_missing_cost_data} 个历史订单缺少实际成本数据，
                                        利润为估算值。请在发货结算时录入实际运费和外箱成本。
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* 维度分析 */}
                    <Card>
                        <CardHeader>
                            <CardTitle>按 {dimension === 'order_status' ? '订单状态' : dimension === 'payment_status' ? '支付状态' : dimension === 'shipping_method' ? '运输方式' : dimension === 'country' ? '目的地国家' : dimension === 'online_store_tag' ? '下单网站' : dimension === 'payment_method' ? '支付方式' : '是否退款'} 分析</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="text-left py-3 px-4 font-medium">分类</th>
                                            <th className="text-right py-3 px-4 font-medium">订单数</th>
                                            <th className="text-right py-3 px-4 font-medium">下单利润</th>
                                            <th className="text-right py-3 px-4 font-medium">运费利润</th>
                                            <th className="text-right py-3 px-4 font-medium">总利润</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Object.entries(reportData.byDimension).map(([key, data]) => (
                                            <tr key={key} className="border-b hover:bg-gray-50">
                                                <td className="py-3 px-4">{key}</td>
                                                <td className="text-right py-3 px-4">{data.order_count}</td>
                                                <td className="text-right py-3 px-4">
                                                    <span className={data.order_stage_profit_jpy >= 0 ? 'text-green-600' : 'text-red-600'}>
                                                        {formatCurrency(data.order_stage_profit_jpy)}
                                                    </span>
                                                </td>
                                                <td className="text-right py-3 px-4">
                                                    <span className={data.shipping_stage_profit_jpy >= 0 ? 'text-green-600' : 'text-red-600'}>
                                                        {formatCurrency(data.shipping_stage_profit_jpy)}
                                                    </span>
                                                </td>
                                                <td className="text-right py-3 px-4">
                                                    <span className={data.total_profit_jpy >= 0 ? 'text-green-600' : 'text-red-600'}>
                                                        {formatCurrency(data.total_profit_jpy)}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>

                    {/* 指标说明 */}
                    <Card>
                        <CardHeader>
                            <CardTitle>指标说明</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground space-y-2">
                            <p><strong>下单阶段利润</strong> = 用户下单实付金额 - 退款金额 - 日元货款金额（商品采购成本）</p>
                            <p><strong>运费结算利润</strong> = 用户支付运费总额 - 实际国际运费 - 外箱实际成本</p>
                            <p><strong>外箱利润</strong> = 外箱收取金额 - 外箱实际成本</p>
                            <p><strong>总利润</strong> = 下单阶段利润 + 运费结算利润</p>
                            <p className="text-xs mt-2">
                                注意：商品采购成本基于日元货款金额，依赖管理员人工维护准确性。
                                部分历史订单可能缺少实际成本数据，利润为估算值。
                            </p>
                        </CardContent>
                    </Card>
                </>
            ) : (
                <div className="text-center py-12 text-muted-foreground">
                    请选择日期范围后点击"更新报表"
                </div>
            )}
        </div>
    );
}