import { useState, useEffect } from "react";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useTenantBranding } from "@/hooks/useTenantBranding";
import { timePage } from "@/lib/timing";
import { Truck, Package, CheckCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getStatusLabel, getStatusColor } from "@/lib/orderStatus";
// Badge/getStatus* kept for future use; LogisticsStatusBoard handles order display now
import QuickActionsGrid from "@/components/home/QuickActionsGrid";
import LogisticsStatusBoard from "@/components/home/LogisticsStatusBoard";
import HeroSection from "@/components/home/HeroSection";

export default function Home() {
  const { user } = useCurrentUser();
  const { tenant } = useTenantBranding();
  const [recentOrders, setRecentOrders] = useState([]);
  const [quickActions, setQuickActions] = useState([]);
  const [boardConfig, setBoardConfig] = useState({});
  const [heroConfig, setHeroConfig] = useState(null);
  const [stepsConfig, setStepsConfig] = useState(null);

  useEffect(() => {
    const t = timePage('Home');
    Promise.all([
      t.timeCall('getTenantOrders', () => base44.functions.invoke('getTenantOrders', {})
        .then(r => (r.data?.orders || []).slice(0, 5)).catch(() => [])),
      t.timeCall('getTenantSettings', () => base44.functions.invoke('getTenantSettings', {})
        .then(r => {
          const raw = r.data?.raw || [];
          const parseJson = (key) => {
            const item = raw.find(s => s.key === key);
            if (item?.value) { try { return JSON.parse(item.value); } catch { return null; } }
            return null;
          };
          return { quickActions: parseJson('home_quick_actions') || [], boardConfig: parseJson('home_status_board') || {}, heroConfig: parseJson('home_hero_config') || null, stepsConfig: parseJson('home_steps_config') || null };
        }).catch(() => ({ quickActions: [], boardConfig: {}, heroConfig: null }))),
    ]).then(([orders, { quickActions, boardConfig, heroConfig, stepsConfig }]) => {
      setRecentOrders(orders);
      setQuickActions(quickActions);
      setBoardConfig(boardConfig);
      setHeroConfig(heroConfig);
      setStepsConfig(stepsConfig);
      t.done('data ready');
    });
  }, []);

  const DEFAULT_SECTIONS = [{
    heading: "代购流程",
    steps: [
      { title: "提交购买需求", desc: "填写商品链接、数量，系统自动估算预付款" },
      { title: "确认付款",     desc: "选择支付方式完成预付款，管理员审核确认" },
      { title: "采购进行中",   desc: "我们在日本为您采购商品，实时更新状态" },
      { title: "提交发货需求", desc: "填写收货地址，选运输方式，余额自动抵扣运费" },
    ],
  }];
  const STEP_ICONS = [Package, CheckCircle, Package, Truck];

  // resolve steps audience config — supports both old {heading,steps} and new {sections:[]}
  const resolveSteps = () => {
    if (!stepsConfig) return { visible: true, sections: DEFAULT_SECTIONS };
    let cfg;
    if (stepsConfig.unified) {
      cfg = stepsConfig.guest;
    } else {
      const isAdmin = user?.role === "admin" || user?.role === "tenant_admin" || user?.role === "platform_admin" || user?.role === "staff";
      if (isAdmin && stepsConfig.admin) cfg = stepsConfig.admin;
      else if (user && stepsConfig.user) cfg = stepsConfig.user;
      else cfg = stepsConfig.guest;
    }
    const visible = cfg?.visible !== false;
    // Normalise: old format has heading+steps, new has sections[]
    let sections;
    if (Array.isArray(cfg?.sections)) {
      sections = cfg.sections;
    } else if (cfg?.steps) {
      sections = [{ heading: cfg.heading || "代购流程", steps: cfg.steps }];
    } else {
      sections = DEFAULT_SECTIONS;
    }
    return { visible, sections };
  };
  const stepsResolved = resolveSteps();

  return (
    <div className="space-y-8">
      {/* Hero */}
      <HeroSection config={heroConfig} user={user} tenant={tenant} />

      {/* Quick Actions */}
      {user && quickActions.length > 0 && (
        <QuickActionsGrid actions={quickActions} userRole={user.role} />
      )}

      {/* Steps — multi-section */}
      {stepsResolved.visible && stepsResolved.sections.map((section, si) => (
        <div key={si}>
          {section.heading && (
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{section.heading}</h2>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(section.steps || []).map((step, i) => {
              const Icon = STEP_ICONS[i] || Package;
              return (
                <Card key={i} className="border-gray-200">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 bg-red-50 rounded flex items-center justify-center">
                        <Icon className="w-3.5 h-3.5 text-red-600" />
                      </div>
                      <span className="text-xs text-gray-400">Step {i + 1}</span>
                    </div>
                    <div className="font-medium text-sm text-gray-900 mb-1">{step.title}</div>
                    <div className="text-xs text-gray-500">{step.desc}</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      {/* Logistics Status Board */}
      {user && recentOrders.length > 0 && (
        <LogisticsStatusBoard orders={recentOrders} boardConfig={boardConfig} />
      )}
    </div>
  );
}