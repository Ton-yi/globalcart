import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Package, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getStatusLabel, getStatusColor } from "@/lib/orderStatus";
import OrderDetailDrawer from "@/components/orders/OrderDetailDrawer";

const STATUS_FILTERS = [
  { v: "all", l: "全部" },
  { v: "payment_pending", l: "待付款" },
  { v: "paid", l: "已付款" },
  { v: "purchased", l: "已下单" },
  { v: "in_warehouse", l: "已入库" },
  { v: "notified_shipment", l: "已通知出货" },
  { v: "shipping_fee_pending", l: "待付运费" },
  { v: "shipped", l: "已发出" },
  { v: "delivered", l: "已收货" },
  { v: "cancelled", l: "已取消" },
];

export default function MyOrders() {
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState(null);

  const fetchOrders = async (u) => {
    if (!u) return;
    setLoading(true);
    const data = await base44.entities.Order.filter({ user_email: u.email }, "-updated_date", 100);
    setOrders(data);
    setLoading(false);
  };

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      fetchOrders(u);
    }).catch(() => base44.auth.redirectToLogin());
  }, []);

  const filtered = orders.filter(o => {
    const matchStatus = statusFilter === "all" || o.order_status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      (o.product_name || "").toLowerCase().includes(q) ||
      (o.order_number || "").toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold text-gray-900">我的订单</h1>
        <Button variant="outline" size="sm" onClick={() => fetchOrders(user)}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />刷新
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <Input placeholder="搜索商品名、订单号..." className="pl-8 h-8 text-sm"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Orders list */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-gray-400 text-sm">加载中...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-gray-400">
            <Package className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">暂无订单</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map(order => (
              <div key={order.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer"
                onClick={() => setSelectedOrder(order)}>
                {order.product_image_url ? (
                  <img src={order.product_image_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-gray-100" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <Package className="w-5 h-5 text-gray-300" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{order.product_name}</div>
                  <div className="text-xs text-gray-400">{order.order_number}</div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <Badge className={`text-xs ${getStatusColor(order.order_status, "user")}`}>
                    {getStatusLabel(order.order_status, "user")}
                  </Badge>
                  {order.prepayment_amount > 0 && (
                    <span className="text-xs text-gray-500">{order.prepayment_currency} {order.prepayment_amount?.toFixed(2)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="text-xs text-gray-400 text-right">共 {filtered.length} 条</div>

      {selectedOrder && (
        <OrderDetailDrawer
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onUpdated={() => {
            setSelectedOrder(null);
            fetchOrders(user);
          }}
        />
      )}
    </div>
  );
}