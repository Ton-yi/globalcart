/**
 * CustomDashboardTab — 「我的看板」选项卡的完整内容
 * 负责加载看板列表、切换、传入数据
 */
import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, LayoutDashboard } from "lucide-react";
import DashboardManager from "./customDashboard/DashboardManager.jsx";
import CustomDashboardView from "./customDashboard/CustomDashboardView.jsx";

export default function CustomDashboardTab({ reportData, dimension }) {
    const [dashboards,         setDashboards]         = useState([]);
    const [activeDashboardId,  setActiveDashboardId]  = useState(null);
    const [loading,            setLoading]            = useState(true);

    const loadDashboards = useCallback(async () => {
        setLoading(true);
        const res = await base44.functions.invoke('manageCustomDashboard', { action: 'list' });
        const list = res?.data?.dashboards || [];
        setDashboards(list);
        // 如果当前激活的看板被删除了，自动清空
        if (activeDashboardId && !list.find(d => d.id === activeDashboardId)) {
            setActiveDashboardId(list[0]?.id || null);
        } else if (!activeDashboardId && list.length > 0) {
            setActiveDashboardId(list[0].id);
        }
        setLoading(false);
    }, [activeDashboardId]);

    useEffect(() => {
        loadDashboards();
    }, []);

    const activeDashboard = dashboards.find(d => d.id === activeDashboardId) || null;

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* 看板选择器 + 管理工具栏 */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                    <LayoutDashboard className="w-4 h-4" />
                    我的看板
                </div>
                <DashboardManager
                    dashboards={dashboards}
                    activeDashboardId={activeDashboardId}
                    onSelect={setActiveDashboardId}
                    onRefresh={loadDashboards}
                />
            </div>

            {/* 看板画布 */}
            <CustomDashboardView
                dashboard={activeDashboard}
                reportData={reportData}
                dimension={dimension}
                onSaved={loadDashboards}
            />
        </div>
    );
}