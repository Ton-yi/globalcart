import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Search, Edit2, ExternalLink, CheckSquare, Square, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AdminOrderEditModal from "@/components/admin/AdminOrderEditModal";
import ColumnCustomizer from "@/components/orders/ColumnCustomizer";
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

// All available columns definition
const ALL_COLUMNS = [
  { key: "order_number", label: "订单号", visible: true },
  { key: "user_name", label: "用户名", visible: true },
  { key: "product_name", label: "商品名", visible: true },
  { key: "estimated_jpy", label: "日元报价", visible: true },
  { key: "prepayment_amount", label: "付款金额", visible: true },
  { key: "weight_g", label: "订单重量", visible: true },
  { key: "order_status", label: "订单状态", visible: true },
  { key: "payment_status", label: "付款状态", visible: false },
  { key: "product_description", label: "商品描述", visible: false },
  { key: "product_image_url", label: "商品图片", visible: false },
  { key: "arrival_photo_url", label: "入库图片", visible: false },
  { key: "admin_note", label: "管理员备注", visible: false },
  { key: "user_note", label: "用户备注", visible: false },
  { key: "payment_due_date", label: "付款截止日期", visible: false },
];

const STORAGE_KEY = "admin_orders_columns";

function loadColumns() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return ALL_COLUMNS;
}

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingOrder, setEditingOrder] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [columns, setColumns] = useState(loadColumns);

  const load = async () => {
    const data = await base44.entities.Order.list("-updated_date", 200);
    setOrders(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleColumnsChange = (newCols) => {
    setColumns(newCols);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newCols));
  };

  const filtered = orders.filter(o => {
    const matchSearch = !search ||
      o.product_name?.toLowerCase().includes(search.toLowerCase()) ||
      o.user_email?.includes(search) ||
      o.order_number?.includes(search);
    const matchStatus = statusFilter === "all" || o.order_status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statusOptions = Object.entries(ORDER_STATUS_CONFIG).map(([k, v]) => ({ key: k, label: v.admin }));
  const visibleCols = columns.filter(c => c.visible);

  // Selection
  const allSelected = filtered.length > 0 && filtered.every(o => selectedIds.includes(o.id));
  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? [] : filtered.map(o => o.id));
  };
  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // Bulk status update
  const handleBulkUpdate = async () => {
    if (!bulkStatus || selectedIds.length === 0) return;
    setBulkUpdating(true);
    await Promise.all(selectedIds.map(id => base44.entities.Order.update(id, { order_status: bulkStatus })));
    setBulkUpdating(false);
    setSelectedIds([]);
    setBulkStatus("");
    load();
  };

  // Quick mark as purchased
  const handleQuickPurchased = async (order) => {
    await base44.entities.Order.update(order.id, { order_status: "purchased" });
    load();
  };

  // Check if two adjacent visible columns are jpy and prepayment
  const isAdjacentJpyAndPayment = (colKey, nextColKey) => {
    return (colKey === "estimated_jpy" && nextColKey === "prepayment_amount") ||
           (colKey === "prepayment_amount" && nextColKey === "estimated_jpy");
  };

  const renderCell = (col, order) => {
    switch (col.key) {
      case "order_number":
        return <td key={col.key} className="px-4 py-3 font-mono text-xs text-gray-500">{order.order_number || order.id.slice(0, 8)}</td>;

      case "user_name":
        return (
          <td key={col.key} className="px-4 py-3">
            <div className="flex items-center gap-2">
              {order.user_avatar_url && (
                <img src={order.user_avatar_url} alt="" className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
              )}
              <span className="text-xs font-medium text-gray-800">{order.user_name || "-"}</span>
            </div>
          </td>
        );

      case "product_name":
        return (
          <td key={col.key} className="px-4 py-3">
            <div className="truncate max-w-[160px] text-gray-800 text-sm">{order.product_name}</div>
          </td>
        );

      case "estimated_jpy":
        return <td key={col.key} className="px-4 py-3 text-gray-700 text-sm">
          {order.estimated_jpy > 0 ? `¥${order.estimated_jpy?.toLocaleString()}` : "-"}
        </td>;

      case "prepayment_amount":
        return (
          <td key={col.key} className="px-4 py-3 text-gray-700 text-sm">
            {order.prepayment_amount ? `${order.prepayment_currency} ${order.prepayment_amount.toFixed(2)}` : "-"}
            {order.paid_amount > 0 && <div className="text-xs text-green-600">已付 {order.paid_amount.toFixed(2)}</div>}
          </td>
        );

      case "weight_g":
        return <td key={col.key} className="px-4 py-3 text-xs text-gray-500">
          {order.weight_g ? `${order.weight_g}g` : "-"}
        </td>;

      case "order_status":
        return (
          <td key={col.key} className="px-4 py-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              {isPurchaseStatus(order.order_status) ? (
                <Badge
                  className={`text-xs cursor-pointer hover:opacity-80 ${getStatusColor(order.order_status, "admin")}`}
                  onClick={() => handlePurchaseClick(order, setEditingOrder)}
                  title="单链接直接跳转，多链接/有备注打开详情"
                >
                  {getStatusLabel(order.order_status, "admin")}
                  <ExternalLink className="w-3 h-3 ml-1 inline" />
                </Badge>
              ) : (
                <Badge className={`text-xs ${getStatusColor(order.order_status, "admin")}`}>
                  {getStatusLabel(order.order_status, "admin")}
                </Badge>
              )}
              {isPurchaseStatus(order.order_status) && (
                <button
                  className="text-xs text-indigo-600 hover:text-indigo-800 border border-indigo-200 rounded px-1.5 py-0.5 hover:bg-indigo-50 transition-colors whitespace-nowrap"
                  onClick={() => handleQuickPurchased(order)}
                  title="快捷标记为已下单"
                >
                  → 已下单
                </button>
              )}
              {order.order_status === "awaiting_reply" && (order.messages || []).length > 0 && (
                <div className="text-xs text-orange-500">{(order.messages || []).length}条留言</div>
              )}
            </div>
          </td>
        );

      case "payment_status":
        return (
          <td key={col.key} className="px-4 py-3 text-xs text-gray-500">
            {order.payment_status === "paid" && <span className="text-green-600">已付款</span>}
            {order.payment_status === "awaiting_payment" && <span className="text-orange-500">待付款</span>}
            {order.payment_status === "confirmed" && <span className="text-green-700">已确认</span>}
            {order.payment_status === "underpaid" && <span className="text-red-500">付款不足</span>}
          </td>
        );

      case "product_description":
        return <td key={col.key} className="px-4 py-3 text-xs text-gray-500 max-w-[140px] truncate">{order.product_description || "-"}</td>;

      case "product_image_url":
        return (
          <td key={col.key} className="px-4 py-3">
            {order.product_image_url
              ? <a href={order.product_image_url} target="_blank" rel="noopener noreferrer"><img src={order.product_image_url} alt="" className="h-8 w-8 rounded object-cover" /></a>
              : <span className="text-xs text-gray-300">-</span>}
          </td>
        );

      case "arrival_photo_url":
        return (
          <td key={col.key} className="px-4 py-3">
            {order.arrival_photo_url
              ? <a href={order.arrival_photo_url} target="_blank" rel="noopener noreferrer"><img src={order.arrival_photo_url} alt="" className="h-8 w-8 rounded object-cover" /></a>
              : <span className="text-xs text-gray-300">-</span>}
          </td>
        );

      case "admin_note":
        return <td key={col.key} className="px-4 py-3 text-xs text-gray-500 max-w-[140px] truncate">{order.admin_note || "-"}</td>;

      case "user_note":
        return <td key={col.key} className="px-4 py-3 text-xs text-gray-500 max-w-[140px] truncate">{order.user_note || "-"}</td>;

      case "payment_due_date":
        return <td key={col.key} className="px-4 py-3 text-xs text-gray-500">{order.payment_due_date || "-"}</td>;

      default:
        return <td key={col.key} className="px-4 py-3">-</td>;
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">订单管理</h1>
        <span className="text-sm text-gray-400">{filtered.length} 笔</span>
      </div>

      <div className="flex gap-3 flex-wrap items-center">
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
        <ColumnCustomizer columns={columns} onChange={handleColumnsChange} />
      </div>

      {/* Bulk action bar */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2.5">
          <CheckCheck className="w-4 h-4 text-indigo-600 flex-shrink-0" />
          <span className="text-sm text-indigo-700 font-medium">已选 {selectedIds.length} 笔</span>
          <Select value={bulkStatus} onValueChange={setBulkStatus}>
            <SelectTrigger className="w-44 h-7 text-xs bg-white"><SelectValue placeholder="批量修改为..." /></SelectTrigger>
            <SelectContent>
              {statusOptions.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700"
            onClick={handleBulkUpdate} disabled={!bulkStatus || bulkUpdating}>
            {bulkUpdating ? "更新中..." : "确认更新"}
          </Button>
          <button className="text-xs text-gray-400 hover:text-gray-600 ml-auto" onClick={() => setSelectedIds([])}>取消选择</button>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {/* Checkbox column */}
              <th className="px-3 py-2.5 w-8">
                <button onClick={toggleSelectAll} className="text-gray-400 hover:text-gray-700">
                  {allSelected
                    ? <CheckSquare className="w-4 h-4 text-indigo-600" />
                    : <Square className="w-4 h-4" />}
                </button>
              </th>
              {visibleCols.map((col, idx) => {
                const nextCol = visibleCols[idx + 1];
                const showEq = nextCol && isAdjacentJpyAndPayment(col.key, nextCol.key);
                return (
                  <th key={col.key} className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 whitespace-nowrap">
                    {col.label}
                    {showEq && <span className="ml-1 text-gray-300">=</span>}
                  </th>
                );
              })}
              <th className="px-4 py-2.5 w-16"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={visibleCols.length + 2} className="text-center py-8 text-gray-400">加载中...</td></tr>
            ) : filtered.map(order => (
              <tr key={order.id} className={`hover:bg-gray-50 ${selectedIds.includes(order.id) ? "bg-indigo-50/40" : ""}`}>
                <td className="px-3 py-3">
                  <button onClick={() => toggleSelect(order.id)} className="text-gray-400 hover:text-indigo-600">
                    {selectedIds.includes(order.id)
                      ? <CheckSquare className="w-4 h-4 text-indigo-600" />
                      : <Square className="w-4 h-4" />}
                  </button>
                </td>
                {visibleCols.map((col, idx) => {
                  const nextCol = visibleCols[idx + 1];
                  const showEq = nextCol && isAdjacentJpyAndPayment(col.key, nextCol.key);
                  const cell = renderCell(col, order);
                  if (!showEq) return cell;
                  // Wrap cell and inject "=" separator after it
                  return [
                    cell,
                    <td key={`${col.key}_eq`} className="px-0 py-3 text-gray-300 text-sm font-light select-none">=</td>
                  ];
                })}
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