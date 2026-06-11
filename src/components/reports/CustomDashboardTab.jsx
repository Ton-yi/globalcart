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
        try {
            const res = await base44.functions.invoke('manageCustomDashboard', { action: 'list' });
            // 兼容 SDK 嵌套结构
            const result = res?.data?.data ?? res?.data;
            const list = result?.dashboards || [];
            console.log('[CustomDashboardTab] loaded dashboards:', list);
            setDashboards(list);
            setActiveDashboardId(prev => {
                if (prev && list.find(d => d.id === prev)) return prev;
                return list[0]?.id || null;
            });
        } catch (err) {
            console.error('[CustomDashboardTab] failed to load:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadDashboards();
    }, [loadDashboards]);

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