import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import {
  Ticket, Search, RefreshCw, Filter, ChevronUp, ChevronDown,
  ChevronsUpDown, LayoutList, Archive, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { usePermissions } from "@/hooks/usePermissions";
import { usePageSize } from "@/hooks/usePageSize";
import PaginationBar from "@/components/common/PaginationBar";
import ColumnCustomizer from "@/components/orders/ColumnCustomizer";
import { orderRegistry } from "@/lib/orderRegistry";
import TicketOrderDetailPanel from "@/components/tickets/TicketOrderDetailPanel";

const STORAGE_KEY = "admin_ticket_orders_columns_v1";

const ALL_STATUSES = [
  { v: "pending_confirmation",       l: "待确认" },
  { v: "accepted",                   l: "已受理" },
  { v: "awaiting_lottery_result",    l: "待抽选结果" },
  { v: "purchased_pending_warehouse",l: "已购买待入库" },
  { v: "in_warehouse",               l: "已入库" },
  { v: "shipped",                    l: "已发货" },
  { v: "delivered",                  l: "已收货" },
  { v: "cancelled",                  l: "已取消" },
];

function loadColumns(defaultCols) {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return defaultCols;
    const parsed = JSON.parse(saved);
    // Merge saved order/visibility with any new default columns
    const savedMap = Object.fromEntries(parsed.map(c => [c.key, c]));
    const merged = parsed
      .map(c => { const def = defaultCols.find(d => d.key === c.key); return def ? { ...def, visible: c.visible, imageWidth: c.imageWidth } : null; })
      .filter(Boolean);
    // Append any new columns not in saved
    defaultCols.forEach(d => { if (!savedMap[d.key]) merged.push(d); });
    return merged;
  } catch {
    return defaultCols;
  }
}

