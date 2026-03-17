import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Search, Edit2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AdminOrderEditModal from "@/components/admin/AdminOrderEditModal";
import { getStatusLabel, getStatusColor, ORDER_STATUS_CONFIG } from "@/lib/orderStatus";

function isPurchaseStatus(status) {
  return status === "paid" || status === "pending_purchase";
}

function handlePurchaseClick(order, openModal) {
  const urls = (order.product_url || "").split("\n").map(s => s.trim()).filter(Boolean);
  const hasExtras = order.user_note || order.product_description || urls.length > 1;
  if (!hasExtras && urls.length === 1) {
    window.open(urls[0], "_blank", "noopener,noreferrer");
  } else {
    openModal(order);
  }
}

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingOrder, setEditingOrder] = useState(null);

  const load = async () => {
    const data = await base44.entities.Order.list("-updated_date", 200);
    setOrders(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = orders.filter(o => {
    const matchSearch = !search || o.product_name?.toLowerCase().includes(search.toLowerCase()) || o.user_email?.includes(search) || o.order_number?.includes(search);
    const matchStatus = statusFilter === "all" || o.order_status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statusOptions = Object.entries(ORDER_STATUS_CONFIG).map(([k, v]) => ({ key: k, label: v.admin }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">订单管理</h1>
        <span className="text-sm text-gray-400">{filtered.length} 笔</span>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <Input placeholder="搜索商品、邮箱、订单号..." className="pl-8 h-8 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            {statusOptions.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">订单号</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">用户</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">商品</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">预付款</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">订单状态</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">付款</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">加载中...</td></tr>
            ) : filtered.map(order => (
              <tr key={order.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{order.order_number || order.id.slice(0,8)}</td>
                <td className="px-4 py-3">
                  <div className="text-xs font-medium text-gray-800">{order.user_name || "-"}</div>
                  <div className="text-xs text-gray-400 truncate max-w-[120px]">{order.user_email}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="truncate max-w-[160px] text-gray-800">{order.product_name}</div>
                  <div className="text-xs text-gray-400">×{order.quantity}</div>
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {order.prepayment_amount ? `${order.prepayment_currency} ${order.prepayment_amount.toFixed(2)}` : "-"}
                  {order.paid_amount > 0 && <div className="text-xs text-green-600">已付 {order.paid_amount.toFixed(2)}</div>}
                </td>
                <td className="px-4 py-3">
                  <Badge className={`text-xs ${getStatusColor(order.order_status, "admin")}`}>
                    {getStatusLabel(order.order_status, "admin")}
                  </Badge>
                  {order.order_status === "awaiting_reply" && (order.messages || []).length > 0 && (
                    <div className="text-xs text-orange-500 mt-0.5">
                      {(order.messages || []).length}条留言
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {order.payment_status === "paid" && <span className="text-green-600">已付款</span>}
                  {order.payment_status === "awaiting_payment" && <span className="text-orange-500">待付款</span>}
                  {order.payment_status === "confirmed" && <span className="text-green-700">已确认</span>}
                  {order.payment_status === "underpaid" && <span className="text-red-500">付款不足</span>}
                </td>
                <td className="px-4 py-3">
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingOrder(order)}>
                    <Edit2 className="w-3 h-3 mr-1" />编辑
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingOrder && (
        <AdminOrderEditModal order={editingOrder} onClose={() => setEditingOrder(null)} onSaved={() => { setEditingOrder(null); load(); }} />
      )}
    </div>
  );
}