import React from "react";
import { BarChart3, TrendingUp, Users, Package, DollarSign } from "lucide-react";
import MetricCard from "@/components/reports/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function MetricCardSizesDemo() {
    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold">MetricCard 尺寸演示</h1>
                <p className="text-sm text-muted-foreground mt-0.5">展示小、中、大三种尺寸的卡片效果</p>
            </div>

            {/* 小卡片 */}
            <section>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    小卡片（sm）- 紧凑布局
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <MetricCard
                        size="sm"
                        title="订单总数"
                        value={150}
                        isCount
                        subtitle="昨日：120"
                        trend={0.25}
                        icon={Package}
                    />
                    <MetricCard
                        size="sm"
                        title="客户总数"
                        value={45}
                        isCount
                        subtitle="新增 3 人"
                        trend={0.1}
                        icon={Users}
                    />
                    <MetricCard
                        size="sm"
                        title="总收入"
                        value={1500000}
                        subtitle="环比 +15%"
                        trend={0.15}
                        icon={DollarSign}
                    />
                    <MetricCard
                        size="sm"
                        title="利润率"
                        value="32.5%"
                        raw
                        subtitle="较上月 +2.1%"
                        trend={0.021}
                    />
                </div>
            </section>

            {/* 中卡片 */}
            <section>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    中卡片（md）- 标准布局
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <MetricCard
                        size="md"
                        title="订单总数"
                        value={150}
                        isCount
                        subtitle="昨日：120"
                        trend={0.25}
                        icon={Package}
                    />
                    <MetricCard
                        size="md"
                        title="客户总数"
                        value={45}
                        isCount
                        subtitle="新增 3 人"
                        trend={0.1}
                        icon={Users}
                    />
                    <MetricCard
                        size="md"
                        title="总收入"
                        value={1500000}
                        subtitle="环比 +15%"
                        trend={0.15}
                        icon={DollarSign}
                    />
                    <MetricCard
                        size="md"
                        title="平均利润率"
                        value="32.5%"
                        raw
                        subtitle="较上月 +2.1%"
                        trend={0.021}
                        description="过去 30 天的平均利润率"
                    />
                </div>
            </section>

            {/* 大卡片 */}
            <section>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-purple-500" />
                    大卡片（lg）- 突出显示
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
                    <MetricCard
                        size="lg"
                        title="本月总利润"
                        value={450000}
                        subtitle="较上月 +12.5%"
                        trend={0.125}
                        icon={TrendingUp}
                        colorClass="text-green-600"
                        description="包含订单利润和发货利润"
                    />
                    <MetricCard
                        size="lg"
                        title="年度累计收入"
                        value={15000000}
                        subtitle="完成年度目标的 75%"
                        trend={0.08}
                        icon={BarChart3}
                        colorClass="text-blue-600"
                        description="2026 年 1 月 1 日至今的累计收入"
                    />
                </div>
            </section>

            {/* 对比示例 */}
            <section>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-orange-500" />
                    尺寸对比
                </h2>
                <Card>
                    <CardHeader>
                        <CardTitle>同一指标在不同尺寸下的显示效果</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 md:grid-cols-3">
                            <div>
                                <p className="text-xs text-muted-foreground mb-2 text-center">小卡片（sm）</p>
                                <MetricCard
                                    size="sm"
                                    title="总收入"
                                    value={1500000}
                                    subtitle="环比 +15%"
                                    trend={0.15}
                                />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground mb-2 text-center">中卡片（md）</p>
                                <MetricCard
                                    size="md"
                                    title="总收入"
                                    value={1500000}
                                    subtitle="环比 +15%"
                                    trend={0.15}
                                />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground mb-2 text-center">大卡片（lg）</p>
                                <MetricCard
                                    size="lg"
                                    title="总收入"
                                    value={1500000}
                                    subtitle="环比 +15%"
                                    trend={0.15}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </section>

            {/* 使用建议 */}
            <section>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-gray-500" />
                    使用建议
                </h2>
                <Card>
                    <CardContent className="pt-6">
                        <ul className="space-y-2 text-sm">
                            <li className="flex items-start gap-2">
                                <span className="font-semibold text-blue-600">小卡片（sm）：</span>
                                <span className="text-muted-foreground">适用于数据概览、紧凑布局、移动端优先的场景。建议每行显示 4-6 个卡片。</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="font-semibold text-green-600">中卡片（md）：</span>
                                <span className="text-muted-foreground">标准尺寸，适用于大多数报表场景。建议每行显示 3-4 个卡片。</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="font-semibold text-purple-600">大卡片（lg）：</span>
                                <span className="text-muted-foreground">适用于关键指标突出显示、首页总览、数据展示。建议每行显示 1-2 个卡片。</span>
                            </li>
                        </ul>
                    </CardContent>
                </Card>
            </section>
        </div>
    );
}