export default function AdminTicketOrders() {
  const { user } = useCurrentUser();
  const { can, isAdmin } = usePermissions();
  const canEditOrder = isAdmin || can("order:edit_order");

  const ticketController = orderRegistry.get('ticket');
  const defaultCols = ticketController?.getColumnConfig ? ticketController.getColumnConfig() : [];

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [columns, setColumns] = useState(() => loadColumns(defaultCols));
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [groupBy, setGroupBy] = useState("none");
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [userProfileMap, setUserProfileMap] = useState({});
  const { pageSize, setPageSize, currentPage, setCurrentPage, resetPage } = usePageSize("admin_ticket_orders_page_size", 20);

  const handleColumnsChange = (cols) => {
    setColumns(cols);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cols.map(c => ({ key: c.key, visible: c.visible, imageWidth: c.imageWidth })))); } catch {}
  };

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const r = await base44.functions.invoke('getAdminTicketOrders', {});
    const { orders: data = [], userProfileMap: profiles = {} } = r.data || {};
    setOrders(data);
    setUserProfileMap(profiles);
    setLoading(false);
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  if (user && !isAdmin && !can("order:update")) {
    return <div className="text-center py-8 text-red-600">无访问权限</div>;
  }

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  // Filter
  const filteredOrders = (ticketController?.filterData
    ? ticketController.filterData(orders, { statusFilter, search, userProfileMap, showArchived })
    : orders.filter(o => {
        if (showArchived ? !o.is_archived : !!o.is_archived) return false;
        const matchStatus = statusFilter === "all" || o.ticket_status === statusFilter;
        const q = search?.toLowerCase() || "";
        const matchSearch = !q ||
          (o.product_name || "").toLowerCase().includes(q) ||
          (o.order_number || "").toLowerCase().includes(q) ||
          (o.user_name || "").toLowerCase().includes(q) ||
          (o.user_email || "").toLowerCase().includes(q) ||
          (o.ticket_data?.performance_name || "").toLowerCase().includes(q);
        return matchStatus && matchSearch;
      })
  );

  // Sort
  const filtered = [...filteredOrders].sort((a, b) => {
    if (!sortKey) return 0;
    const rk = sortKey === "submit_date" ? "created_date" : sortKey;
    let va = a[rk] ?? a.ticket_data?.[rk] ?? "";
    let vb = b[rk] ?? b.ticket_data?.[rk] ?? "";
    if (typeof va === "string") va = va.toLowerCase();
    if (typeof vb === "string") vb = vb.toLowerCase();
    if (va < vb) return sortDir === "asc" ? -1 : 1;
    if (va > vb) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const visibleCols = columns.filter(c => c.visible);
  const pagedFiltered = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const getStatusLabel = (status) => ALL_STATUSES.find(s => s.v === status)?.l || status;

  const renderOrderRow = (order) => (
    <tr key={order.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedOrder(order)}>
      {visibleCols.map(col => (
        <td key={col.key} className="px-3 py-3 max-w-[220px]">
          {ticketController?.renderCell
            ? ticketController.renderCell(order, col, { userAvatars: userProfileMap })
            : <span className="text-xs text-gray-500">-</span>
          }
        </td>
      ))}
      <td className="px-3 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
        {canEditOrder && (
          <Button size="sm" variant="outline" className="h-6 text-xs px-2 text-indigo-600 border-indigo-200"
            onClick={() => setSelectedOrder(order)}>
            查看详情
          </Button>
        )}
      </td>
    </tr>
  );

  // Grouping
  const buildGroups = () => {
    const groups = {};
    filtered.forEach(order => {
      let key = "其它";
      if (groupBy === "user_name") {
        key = userProfileMap[order.user_email]?.display_name || order.user_name || order.user_email || "未知用户";
      } else if (groupBy === "ticket_status") {
        key = getStatusLabel(order.ticket_status) || order.ticket_status;
      } else if (groupBy === "sales_method") {
        const map = { first_come: "先着", lottery: "抽选", other: "其它" };
        key = map[order.ticket_data?.sales_method] || order.ticket_data?.sales_method || "其它";
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(order);
    });
    const entries = Object.entries(groups);
    if (groupBy === "ticket_status") {
      const order = ALL_STATUSES.map(s => s.l);
      entries.sort(([a], [b]) => {
        const ai = order.indexOf(a), bi = order.indexOf(b);
        if (ai === -1 && bi === -1) return a.localeCompare(b);
        return ai === -1 ? 1 : bi === -1 ? -1 : ai - bi;
      });
    }
    return entries;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Ticket className="w-5 h-5 text-violet-600" />票务订单管理
            {showArchived && <span className="text-sm font-normal text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">已存档</span>}
          </h1>
          <p className="text-sm text-gray-500 mt-1">管理票务代购需求的状态流转与退差价处理</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showArchived ? "default" : "outline"}
            size="sm"
            className={showArchived ? "bg-amber-600 hover:bg-amber-700 text-white" : ""}
            onClick={() => { setShowArchived(v => !v); setStatusFilter("all"); resetPage(); }}
          >
            <Archive className="w-3.5 h-3.5 mr-1.5" />
            {showArchived ? "退出存档视图" : "查看已存档"}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchOrders}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />刷新
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative w-44 shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <Input placeholder="搜索订单/演出/用户..." className="pl-8 h-8 text-sm"
            value={search} onChange={e => { setSearch(e.target.value); resetPage(); }} />
        </div>
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); resetPage(); }}>
          <SelectTrigger className="w-36 h-8 text-xs">
            <Filter className="w-3.5 h-3.5 mr-1 text-gray-400 shrink-0" />
            <SelectValue placeholder="所有状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">所有状态</SelectItem>
            {ALL_STATUSES.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={groupBy} onValueChange={v => { setGroupBy(v); setCollapsedGroups({}); }}>
          <SelectTrigger className="w-32 h-8 text-xs">
            <LayoutList className="w-3.5 h-3.5 mr-1 text-gray-400 shrink-0" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">不分组</SelectItem>
            <SelectItem value="user_name">按用户名</SelectItem>
            <SelectItem value="ticket_status">按票务状态</SelectItem>
            <SelectItem value="sales_method">按销售方式</SelectItem>
          </SelectContent>
        </Select>

        {/* Clear filters */}
        {(statusFilter !== "all" || search) && (
          <button onClick={() => { setStatusFilter("all"); setSearch(""); resetPage(); }}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 h-8 px-1">
            <X className="w-3 h-3" />清除
          </button>
        )}

        <div className="ml-auto">
          <ColumnCustomizer columns={columns} onChange={handleColumnsChange} />
        </div>
      </div>

      {/* Orders table */}
      <div className="border border-gray-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
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
              <tr><td colSpan={visibleCols.length + 1} className="text-center py-12 text-gray-400 text-sm">加载中...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={visibleCols.length + 1} className="text-center py-12 text-gray-400 text-sm">
                {showArchived ? "暂无已存档的票务订单" : "暂无票务订单"}
              </td></tr>
            ) : groupBy === "none" ? pagedFiltered.map(renderOrderRow) : (
              buildGroups().flatMap(([groupKey, groupOrders]) => {
                const isCollapsed = collapsedGroups[groupKey] !== false;
                return [
                  <tr key={`group-${groupKey}`} className="bg-gray-100 border-y border-gray-200">
                    <td colSpan={visibleCols.length + 1} className="px-3 py-2">
                      <button
                        className="flex items-center gap-2 text-xs font-semibold text-gray-700 hover:text-gray-900 w-full text-left"
                        onClick={() => setCollapsedGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }))}
                      >
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isCollapsed ? "-rotate-90" : ""}`} />
                        <span>{groupKey}</span>
                        <span className="font-normal text-gray-400">({groupOrders.length} 条)</span>
                      </button>
                    </td>
                  </tr>,
                  ...(isCollapsed ? [] : groupOrders.map(renderOrderRow)),
                ];
              })
            )}
          </tbody>
        </table>
      </div>

      <PaginationBar
        total={filtered.length}
        pageSize={pageSize}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        onPageSizeChange={(s) => { setPageSize(s); resetPage(); }}
        className="mt-1"
      />

      {selectedOrder && (
        <TicketOrderDetailPanel
          order={selectedOrder}
          userProfileMap={userProfileMap}
          onClose={() => setSelectedOrder(null)}
          onRefresh={fetchOrders}
        />
      )}
    </div>
  );
}