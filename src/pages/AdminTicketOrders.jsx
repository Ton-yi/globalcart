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
import TicketDateRangeFilter from "@/components/tickets/TicketDateRangeFilter";
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
  
  // 新增筛选状态
  const [orderAmountFilter, setOrderAmountFilter] = useState("all");
  const [customOrderAmount, setCustomOrderAmount] = useState({ min: "", max: "" });
  const [salesMethodFilter, setSalesMethodFilter] = useState("all");
  const [ticketingMethodFilter, setTicketingMethodFilter] = useState("all");
  const [ticketDateFilter, setTicketDateFilter] = useState(null);
  const [additionalFeeFilter, setAdditionalFeeFilter] = useState("all");
  const [customAdditionalFee, setCustomAdditionalFee] = useState({ min: "", max: "" });
  const [lotteryBonusFilter, setLotteryBonusFilter] = useState("all");
  const [customLotteryBonus, setCustomLotteryBonus] = useState({ min: "", max: "" });

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
    ? ticketController.filterData(orders, {
        statusFilter, search, userProfileMap, showArchived,
        orderAmountFilter, customOrderAmount,
        salesMethodFilter, ticketingMethodFilter,
        ticketDateFilter,
        additionalFeeFilter, customAdditionalFee,
        lotteryBonusFilter, customLotteryBonus,
      })
    : orders.filter(o => {
        if (showArchived ? !o.is_archived : !!o.is_archived) return false;
        
        const matchStatus = statusFilter === "all" || o.ticket_status === statusFilter;
        const td = o.ticket_data || {};
        
        // Order amount filter
        const orderAmount = o.ticket_prepaid_total_jpy || 0;
        let matchOrderAmount = true;
        if (orderAmountFilter !== "all") {
          if (orderAmountFilter === "0-5000") matchOrderAmount = orderAmount >= 0 && orderAmount < 5000;
          else if (orderAmountFilter === "5000-10000") matchOrderAmount = orderAmount >= 5000 && orderAmount < 10000;
          else if (orderAmountFilter === "10000-50000") matchOrderAmount = orderAmount >= 10000 && orderAmount < 50000;
          else if (orderAmountFilter === "50000+") matchOrderAmount = orderAmount >= 50000;
          else if (orderAmountFilter === "custom") {
            if (customOrderAmount.min) matchOrderAmount = orderAmount >= Number(customOrderAmount.min);
            if (customOrderAmount.max) matchOrderAmount = matchOrderAmount && orderAmount <= Number(customOrderAmount.max);
          }
        }
        
        // Sales method filter
        let matchSalesMethod = true;
        if (salesMethodFilter !== "all") {
          matchSalesMethod = td.sales_method === salesMethodFilter;
        }
        
        // Ticketing method filter
        let matchTicketingMethod = true;
        if (ticketingMethodFilter !== "all") {
          matchTicketingMethod = td.ticketing_method === ticketingMethodFilter;
        }
        
        // Unified date range filter
        let matchDateRange = true;
        if (ticketDateFilter) {
          const { field, from, to } = ticketDateFilter;
          let dateValue = null;
          
          // Get date value based on field
          if (field === "ticket_data.performance_datetime") {
            dateValue = td.performance_datetime ? new Date(td.performance_datetime) : null;
          } else if (field === "ticket_data.sales_start_time") {
            dateValue = td.sales_start_time ? new Date(td.sales_start_time) : null;
          } else if (field === "ticket_data.sales_end_time") {
            dateValue = td.sales_end_time ? new Date(td.sales_end_time) : null;
          } else if (field === "submit_date") {
            dateValue = o.created_date ? new Date(o.created_date) : null;
          } else if (field === "ticket_data.lottery_result_time") {
            dateValue = td.lottery_result_time ? new Date(td.lottery_result_time) : null;
          }
          
          if (dateValue) {
            if (from) matchDateRange = dateValue >= from;
            if (to) matchDateRange = matchDateRange && dateValue <= to;
          } else {
            matchDateRange = false;
          }
        }
        
        // Additional fee filter
        const additionalFee = td.additional_fee_jpy || 0;
        let matchAdditionalFee = true;
        if (additionalFeeFilter !== "all") {
          if (additionalFeeFilter === "0-1000") matchAdditionalFee = additionalFee >= 0 && additionalFee < 1000;
          else if (additionalFeeFilter === "1000-3000") matchAdditionalFee = additionalFee >= 1000 && additionalFee < 3000;
          else if (additionalFeeFilter === "3000-10000") matchAdditionalFee = additionalFee >= 3000 && additionalFee < 10000;
          else if (additionalFeeFilter === "10000+") matchAdditionalFee = additionalFee >= 10000;
          else if (additionalFeeFilter === "custom") {
            if (customAdditionalFee.min) matchAdditionalFee = additionalFee >= Number(customAdditionalFee.min);
            if (customAdditionalFee.max) matchAdditionalFee = matchAdditionalFee && additionalFee <= Number(customAdditionalFee.max);
          }
        }
        
        // Lottery bonus filter
        const lotteryBonus = td.lottery_win_bonus_jpy || 0;
        let matchLotteryBonus = true;
        if (lotteryBonusFilter !== "all") {
          if (lotteryBonusFilter === "0-1000") matchLotteryBonus = lotteryBonus >= 0 && lotteryBonus < 1000;
          else if (lotteryBonusFilter === "1000-3000") matchLotteryBonus = lotteryBonus >= 1000 && lotteryBonus < 3000;
          else if (lotteryBonusFilter === "3000-10000") matchLotteryBonus = lotteryBonus >= 3000 && lotteryBonus < 10000;
          else if (lotteryBonusFilter === "10000+") matchLotteryBonus = lotteryBonus >= 10000;
          else if (lotteryBonusFilter === "custom") {
            if (customLotteryBonus.min) matchLotteryBonus = lotteryBonus >= Number(customLotteryBonus.min);
            if (customLotteryBonus.max) matchLotteryBonus = matchLotteryBonus && lotteryBonus <= Number(customLotteryBonus.max);
          }
        }
        
        // Search
        const q = search?.toLowerCase() || "";
        const matchSearch = !q ||
          (o.product_name || "").toLowerCase().includes(q) ||
          (o.order_number || "").toLowerCase().includes(q) ||
          (o.user_name || "").toLowerCase().includes(q) ||
          (o.user_email || "").toLowerCase().includes(q) ||
          (td.performance_name || "").toLowerCase().includes(q) ||
          (td.prefecture || "").toLowerCase().includes(q);
        
        return matchStatus && matchOrderAmount && matchSalesMethod && matchTicketingMethod &&
          matchDateRange && matchAdditionalFee && matchLotteryBonus && matchSearch;
      })
  );

  // Sort
  const filtered = [...filteredOrders].sort((a, b) => {
    if (!sortKey) return 0;
    // Map column keys to actual data paths
    const keyMap = {
      submit_date: 'created_date',
      performance_datetime: 'ticket_data.performance_datetime',
      prefecture: 'ticket_data.prefecture',
      sales_method: 'ticket_data.sales_method',
      ticketing_method: 'ticket_data.ticketing_method',
      account_count: 'ticket_data.account_count',
      sales_start_time: 'ticket_data.sales_start_time',
      sales_end_time: 'ticket_data.sales_end_time',
      lottery_result_time: 'ticket_data.lottery_result_time',
      additional_fee_jpy: 'ticket_data.additional_fee_jpy',
      lottery_win_bonus_jpy: 'ticket_data.lottery_win_bonus_jpy',
      purchase_link: 'ticket_data.purchase_link',
    };
    const dataPath = keyMap[sortKey] || sortKey;
    
    // Get value from nested path
    const getValue = (obj, path) => {
      if (path.includes('.')) {
        return path.split('.').reduce((o, p) => o?.[p], obj) ?? "";
      }
      return obj[path] ?? "";
    };
    
    let va = getValue(a, dataPath);
    let vb = getValue(b, dataPath);
    
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

      {/* Filters - 参考 AdminOrders 样式，搜索框 flex-1，其它固定宽度 */}
      <div className="flex flex-wrap gap-2 items-center w-full">
        {/* 搜索框 - 灵活适配 */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <Input placeholder="搜索订单/演出/用户..." className="pl-8 h-8 text-sm w-full"
            value={search} onChange={e => { setSearch(e.target.value); resetPage(); }} />
        </div>

        {/* 票务状态 - 固定宽度 */}
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); resetPage(); }}>
          <SelectTrigger className="w-36 h-8 text-xs shrink-0">
            <Filter className="w-3.5 h-3.5 mr-1 text-gray-400 shrink-0" />
            <SelectValue placeholder="所有状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">所有状态</SelectItem>
            {ALL_STATUSES.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* 订单金额 - 固定宽度 */}
        <Select value={orderAmountFilter} onValueChange={v => { setOrderAmountFilter(v); resetPage(); }}>
          <SelectTrigger className="h-8 text-xs w-32 shrink-0">
            <SelectValue placeholder="订单金额" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">订单金额</SelectItem>
            <SelectItem value="0-5000">0–5,000</SelectItem>
            <SelectItem value="5000-10000">5,000–10,000</SelectItem>
            <SelectItem value="10000-50000">10,000–50,000</SelectItem>
            <SelectItem value="50000+">50,000+</SelectItem>
          </SelectContent>
        </Select>

        {/* 销售方式 - 固定宽度 */}
        <Select value={salesMethodFilter} onValueChange={v => { setSalesMethodFilter(v); resetPage(); }}>
          <SelectTrigger className="h-8 text-xs w-28 shrink-0">
            <SelectValue placeholder="销售方式" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">销售方式</SelectItem>
            <SelectItem value="first_come">先着</SelectItem>
            <SelectItem value="lottery">抽选</SelectItem>
            <SelectItem value="other">其它</SelectItem>
          </SelectContent>
        </Select>

        {/* 发券方式 - 固定宽度 */}
        <Select value={ticketingMethodFilter} onValueChange={v => { setTicketingMethodFilter(v); resetPage(); }}>
          <SelectTrigger className="h-8 text-xs w-28 shrink-0">
            <SelectValue placeholder="发券方式" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">发券方式</SelectItem>
            <SelectItem value="paper">纸票</SelectItem>
            <SelectItem value="electronic">电子票</SelectItem>
            <SelectItem value="ticket_number">发券番号</SelectItem>
          </SelectContent>
        </Select>

        {/* 日期筛选 - 统一选择器 */}
        <div className="shrink-0">
          <TicketDateRangeFilter value={ticketDateFilter} onChange={setTicketDateFilter} />
        </div>

        {/* 追加料金 - 固定宽度 */}
        <Select value={additionalFeeFilter} onValueChange={v => { setAdditionalFeeFilter(v); resetPage(); }}>
          <SelectTrigger className="h-8 text-xs w-32 shrink-0">
            <SelectValue placeholder="追加料金" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">追加料金</SelectItem>
            <SelectItem value="0-1000">0–1,000</SelectItem>
            <SelectItem value="1000-3000">1,000–3,000</SelectItem>
            <SelectItem value="3000-10000">3,000–10,000</SelectItem>
            <SelectItem value="10000+">10,000+</SelectItem>
          </SelectContent>
        </Select>

        {/* 抽中追加報酬 - 固定宽度 */}
        <Select value={lotteryBonusFilter} onValueChange={v => { setLotteryBonusFilter(v); resetPage(); }}>
          <SelectTrigger className="h-8 text-xs w-32 shrink-0">
            <SelectValue placeholder="抽中追加報酬" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">抽中追加報酬</SelectItem>
            <SelectItem value="0-1000">0–1,000</SelectItem>
            <SelectItem value="1000-3000">1,000–3,000</SelectItem>
            <SelectItem value="3000-10000">3,000–10,000</SelectItem>
            <SelectItem value="10000+">10,000+</SelectItem>
          </SelectContent>
        </Select>

        {/* 分组 - 固定宽度 */}
        <Select value={groupBy} onValueChange={v => { setGroupBy(v); setCollapsedGroups({}); }}>
          <SelectTrigger className="w-32 h-8 text-xs shrink-0">
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

        {/* 清除筛选 */}
        {(statusFilter !== "all" || search || orderAmountFilter !== "all" || salesMethodFilter !== "all" || 
          ticketingMethodFilter !== "all" || ticketDateFilter || additionalFeeFilter !== "all" || lotteryBonusFilter !== "all") && (
          <button onClick={() => {
            setStatusFilter("all"); setSearch("");
            setOrderAmountFilter("all"); setSalesMethodFilter("all"); setTicketingMethodFilter("all");
            setTicketDateFilter(null);
            setAdditionalFeeFilter("all"); setLotteryBonusFilter("all");
            resetPage();
          }}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 h-8 px-1 shrink-0">
            <X className="w-3 h-3" />清除
          </button>
        )}

        <div className="ml-auto shrink-0">
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