import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, BarChart3, Package, TrendingUp, Truck, Users } from "lucide-react";
import ReportFilters from "@/components/reports/ReportFilters";
import OverviewDashboard from "@/components/reports/OverviewDashboard";
import FinanceDashboard from "@/components/reports/FinanceDashboard";
import OrderDashboard from "@/components/reports/OrderDashboard";
import LogisticsDashboard from "@/components/reports/LogisticsDashboard";
import CustomerDashboard from "@/components/reports/CustomerDashboard";

const DEFAULT_START = (() => {
    const d = new Date(); d.setDate(d.getDate() - 29);
    return d.toISOString().split('T')[0];
})();
const DEFAULT_END = new Date().toISOString().split('T')[0];

export default function AdminReports() {
    const [startDate, setStartDate] = useState(DEFAULT_START);
    const [endDate, setEndDate] = useState(DEFAULT_END);
    const [dimension, setDimension] = useState("order_status");
    const [granularity, setGranularity] = useState("day");
    const [activeTab, setActiveTab] = useState("overview");

    const { data: reportData, isLoading, error } = useQuery({
        queryKey: ['reports', startDate, endDate, dimension, granularity],
        queryFn: async () => {
            const response = await base44.functions.invoke('getReportData', {
                startDate, endDate, dimension, granularity
            });
            if (response?.data?.data?.summary) return response.data.data;
            if (response?.data?.summary) return response.data;
            if (response?.summary) return response;
            return response?.data ?? response;
        },
        retry: false,
        staleTime: 60 * 1000,
    });

    if (error) {
        return (
            <div className="p-6">
                <Card className="border-red-200 bg-red-50">
                    <CardContent className="pt-6">
                        <div className="flex items-start gap-3 text-red-600">
                            <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-medium">报表加载失败</p>
                                <p className="text-sm mt-1">{error?.message || '未知错误'}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 space-y-4">
            <div>
                <h1 className="text-2xl font-bold">数据报表</h1>
                <p className="text-sm text-muted-foreground mt-0.5">多维度业务数据分析</p>
            </div>

            {/* 筛选条件 */}
            <ReportFilters
                startDate={startDate} endDate={endDate}
                dimension={dimension} granularity={granularity}
                onStartDate={setStartDate} onEndDate={setEndDate}
                onDimension={setDimension} onGranularity={setGranularity}
            />

            {/* 看板 Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid grid-cols-5 w-full max-w-2xl">
                    <TabsTrigger value="overview" className="flex items-center gap-1 text-xs">
                        <BarChart3 className="w-3 h-3" />经营概览
                    </TabsTrigger>
                    <TabsTrigger value="finance" className="flex items-center gap-1 text-xs">
                        <TrendingUp className="w-3 h-3" />财务分析
                    </TabsTrigger>
                    <TabsTrigger value="orders" className="flex items-center gap-1 text-xs">
                        <Package className="w-3 h-3" />订单分析
                    </TabsTrigger>
                    <TabsTrigger value="logistics" className="flex items-center gap-1 text-xs">
                        <Truck className="w-3 h-3" />物流分析
                    </TabsTrigger>
                    <TabsTrigger value="customers" className="flex items-center gap-1 text-xs">
                        <Users className="w-3 h-3" />客户分析
                    </TabsTrigger>
                </TabsList>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-24">
                        <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mb-4" />
                        <p className="text-muted-foreground text-sm">正在加载报表数据...</p>
                    </div>
                ) : !reportData?.summary ? (
                    <div className="text-center py-20 text-muted-foreground">
                        <Package className="h-12 w-12 mx-auto mb-4 opacity-30" />
                        <p>暂无数据</p>
                        <p className="text-sm mt-1">请选择有效的时间范围</p>
                    </div>
                ) : (
                    <>
                        <TabsContent value="overview" className="mt-4">
                            <OverviewDashboard data={reportData} />
                        </TabsContent>
                        <TabsContent value="finance" className="mt-4">
                            <FinanceDashboard data={reportData} dimension={dimension} />
                        </TabsContent>
                        <TabsContent value="orders" className="mt-4">
                            <OrderDashboard data={reportData} dimension={dimension} />
                        </TabsContent>
                        <TabsContent value="logistics" className="mt-4">
                            <LogisticsDashboard data={reportData} dimension={dimension} />
                        </TabsContent>
                        <TabsContent value="customers" className="mt-4">
                            <CustomerDashboard data={reportData} />
                        </TabsContent>
                    </>
                )}
            </Tabs>
        </div>
    );
}