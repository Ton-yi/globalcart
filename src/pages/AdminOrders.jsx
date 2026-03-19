import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Search, RefreshCw, Filter, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import AdminOrderEditModal from "@/components/admin/AdminOrderEditModal";
import { getStatusLabel, getStatusColor } from "@/lib/orderStatus";

const ALL_STATUSES = [
  { v: "pending_confirmation", l: "后付款待确认" },
  { v: "awaiting_reply", l: "待回复" },
  { v: "admin_replied", l: "管理员已回复" },
  { v: "payment_pending", l: "待付款" },
  { v: "paid", l: "已付款" },
  { v: "pending_purchase", l: "待下单" },
  { v: "purchased", l: "已下单" },
  { v: "in_warehouse", l: "已入库" },
  { v: "notified_shipment", l: "已通知出货" },
  { v: "shipping_fee_pending", l: "待付运费" },
  { v: "ready_to_ship", l: "准备发货" },
  { v: "shipped", l: "已发出" },
  { v: "delivered", l: "已收货" },
  { v: "cancelled", l: "已取消" },
];

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkUpdating, setBulkUpdating] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const data = await base44.entities.Order.list("-updated_date", 200);
    setOrders(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const filtered = orders.filter(o => {
    const matchStatus = statusFilter === "all" || o.order_status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      (o.product_name || "").toLowerCase().includes(q) ||
      (o.order_number || "").toLowerCase().includes(q) ||
      (o.user_email || "").toLowerCase().includes(q) ||
      (o.user_name || "").toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    if (selectedIds.length === filtered.length) setSelectedIds([]);
    else setSelectedIds(filtered.map(o => o.id));
  };

  const handleBulkUpdate = async () => {
    if (!bulkStatus || selectedIds.length === 0) return;
    setBulkUpdating(true);
    await Promise.all(selectedIds.map(id => base44.entities.Order.update(id, { order_status: bulkStatus })));
    setBulkUpdating(false);
    setSelectedIds([]);
    setBulkStatus("");
    fetchOrders();
  };

  const handleQuickOrdered = async (order, e) => {
    e.stopPropagation();
    await base44.entities.Order.update(order.id, { order_status: "purchased" });
    fetchOrders();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold text-gray-900">订单管理</h1>
        <Button variant="outline" size="sm" onClick={fetchOrders}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />刷新
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <Input placeholder="搜索订单号、商品名、用户..." className="pl-8 h-8 text-sm"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 h-8 text-sm">
            <Filter className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
            <SelectValue placeholder="所有状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">所有状态</SelectItem>
            {ALL_STATUSES.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Bulk actions */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          <span className="text-sm text-blue-700 font-medium">已选 {selectedIds.length} 条</span>
          <Select value={bulkStatus} onValueChange={setBulkStatus}>
            <SelectTrigger className="h-7 text-xs w-40">
              <SelectValue placeholder="批量设置状态" />
            </SelectTrigger>
            <SelectContent>
              {ALL_STATUSES.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700"
            onClick={handleBulkUpdate} disabled={!bulkStatus || bulkUpdating}>
            {bulkUpdating ? "更新中..." : "确认更新"}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedIds([])}>取消</Button>
        </div>
      )}

      {/* Orders list */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[32px_1fr_140px_100px_80px] gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500">
          <Checkbox checked={selectedIds.length === filtered.length && filtered.length > 0}
            onCheckedChange={toggleAll} />
          <div>商品 / 用户</div>
          <div>状态</div>
          <div>金额</div>
          <div>操作</div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400 text-sm">加载中...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">暂无订单</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map(order => (
              <div key={order.id}
                className="grid grid-cols-[32px_1fr_140px_100px_80px] gap-2 px-3 py-3 hover:bg-gray-50 cursor-pointer items-center"
                onClick={() => setSelectedOrder(order)}>
                <Checkbox checked={selectedIds.includes(order.id)}
                  onCheckedChange={() => toggleSelect(order.id)}
                  onClick={e => e.stopPropagation()} />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{order.product_name}</div>
                  <div className="text-xs text-gray-400 truncate">{order.order_number} · {order.user_name || order.user_email}</div>
                </div>
                <div>
                  <Badge className={`text-xs ${getStatusColor(order.order_status, "admin")}`}>
                    {getStatusLabel(order.order_status, "admin")}
                  </Badge>
                </div>
                <div className="text-sm text-gray-700">
                  {order.prepayment_amount > 0 ? `${order.prepayment_currency} ${order.prepayment_amount?.toFixed(2)}` : "-"}
                </div>
                <div onClick={e => e.stopPropagation()}>
                  {(order.order_status === "paid" || order.order_status === "pending_purchase") && (
                    <Button size="sm" variant="outline" className="h-6 text-xs px-2 text-indigo-600 border-indigo-200"
                      onClick={e => handleQuickOrdered(order, e)}>
                      已下单
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="text-xs text-gray-400 text-right">共 {filtered.length} 条</div>

      {selectedOrder && (
        <AdminOrderEditModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onSaved={() => { setSelectedOrder(null); fetchOrders(); }}
        />
      )}
    </div>
  );
}