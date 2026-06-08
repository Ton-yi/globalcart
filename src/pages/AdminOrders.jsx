import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Search, RefreshCw, Filter, ChevronUp, ChevronDown, ChevronsUpDown, Trash2, AlertCircle, Layers, Send, LayoutList, Archive, ArchiveRestore, Scissors, Calculator, CheckCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import AdminOrderEditModal from "@/components/admin/AdminOrderEditModal";
import PreShipmentBadge from "@/components/admin/PreShipmentBadge";
import { getStatusLabel, getStatusColor } from "@/lib/orderStatus";
import ColumnCustomizer from "@/components/orders/ColumnCustomizer";
import { matchStoreTagResult } from "@/lib/onlineStoreTag";
import { ImageWithViewer } from "@/components/common/ImageViewer";
import ShippingPoolDetailModal from "@/components/shippingpool/ShippingPoolDetailModal";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { usePermissions } from "@/hooks/usePermissions";

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
  { key: "product_image_url", label: "商品图片", defaultVisible: false, sortable: false, isImage: true },
  { key: "arrival_photo_url", label: "入库图片", defaultVisible: false, sortable: false, isImage: true },
  { key: "product_description", label: "商品描述", defaultVisible: false, sortable: true },
  { key: "admin_note", label: "管理员备注", defaultVisible: false, sortable: true },
  { key: "user_note", label: "用户订单备注", defaultVisible: false, sortable: true },
  { key: "payment_due_date", label: "付款截止日期", defaultVisible: false, sortable: true },
  { key: "fullpay_once", label: "一次付款", defaultVisible: false, sortable: false, isFullPayOnce: true },
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
        if (!def) return null;
        return { ...def, visible: p.visible, ...(p.imageWidth ? { imageWidth: p.imageWidth } : {}), ...(p.showActual !== undefined ? { showActual: p.showActual } : {}), ...(p.showActualOnly !== undefined ? { showActualOnly: p.showActualOnly } : {}) };
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
  { v: "notified_shipment_fee_pending", l: "待出货待付运费" },
  { v: "notified_shipment_fee_paid", l: "待出货已付运费" },
  { v: "shipping_fee_pending", l: "待付运费" },
  { v: "ready_to_ship", l: "准备发货" },
  { v: "shipped", l: "已发出" },
  { v: "delivered", l: "已收货" },
  { v: "cancelled", l: "已取消" },
];

function formatAmount(amount, currency) {
  if (!amount || amount <= 0) return "-";
  if (currency === "JPY") return `${Math.round(amount).toLocaleString()} yen`;
  if (currency === "CNY") return `${Math.round(amount)} yuan`;
  return `${currency} ${amount.toFixed(2)}`;
}

