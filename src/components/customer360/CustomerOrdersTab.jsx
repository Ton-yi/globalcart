/**
 * CustomerOrdersTab - 客户订单记录 Tab
 * 支持按订单状态、支付状态、发货状态、时间范围筛选
 */
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Package } from "lucide-react";

const ORDER_STATUS_LABELS = {
  pending_confirmation: "待确认", payment_pending: "待付款", paid: "已付款",
  pending_purchase: "待采购", purchased: "已采购", in_warehouse: "已入库",
  in_storage: "仓储中", ready_to_ship: "待发货", transit_shipped: "中转已发货",
  shipped: "已发货", delivered: "已送达", cancelled: "已取消", expired: "已超期",
};

const PAYMENT_STATUS_LABELS = {
  pending: "待处理", awaiting_payment: "待付款", awaiting_confirmation: "待确认",
  paid: "已付款", underpaid: "未付足", overpaid: "多付款", confirmed: "已确认",
};

const SHIPPED_STATUSES = ["transit_shipped", "shipped", "delivered"];

export default function CustomerOrdersTab({ orders, formatCurrency, formatDate, OrderStatusBadge, PaymentStatusBadge, onOrderClick }) {
  const [orderStatus, setOrderStatus] = useState("all");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [shipState, setShipState] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const orderStatusOptions = useMemo(
    () => [...new Set((orders || []).map(o => o.order_status).filter(Boolean))],
    [orders]
  );
  const paymentStatusOptions = useMemo(
    () => [...new Set((orders || []).map(o => o.payment_status).filter(Boolean))],
    [orders]
  );

  const filtered = useMemo(() => (orders || []).filter(o => {
    if (orderStatus !== "all" && o.order_status !== orderStatus) return false;
    if (paymentStatus !== "all" && o.payment_status !== paymentStatus) return false;
    if (shipState === "shipped" && !SHIPPED_STATUSES.includes(o.order_status)) return false;
    if (shipState === "unshipped" && SHIPPED_STATUSES.includes(o.order_status)) return false;
    if (shipState === "delivered" && o.order_status !== "delivered") return false;
    if (dateFrom && new Date(o.created_date) < new Date(dateFrom)) return false;
    if (dateTo && new Date(o.created_date) > new Date(dateTo + "T23:59:59")) return false;
    return true;
  }), [orders, orderStatus, paymentStatus, shipState, dateFrom, dateTo]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">订单记录（{filtered.length} / {orders?.length || 0}）</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <Label className="text-xs text-gray-500">订单状态</Label>
            <Select value={orderStatus} onValueChange={setOrderStatus}>
              <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                {orderStatusOptions.map(s => (
                  <SelectItem key={s} value={s}>{ORDER_STATUS_LABELS[s] || s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-gray-500">支付状态</Label>
            <Select value={paymentStatus} onValueChange={setPaymentStatus}>
              <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                {paymentStatusOptions.map(s => (
                  <SelectItem key={s} value={s}>{PAYMENT_STATUS_LABELS[s] || s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-gray-500">发货状态</Label>
            <Select value={shipState} onValueChange={setShipState}>
              <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="unshipped">未发货</SelectItem>
                <SelectItem value="shipped">已发货</SelectItem>
                <SelectItem value="delivered">已送达</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-gray-500">开始日期</Label>
            <Input type="date" className="h-8 text-sm mt-1" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs text-gray-500">结束日期</Label>
            <Input type="date" className="h-8 text-sm mt-1" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
        </div>

        {/* List */}
        {filtered.length > 0 ? (
          <div className="space-y-2">
            {filtered.map(order => (
              <button
                key={order.id}
                type="button"
                onClick={() => onOrderClick?.(order)}
                className="w-full text-left flex items-center gap-3 p-3 border rounded-lg hover:bg-blue-50/50 hover:border-blue-200 transition-colors cursor-pointer"
              >
                {order.product_image_url ? (
                  <img src={order.product_image_url} alt="" className="w-10 h-10 rounded object-cover border flex-shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <Package className="w-4 h-4 text-gray-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm truncate">{order.product_name}</span>
                    <OrderStatusBadge status={order.order_status} />
                    <PaymentStatusBadge status={order.payment_status} />
                    {order.payment_mode === 'credit' && (
                      <Badge className="bg-indigo-100 text-indigo-700 text-xs">记账</Badge>
                    )}
                    {order.online_store_tag && (
                      <Badge variant="outline" className="text-xs">{order.online_store_tag}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatDate(order.created_date)} · 订单号：{order.order_number || "-"} · {formatCurrency(order.paid_amount)}
                    {order.shipping_method && ` · ${order.shipping_method}`}
                    {order.destination_country && ` · ${order.destination_country}`}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-8">无符合条件的订单</p>
        )}
      </CardContent>
    </Card>
  );
}