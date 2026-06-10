import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, TrendingUp, Package, DollarSign, AlertTriangle } from "lucide-react";

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
                // response 包含 { success, data, date_range, dimension }
                // 返回内部的 data 字段（包含 summary 和 byDimension）
                return response.data;
            } catch (err) {
                console.error('Report fetch error:', err);
                throw err;
            }
        },
        retry: false
    });

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('ja-JP', {
            style: 'currency',
            currency: 'JPY'
        }).format(amount || 0);
    };

    const MetricCard = ({ title, value, icon: Icon, subtitle }) => (
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
        console.error('Report error details:', error);
        return (
            <div className="p-6">
                <Card className="border-red-200 bg-red-50">
                    <CardContent className="pt-6">
                        <div className="flex items-start gap-3 text-red-600">
                            <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-medium">报表加载失败</p>
                                <p className="text-sm mt-1">{error?.message || '未知错误'}</p>
                                <p className="text-xs mt-2 text-red-500">请检查控制台日志获取详细信息</p>
                            </div>
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
                <div className="flex flex-col items-center justify-center py-20">
                    <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mb-4"></div>
                    <p className="text-muted-foreground">正在加载报表数据...</p>
                </div>
            ) : reportData && reportData.summary ? (
                <>
                    {/* 汇总指标 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <MetricCard 
                            title="下单阶段利润" 
                            value={reportData.summary.order_stage_profit_jpy || 0} 
                            icon={TrendingUp}
                            subtitle={`收入：${formatCurrency(reportData.summary.order_stage_payment_jpy || 0)} - 退款：${formatCurrency(reportData.summary.refund_amount_jpy || 0)} - 成本：${formatCurrency(reportData.summary.goods_cost_jpy || 0)}`}
                        />
                        <MetricCard 
                            title="运费结算利润" 
                            value={reportData.summary.shipping_stage_profit_jpy || 0} 
                            icon={DollarSign}
                            subtitle={`运费收入：${formatCurrency(reportData.summary.shipping_stage_income_jpy || 0)} - 运费支出：${formatCurrency(reportData.summary.actual_international_shipping_cost_jpy || 0)}`}
                        />
                        <MetricCard 
                            title="外箱利润" 
                            value={reportData.summary.box_profit_jpy || 0} 
                            icon={Package}
                            subtitle={`收费：${formatCurrency(reportData.summary.box_charge_jpy || 0)} - 成本：${formatCurrency(reportData.summary.box_actual_cost_jpy || 0)}`}
                        />
                        <MetricCard 
                            title="总利润" 
                            value={reportData.summary.total_profit_jpy || 0} 
                            icon={TrendingUp}
                            subtitle={`订单数：${reportData.summary.total_orders || 0}`}
                        />
                    </div>

                    {/* 成本缺失提醒 */}
                    {(reportData.summary.orders_missing_cost_data || 0) > 0 && (
                        <Card className="border-yellow-200 bg-yellow-50">
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-2 text-yellow-800">
                                    <AlertTriangle className="h-5 w-5" />
                                    <p>
                                        <strong>注意：</strong>
                                        有 {reportData.summary.orders_missing_cost_data || 0} 个历史订单缺少实际成本数据，
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
                                        {Object.entries(reportData.byDimension || {}).map(([key, data]) => (
                                            <tr key={key} className="border-b hover:bg-gray-50">
                                                <td className="py-3 px-4">{key}</td>
                                                <td className="text-right py-3 px-4">{data.order_count || 0}</td>
                                                <td className="text-right py-3 px-4">
                                                    <span className={(data.order_stage_profit_jpy || 0) >= 0 ? 'text-green-600' : 'text-red-600'}>
                                                        {formatCurrency(data.order_stage_profit_jpy || 0)}
                                                    </span>
                                                </td>
                                                <td className="text-right py-3 px-4">
                                                    <span className={(data.shipping_stage_profit_jpy || 0) >= 0 ? 'text-green-600' : 'text-red-600'}>
                                                        {formatCurrency(data.shipping_stage_profit_jpy || 0)}
                                                    </span>
                                                </td>
                                                <td className="text-right py-3 px-4">
                                                    <span className={(data.total_profit_jpy || 0) >= 0 ? 'text-green-600' : 'text-red-600'}>
                                                        {formatCurrency(data.total_profit_jpy || 0)}
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
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>暂无数据</p>
                    <p className="text-sm mt-2">请选择日期范围后点击"更新报表"</p>
                </div>
            )}
        </div>
    );
}