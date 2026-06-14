import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Ticket, Search, RefreshCw, Filter, ChevronUp, ChevronDown, ChevronsUpDown, LayoutList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { usePermissions } from "@/hooks/usePermissions";
import { usePageSize } from "@/hooks/usePageSize";
import PaginationBar from "@/components/common/PaginationBar";
import { orderRegistry } from "@/lib/orderRegistry";
import TicketOrderDetailPanel from "@/components/tickets/TicketOrderDetailPanel";

const ALL_STATUSES = [
  { v: "pending_confirmation", l: "待确认" },
  { v: "accepted", l: "已受理" },
  { v: "awaiting_lottery_result", l: "待抽选结果" },
  { v: "purchased_pending_warehouse", l: "已购买待入库" },
  { v: "in_warehouse", l: "已入库" },
  { v: "shipped", l: "已发货" },
  { v: "delivered", l: "已收货" },
  { v: "cancelled", l: "已取消" },
];

export default function AdminTicketOrders() {
  const { user } = useCurrentUser();
  const { can, isAdmin } = usePermissions();
  const canEditOrder = isAdmin || can("order:edit_order");
  
  // 获取票务订单控制器
  const ticketController = orderRegistry.get('ticket');
  
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [columns, setColumns] = useState(() => ticketController?.getColumnConfig ? ticketController.getColumnConfig() : []);
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [groupBy, setGroupBy] = useState("none");
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [userProfileMap, setUserProfileMap] = useState({});
  const { pageSize, setPageSize, currentPage, setCurrentPage, resetPage } = usePageSize("admin_ticket_orders_page_size", 20);


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
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  // 使用控制器的 filterData 方法过滤票务订单
  const filteredOrders = ticketController?.filterData
    ? ticketController.filterData(orders, { statusFilter, search, userProfileMap })
    : orders.filter(o => {
        const matchStatus = statusFilter === "all" || o.ticket_status === statusFilter;
        const q = search?.toLowerCase() || "";
        const matchSearch = !q ||
          (o.product_name || "").toLowerCase().includes(q) ||
          (o.order_number || "").toLowerCase().includes(q) ||
          (o.user_name || "").toLowerCase().includes(q) ||
          (o.user_email || "").toLowerCase().includes(q) ||
          (o.ticket_data?.performance_name || "").toLowerCase().includes(q);
        return matchStatus && matchSearch;
      });

  const filtered = filteredOrders.sort((a, b) => {
    if (!sortKey) return 0;
    const rk = sortKey === "submit_date" ? "created_date" : sortKey;
    let va = a[rk], vb = b[rk];
    if (typeof va === "string" && typeof vb === "string") {
      va = va.toLowerCase(); vb = vb.toLowerCase();
    }
    if (va == null) va = "";
    if (vb == null) vb = "";
    if (va < vb) return sortDir === "asc" ? -1 : 1;
    if (va > vb) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const visibleCols = columns.filter(c => c.visible || c.defaultVisible);
  const pagedFiltered = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const getTicketStatusColor = (status) => {
    const colors = {
      pending_confirmation: "bg-gray-100 text-gray-700",
      accepted: "bg-blue-100 text-blue-700",
      awaiting_lottery_result: "bg-yellow-100 text-yellow-700",
      purchased_pending_warehouse: "bg-purple-100 text-purple-700",
      in_warehouse: "bg-green-100 text-green-700",
      shipped: "bg-teal-100 text-teal-700",
      delivered: "bg-green-200 text-green-800",
      cancelled: "bg-red-100 text-red-700",
    };
    return colors[status] || "bg-gray-100 text-gray-700";
  };

  const getTicketStatusLabel = (status) => {
    const labels = {
      pending_confirmation: "待确认",
      accepted: "已受理",
      awaiting_lottery_result: "待抽选结果",
      purchased_pending_warehouse: "已购买待入库",
      in_warehouse: "已入库",
      shipped: "已发货",
      delivered: "已收货",
      cancelled: "已取消",
    };
    return labels[status] || status;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Ticket className="w-5 h-5 text-violet-600" />票务订单管理
          </h1>
          <p className="text-sm text-gray-500 mt-1">管理票务代购需求的状态流转与退差价处理</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchOrders}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />刷新
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <Input placeholder="搜索订单号、演出名、用户..." className="pl-8 h-8 text-sm"
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
        <Select value={groupBy} onValueChange={v => { setGroupBy(v); setCollapsedGroups({}); }}>
          <SelectTrigger className="w-36 h-8 text-sm">
            <LayoutList className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">不分组</SelectItem>
            <SelectItem value="user_name">按用户名</SelectItem>
            <SelectItem value="ticket_status">按票务状态</SelectItem>
            <SelectItem value="sales_method">按销售方式</SelectItem>
          </SelectContent>
        </Select>
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
              <tr><td colSpan={visibleCols.length + 1} className="text-center py-12 text-gray-400 text-sm">暂无票务订单</td></tr>
            ) : (() => {
              const renderData = groupBy === "none" ? pagedFiltered : filtered;
              const renderOrderRow = (order) => {
                return (
                  <tr key={order.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedOrder(order)}>
                    {visibleCols.map(col => (
                      <td key={col.key} className="px-3 py-3 max-w-[220px]">
                        {ticketController?.renderCell ? ticketController.renderCell(order, { ...col }, {
                          userAvatars: userProfileMap,
                        }) : (
                          <>
                            {col.key === "order_number" && <span className="font-mono text-xs text-gray-500">{order.order_number || "-"}</span>}
                            {col.key === "user_name" && (
                              <div className="flex items-center gap-2 min-w-0">
                                {userProfileMap?.[order.user_email]?.avatar_url
                                  ? <img src={userProfileMap[order.user_email].avatar_url} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0 border border-gray-100" />
                                  : <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 text-xs text-gray-500 font-medium">
                                      {(order.user_name || order.user_email || "?")[0].toUpperCase()}
                                    </div>
                                }
                                <span className="text-sm text-gray-800 truncate">{order.user_name || order.user_email || "?"}</span>
                              </div>
                            )}
                            {col.key === "product_name" && <span className="text-sm font-medium text-gray-900 truncate">{order.product_name || "-"}</span>}
                            {col.key === "ticket_prepaid_total_jpy" && <span className="text-sm text-gray-700">{order.ticket_prepaid_total_jpy ? `${Math.round(order.ticket_prepaid_total_jpy).toLocaleString()} yen` : "-"}</span>}
                            {col.key === "ticket_status" && (
                              <Badge className={`text-xs ${getTicketStatusColor(order.ticket_status)}`}>
                                {getTicketStatusLabel(order.ticket_status)}
                              </Badge>
                            )}
                            {col.key === "performance_datetime" && <span className="text-xs text-gray-700">{order.ticket_data?.performance_datetime ? new Date(order.ticket_data.performance_datetime).toLocaleDateString("zh-CN") : "-"}</span>}
                            {col.key === "prefecture" && <span className="text-xs text-gray-700">{order.ticket_data?.prefecture || "-"}</span>}
                            {col.key === "sales_method" && <span className="text-xs text-gray-700">{order.ticket_data?.sales_method || "-"}</span>}
                            {col.key === "submit_date" && <span className="text-xs text-gray-700">{order.created_date ? new Date(order.created_date).toLocaleDateString("zh-CN") : "-"}</span>}
                          </>
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      <div className="flex flex-wrap gap-1 items-center">
                        {canEditOrder && (
                          <Button size="sm" variant="outline" className="h-6 text-xs px-2 text-indigo-600 border-indigo-200"
                            onClick={() => setSelectedOrder(order)}>
                            查看详情
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              };

              if (groupBy === "none") return renderData.map(renderOrderRow);

              // Build groups
              const groups = {};
              filtered.forEach(order => {
                let key = "其它";
                if (groupBy === "user_name") {
                  key = userProfileMap[order.user_email]?.display_name || order.user_name || order.user_email || "未知用户";
                } else if (groupBy === "ticket_status") {
                  key = getTicketStatusLabel(order.ticket_status) || order.ticket_status;
                } else if (groupBy === "sales_method") {
                  const salesMethods = { first_come: "先着", lottery: "抽选", other: "其它" };
                  key = salesMethods[order.ticket_data?.sales_method] || order.ticket_data?.sales_method || "其它";
                }
                if (!groups[key]) groups[key] = [];
                groups[key].push(order);
              });

              const groupEntries = Object.entries(groups);
              if (groupBy === "ticket_status") {
                const statusOrder = ALL_STATUSES.map(s => s.l);
                groupEntries.sort(([a], [b]) => {
                  const ai = statusOrder.indexOf(a);
                  const bi = statusOrder.indexOf(b);
                  if (ai === -1 && bi === -1) return a.localeCompare(b);
                  if (ai === -1) return 1;
                  if (bi === -1) return -1;
                  return ai - bi;
                });
              }

              return groupEntries.flatMap(([groupKey, groupOrders]) => {
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
              });
            })()}
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
        />
      )}
    </div>
  );
}