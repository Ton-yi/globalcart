import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Search, RefreshCw, Filter, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import AdminOrderEditModal from "@/components/admin/AdminOrderEditModal";
import { getStatusLabel, getStatusColor } from "@/lib/orderStatus";
import ColumnCustomizer from "@/components/orders/ColumnCustomizer";

const STORAGE_KEY = "admin_orders_columns";

const ALL_COLUMNS = [
  { key: "order_number", label: "订单号", defaultVisible: true },
  { key: "user_name", label: "用户名", defaultVisible: true },
  { key: "product_name", label: "商品名", defaultVisible: true },
  { key: "estimated_jpy", label: "货款", defaultVisible: true },
  { key: "prepayment_amount", label: "付款金额", defaultVisible: true },
  { key: "weight_g", label: "订单重量", defaultVisible: true },
  { key: "order_status", label: "订单状态", defaultVisible: true },
  { key: "product_image_url", label: "商品图片", defaultVisible: false },
  { key: "arrival_photo_url", label: "入库图片", defaultVisible: false },
  { key: "product_description", label: "商品描述", defaultVisible: false },
  { key: "admin_note", label: "管理员备注", defaultVisible: false },
  { key: "user_note", label: "用户备注", defaultVisible: false },
  { key: "payment_due_date", label: "付款截止日期", defaultVisible: false },
];

const DEFAULT_COLUMNS = ALL_COLUMNS.map(c => ({ ...c, visible: c.defaultVisible }));

function loadColumns() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return DEFAULT_COLUMNS;
    const parsed = JSON.parse(saved);
    // Merge with ALL_COLUMNS to pick up any new columns added
    const keyOrder = parsed.map(c => c.key);
    const merged = [
      ...parsed.map(p => {
        const def = ALL_COLUMNS.find(c => c.key === p.key);
        return def ? { ...def, visible: p.visible } : null;
      }).filter(Boolean),
      ...ALL_COLUMNS.filter(c => !keyOrder.includes(c.key)).map(c => ({ ...c, visible: c.defaultVisible })),
    ];
    return merged;
  } catch {
    return DEFAULT_COLUMNS;
  }
}

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

function formatAmount(amount, currency) {
  if (!amount || amount <= 0) return "-";
  const val = amount.toFixed(2);
  if (currency === "CNY") return `${val} yuan`;
  return `${currency} ${val}`;
}

