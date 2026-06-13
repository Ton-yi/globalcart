import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useTenantBranding } from "@/hooks/useTenantBranding";
import { timePage } from "@/lib/timing";
import { ShoppingBag, Truck, Package, ArrowRight, Bell, CheckCircle, Globe } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getStatusLabel, getStatusColor } from "@/lib/orderStatus";
// Badge/getStatus* kept for future use; LogisticsStatusBoard handles order display now
import QuickActionsGrid from "@/components/home/QuickActionsGrid";
import LogisticsStatusBoard from "@/components/home/LogisticsStatusBoard";

export default function Home() {
  const { user } = useCurrentUser();
  const { tenant } = useTenantBranding();
  const [recentOrders, setRecentOrders] = useState([]);
  const [quickActions, setQuickActions] = useState([]);
  const [boardConfig, setBoardConfig] = useState({});

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
          return { quickActions: parseJson('home_quick_actions') || [], boardConfig: parseJson('home_status_board') || {} };
        }).catch(() => ({ quickActions: [], boardConfig: {} }))),
    ]).then(([orders, { quickActions, boardConfig }]) => {
      setRecentOrders(orders);
      setQuickActions(quickActions);
      setBoardConfig(boardConfig);
      t.done('data ready');
    });
  }, []);

  const steps = [
    { icon: ShoppingBag, title: "提交购买需求", desc: "填写商品链接、数量，系统自动估算预付款" },
    { icon: CheckCircle, title: "确认付款", desc: "选择支付方式完成预付款，管理员审核确认" },
    { icon: Package, title: "采购进行中", desc: "我们在日本为您采购商品，实时更新状态" },
    { icon: Truck, title: "提交发货需求", desc: "填写收货地址，选运输方式，余额自动抵扣运费" },
  ];

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          <Globe className="w-5 h-5 text-red-600" />
          <span className="text-sm text-gray-500">日本 → 全球</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{tenant?.login_title || "同一物流 · Tongyi Express"}</h1>
        <p className="text-gray-500 mb-6 max-w-md mx-auto text-sm">
          {tenant?.login_subtitle || "专业代购日本商品，安心付款，全程追踪，极速发货至全球各地"}
        </p>
        {user ? (
          <div className="flex gap-3 justify-center">
            <Link to={createPageUrl("SubmitOrder")}>
              <Button className="bg-red-600 hover:bg-red-700">
                <ShoppingBag className="w-4 h-4 mr-2" />提交购买需求
              </Button>
            </Link>
            <Link to={createPageUrl("MyOrders")}>
              <Button variant="outline">查看我的订单</Button>
            </Link>
          </div>
        ) : (
          <Button className="bg-red-600 hover:bg-red-700" onClick={() => base44.auth.redirectToLogin()}>
            登录开始代购
          </Button>
        )}
      </div>

      {/* Quick Actions */}
      {user && quickActions.length > 0 && (
        <QuickActionsGrid actions={quickActions} userRole={user.role} />
      )}

      {/* Steps */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">代购流程</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {steps.map(({ icon: Icon, title, desc }, i) => (
            <Card key={i} className="border-gray-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 bg-red-50 rounded flex items-center justify-center">
                    <Icon className="w-3.5 h-3.5 text-red-600" />
                  </div>
                  <span className="text-xs text-gray-400">Step {i + 1}</span>
                </div>
                <div className="font-medium text-sm text-gray-900 mb-1">{title}</div>
                <div className="text-xs text-gray-500">{desc}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Logistics Status Board */}
      {user && recentOrders.length > 0 && (
        <LogisticsStatusBoard orders={recentOrders} boardConfig={boardConfig} />
      )}
    </div>
  );
}