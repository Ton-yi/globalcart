import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Search, RefreshCw, Filter, ChevronUp, ChevronDown, ChevronsUpDown, Trash2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import AdminOrderEditModal from "@/components/admin/AdminOrderEditModal";
import { getStatusLabel, getStatusColor } from "@/lib/orderStatus";
import ColumnCustomizer from "@/components/orders/ColumnCustomizer";
import { matchStoreTagResult } from "@/lib/onlineStoreTag";

const STORAGE_KEY = "admin_orders_columns";

const ALL_COLUMNS = [
  { key: "order_number", label: "订单号", defaultVisible: true, sortable: true },
  { key: "user_name", label: "用户名", defaultVisible: true, sortable: true },
  { key: "product_name", label: "商品名", defaultVisible: true, sortable: true },
  { key: "estimated_jpy", label: "货款", defaultVisible: true, sortable: true },
  { key: "prepayment_amount", label: "付款金额", defaultVisible: true, sortable: true },
  { key: "weight_g", label: "订单重量", defaultVisible: true, sortable: true },
  { key: "order_status", label: "订单状态", defaultVisible: true, sortable: true },
  { key: "online_store_tag", label: "商城标签", defaultVisible: false, sortable: true },
  { key: "reply_status", label: "回复状态", defaultVisible: false, sortable: true },
  { key: "purchased_date", label: "下单日", defaultVisible: false, sortable: true },
  { key: "in_warehouse_date", label: "入库日", defaultVisible: false, sortable: true },
  { key: "shipped_date", label: "发货日", defaultVisible: false, sortable: true },
  { key: "submit_date", label: "订单提交日", defaultVisible: false, sortable: true },
  { key: "product_image_url", label: "商品图片", defaultVisible: false, sortable: false },
  { key: "arrival_photo_url", label: "入库图片", defaultVisible: false, sortable: false },
  { key: "product_description", label: "商品描述", defaultVisible: false, sortable: true },
  { key: "admin_note", label: "管理员备注", defaultVisible: false, sortable: true },
  { key: "user_note", label: "用户备注", defaultVisible: false, sortable: true },
  { key: "payment_due_date", label: "付款截止日期", defaultVisible: false, sortable: true },
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
  if (currency === "JPY") return `${Math.round(amount).toLocaleString()} yen`;
  if (currency === "CNY") return `${amount.toFixed(2)} yuan`;
  return `${currency} ${amount.toFixed(2)}`;
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
      return (
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-gray-900 truncate">{order.product_name}</span>
          {(order.unread_roles || []).includes("admin") && (
            <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 animate-pulse" title="有新消息" />
          )}
        </div>
      );
    case "estimated_jpy":
      return <span className="text-sm text-gray-700">{order.estimated_jpy ? `${Math.round(order.estimated_jpy).toLocaleString()} yen` : "-"}</span>;
    case "prepayment_amount":
      return <span className="text-sm text-gray-700">{formatAmount(order.prepayment_amount, order.prepayment_currency)}</span>;
    case "weight_g":
      return <span className="text-sm text-gray-700">{order.weight_g ? `${order.weight_g}g` : "-"}</span>;
    case "order_status":
      return (
        <Badge className={`text-xs ${getStatusColor(order.order_status, "admin")}`}>
          {getStatusLabel(order.order_status, "admin")}
        </Badge>
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
    case "reply_status": {
      const hasUnread = (order.unread_roles || []).includes("admin");
      const hasMsgs = (order.messages || []).length > 0;
      if (hasUnread) return <Badge className="text-xs bg-red-100 text-red-700">有新消息</Badge>;
      if (hasMsgs) return <Badge className="text-xs bg-gray-100 text-gray-500">有留言</Badge>;
      return <Badge className="text-xs bg-gray-100 text-gray-400">无留言</Badge>;
    }
    case "created_date":
      return <span className="text-xs text-gray-700">{order.created_date ? new Date(order.created_date).toLocaleDateString("zh-CN") : "-"}</span>;
    case "submit_date":
      return <span className="text-xs text-gray-700">{order.created_date ? new Date(order.created_date).toLocaleDateString("zh-CN") : "-"}</span>;
    case "purchased_date":
      return <span className="text-xs text-gray-700">{order.purchased_date ? new Date(order.purchased_date).toLocaleDateString("zh-CN") : "-"}</span>;
    case "in_warehouse_date":
      return <span className="text-xs text-gray-700">{order.in_warehouse_date ? new Date(order.in_warehouse_date).toLocaleDateString("zh-CN") : "-"}</span>;
    case "shipped_date":
      return <span className="text-xs text-gray-700">{order.shipped_date ? new Date(order.shipped_date).toLocaleDateString("zh-CN") : "-"}</span>;
    case "online_store_tag": {
      const tagRules = col._rules || [];
      const firstUrl = (order.product_url || "").split("\n").map(s => s.trim()).filter(Boolean)[0] || "";
      const tagResult = matchStoreTagResult(firstUrl, tagRules);
      return <Badge className={`text-xs ${tagResult.tag_color}`}>{tagResult.tag_label}</Badge>;
    }
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
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [storeTagRules, setStoreTagRules] = useState([]);

  const [itemSizeTemplates, setItemSizeTemplates] = useState([]);
  const [pendingEditRequests, setPendingEditRequests] = useState([]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const r = await base44.functions.invoke('getAdminOrdersPageData', {});
    const { orders: data = [], storeTagRules: rules = [], itemSizeTemplates: templates = [], pendingEditRequests: edits = [] } = r.data || {};
    setOrders(data);
    setStoreTagRules(rules);
    setItemSizeTemplates(templates);
    setPendingEditRequests(edits);
    setLoading(false);
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleColumnsChange = (newCols) => {
    setColumns(newCols);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newCols.map(c => ({ key: c.key, visible: c.visible }))));
  };

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
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
  }).sort((a, b) => {
    if (!sortKey) return 0;
    const rk = sortKey === "submit_date" ? "created_date" : sortKey;
    let va = a[rk], vb = b[rk];
    if (sortKey === "reply_status") {
      // Sort by unread: unread admin first
      va = (a.unread_roles || []).includes("admin") ? 1 : 0;
      vb = (b.unread_roles || []).includes("admin") ? 1 : 0;
    } else if (typeof va === "string" && typeof vb === "string") {
      va = va.toLowerCase(); vb = vb.toLowerCase();
    }
    if (va == null) va = "";
    if (vb == null) vb = "";
    if (va < vb) return sortDir === "asc" ? -1 : 1;
    if (va > vb) return sortDir === "asc" ? 1 : -1;
    return 0;
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
    await Promise.all(selectedIds.map(id =>
      base44.functions.invoke('updateTenantOrder', { order_id: id, order_status: bulkStatus })
    ));
    setBulkUpdating(false);
    setSelectedIds([]);
    setBulkStatus("");
    fetchOrders();
  };

  const handleStatusClick = (order) => {
    // Quick link jump for simple pending_purchase orders
    if (order.order_status === "pending_purchase") {
      const urls = (order.product_url || "").split("\n").map(s => s.trim()).filter(Boolean);
      const isSimpleOrder = urls.length === 1 && !order.product_description && !order.user_note && (order.messages || []).length === 0;
      if (isSimpleOrder) {
        window.open(urls[0], "_blank");
        return;
      }
    }
    // Open order details for other cases
    setSelectedOrder(order);
  };

  const handleQuickOrdered = async (order) => {
    await base44.functions.invoke('updateTenantOrder', {
      order_id: order.id,
      order_status: "purchased",
      purchased_date: new Date().toISOString().split("T")[0],
    });
    fetchOrders();
  };

  const handleQuickInWarehouse = async (order) => {
    setSelectedOrder(order);
  };

  const handleDeleteCancelled = async (order) => {
    if (!window.confirm(`确认永久删除订单"${order.product_name}"？此操作不可撤销。`)) return;
    await base44.functions.invoke('mutateTenantEntity', { entity: 'Order', action: 'delete', id: order.id });
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
                <th key={col.key}
                  className={`px-3 py-2 text-left text-xs font-medium text-gray-500 whitespace-nowrap ${col.sortable ? "cursor-pointer select-none hover:text-gray-800" : ""}`}
                  onClick={() => col.sortable && handleSort(col.key)}>
                  <div className="flex items-center gap-1">
                    {col.label}
                    {col.sortable && (
                      sortKey === col.key
                        ? (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)
                        : <ChevronsUpDown className="w-3 h-3 opacity-30" />
                    )}
                  </div>
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
            ) : filtered.map(order => {
              const pendingEdit = pendingEditRequests.find(r => r.order_id === order.id);
              return (
              <tr key={order.id} className={`hover:bg-gray-50 cursor-pointer ${pendingEdit ? "bg-orange-50/60" : ""}`} onClick={() => handleStatusClick(order)}>
                <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                  <Checkbox checked={selectedIds.includes(order.id)} onCheckedChange={() => toggleSelect(order.id)} />
                </td>
                {visibleCols.map(col => (
                  <td key={col.key} className="px-3 py-3 max-w-[220px]">
                   <CellValue col={{ ...col, _rules: storeTagRules }} order={order} onQuickOrdered={handleQuickOrdered} userAvatars={userAvatars} />
                  </td>
                ))}
                <td className="px-3 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                  <div className="flex flex-wrap gap-1 items-center">
                    {pendingEdit && (
                      <span className="inline-flex items-center gap-1 text-xs bg-orange-100 text-orange-700 border border-orange-300 px-1.5 py-0.5 rounded-full font-medium">
                        <AlertCircle className="w-3 h-3" />
                        {pendingEdit.edit_type === 'cancel_shipment' ? '申请重新入库' : '申请移至其他发货申请'}
                      </span>
                    )}
                    {(order.order_status === "paid" || order.order_status === "pending_purchase") && (
                      <Button size="sm" variant="outline" className="h-6 text-xs px-2 text-indigo-600 border-indigo-200"
                        onClick={() => handleQuickOrdered(order)}>
                        已下单
                      </Button>
                    )}
                    {order.order_status === "purchased" && (
                      <Button size="sm" variant="outline" className="h-6 text-xs px-2 text-teal-600 border-teal-200"
                        onClick={() => handleQuickInWarehouse(order)}>
                        入库
                      </Button>
                    )}
                    {order.order_status === "cancelled" && (
                      <Button size="sm" variant="outline" className="h-6 text-xs px-2 text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => handleDeleteCancelled(order)}>
                        <Trash2 className="w-3 h-3 mr-1" />删除
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-gray-400 text-right">共 {filtered.length} 条</div>

      {selectedOrder && (
        <AdminOrderEditModal
          order={selectedOrder}
          initialItemSizeTemplates={itemSizeTemplates}
          onClose={() => setSelectedOrder(null)}
          onSaved={() => { setSelectedOrder(null); fetchOrders(); }}
        />
      )}
    </div>
  );
}