import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Search, Edit2, Check, X, AlertTriangle, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AdminOrderEditModal from "../components/admin/AdminOrderEditModal";

const STATUS_LABELS = {
  draft: "草稿", submitted: "已提交", price_confirmed: "已报价",
  payment_pending: "待付款", payment_confirmed: "已付款",
  purchasing: "采购中", purchased: "已购买",
  awaiting_shipment: "等待发货", shipped: "已发货", delivered: "已签收", cancelled: "已取消"
};
const STATUS_COLORS = {
  draft: "bg-gray-100 text-gray-600", submitted: "bg-blue-100 text-blue-700",
  price_confirmed: "bg-yellow-100 text-yellow-700", payment_pending: "bg-orange-100 text-orange-700",
  payment_confirmed: "bg-green-100 text-green-700", purchasing: "bg-purple-100 text-purple-700",
  purchased: "bg-indigo-100 text-indigo-700", awaiting_shipment: "bg-cyan-100 text-cyan-700",
  shipped: "bg-teal-100 text-teal-700", delivered: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
};
const PAY_COLORS = {
  pending: "bg-gray-100 text-gray-600", awaiting_payment: "bg-orange-100 text-orange-700",
  paid: "bg-yellow-100 text-yellow-700", underpaid: "bg-red-100 text-red-700",
  overpaid: "bg-blue-100 text-blue-700", confirmed: "bg-green-100 text-green-700",
};
const PAY_LABELS = { pending: "未付款", awaiting_payment: "等待付款", paid: "已付待确认", underpaid: "付款不足", overpaid: "付款多余", confirmed: "已确认" };

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
          <SelectTrigger className="w-36 h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
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
              <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">付款状态</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">订单状态</th>
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
                  <Badge className={`text-xs ${PAY_COLORS[order.payment_status] || "bg-gray-100"}`}>
                    {PAY_LABELS[order.payment_status] || order.payment_status}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge className={`text-xs ${STATUS_COLORS[order.order_status] || "bg-gray-100"}`}>
                    {STATUS_LABELS[order.order_status] || order.order_status}
                  </Badge>
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