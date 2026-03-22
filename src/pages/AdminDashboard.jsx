import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Package, Truck, Users, Bell, TrendingUp, AlertCircle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function AdminDashboard() {
  const [stats, setStats] = useState({ orders: [], shipping: [], users: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.functions.invoke('getTenantOrders', {}).then(r => r.data?.orders || []),
      base44.functions.invoke('listNonAdminUsers', {}).then(r => r.data?.users || []),
    ]).then(([orders, users]) => {
      setStats({ orders, shipping: [], users });
      setLoading(false);
    });
  }, []);

  const { orders, shipping, users } = stats;

  const statCards = [
    { title: "总订单数", value: orders.length, icon: Package, color: "text-blue-600 bg-blue-50", link: "AdminOrders" },
    { title: "待审核付款", value: orders.filter(o => o.payment_status === "paid" && o.order_status === "payment_pending").length, icon: AlertCircle, color: "text-orange-600 bg-orange-50", link: "AdminOrders" },
    { title: "入库待发货", value: orders.filter(o => o.order_status === "in_warehouse").length, icon: Truck, color: "text-purple-600 bg-purple-50", link: "AdminShippingPool" },
    { title: "注册用户", value: users.length, icon: Users, color: "text-green-600 bg-green-50", link: "AdminUsers" },
  ];

  const pendingOrders = orders.filter(o => o.payment_status === "paid" && o.order_status === "payment_pending").slice(0, 5);
  const pendingShipping = orders.filter(o => o.order_status === "in_warehouse").slice(0, 5);

  const statusMap = {
    draft: "草稿", submitted: "已提交", price_confirmed: "已报价",
    payment_pending: "待付款", payment_confirmed: "已付款",
    purchasing: "采购中", purchased: "已购买",
    awaiting_shipment: "等待发货", shipped: "已发货", delivered: "已签收", cancelled: "已取消"
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">管理总览</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map(({ title, value, icon: Icon, color, link }) => (
          <Link key={title} to={createPageUrl(link)}>
            <Card className="border-gray-200 hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-2 rounded-lg ${color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  {value > 0 && <Badge className="bg-red-100 text-red-700 text-xs">{value}</Badge>}
                </div>
                <div className="text-2xl font-bold text-gray-900">{loading ? "..." : value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{title}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {/* Pending Payments */}
        <Card className="border-gray-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Clock className="w-4 h-4 text-orange-500" />待确认付款
              </CardTitle>
              <Link to={createPageUrl("AdminOrders")} className="text-xs text-red-600 hover:underline">查看全部</Link>
            </div>
          </CardHeader>
          <CardContent>
            {pendingOrders.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">暂无待审核订单</p>
            ) : (
              <div className="space-y-2">
                {pendingOrders.map(o => (
                  <div key={o.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div>
                      <div className="text-sm font-medium text-gray-800 truncate max-w-[180px]">{o.product_name}</div>
                      <div className="text-xs text-gray-400">{o.user_name || o.user_email}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-gray-900">{o.prepayment_currency} {o.paid_amount?.toFixed(2) || "-"}</div>
                      <Badge className="bg-orange-100 text-orange-700 text-xs">待确认</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Shipping */}
        <Card className="border-gray-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Truck className="w-4 h-4 text-purple-500" />已入库待发货
              </CardTitle>
              <Link to={createPageUrl("AdminShippingPool")} className="text-xs text-red-600 hover:underline">查看全部</Link>
            </div>
          </CardHeader>
          <CardContent>
            {pendingShipping.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">暂无待处理发货</p>
            ) : (
              <div className="space-y-2">
                {pendingShipping.map(s => (
                  <div key={s.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div>
                      <div className="text-sm font-medium text-gray-800 truncate max-w-[180px]">{s.product_name}</div>
                      <div className="text-xs text-gray-400">{s.user_name || s.user_email} · {s.order_number}</div>
                    </div>
                    <Badge className="bg-gray-100 text-gray-600 text-xs">已入库</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}