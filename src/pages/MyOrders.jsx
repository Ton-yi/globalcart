import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Package, CreditCard, Eye, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getStatusLabel, getStatusColor, COMPLETED_STATUSES } from "@/lib/orderStatus";
import PaymentModal from "@/components/orders/PaymentModal";
import UserNotifyShipmentModal from "@/components/orders/UserNotifyShipmentModal";
import OrderDetailDrawer from "@/components/orders/OrderDetailDrawer";

export default function MyOrders() {
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("active");

  // Modal state
  const [detailOrder, setDetailOrder] = useState(null);
  const [payingOrder, setPayingOrder] = useState(null);
  const [payMode, setPayMode] = useState("prepay");
  const [notifyShipOrder, setNotifyShipOrder] = useState(null);

  const load = async () => {
    const u = await base44.auth.me();
    setUser(u);
    const data = await base44.entities.Order.filter({ user_email: u.email }, "-updated_date");
    setOrders(data);
    setLoading(false);
  };

  useEffect(() => { load().catch(() => base44.auth.redirectToLogin()); }, []);

  const refresh = () => load();

  const activeOrders = orders.filter(o => !COMPLETED_STATUSES.includes(o.order_status) && o.order_status !== "cancelled");
  const completedOrders = orders.filter(o => COMPLETED_STATUSES.includes(o.order_status));
  const cancelledOrders = orders.filter(o => o.order_status === "cancelled");

  const displayOrders = filter === "active" ? activeOrders
    : filter === "completed" ? completedOrders
    : cancelledOrders;

  const filterTabs = [
    { key: "active", label: "进行中", count: activeOrders.length },
    { key: "completed", label: "完成的订单", count: completedOrders.length },
    { key: "cancelled", label: "已取消", count: cancelledOrders.length },
  ];

  // Determine action buttons for a row
  const getRowActions = (order) => {
    const s = order.order_status;
    const actions = [];

    // Pay button
    if (s === "payment_pending") {
      actions.push({ type: "pay", mode: "prepay", label: "付款", color: "bg-red-600 hover:bg-red-700" });
    }
    if (order.supplement_requested && s !== "cancelled") {
      actions.push({ type: "pay", mode: "supplement", label: `补款`, color: "bg-orange-600 hover:bg-orange-700" });
    }
    if (s === "shipping_fee_pending" && order.shipping_fee_amount > 0) {
      actions.push({ type: "pay", mode: "shipping", label: "付运费", color: "bg-yellow-600 hover:bg-yellow-700" });
    }

    // Notify shipment
    if (s === "in_warehouse") {
      actions.push({ type: "notify_ship", label: "通知发货", color: "bg-teal-600 hover:bg-teal-700" });
    }

    return actions;
  };

  // For "paid" status: smart click on product name
  const handleProductClick = (order) => {
    const urls = (order.product_url || "").split("\n").map(s => s.trim()).filter(Boolean);
    const hasDesc = !!(order.product_description?.trim());
    const hasNote = !!(order.user_note?.trim());
    if (urls.length === 1 && !hasDesc && !hasNote) {
      window.open(urls[0], "_blank");
    } else {
      setDetailOrder(order);
    }
  };

  const handleAction = (order, action) => {
    if (action?.type === "pay") {
      setPayMode(action.mode);
      setPayingOrder(order);
    } else if (action?.type === "notify_ship") {
      setNotifyShipOrder(order);
    }
  };

  const handleDrawerAction = (order, actionType) => {
    if (actionType === "pay_shipping") {
      setDetailOrder(null);
      setPayMode("shipping");
      setPayingOrder(order);
    } else if (actionType === "notify_ship") {
      setDetailOrder(null);
      setNotifyShipOrder(order);
    } else {
      refresh();
      setDetailOrder(null);
    }
  };

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
        {filterTabs.map(t => (
          <button key={t.key} onClick={() => setFilter(t.key)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              filter === t.key ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}>
            {t.label}
            {t.count > 0 && <span className="ml-1 opacity-70">({t.count})</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">加载中...</div>
      ) : displayOrders.length === 0 ? (
        <div className="text-center py-16 bg-white border border-gray-200 rounded-xl">
          <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">
            {filter === "active" ? "暂无进行中的订单" : filter === "completed" ? "暂无完成的订单" : "暂无已取消订单"}
          </p>
          {filter === "active" && (
            <Link to={createPageUrl("SubmitOrder")}>
              <Button className="mt-3 bg-red-600 hover:bg-red-700 text-sm">提交第一笔代购需求</Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">订单号</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">商品</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 hidden sm:table-cell">状态</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 hidden md:table-cell">金额</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayOrders.map(order => {
                const rowActions = getRowActions(order);
                const statusLabel = getStatusLabel(order.order_status, "user");
                const statusColor = getStatusColor(order.order_status, "user");
                const unread = order.order_status === "admin_replied";
                const isPaid = order.order_status === "paid" || order.order_status === "pending_purchase";

                return (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">
                      {order.order_number || order.id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3">
                      <div
                        className={`font-medium truncate max-w-xs ${isPaid ? "text-blue-600 hover:text-blue-800 cursor-pointer flex items-center gap-1" : "text-gray-900"}`}
                        onClick={isPaid ? () => handleProductClick(order) : undefined}
                      >
                        {order.product_name}
                        {isPaid && <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-50" />}
                      </div>
                      <div className="text-xs text-gray-400">×{order.quantity}</div>
                      {unread && (
                        <Badge className="bg-orange-100 text-orange-700 text-xs mt-0.5 animate-pulse">有新回复</Badge>
                      )}
                      {order.payment_due_date && order.order_status === "payment_pending" && (
                        <div className="text-xs text-red-500 mt-0.5">截止 {order.payment_due_date}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <Badge className={`text-xs ${statusColor}`}>{statusLabel}</Badge>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-gray-700 text-xs">
                      {order.prepayment_amount
                        ? <div>{order.prepayment_currency} {order.prepayment_amount.toFixed(2)}</div>
                        : <div className="text-gray-400">-</div>}
                      {order.balance_credit > 0 && (
                        <div className="text-green-600">余额 {order.prepayment_currency} {order.balance_credit.toFixed(2)}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        {rowActions.map((action, i) => (
                          <Button key={i} size="sm"
                            className={`h-7 text-xs text-white ${action.color}`}
                            onClick={() => handleAction(order, action)}>
                            <CreditCard className="w-3 h-3 mr-1" />{action.label}
                          </Button>
                        ))}
                        <Button size="sm" variant="ghost" className="h-7 text-xs"
                          onClick={() => setDetailOrder(order)}>
                          <Eye className="w-3 h-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {payingOrder && (
        <PaymentModal
          order={payingOrder}
          mode={payMode}
          onClose={() => setPayingOrder(null)}
          onSuccess={() => { setPayingOrder(null); refresh(); }}
        />
      )}
      {notifyShipOrder && (
        <UserNotifyShipmentModal
          order={notifyShipOrder}
          onClose={() => setNotifyShipOrder(null)}
          onSuccess={() => { setNotifyShipOrder(null); refresh(); }}
        />
      )}
      {detailOrder && user && (
        <OrderDetailDrawer
          order={detailOrder}
          currentUser={user}
          onClose={() => setDetailOrder(null)}
          onAction={(a) => handleDrawerAction(detailOrder, a)}
        />
      )}
    </div>
  );
}