function CellValue({ col, order, onQuickOrdered, userAvatars }) {
  switch (col.key) {
    case "order_number":
      return <span className="font-mono text-xs text-gray-500">{order.order_number || "-"}</span>;
    case "user_name": {
      const avatar = userAvatars?.[order.user_email];
      return (
        <div className="flex items-center gap-2 min-w-0">
          {avatar
            ? <img src={avatar} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0 border border-gray-100" />
            : <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 text-xs text-gray-500 font-medium">
                {(order.user_name || order.user_email || "?")[0].toUpperCase()}
              </div>
          }
          <span className="text-sm text-gray-800 truncate">{order.user_name || "-"}</span>
        </div>
      );
    }
    case "product_name":
      return <span className="text-sm font-medium text-gray-900 truncate">{order.product_name}</span>;
    case "estimated_jpy":
      return <span className="text-sm text-gray-700">{order.estimated_jpy ? `${order.estimated_jpy.toLocaleString()} yen` : "-"}</span>;
    case "prepayment_amount":
      return <span className="text-sm text-gray-700">{formatAmount(order.prepayment_amount, order.prepayment_currency)}</span>;
    case "weight_g":
      return <span className="text-sm text-gray-700">{order.weight_g ? `${order.weight_g}g` : "-"}</span>;
    case "order_status":
      return (
        <div className="flex flex-col gap-1 items-start">
          <Badge className={`text-xs ${getStatusColor(order.order_status, "admin")}`}>
            {getStatusLabel(order.order_status, "admin")}
          </Badge>
          {(order.order_status === "paid" || order.order_status === "pending_purchase") && (
            <Button size="sm" variant="outline" className="h-5 text-xs px-1.5 text-indigo-600 border-indigo-200"
              onClick={e => { e.stopPropagation(); onQuickOrdered(order); }}>
              快速→已下单
            </Button>
          )}
        </div>
      );
    case "product_image_url":
      return order.product_image_url
        ? <img src={order.product_image_url} alt="" className="w-10 h-10 rounded object-cover border border-gray-100" />
        : <span className="text-xs text-gray-300">-</span>;
    case "arrival_photo_url":
      return order.arrival_photo_url
        ? <img src={order.arrival_photo_url} alt="" className="w-10 h-10 rounded object-cover border border-gray-100" />
        : <span className="text-xs text-gray-300">-</span>;
    case "product_description":
      return <span className="text-xs text-gray-600 line-clamp-2 max-w-[200px]">{order.product_description || "-"}</span>;
    case "admin_note":
      return <span className="text-xs text-gray-600 line-clamp-2 max-w-[200px]">{order.admin_note || "-"}</span>;
    case "user_note":
      return <span className="text-xs text-gray-600 line-clamp-2 max-w-[200px]">{order.user_note || "-"}</span>;
    case "payment_due_date":
      return <span className="text-xs text-gray-700">{order.payment_due_date || "-"}</span>;
    default:
      return "-";
  }
}

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [columns, setColumns] = useState(loadColumns);
  const [userAvatars, setUserAvatars] = useState({});

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const [data, prefs] = await Promise.all([
      base44.entities.Order.list("-updated_date", 200),
      base44.entities.UserPreference.list(),
    ]);
    setOrders(data);
    const avatarMap = {};
    prefs.forEach(p => { if (p.avatar_url) avatarMap[p.user_email] = p.avatar_url; });
    setUserAvatars(avatarMap);
    setLoading(false);
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleColumnsChange = (newCols) => {
    setColumns(newCols);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newCols.map(c => ({ key: c.key, visible: c.visible }))));
  };

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

  const visibleCols = columns.filter(c => c.visible);

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

  const handleQuickOrdered = async (order) => {
    await base44.entities.Order.update(order.id, { order_status: "purchased" });
    fetchOrders();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold text-gray-900">订单管理</h1>
        <div className="flex items-center gap-2">
          <ColumnCustomizer columns={columns} onChange={handleColumnsChange} />
          <Button variant="outline" size="sm" onClick={fetchOrders}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />刷新
          </Button>
        </div>
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

      {/* Orders table */}
      <div className="border border-gray-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="w-8 px-3 py-2 text-left">
                <Checkbox checked={selectedIds.length === filtered.length && filtered.length > 0}
                  onCheckedChange={toggleAll} />
              </th>
              {visibleCols.map(col => (
                <th key={col.key} className="px-3 py-2 text-left text-xs font-medium text-gray-500 whitespace-nowrap">
                  {col.label}
                </th>
              ))}
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={visibleCols.length + 2} className="text-center py-12 text-gray-400 text-sm">加载中...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={visibleCols.length + 2} className="text-center py-12 text-gray-400 text-sm">暂无订单</td></tr>
            ) : filtered.map(order => (
              <tr key={order.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedOrder(order)}>
                <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                  <Checkbox checked={selectedIds.includes(order.id)} onCheckedChange={() => toggleSelect(order.id)} />
                </td>
                {visibleCols.map(col => (
                  <td key={col.key} className="px-3 py-3 max-w-[220px]">
                   <CellValue col={col} order={order} onQuickOrdered={handleQuickOrdered} userAvatars={userAvatars} />
                  </td>
                ))}
                <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                  {(order.order_status === "paid" || order.order_status === "pending_purchase") && (
                    <Button size="sm" variant="outline" className="h-6 text-xs px-2 text-indigo-600 border-indigo-200"
                      onClick={() => handleQuickOrdered(order)}>
                      已下单
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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