import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Package, Eye, CreditCard, Truck, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import OrderDetailModal from "@/components/orders/OrderDetailModal";
import PaymentModal from "@/components/orders/PaymentModal";

const STATUS_LABELS = {
  draft: "草稿", submitted: "已提交", price_confirmed: "已报价",
  payment_pending: "待付款", payment_confirmed: "已付款",
  purchasing: "采购中", purchased: "已购买",
  awaiting_shipment: "等待发货", shipped: "已发货", delivered: "已签收", cancelled: "已取消"
};
const STATUS_COLORS = {
  draft: "bg-gray-100 text-gray-600",
  submitted: "bg-blue-100 text-blue-700",
  price_confirmed: "bg-yellow-100 text-yellow-700",
  payment_pending: "bg-orange-100 text-orange-700",
  payment_confirmed: "bg-green-100 text-green-700",
  purchasing: "bg-purple-100 text-purple-700",
  purchased: "bg-indigo-100 text-indigo-700",
  awaiting_shipment: "bg-cyan-100 text-cyan-700",
  shipped: "bg-teal-100 text-teal-700",
  delivered: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function MyOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [payingOrder, setPayingOrder] = useState(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    const load = async () => {
      const user = await base44.auth.me();
      const data = await base44.entities.Order.filter({ user_email: user.email }, "-updated_date");
      setOrders(data);
      setLoading(false);
    };
    load().catch(() => base44.auth.redirectToLogin());
  }, []);

  const refresh = async () => {
    const user = await base44.auth.me();
    const data = await base44.entities.Order.filter({ user_email: user.email }, "-updated_date");
    setOrders(data);
  };

  const filters = [
    { key: "all", label: "全部" },
    { key: "payment_pending", label: "待付款" },
    { key: "payment_confirmed", label: "已付款" },
    { key: "purchasing", label: "采购中" },
    { key: "awaiting_shipment", label: "等待发货" },
    { key: "shipped", label: "已发货" },
  ];

  const filtered = filter === "all" ? orders : orders.filter(o => o.order_status === filter);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">我的订单</h1>
          <p className="text-sm text-gray-500 mt-0.5">共 {orders.length} 笔订单</p>
        </div>
        <Link to={createPageUrl("SubmitOrder")}>
          <Button className="bg-red-600 hover:bg-red-700 text-sm">+ 新增需求</Button>
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {filters.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              filter === f.key ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}>
            {f.label}
            {f.key !== "all" && <span className="ml-1 text-xs opacity-70">
              ({orders.filter(o => o.order_status === f.key).length})
            </span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">加载中...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white border border-gray-200 rounded-xl">
          <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">暂无订单</p>
          <Link to={createPageUrl("SubmitOrder")}>
            <Button className="mt-3 bg-red-600 hover:bg-red-700 text-sm">提交第一笔代购需求</Button>
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">订单号</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">商品</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 hidden sm:table-cell">状态</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 hidden md:table-cell">预付款</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 hidden lg:table-cell">余额</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(order => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{order.order_number || order.id.slice(0,8)}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 truncate max-w-xs">{order.product_name}</div>
                    <div className="text-xs text-gray-400">×{order.quantity}</div>
                    {order.supplement_requested && (
                      <Badge className="bg-orange-100 text-orange-700 text-xs mt-1">需补款 {order.prepayment_currency} {order.supplement_amount}</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <Badge className={`text-xs ${STATUS_COLORS[order.order_status] || "bg-gray-100 text-gray-600"}`}>
                      {STATUS_LABELS[order.order_status] || order.order_status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-gray-700">
                    {order.prepayment_amount ? `${order.prepayment_currency} ${order.prepayment_amount.toFixed(2)}` : "-"}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {order.balance_credit > 0 ? (
                      <span className="text-green-600 font-medium">{order.prepayment_currency} {order.balance_credit.toFixed(2)}</span>
                    ) : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {(order.order_status === "payment_pending" || order.supplement_requested) && (
                        <Button size="sm" className="h-7 text-xs bg-red-600 hover:bg-red-700" onClick={() => setPayingOrder(order)}>
                          <CreditCard className="w-3 h-3 mr-1" />付款
                        </Button>
                      )}
                      {order.order_status === "purchased" && (
                        <Link to={createPageUrl("ShippingRequests")}>
                          <Button size="sm" variant="outline" className="h-7 text-xs">
                            <Truck className="w-3 h-3 mr-1" />发货
                          </Button>
                        </Link>
                      )}
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedOrder(order)}>
                        <Eye className="w-3 h-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedOrder && (
        <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} onRefresh={refresh} />
      )}
      {payingOrder && (
        <PaymentModal order={payingOrder} onClose={() => setPayingOrder(null)} onSuccess={() => { setPayingOrder(null); refresh(); }} />
      )}
    </div>
  );
}