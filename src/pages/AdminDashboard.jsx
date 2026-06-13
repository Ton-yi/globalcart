import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Users, Bell, MessageSquare, HelpCircle, ShoppingBag,
  Package, Truck, CreditCard, RefreshCw, Inbox,
  CheckSquare, Layers, AlertCircle, ArrowRight, LayoutDashboard
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import TodoSection from "@/components/todo/TodoSection";
import TodoItem from "@/components/todo/TodoItem";

function fmtJpy(v) {
  if (v == null || isNaN(v)) return null;
  return `¥${Number(v).toLocaleString()}`;
}

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
  shipping_fee_pending: "待付运费",
  ready_to_ship: "待发货",
  shipped: "已发货",
  delivered: "已签收",
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    base44.functions.invoke("getAdminTodoData", {})
      .then(r => setData(r.data || {}))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );

  const {
    newUsers = [],
    allNonAdminUsers = [],
    ordersWithUnreadMessages = [],
    poolsWithUnreadMessages = [],
    pendingFaqQuestions = [],
    pendingPaymentConfirm = [],
    pendingPurchase = [],
    inWarehouse = [],
    notifiedShipmentFeePending = [],
    readyToShip = [],
    poolsPendingInit = [],
    poolsAwaitingPaymentConfirm = [],
    poolsReadyToShip = [],
    totalActiveOrders = 0,
    totalPools = 0,
    totalUsers = 0,
  } = data || {};

  const confirmCount = newUsers.length + ordersWithUnreadMessages.length + poolsWithUnreadMessages.length + pendingFaqQuestions.length;
  const orderTodoCount = pendingPaymentConfirm.length + pendingPurchase.length + inWarehouse.length + notifiedShipmentFeePending.length + readyToShip.length;
  const poolTodoCount = poolsPendingInit.length + poolsAwaitingPaymentConfirm.length + poolsReadyToShip.length;
  const totalTodo = confirmCount + orderTodoCount + poolTodoCount;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">管理待办看板</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {totalTodo > 0 ? `共 ${totalTodo} 项待处理` : "一切就绪 🎉"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500" title="刷新">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <Link to={createPageUrl("AdminOrders")}>
          <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow text-center cursor-pointer">
            <div className="text-2xl font-bold text-gray-900">{totalActiveOrders}</div>
            <div className="text-xs text-gray-500 mt-0.5">活跃订单</div>
          </div>
        </Link>
        <Link to={createPageUrl("AdminShippingPool")}>
          <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow text-center cursor-pointer">
            <div className="text-2xl font-bold text-gray-900">{totalPools}</div>
            <div className="text-xs text-gray-500 mt-0.5">发货申请</div>
          </div>
        </Link>
        <Link to={createPageUrl("AdminUsers")}>
          <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow text-center cursor-pointer">
            <div className="text-2xl font-bold text-gray-900">{totalUsers}</div>
            <div className="text-xs text-gray-500 mt-0.5">注册用户</div>
          </div>
        </Link>
      </div>

      {/* ── 待确认 ── */}
      <TodoSection icon={Bell} title="待确认" count={confirmCount} color="orange" emptyText="暂无待确认事项">
        {/* 新注册用户 */}
        {newUsers.map(u => (
          <TodoItem
            key={u.id}
            label={u.full_name || u.email}
            sub={`新注册用户 · ${u.email}`}
            badge={{ text: "新用户", className: "bg-blue-100 text-blue-700" }}
            onClick={() => navigate(createPageUrl("AdminUsers"))}
            actionLabel="查看"
          />
        ))}
        {/* 订单留言（用户发给管理员） */}
        {ordersWithUnreadMessages.map(o => (
          <TodoItem
            key={`om-${o.id}`}
            label={o.product_name}
            sub={`用户留言 · ${o.user_name || o.user_email} · ${o.order_number || ""}`}
            badge={{ text: "新留言", className: "bg-purple-100 text-purple-700" }}
            onClick={() => navigate(createPageUrl("AdminOrders"))}
            actionLabel="回复"
          />
        ))}
        {/* 发货申请留言 */}
        {poolsWithUnreadMessages.map(p => (
          <TodoItem
            key={`pm-${p.id}`}
            label={p.pool_code || p.title || "发货申请"}
            sub={`用户留言 · ${p.creator_name || p.creator_email || ""}`}
            badge={{ text: "新留言", className: "bg-purple-100 text-purple-700" }}
            onClick={() => navigate(createPageUrl("AdminShippingPool"))}
            actionLabel="回复"
          />
        ))}
        {/* FAQ 新提问 */}
        {pendingFaqQuestions.map(q => (
          <TodoItem
            key={`faq-${q.id}`}
            label={q.question?.slice(0, 50) || "新提问"}
            sub={`${q.user_name || q.user_email || "用户"} 提交了新问题`}
            badge={{ text: "待回复", className: "bg-yellow-100 text-yellow-700" }}
            onClick={() => navigate(createPageUrl("AdminFaq"))}
            actionLabel="回复"
          />
        ))}
      </TodoSection>

      {/* ── 待处理订单 ── */}
      <TodoSection icon={Package} title="待处理订单" count={orderTodoCount} color="blue" emptyText="暂无待处理订单">
        {/* 次级分组：待确认付款 */}
        {pendingPaymentConfirm.length > 0 && (
          <div>
            <div className="px-4 py-1.5 bg-orange-50 border-b border-orange-100">
              <span className="text-xs font-semibold text-orange-700 flex items-center gap-1.5">
                <CreditCard className="w-3 h-3" />
                待确认付款
                <span className="ml-1 bg-orange-200 text-orange-800 rounded-full px-1.5 py-0 text-xs font-bold">{pendingPaymentConfirm.length}</span>
              </span>
            </div>
            {pendingPaymentConfirm.slice(0, 5).map(o => (
              <TodoItem
                key={`pay-${o.id}`}
                label={o.product_name}
                sub={`${o.user_name || o.user_email} · ${o.order_number || ""}`}
                badge={fmtJpy(o.paid_amount || o.prepayment_amount) ? { text: fmtJpy(o.paid_amount || o.prepayment_amount), className: "bg-orange-100 text-orange-700 font-semibold" } : undefined}
                onClick={() => navigate(createPageUrl("AdminOrders"))}
                actionLabel="确认"
              />
            ))}
            {pendingPaymentConfirm.length > 5 && (
              <div className="px-4 py-2 text-center">
                <Link to={createPageUrl("AdminOrders")} className="text-xs text-blue-600 hover:underline flex items-center justify-center gap-1">
                  查看全部 {pendingPaymentConfirm.length} 条 <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            )}
          </div>
        )}

        {/* 待下单/采购 */}
        {pendingPurchase.length > 0 && (
          <div>
            <div className="px-4 py-1.5 bg-blue-50 border-b border-blue-100">
              <span className="text-xs font-semibold text-blue-700 flex items-center gap-1.5">
                <ShoppingBag className="w-3 h-3" />
                待下单采购
                <span className="ml-1 bg-blue-200 text-blue-800 rounded-full px-1.5 py-0 text-xs font-bold">{pendingPurchase.length}</span>
              </span>
            </div>
            {pendingPurchase.slice(0, 5).map(o => (
              <TodoItem
                key={`pp-${o.id}`}
                label={o.product_name}
                sub={`${o.user_name || o.user_email} · ${o.order_number || ""}`}
                badge={{ text: "待采购", className: "bg-blue-100 text-blue-700" }}
                onClick={() => navigate(createPageUrl("AdminOrders"))}
                actionLabel="去采购"
              />
            ))}
            {pendingPurchase.length > 5 && (
              <div className="px-4 py-2 text-center">
                <Link to={createPageUrl("AdminOrders")} className="text-xs text-blue-600 hover:underline flex items-center justify-center gap-1">
                  查看全部 {pendingPurchase.length} 条 <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            )}
          </div>
        )}

        {/* 已入库待处理 */}
        {inWarehouse.length > 0 && (
          <div>
            <div className="px-4 py-1.5 bg-green-50 border-b border-green-100">
              <span className="text-xs font-semibold text-green-700 flex items-center gap-1.5">
                <Inbox className="w-3 h-3" />
                已入库待安排发货
                <span className="ml-1 bg-green-200 text-green-800 rounded-full px-1.5 py-0 text-xs font-bold">{inWarehouse.length}</span>
              </span>
            </div>
            {inWarehouse.slice(0, 5).map(o => (
              <TodoItem
                key={`wh-${o.id}`}
                label={o.product_name}
                sub={`${o.user_name || o.user_email} · ${o.order_number || ""}`}
                badge={{ text: "已入库", className: "bg-green-100 text-green-700" }}
                onClick={() => navigate(createPageUrl("AdminOrders"))}
                actionLabel="安排"
              />
            ))}
            {inWarehouse.length > 5 && (
              <div className="px-4 py-2 text-center">
                <Link to={createPageUrl("AdminOrders")} className="text-xs text-blue-600 hover:underline flex items-center justify-center gap-1">
                  查看全部 {inWarehouse.length} 条 <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            )}
          </div>
        )}

        {/* 通知出货费用待处理 */}
        {notifiedShipmentFeePending.length > 0 && (
          <div>
            <div className="px-4 py-1.5 bg-yellow-50 border-b border-yellow-100">
              <span className="text-xs font-semibold text-yellow-700 flex items-center gap-1.5">
                <Truck className="w-3 h-3" />
                待填写运费
                <span className="ml-1 bg-yellow-200 text-yellow-800 rounded-full px-1.5 py-0 text-xs font-bold">{notifiedShipmentFeePending.length}</span>
              </span>
            </div>
            {notifiedShipmentFeePending.slice(0, 5).map(o => (
              <TodoItem
                key={`nsf-${o.id}`}
                label={o.product_name}
                sub={`${o.user_name || o.user_email} · ${o.order_number || ""}`}
                badge={{ text: "待填运费", className: "bg-yellow-100 text-yellow-700" }}
                onClick={() => navigate(createPageUrl("AdminShippingPool"))}
                actionLabel="处理"
              />
            ))}
          </div>
        )}

        {/* 待发货（ready_to_ship） */}
        {readyToShip.length > 0 && (
          <div>
            <div className="px-4 py-1.5 bg-purple-50 border-b border-purple-100">
              <span className="text-xs font-semibold text-purple-700 flex items-center gap-1.5">
                <Truck className="w-3 h-3" />
                待发货
                <span className="ml-1 bg-purple-200 text-purple-800 rounded-full px-1.5 py-0 text-xs font-bold">{readyToShip.length}</span>
              </span>
            </div>
            {readyToShip.slice(0, 5).map(o => (
              <TodoItem
                key={`rs-${o.id}`}
                label={o.product_name}
                sub={`${o.user_name || o.user_email} · ${o.order_number || ""}`}
                badge={{ text: "待发货", className: "bg-purple-100 text-purple-700" }}
                onClick={() => navigate(createPageUrl("AdminShippingPool"))}
                actionLabel="发货"
              />
            ))}
          </div>
        )}
      </TodoSection>

      {/* ── 待处理发货申请 ── */}
      <TodoSection icon={Truck} title="待处理发货申请" count={poolTodoCount} color="purple" emptyText="暂无待处理发货申请">
        {/* 待初步处理 */}
        {poolsPendingInit.length > 0 && (
          <div>
            <div className="px-4 py-1.5 bg-blue-50 border-b border-blue-100">
              <span className="text-xs font-semibold text-blue-700 flex items-center gap-1.5">
                <Layers className="w-3 h-3" />
                待初步处理（填写发货信息）
                <span className="ml-1 bg-blue-200 text-blue-800 rounded-full px-1.5 py-0 text-xs font-bold">{poolsPendingInit.length}</span>
              </span>
            </div>
            {poolsPendingInit.slice(0, 5).map(p => (
              <TodoItem
                key={`pi-${p.id}`}
                label={p.pool_code || p.title || "发货申请"}
                sub={`${p.creator_name || p.creator_email || ""} · ${(p.order_ids || []).length} 个订单`}
                badge={{ text: "待处理", className: "bg-blue-100 text-blue-700" }}
                onClick={() => navigate(createPageUrl("AdminShippingPool"))}
                actionLabel="处理"
              />
            ))}
            {poolsPendingInit.length > 5 && (
              <div className="px-4 py-2 text-center">
                <Link to={createPageUrl("AdminShippingPool")} className="text-xs text-blue-600 hover:underline flex items-center justify-center gap-1">
                  查看全部 {poolsPendingInit.length} 条 <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            )}
          </div>
        )}

        {/* 待确认运费付款 */}
        {poolsAwaitingPaymentConfirm.length > 0 && (
          <div>
            <div className="px-4 py-1.5 bg-orange-50 border-b border-orange-100">
              <span className="text-xs font-semibold text-orange-700 flex items-center gap-1.5">
                <CreditCard className="w-3 h-3" />
                待确认运费付款
                <span className="ml-1 bg-orange-200 text-orange-800 rounded-full px-1.5 py-0 text-xs font-bold">{poolsAwaitingPaymentConfirm.length}</span>
              </span>
            </div>
            {poolsAwaitingPaymentConfirm.slice(0, 5).map(p => (
              <TodoItem
                key={`pa-${p.id}`}
                label={p.pool_code || p.title || "发货申请"}
                sub={`${p.creator_name || p.creator_email || ""}`}
                badge={fmtJpy(p.shipping_fee_jpy) ? { text: fmtJpy(p.shipping_fee_jpy), className: "bg-orange-100 text-orange-700 font-semibold" } : { text: "待确认", className: "bg-orange-100 text-orange-700" }}
                onClick={() => navigate(createPageUrl("AdminShippingPool"))}
                actionLabel="确认"
              />
            ))}
          </div>
        )}

        {/* 待发货（pool） */}
        {poolsReadyToShip.length > 0 && (
          <div>
            <div className="px-4 py-1.5 bg-purple-50 border-b border-purple-100">
              <span className="text-xs font-semibold text-purple-700 flex items-center gap-1.5">
                <Truck className="w-3 h-3" />
                待发货
                <span className="ml-1 bg-purple-200 text-purple-800 rounded-full px-1.5 py-0 text-xs font-bold">{poolsReadyToShip.length}</span>
              </span>
            </div>
            {poolsReadyToShip.slice(0, 5).map(p => (
              <TodoItem
                key={`pr-${p.id}`}
                label={p.pool_code || p.title || "发货申请"}
                sub={`${p.creator_name || p.creator_email || ""} · ${(p.order_ids || []).length} 个订单`}
                badge={{ text: "待发货", className: "bg-purple-100 text-purple-700" }}
                onClick={() => navigate(createPageUrl("AdminShippingPool"))}
                actionLabel="发货"
              />
            ))}
          </div>
        )}
      </TodoSection>

      {/* 用户端看板入口 */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gray-100 rounded-lg">
            <LayoutDashboard className="w-4 h-4 text-gray-600" />
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-800">用户端待办看板</div>
            <div className="text-xs text-gray-500">查看您自己的待办事项（以普通用户视角）</div>
          </div>
        </div>
        <Link to={createPageUrl("UserTodo")}>
          <Button size="sm" variant="outline" className="gap-1 text-xs">
            查看 <ArrowRight className="w-3 h-3" />
          </Button>
        </Link>
      </div>

      {/* Quick action links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: "订单管理", page: "AdminOrders" },
          { label: "发货池管理", page: "AdminShippingPool" },
          { label: "用户管理", page: "AdminUsers" },
          { label: "常见问题", page: "AdminFaq" },
        ].map(({ label, page }) => (
          <Link key={page} to={createPageUrl(page)}>
            <div className="rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors px-3 py-2.5 text-center text-sm font-medium text-gray-700">
              {label}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}