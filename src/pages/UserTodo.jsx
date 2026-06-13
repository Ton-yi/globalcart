import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Bell, MessageSquare, CreditCard, Truck, Package,
  ClipboardList, CheckCircle2, RefreshCw, Megaphone, HelpCircle, Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import TodoSection from "@/components/todo/TodoSection";
import TodoItem from "@/components/todo/TodoItem";

// ── helpers ──────────────────────────────────────────────────────────────
const ORDER_STATUS_LABEL = {
  pending_confirmation: "待确认",
  payment_pending: "待付款",
  paid: "已付款",
  pending_purchase: "待采购",
  purchased: "已采购",
  in_warehouse: "已入库",
  in_storage: "在仓",
  notified_shipment: "已通知出货",
  notified_shipment_fee_pending: "待运费",
  notified_shipment_fee_paid: "运费已付",
  shipping_fee_pending: "待付运费",
  ready_to_ship: "待发货",
  transit_shipped: "转运中",
  shipped: "已发货",
  delivered: "已签收",
  cancelled: "已取消",
  expired: "已超时",
};

function fmtJpy(v) {
  if (v == null || v === 0) return null;
  return `¥${Number(v).toLocaleString()}`;
}

export default function UserTodo() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPayOrders, setSelectedPayOrders] = useState([]);
  const [selectedPayPools, setSelectedPayPools] = useState([]);
  const [selectedNotifyOrders, setSelectedNotifyOrders] = useState([]);

  const load = () => {
    setLoading(true);
    base44.functions.invoke("getUserTodoData", {})
      .then(r => setData(r.data || {}))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );

  const { orders = [], pools = [], notifications = [], announcements = [], faqQuestions = [] } = data || {};

  // ── 待确认 ────────────────────────────────────────────────────────────
  // 公告 (active, dismissible=false or not dismissed)
  const pendingAnnouncements = announcements.filter(a => a.type !== "modal" || a.is_active);
  // 通知 (unread)
  const unreadNotifications = notifications;
  // 留言 (orders with messages where last message is from admin, user hasn't replied)
  const ordersWithAdminMsg = orders.filter(o => {
    if (!o.messages || o.messages.length === 0) return false;
    const last = o.messages[o.messages.length - 1];
    return last?.role === "admin";
  });
  const poolsWithAdminMsg = pools.filter(p => {
    if (!p.messages || p.messages.length === 0) return false;
    const last = p.messages[p.messages.length - 1];
    return last?.role === "admin";
  });

  // ── 待付款 ────────────────────────────────────────────────────────────
  // 待付货款的订单：payment_pending 或 awaiting_payment
  const pendingPayOrders = orders.filter(o =>
    ["payment_pending", "pending_confirmation"].includes(o.order_status) ||
    ["pending", "awaiting_payment"].includes(o.payment_status)
  ).filter(o => !["paid", "confirmed"].includes(o.payment_status));

  // 待付运费的发货申请
  const pendingPayPools = pools.filter(p =>
    ["awaiting_payment", "pending"].includes(p.status) &&
    !["paid"].includes(p.payment_status) &&
    p.shipping_fee_jpy > 0
  );

  // ── 待通知出货 ────────────────────────────────────────────────────────
  // in_warehouse or in_storage (user hasn't created a shipping request yet)
  const pendingNotifyOrders = orders.filter(o =>
    ["in_warehouse", "in_storage"].includes(o.order_status)
  );

  // ── 待收货 ────────────────────────────────────────────────────────────
  const pendingReceiveOrders = orders.filter(o =>
    ["transit_shipped", "shipped"].includes(o.order_status)
  );
  const pendingReceivePools = pools.filter(p => p.status === "shipped");

  // ── 待补充信息 ────────────────────────────────────────────────────────
  const needsInfoOrders = orders.filter(o =>
    o.order_status === "pending_confirmation" && !o.product_url && !o.product_image_url
  );
  const pendingFaqReplies = faqQuestions;

  // ── counts ────────────────────────────────────────────────────────────
  const confirmCount = unreadNotifications.length + ordersWithAdminMsg.length + poolsWithAdminMsg.length + pendingAnnouncements.length + pendingFaqReplies.length;
  const payCount = pendingPayOrders.length + pendingPayPools.length;
  const notifyCount = pendingNotifyOrders.length;
  const receiveCount = pendingReceiveOrders.length + pendingReceivePools.length;
  const infoCount = needsInfoOrders.length;

  const totalTodo = confirmCount + payCount + notifyCount + receiveCount + infoCount;

  // ── bulk pay helpers ──────────────────────────────────────────────────
  const togglePayOrder = (id, checked) =>
    setSelectedPayOrders(prev => checked ? [...prev, id] : prev.filter(x => x !== id));
  const togglePayPool = (id, checked) =>
    setSelectedPayPools(prev => checked ? [...prev, id] : prev.filter(x => x !== id));
  const toggleNotifyOrder = (id, checked) =>
    setSelectedNotifyOrders(prev => checked ? [...prev, id] : prev.filter(x => x !== id));

  const goToMyOrders = (tab) => {
    navigate(createPageUrl("MyOrders") + (tab ? `?tab=${tab}` : ""));
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">我的待办</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {totalTodo > 0 ? `共 ${totalTodo} 项待处理` : "暂无待办事项 🎉"}
          </p>
        </div>
        <button onClick={load} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500" title="刷新">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* ── 待确认 ── */}
      <TodoSection icon={Bell} title="待确认" count={confirmCount} color="orange" emptyText="暂无待确认项目">
        {/* 公告 */}
        {pendingAnnouncements.map(a => (
          <TodoItem
            key={a.id}
            label={a.title}
            sub="新公告"
            badge={{ text: a.type === "urgent" ? "紧急" : "公告", className: a.type === "urgent" ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700" }}
            onClick={() => goToMyOrders()}
            actionLabel="查看"
          />
        ))}
        {/* 通知 */}
        {unreadNotifications.map(n => (
          <TodoItem
            key={n.id}
            label={n.title || n.subject || "新通知"}
            sub={n.message?.slice(0, 50)}
            badge={{ text: "未读", className: "bg-blue-100 text-blue-700" }}
            onClick={() => navigate(createPageUrl("Notifications"))}
            actionLabel="查看"
          />
        ))}
        {/* 订单留言 */}
        {ordersWithAdminMsg.map(o => (
          <TodoItem
            key={o.id}
            label={o.product_name}
            sub={`管理员回复了您的留言 · ${o.order_number || ""}`}
            badge={{ text: "新留言", className: "bg-purple-100 text-purple-700" }}
            onClick={() => goToMyOrders()}
            actionLabel="查看"
          />
        ))}
        {/* 发货申请留言 */}
        {poolsWithAdminMsg.map(p => (
          <TodoItem
            key={p.id}
            label={p.pool_code || p.title || "发货申请"}
            sub="管理员回复了留言"
            badge={{ text: "新留言", className: "bg-purple-100 text-purple-700" }}
            onClick={() => navigate(createPageUrl("ShippingPool"))}
            actionLabel="查看"
          />
        ))}
        {/* FAQ 回复 */}
        {pendingFaqReplies.map(q => (
          <TodoItem
            key={q.id}
            label={q.question?.slice(0, 40) || "我的提问"}
            sub="管理员已回复您的问题"
            badge={{ text: "有回复", className: "bg-teal-100 text-teal-700" }}
            onClick={() => navigate(createPageUrl("helpcenter/faq"))}
            actionLabel="查看"
          />
        ))}
      </TodoSection>

      {/* ── 待付款 ── */}
      <TodoSection icon={CreditCard} title="待付款" count={payCount} color="red" emptyText="暂无待付款项目">
        {/* 批量付款按钮 */}
        {(selectedPayOrders.length + selectedPayPools.length) > 0 && (
          <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex items-center gap-2">
            <span className="text-xs text-blue-700 flex-1">已选 {selectedPayOrders.length + selectedPayPools.length} 项</span>
            <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700"
              onClick={() => goToMyOrders()}>
              去付款
            </Button>
          </div>
        )}
        {pendingPayOrders.map(o => (
          <TodoItem
            key={o.id}
            label={o.product_name}
            sub={`订单 ${o.order_number || ""} · ${ORDER_STATUS_LABEL[o.order_status] || ""}`}
            badge={fmtJpy(o.prepayment_amount) ? { text: fmtJpy(o.prepayment_amount), className: "bg-red-100 text-red-700 font-semibold" } : undefined}
            checkbox
            selected={selectedPayOrders.includes(o.id)}
            onSelect={c => togglePayOrder(o.id, c)}
            onClick={() => goToMyOrders()}
            actionLabel="去付款"
          />
        ))}
        {pendingPayPools.map(p => (
          <TodoItem
            key={p.id}
            label={p.pool_code || p.title || "发货申请"}
            sub={`发货运费待支付`}
            badge={fmtJpy(p.shipping_fee_jpy) ? { text: fmtJpy(p.shipping_fee_jpy), className: "bg-red-100 text-red-700 font-semibold" } : undefined}
            checkbox
            selected={selectedPayPools.includes(p.id)}
            onSelect={c => togglePayPool(p.id, c)}
            onClick={() => navigate(createPageUrl("ShippingPool"))}
            actionLabel="去付款"
          />
        ))}
      </TodoSection>

      {/* ── 待通知出货 ── */}
      <TodoSection icon={Truck} title="待通知出货" count={notifyCount} color="blue" emptyText="暂无待通知出货">
        {selectedNotifyOrders.length > 0 && (
          <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex items-center gap-2">
            <span className="text-xs text-blue-700 flex-1">已选 {selectedNotifyOrders.length} 个订单</span>
            <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700"
              onClick={() => goToMyOrders()}>
              批量通知出货
            </Button>
          </div>
        )}
        {pendingNotifyOrders.map(o => (
          <TodoItem
            key={o.id}
            label={o.product_name}
            sub={`${o.order_number || ""} · 已入库，可通知发货`}
            badge={{ text: "已入库", className: "bg-green-100 text-green-700" }}
            checkbox
            selected={selectedNotifyOrders.includes(o.id)}
            onSelect={c => toggleNotifyOrder(o.id, c)}
            onClick={() => goToMyOrders()}
            actionLabel="通知出货"
          />
        ))}
      </TodoSection>

      {/* ── 待收货 ── */}
      <TodoSection icon={Package} title="待收货" count={receiveCount} color="teal" emptyText="暂无在途包裹">
        {pendingReceiveOrders.map(o => (
          <TodoItem
            key={o.id}
            label={o.product_name}
            sub={o.tracking_number ? `运单号: ${o.tracking_number}` : (o.order_number || "")}
            badge={{ text: ORDER_STATUS_LABEL[o.order_status] || "运输中", className: "bg-teal-100 text-teal-700" }}
            onClick={() => goToMyOrders()}
            actionLabel="查看"
          />
        ))}
        {pendingReceivePools.map(p => (
          <TodoItem
            key={p.id}
            label={p.pool_code || p.title || "发货申请"}
            sub={p.tracking_number ? `运单号: ${p.tracking_number}` : ""}
            badge={{ text: "已发货", className: "bg-teal-100 text-teal-700" }}
            onClick={() => navigate(createPageUrl("ShippingPool"))}
            actionLabel="查看"
          />
        ))}
      </TodoSection>

      {/* ── 待补充信息 ── */}
      <TodoSection icon={ClipboardList} title="待补充填写信息" count={infoCount} color="yellow" emptyText="暂无待补充项目">
        {needsInfoOrders.map(o => (
          <TodoItem
            key={o.id}
            label={o.product_name}
            sub="请完善商品链接或图片等信息"
            badge={{ text: "信息不完整", className: "bg-yellow-100 text-yellow-700" }}
            onClick={() => goToMyOrders()}
            actionLabel="去完善"
          />
        ))}
      </TodoSection>

      {/* Quick links */}
      <div className="flex gap-2 pt-2">
        <Link to={createPageUrl("MyOrders")} className="flex-1">
          <div className="rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors px-4 py-3 text-center text-sm font-medium text-gray-700">
            我的订单
          </div>
        </Link>
        <Link to={createPageUrl("ShippingPool")} className="flex-1">
          <div className="rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors px-4 py-3 text-center text-sm font-medium text-gray-700">
            发货申请
          </div>
        </Link>
        <Link to={createPageUrl("Notifications")} className="flex-1">
          <div className="rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors px-4 py-3 text-center text-sm font-medium text-gray-700">
            通知中心
          </div>
        </Link>
      </div>
    </div>
  );
}