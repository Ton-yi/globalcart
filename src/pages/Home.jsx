import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useTenantBranding } from "@/hooks/useTenantBranding";
import { usePageData } from "@/hooks/usePageData";
import { ShoppingBag, Truck, Package, ArrowRight, Bell, CheckCircle, Globe } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getStatusLabel, getStatusColor } from "@/lib/orderStatus";

export default function Home() {
  const { user } = useCurrentUser();
  const { tenant } = useTenantBranding();

  // Cached: navigating away and back won't re-fetch within 60s
  const { data: ordersData } = usePageData('getTenantOrders', {}, { enabled: !!user });
  const { data: configData } = usePageData('getTenantConfigData', {}, { enabled: !!user });

  const recentOrders = (ordersData?.orders || []).slice(0, 5);
  const announcements = (configData?.announcements || []).filter(a => a.is_active);

  const steps = [
    { icon: ShoppingBag, title: "提交购买需求", desc: "填写商品链接、数量，系统自动估算预付款" },
    { icon: CheckCircle, title: "确认付款", desc: "选择支付方式完成预付款，管理员审核确认" },
    { icon: Package, title: "采购进行中", desc: "我们在日本为您采购商品，实时更新状态" },
    { icon: Truck, title: "提交发货需求", desc: "填写收货地址，选运输方式，余额自动抵扣运费" },
  ];

  return (
    <div className="space-y-8">
      {/* Announcements */}
      {announcements.length > 0 && (
        <div className="space-y-2">
          {announcements.map(a => (
            <div key={a.id} className={`flex items-start gap-2 p-3 rounded-lg border text-sm ${
              a.type === "urgent" ? "bg-red-50 border-red-200 text-red-800" :
              a.type === "warning" ? "bg-yellow-50 border-yellow-200 text-yellow-800" :
              a.type === "success" ? "bg-green-50 border-green-200 text-green-800" :
              "bg-blue-50 border-blue-200 text-blue-800"
            }`}>
              <Bell className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div><strong>{a.title}</strong>：{a.content}</div>
            </div>
          ))}
        </div>
      )}

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

      {/* Recent Orders */}
      {user && recentOrders.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">最近订单</h2>
            <Link to={createPageUrl("MyOrders")} className="text-xs text-red-600 flex items-center gap-1 hover:underline">
              查看全部 <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">订单</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 hidden sm:table-cell">商品</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">状态</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 hidden md:table-cell">预付款</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentOrders.map(order => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{order.order_number || order.id.slice(0,8)}</td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <div className="max-w-xs truncate text-gray-800">{order.product_name}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`text-xs ${getStatusColor(order.order_status, "user")}`}>
                        {getStatusLabel(order.order_status, "user")}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-gray-700">
                      {order.prepayment_amount ? `${order.prepayment_currency} ${order.prepayment_amount.toFixed(2)}` : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}