function CellValue({ col, order, onQuickOrdered, userAvatars, onOpenFullpaySettlement }) {
  switch (col.key) {
    case "order_number": {
      const isSplitPending = order.has_split_marker && !order.parent_order_id && order.split_index !== -1;
      return <span className="font-mono text-xs text-gray-500">{order.order_number ? `${order.order_number}${isSplitPending ? " - 00" : ""}` : "-"}</span>;
    }
    case "user_name": {
      const profile = userAvatars?.[order.user_email] || {};
      const avatarUrl = profile.avatar_url || null;
      const displayName = profile.display_name || order.user_name || order.user_email || "?";
      return (
        <div className="flex items-center gap-2 min-w-0">
          {avatarUrl
            ? <img src={avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0 border border-gray-100" />
            : <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 text-xs text-gray-500 font-medium">
                {displayName[0].toUpperCase()}
              </div>
          }
          <span className="text-sm text-gray-800 truncate">{displayName}</span>
        </div>
      );
    }
    case "product_name":
      return (
        <span className="text-sm font-medium text-gray-900 truncate">{order.product_name}</span>
      );
    case "estimated_jpy":
      return <span className="text-sm text-gray-700">{order.estimated_jpy ? `${Math.round(order.estimated_jpy).toLocaleString()} yen` : "-"}</span>;
    case "prepayment_amount": {
      const amt = order.prepayment_amount;
      const cur = order.prepayment_currency || "JPY";
      // prepayment_amount_jpy: original JPY amount (always preserved)
      const jpyAmt = order.prepayment_amount_jpy || (cur === "JPY" ? amt : null) || order.paid_amount || null;
      const isNonJpy = cur && cur !== "JPY" && amt > 0;

      const mainDisplay = jpyAmt
        ? `${Math.round(jpyAmt).toLocaleString()} yen`
        : formatAmount(amt, cur);

      // showActualOnly: only show actual paid currency (CNY etc.)
      if (col.showActualOnly && isNonJpy) {
        const actualDisplay = cur === "CNY" ? `${Math.round(amt)} 元` : `${cur} ${Number(amt).toFixed(2)}`;
        return <span className="text-sm text-gray-700">{actualDisplay}</span>;
      }
      // showActual: show JPY main + actual currency sub
      if (col.showActual && isNonJpy) {
        const actualSub = cur === "CNY" ? `实付 ${Math.round(amt)} 元` : `实付 ${cur} ${Number(amt).toFixed(2)}`;
        return (
          <div className="flex flex-col gap-0.5">
            <span className="text-sm text-gray-700">{mainDisplay}</span>
            <span className="text-[11px] text-gray-400">{actualSub}</span>
          </div>
        );
      }
      return <span className="text-sm text-gray-700">{mainDisplay}</span>;
    }
    case "weight_g":
      return <span className="text-sm text-gray-700">{order.weight_g ? `${order.weight_g}g` : "-"}</span>;
    case "order_status":
      return (
        <div className="flex flex-col gap-0.5">
          <Badge className={`text-xs ${getStatusColor(order.order_status, "admin")}`}>
            {getStatusLabel(order.order_status, "admin")}
          </Badge>
          {order.order_status === "shipping_fee_pending" && (
            <Badge className="text-xs bg-orange-100 text-orange-700 w-fit">待付运费</Badge>
          )}
        </div>
      );
    case "product_image_url": {
      const imgW = col.imageWidth || 40;
      return order.product_image_url
        ? <ImageWithViewer src={order.product_image_url} alt={order.product_name}>
            <img src={order.product_image_url} alt="" style={{ maxWidth: imgW, maxHeight: imgW, width: "100%", height: "auto" }} className="rounded object-cover border border-gray-100 cursor-pointer" />
          </ImageWithViewer>
        : <span className="text-xs text-gray-300">-</span>;
    }
    case "arrival_photo_url": {
      const imgW = col.imageWidth || 40;
      return order.arrival_photo_url
        ? <ImageWithViewer src={order.arrival_photo_url} alt="入库图片">
            <img src={order.arrival_photo_url} alt="" style={{ maxWidth: imgW, maxHeight: imgW, width: "100%", height: "auto" }} className="rounded object-cover border border-gray-100 cursor-pointer" />
          </ImageWithViewer>
        : <span className="text-xs text-gray-300">-</span>;
    }
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
    case "fullpay_once": {
      // One-time payment order display
      const isFullpayOnce = order.payment_mode === "fullpay_once";
      const config = order.fullpay_once_config;
      
      if (!isFullpayOnce || !config) {
        return <span className="text-xs text-gray-400">-</span>;
      }
      
      const estimatedWeight = config.user_estimated_weight_g || 0;
      const actualWeight = order.weight_g || 0;
      const estimatedFee = config.estimated_shipping_fee_jpy || 0;
      const weightDiff = actualWeight - estimatedWeight;
      const settlementStatus = config.settlement_status || "pending";
      
      // Color coding based on settlement status
      const statusColors = {
        pending: "bg-gray-100 text-gray-600",
        needs_supplement: "bg-orange-100 text-orange-700",
        needs_refund: "bg-blue-100 text-blue-700",
        settled: "bg-green-100 text-green-700"
      };
      
      const statusLabels = {
        pending: "待结算",
        needs_supplement: "待补款",
        needs_refund: "待退款",
        settled: "已结算"
      };
      
      return (
        <div className="flex flex-col gap-1 min-w-[140px]">
          <div className="flex items-center gap-1">
            <Badge className={`text-xs w-fit ${statusColors[settlementStatus]}`}>
              {statusLabels[settlementStatus] || settlementStatus}
            </Badge>
            {settlementStatus === 'pending' && actualWeight === 0 && (
              <button
                onClick={() => {
                  onOpenFullpaySettlement?.(order, {
                    estimatedWeight,
                    estimatedFee,
                    weightDiff: 0,
                    feeDiff: 0
                  });
                }}
                className="text-[10px] text-blue-600 hover:text-blue-800 hover:underline"
              >
                结算
              </button>
            )}
          </div>
          <div className="text-[10px] text-gray-600 space-y-0.5">
            <div className="flex justify-between gap-2">
              <span>预估:</span>
              <span>{estimatedWeight}g / ¥{estimatedFee.toLocaleString()}</span>
            </div>
            {actualWeight > 0 && (
              <div className="flex justify-between gap-2">
                <span>实际:</span>
                <span>{actualWeight}g</span>
              </div>
            )}
            {weightDiff !== 0 && actualWeight > 0 && (
              <div className={`flex justify-between gap-2 ${weightDiff > 0 ? 'text-orange-600 font-medium' : 'text-blue-600 font-medium'}`}>
                <span>差异:</span>
                <span>{weightDiff > 0 ? '+' : ''}{weightDiff}g</span>
              </div>
            )}
          </div>
        </div>
      );
    }
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
  const { user } = useCurrentUser();
  const { can, isAdmin } = usePermissions();
  const canEditOrder = isAdmin || can("order:edit_order");
  const canPlaceOrder = isAdmin || can("order:place_order");
  const canWarehouseIn = isAdmin || can("order:warehouse_in");
  const canArchiveOrder = isAdmin || can("order:archive_order");
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [columns, setColumns] = useState(loadColumns);

  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [groupBy, setGroupBy] = useState("none");
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [storeTagRules, setStoreTagRules] = useState([]);

  const [itemSizeTemplates, setItemSizeTemplates] = useState([]);
  const [pendingEditRequests, setPendingEditRequests] = useState([]);
  const [userProfileMap, setUserProfileMap] = useState({});
  const [shippingPools, setShippingPools] = useState([]);
  const [shippingMethods, setShippingMethods] = useState([]);
  const [boxTemplates, setBoxTemplates] = useState([]);
  const [transitLocations, setTransitLocations] = useState([]);
  const [transitShippingMethods, setTransitShippingMethods] = useState([]);
  const [defaultPackingFeeSingle, setDefaultPackingFeeSingle] = useState(0);
  const [defaultPackingFeeConsolidation, setDefaultPackingFeeConsolidation] = useState(0);
  const [selectedPool, setSelectedPool] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [showFullpaySettlement, setShowFullpaySettlement] = useState(false);
  const [selectedFullpayOrder, setSelectedFullpayOrder] = useState(null);
  const [settlementData, setSettlementData] = useState(null);
  const [actualWeight, setActualWeight] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const r = await base44.functions.invoke('getAdminOrdersPageData', {});
    const { orders: data = [], storeTagRules: rules = [], itemSizeTemplates: templates = [], pendingEditRequests: edits = [], userProfileMap: profiles = {}, shippingPools: pools = [], shippingMethods: sMethods = [], boxTemplates: boxes = [], transitLocations: locs = [], transitShippingMethods: tMethods = [], defaultPackingFeeSingle: pfs = 0, defaultPackingFeeConsolidation: pfc = 0 } = r.data || {};
    setOrders(data);
    setStoreTagRules(rules);
    setItemSizeTemplates(templates);
    setPendingEditRequests(edits);
    setUserProfileMap(profiles);
    setShippingPools(pools);
    setShippingMethods(sMethods);
    setBoxTemplates(boxes);
    setTransitLocations(locs);
    setTransitShippingMethods(tMethods);
    setDefaultPackingFeeSingle(pfs);
    setDefaultPackingFeeConsolidation(pfc);
    setLoading(false);
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  if (user && !isAdmin && !can("order:update")) {
    return <div className="text-center py-8 text-red-600">无访问权限</div>;
  }

  const handleColumnsChange = (newCols) => {
    setColumns(newCols);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newCols.map(c => ({
      key: c.key,
      visible: c.visible,
      ...(c.imageWidth ? { imageWidth: c.imageWidth } : {}),
      ...(c.showActual !== undefined ? { showActual: c.showActual } : {}),
      ...(c.showActualOnly !== undefined ? { showActualOnly: c.showActualOnly } : {}),
    }))));
  };

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const handleArchiveOrder = async (order) => {
    await base44.functions.invoke('updateTenantOrder', { order_id: order.id, is_archived: true, archived_at: new Date().toISOString() });
    fetchOrders();
  };

  const handleUnarchiveOrder = async (order) => {
    await base44.functions.invoke('updateTenantOrder', { order_id: order.id, is_archived: false, archived_at: "" });
    fetchOrders();
  };

  const handleDeleteOrder = async (order) => {
    if (!window.confirm(`确认永久删除订单"${order.product_name}"？此操作不可撤销。`)) return;
    await base44.functions.invoke('mutateTenantEntity', { entity: 'Order', action: 'delete', id: order.id });
    fetchOrders();
  };

  const filtered = orders.filter(o => {
    if (showArchived ? !o.is_archived : !!o.is_archived) return false;
    // Hide split-parent placeholder orders (split_index === -1 means already split into children)
    if (o.split_index === -1) return false;
    const matchStatus = statusFilter === "all" || o.order_status === statusFilter;
    const q = search.toLowerCase();
    const displayName = (userProfileMap[o.user_email]?.display_name || o.user_name || "").toLowerCase();
    const matchSearch = !q ||
      (o.product_name || "").toLowerCase().includes(q) ||
      (o.order_number || "").toLowerCase().includes(q) ||
      (o.user_email || "").toLowerCase().includes(q) ||
      (o.user_name || "").toLowerCase().includes(q) ||
      displayName.includes(q);
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

  // Bulk quick actions: compute shared status of selected orders
  const selectedOrders = orders.filter(o => selectedIds.includes(o.id));
  const uniqueSelectedStatuses = [...new Set(selectedOrders.map(o => o.order_status))];
  const sharedStatus = uniqueSelectedStatuses.length === 1 ? uniqueSelectedStatuses[0] : null;

  const handleBulkQuickOrdered = async () => {
    setBulkUpdating(true);
    await Promise.all(selectedIds.map(id =>
      base44.functions.invoke('updateTenantOrder', { order_id: id, order_status: "purchased", purchased_date: new Date().toISOString().split("T")[0] })
    ));
    setBulkUpdating(false);
    setSelectedIds([]);
    fetchOrders();
  };

  const handleBulkInWarehouse = async () => {
    setBulkUpdating(true);
    await Promise.all(selectedIds.map(id =>
      base44.functions.invoke('updateTenantOrder', { order_id: id, order_status: "in_warehouse", in_warehouse_date: new Date().toISOString().split("T")[0] })
    ));
    setBulkUpdating(false);
    setSelectedIds([]);
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

  // Find the shipping pool for a notified_shipment order
  const getOrderPool = (order) => shippingPools.find(p => (p.order_ids || []).includes(order.id)) || null;

  const handleOpenPool = async (pool) => {
    // Check if it's an official pool
    const isOfficialPool = pool.is_admin_created === true;
    
    // If official pool, navigate to official pool kanban page
    if (isOfficialPool) {
      window.location.href = '/AdminShippingPool?view=official';
      return;
    }
    
    // Always fetch full pool data (shippingPools in state is a trimmed summary)
    const r = await base44.functions.invoke('getTenantShippingPools', {});
    const fullPool = (r.data?.pools || []).find(p => p.id === pool.id);
    setSelectedPool(fullPool || pool);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold text-gray-900">订单管理</h1>
        <div className="flex items-center gap-2">
          <ColumnCustomizer columns={columns} onChange={handleColumnsChange} />
          <Button variant="outline" size="sm" onClick={() => { setShowArchived(v => !v); setSelectedIds([]); }}>
            {showArchived ? <><ArchiveRestore className="w-3.5 h-3.5 mr-1.5" />返回订单列表</> : <><Archive className="w-3.5 h-3.5 mr-1.5" />查看已存档</>}
          </Button>
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
        <Select value={groupBy} onValueChange={v => { setGroupBy(v); setCollapsedGroups({}); }}>
          <SelectTrigger className="w-36 h-8 text-sm">
            <LayoutList className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">不分组</SelectItem>
            <SelectItem value="user_name">按用户名</SelectItem>
            <SelectItem value="order_status">按订单状态</SelectItem>
            <SelectItem value="online_store_tag">按商城标签</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk actions */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 sticky top-14 z-30 shadow-md">
          <span className="text-sm text-blue-700 font-medium shrink-0">已选 {selectedIds.length} 条</span>

          {/* Context-aware quick actions when all selected share the same status */}
          {sharedStatus && (
            <div className="flex items-center gap-1.5 border-r border-blue-200 pr-2 mr-1">
              <span className="text-xs text-blue-500 shrink-0">快捷操作：</span>
              {(sharedStatus === "paid" || sharedStatus === "pending_purchase") && (
                <Button size="sm" className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700"
                  onClick={handleBulkQuickOrdered} disabled={bulkUpdating}>
                  {bulkUpdating ? "处理中..." : `一键标记已下单（${selectedIds.length} 条）`}
                </Button>
              )}

              {sharedStatus === "in_warehouse" && (
                <Button size="sm" className="h-7 text-xs bg-orange-600 hover:bg-orange-700"
                  onClick={async () => {
                    setBulkUpdating(true);
                    await Promise.all(selectedIds.map(id =>
                      base44.functions.invoke('updateTenantOrder', { order_id: id, order_status: "ready_to_ship" })
                    ));
                    setBulkUpdating(false);
                    setSelectedIds([]);
                    fetchOrders();
                  }} disabled={bulkUpdating}>
                  {bulkUpdating ? "处理中..." : `一键待发货（${selectedIds.length} 条）`}
                </Button>
              )}
              {sharedStatus === "ready_to_ship" && (
                <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700"
                  onClick={async () => {
                    setBulkUpdating(true);
                    await Promise.all(selectedIds.map(id =>
                      base44.functions.invoke('updateTenantOrder', { order_id: id, order_status: "shipped", shipped_date: new Date().toISOString().split("T")[0] })
                    ));
                    setBulkUpdating(false);
                    setSelectedIds([]);
                    fetchOrders();
                  }} disabled={bulkUpdating}>
                  {bulkUpdating ? "处理中..." : `一键发货（${selectedIds.length} 条）`}
                </Button>
              )}
              {sharedStatus === "shipped" && (
                <Button size="sm" className="h-7 text-xs bg-green-700 hover:bg-green-800"
                  onClick={async () => {
                    setBulkUpdating(true);
                    await Promise.all(selectedIds.map(id =>
                      base44.functions.invoke('updateTenantOrder', { order_id: id, order_status: "delivered" })
                    ));
                    setBulkUpdating(false);
                    setSelectedIds([]);
                    fetchOrders();
                  }} disabled={bulkUpdating}>
                  {bulkUpdating ? "处理中..." : `一键签收（${selectedIds.length} 条）`}
                </Button>
              )}
            </div>
          )}

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
                {groupBy === "none" ? (
                  <Checkbox checked={selectedIds.length === filtered.length && filtered.length > 0}
                    onCheckedChange={toggleAll} />
                ) : null}
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
            ) : (() => {
              const renderOrderRow = (order) => {
                const pendingEdit = pendingEditRequests.find(r => r.order_id === order.id);
                return (
                  <tr key={order.id} className={`hover:bg-gray-50 cursor-pointer ${pendingEdit ? "bg-orange-50/60" : ""}`} onClick={() => handleStatusClick(order)}>
                    <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                      <Checkbox checked={selectedIds.includes(order.id)} onCheckedChange={() => toggleSelect(order.id)} />
                    </td>
                    {visibleCols.map(col => (
                      <td key={col.key} className="px-3 py-3 max-w-[220px]">
                        <CellValue 
                          col={{ ...col, _rules: storeTagRules }} 
                          order={order} 
                          onQuickOrdered={handleQuickOrdered} 
                          userAvatars={userProfileMap}
                          onOpenFullpaySettlement={(order, data) => {
                            setSelectedFullpayOrder(order);
                            setSettlementData(data);
                            setShowFullpaySettlement(true);
                          }}
                        />
                      </td>
                    ))}
                    <td className="px-3 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      <div className="flex flex-wrap gap-1 items-center">
                        {(order.unread_roles || []).includes("admin") && (
                          <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-600 border border-red-200 px-1.5 py-0.5 rounded-full font-medium animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />新消息
                          </span>
                        )}
                        {order.order_status === "in_warehouse" && (order.messages || []).some(m => m.split_request && m.split_request.status === "pending") && (
                          <span className="inline-flex items-center gap-1 text-xs bg-indigo-100 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded-full font-medium animate-pulse">
                            <Scissors className="w-3 h-3" />申请拆单
                          </span>
                        )}
                        {order.has_split_marker && !order.parent_order_id && order.split_index !== -1 && (
                          <span className="inline-flex items-center gap-1 text-xs bg-indigo-100 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded-full font-medium">
                            <span className="text-[10px]">✂</span>待拆分
                          </span>
                        )}
                        {order.parent_order_id && (
                          <span className="inline-flex items-center gap-1 text-xs bg-purple-100 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded-full font-medium">
                            子 -{String(order.split_index || 0).padStart(2, '0')}
                          </span>
                        )}
                        {pendingEdit && (
                          <span className="inline-flex items-center gap-1 text-xs bg-orange-100 text-orange-700 border border-orange-300 px-1.5 py-0.5 rounded-full font-medium">
                            <AlertCircle className="w-3 h-3" />
                            {pendingEdit.edit_type === 'cancel_shipment' ? '申请重新入库' : '申请移至其他发货申请'}
                          </span>
                        )}
                        {(order.order_status === "paid" || order.order_status === "pending_purchase") && canPlaceOrder && (
                          order.has_split_marker
                            ? <Button size="sm" variant="outline" className="h-6 text-xs px-2 text-indigo-600 border-indigo-200"
                                onClick={() => setSelectedOrder(order)}>
                                查看详情
                              </Button>
                            : <Button size="sm" variant="outline" className="h-6 text-xs px-2 text-indigo-600 border-indigo-200"
                                onClick={() => handleQuickOrdered(order)}>
                                已下单
                              </Button>
                        )}
                        {order.order_status === "purchased" && order.pre_shipment && (
                          <PreShipmentBadge preShipment={order.pre_shipment} />
                        )}
                        {order.order_status === "purchased" && canWarehouseIn && (
                          <Button size="sm" variant="outline" className="h-6 text-xs px-2 text-teal-600 border-teal-200"
                            onClick={() => handleQuickInWarehouse(order)}>
                            入库
                          </Button>
                        )}
                        {order.order_status === "shipping_fee_pending" && (() => {
                          const pool = getOrderPool(order);
                          if (!pool) return null;
                          const isConsolidation = pool.consolidation_type && pool.consolidation_type !== "";
                          return (
                            <Button size="sm" variant="outline"
                              className={`h-6 text-xs px-2 ${isConsolidation ? "text-purple-600 border-purple-200 hover:bg-purple-50" : "text-orange-600 border-orange-200 hover:bg-orange-50"}`}
                              onClick={() => handleOpenPool(pool)}>
                              {isConsolidation ? <><Layers className="w-3 h-3 mr-1" />查看拼邮</> : <><Send className="w-3 h-3 mr-1" />查看发货申请</>}
                            </Button>
                          );
                        })()}
                        {(() => {
                          const pool = getOrderPool(order);
                          if (!pool) return null;
                          if (order.order_status === "shipping_fee_pending") return null; // already shown above
                          const isConsolidation = pool.consolidation_type && pool.consolidation_type !== "";
                          const isOfficialPool = pool.is_admin_created === true;
                          return (
                            <Button size="sm" variant="outline"
                              className={`h-6 text-xs px-2 ${isOfficialPool ? "text-blue-600 border-blue-200 hover:bg-blue-50" : isConsolidation ? "text-purple-600 border-purple-200 hover:bg-purple-50" : "text-teal-600 border-teal-200 hover:bg-teal-50"}`}
                              onClick={() => handleOpenPool(pool)}>
                              {isOfficialPool
                                ? <><Layers className="w-3 h-3 mr-1" />查看官方拼邮</>
                                : isConsolidation
                                ? <><Layers className="w-3 h-3 mr-1" />查看拼邮</>
                                : <><Send className="w-3 h-3 mr-1" />查看发货申请</>}
                            </Button>
                          );
                        })()}
                        {order.order_status === "cancelled" && (
                          <Button size="sm" variant="outline" className="h-6 text-xs px-2 text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => handleDeleteCancelled(order)}>
                            <Trash2 className="w-3 h-3 mr-1" />删除
                          </Button>
                        )}
                        {!showArchived && (order.order_status === "delivered" || order.order_status === "cancelled") && !order.is_archived && canArchiveOrder && (
                          <Button size="sm" variant="outline" className="h-6 text-xs px-2 text-gray-500 border-gray-200 hover:bg-gray-50"
                            onClick={() => handleArchiveOrder(order)}>
                            <Archive className="w-3 h-3 mr-1" />存档
                          </Button>
                        )}
                        {showArchived && (
                          <>
                            <Button size="sm" variant="outline" className="h-6 text-xs px-2 text-blue-500 border-blue-200 hover:bg-blue-50"
                              onClick={() => handleUnarchiveOrder(order)}>
                              <ArchiveRestore className="w-3 h-3 mr-1" />取消存档
                            </Button>
                            <Button size="sm" variant="outline" className="h-6 text-xs px-2 text-red-500 border-red-200 hover:bg-red-50"
                              onClick={() => handleDeleteOrder(order)}>
                              <Trash2 className="w-3 h-3 mr-1" />删除
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              };

              if (groupBy === "none") return filtered.map(renderOrderRow);

              // Build groups
              const getGroupKey = (order) => {
                if (groupBy === "user_name") {
                  return userProfileMap[order.user_email]?.display_name || order.user_name || order.user_email || "未知用户";
                }
                if (groupBy === "order_status") {
                  // Merge all notified_shipment* into one group
                  const NOTIFIED_GROUP = "已通知出货";
                  if (["notified_shipment", "notified_shipment_fee_pending", "notified_shipment_fee_paid"].includes(order.order_status)) {
                    return NOTIFIED_GROUP;
                  }
                  return ALL_STATUSES.find(s => s.v === order.order_status)?.l || getStatusLabel(order.order_status, "admin") || order.order_status || "未知状态";
                }
                if (groupBy === "online_store_tag") {
                  const firstUrl = (order.product_url || "").split("\n").map(s => s.trim()).filter(Boolean)[0] || "";
                  return matchStoreTagResult(firstUrl, storeTagRules).tag_label || "其它";
                }
                return "其它";
              };

              const groups = {};
              filtered.forEach(order => {
                const key = getGroupKey(order);
                if (!groups[key]) groups[key] = [];
                groups[key].push(order);
              });

              // Sort groups: for order_status, follow ALL_STATUSES order; others alphabetically
              const groupEntries = Object.entries(groups);
              if (groupBy === "order_status") {
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
                // Find avatar for user_name grouping
                const groupUserEmail = groupBy === "user_name" ? groupOrders[0]?.user_email : null;
                const groupUserProfile = groupUserEmail ? (userProfileMap[groupUserEmail] || {}) : null;
                const groupAvatarUrl = groupUserProfile?.avatar_url || null;
                return [
                  <tr key={`group-${groupKey}`} className="bg-gray-100 border-y border-gray-200">
                    <td className="px-3 py-2 w-8" onClick={e => e.stopPropagation()}>
                      {!isCollapsed && (
                        <Checkbox
                          checked={groupOrders.length > 0 && groupOrders.every(o => selectedIds.includes(o.id))}
                          onCheckedChange={() => {
                            const ids = groupOrders.map(o => o.id);
                            const allSelected = ids.every(id => selectedIds.includes(id));
                            if (allSelected) setSelectedIds(prev => prev.filter(id => !ids.includes(id)));
                            else setSelectedIds(prev => [...new Set([...prev, ...ids])]);
                          }}
                        />
                      )}
                    </td>
                    <td colSpan={visibleCols.length + 1} className="px-3 py-2">
                      <button
                        className="flex items-center gap-2 text-xs font-semibold text-gray-700 hover:text-gray-900 w-full text-left"
                        onClick={() => setCollapsedGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }))}
                      >
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isCollapsed ? "-rotate-90" : ""}`} />
                        {groupBy === "user_name" && (
                          groupAvatarUrl
                            ? <img src={groupAvatarUrl} alt="" className="w-5 h-5 rounded-full object-cover border border-gray-200 flex-shrink-0" />
                            : <div className="w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 text-[10px] font-medium flex-shrink-0">{groupKey[0]?.toUpperCase()}</div>
                        )}
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

      <div className="text-xs text-gray-400 text-right">{showArchived ? `已存档订单：${filtered.length} 条` : `共 ${filtered.length} 条`}</div>

      {selectedOrder && canEditOrder && (
        <AdminOrderEditModal
          order={selectedOrder}
          initialItemSizeTemplates={itemSizeTemplates}
          shippingPools={shippingPools}
          currentUser={user}
          userProfileMap={userProfileMap}
          onClose={() => setSelectedOrder(null)}
          onSaved={() => { setSelectedOrder(null); fetchOrders(); }}
          onOpenPool={async (poolId, isOfficialPool = false) => {
            setSelectedOrder(null);
            if (!poolId) return;
            
            // If official pool, navigate to official pool kanban page
            if (isOfficialPool) {
              // Navigate to official pool kanban - the page will load all official pools
              window.location.href = '/AdminShippingPool?view=official';
              return;
            }
            
            // For non-official pools, open the detail modal
            // Always fetch full pool data (local shippingPools is a trimmed summary)
            const r = await base44.functions.invoke('getTenantShippingPools', {});
            const pool = (r.data?.pools || []).find(p => p.id === poolId);
            if (pool) setSelectedPool(pool);
          }}
        />
      )}

      {selectedPool && user && (
        <ShippingPoolDetailModal
          pool={selectedPool}
          isAdmin={true}
          currentUser={user}
          pendingEditRequests={pendingEditRequests.filter(r => r.pool_id === selectedPool.id)}
          boxTemplates={boxTemplates}
          shippingMethods={shippingMethods}
          transitLocations={transitLocations}
          transitShippingMethods={transitShippingMethods}
          defaultPackingFeeSingle={defaultPackingFeeSingle}
          defaultPackingFeeConsolidation={defaultPackingFeeConsolidation}
          onClose={() => setSelectedPool(null)}
          onUpdated={() => { setSelectedPool(null); fetchOrders(); }}
        />
      )}

      {/* One-time payment settlement modal */}
      {showFullpaySettlement && selectedFullpayOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">一次付款结算</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">订单号：</span>
                <span className="font-mono">{selectedFullpayOrder.order_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">用户：</span>
                <span>{selectedFullpayOrder.user_name}</span>
              </div>
              <div className="border-t pt-3 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">预估重量：</span>
                  <span>{settlementData?.estimatedWeight}g</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">预估运费：</span>
                  <span>¥{settlementData?.estimatedFee?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">实际重量：</span>
                  <Input
                    type="number"
                    value={actualWeight}
                    onChange={(e) => setActualWeight(e.target.value)}
                    className="w-24 h-7 text-right"
                    placeholder="输入实际重量"
                  />
                </div>
              </div>
              {settlementData && actualWeight && (
                <div className="bg-gray-50 p-3 rounded border">
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-500">重量差异：</span>
                    <span className={settlementData.weightDiff > 0 ? 'text-orange-600 font-medium' : 'text-blue-600 font-medium'}>
                      {settlementData.weightDiff > 0 ? '+' : ''}{settlementData.weightDiff}g
                      ({actualWeight}g - {settlementData.estimatedWeight}g)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">运费差异：</span>
                    <span className={settlementData.feeDiff > 0 ? 'text-orange-600 font-medium' : 'text-blue-600 font-medium'}>
                      {settlementData.feeDiff > 0 ? '+' : '¥'}{Math.abs(settlementData.feeDiff).toLocaleString()} JPY
                    </span>
                  </div>
                  <div className="flex justify-between mt-2 pt-2 border-t">
                    <span className="font-semibold">结算状态：</span>
                    <span className={settlementData.feeDiff > 0 ? 'text-orange-600 font-bold' : settlementData.feeDiff < 0 ? 'text-blue-600 font-bold' : 'text-green-600 font-bold'}>
                      {settlementData.feeDiff > 0 ? '需补款' : settlementData.feeDiff < 0 ? '需退款' : '已结清'}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowFullpaySettlement(false);
                  setSelectedFullpayOrder(null);
                  setActualWeight("");
                }}
                className="flex-1"
              >
                取消
              </Button>
              <Button
                onClick={async () => {
                  if (!actualWeight) {
                    alert('请输入实际重量');
                    return;
                  }
                  setIsProcessing(true);
                  try {
                    const weight = parseFloat(actualWeight);
                    await base44.functions.invoke('updateTenantOrder', {
                      order_id: selectedFullpayOrder.id,
                      weight_g: weight,
                      update_fullpay_settlement: true
                    });
                    alert('结算完成');
                    setShowFullpaySettlement(false);
                    setSelectedFullpayOrder(null);
                    setActualWeight("");
                    fetchOrders();
                  } catch (error) {
                    alert('结算失败：' + error.message);
                  } finally {
                    setIsProcessing(false);
                  }
                }}
                disabled={isProcessing || !actualWeight}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {isProcessing ? '处理中...' : '确认结算'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}