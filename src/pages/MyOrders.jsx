import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Package, RefreshCw, Search, CreditCard, Truck, CheckCircle, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { ImageWithViewer } from "@/components/common/ImageViewer";
import BulkPaymentModal from "@/components/orders/BulkPaymentModal";
import { matchStoreTagResult } from "@/lib/onlineStoreTag";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getStatusLabel, getStatusColor } from "@/lib/orderStatus";
import OrderDetailDrawer from "@/components/orders/OrderDetailDrawer";
import ColumnCustomizer from "@/components/orders/ColumnCustomizer";
import PaymentModal from "@/components/orders/PaymentModal";
import UserNotifyShipmentModal from "@/components/orders/UserNotifyShipmentModal";
import ShippingEditModal from "@/components/shippingpool/ShippingEditModal";

const STORAGE_KEY = "my_orders_columns";

const ALL_COLUMNS = [
  { key: "product_image_url", label: "商品图片", defaultVisible: true, sortable: false, isImage: true },
  { key: "order_number", label: "订单号", defaultVisible: true, sortable: true },
  { key: "product_name", label: "商品名", defaultVisible: true, sortable: true },
  { key: "prepayment_amount", label: "付款金额", defaultVisible: true, sortable: true },
  { key: "weight_g", label: "订单重量", defaultVisible: true, sortable: true },
  { key: "order_status", label: "订单状态", defaultVisible: true, sortable: true },
  { key: "online_store_tag", label: "商城标签", defaultVisible: false, sortable: true },
  { key: "product_description", label: "商品描述", defaultVisible: false, sortable: true },
  { key: "arrival_photo_url", label: "入库图片", defaultVisible: false, sortable: false, isImage: true },
  { key: "admin_note", label: "管理员备注", defaultVisible: false, sortable: true },
  { key: "user_note", label: "用户备注", defaultVisible: false, sortable: true },
  { key: "payment_due_date", label: "付款截止日", defaultVisible: false, sortable: true },
  { key: "submit_date", label: "订单提交日", defaultVisible: false, sortable: true },
  { key: "purchased_date", label: "下单日", defaultVisible: false, sortable: true },
  { key: "in_warehouse_date", label: "入库日", defaultVisible: false, sortable: true },
  { key: "shipped_date", label: "发货日", defaultVisible: false, sortable: true },
];

const DEFAULT_COLUMNS = ALL_COLUMNS.map(c => ({ ...c, visible: c.defaultVisible }));

function loadColumns() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return DEFAULT_COLUMNS;
    const parsed = JSON.parse(saved);
    const keyOrder = parsed.map(c => c.key);
    return [
      ...parsed.map(p => {
        const def = ALL_COLUMNS.find(c => c.key === p.key);
        return def ? { ...def, visible: p.visible, ...(p.imageWidth ? { imageWidth: p.imageWidth } : {}) } : null;
      }).filter(Boolean),
      ...ALL_COLUMNS.filter(c => !keyOrder.includes(c.key)).map(c => ({ ...c, visible: c.defaultVisible })),
    ];
  } catch {
    return DEFAULT_COLUMNS;
  }
}

const STATUS_FILTERS = [
  { v: "all", l: "全部" },
  { v: "payment_pending", l: "待付款" },
  { v: "paid", l: "已付款" },
  { v: "purchased", l: "已下单" },
  { v: "in_warehouse", l: "已入库" },
  { v: "notified_shipment", l: "已通知出货" },
  { v: "shipping_fee_pending", l: "待付运费" },
  { v: "shipped", l: "已发出" },
  { v: "delivered", l: "已收货" },
  { v: "cancelled", l: "已取消" },
];

function CellValue({ col, order }) {
  switch (col.key) {
    case "product_image_url": {
      const imgW = col.imageWidth || 40;
      return order.product_image_url
        ? <ImageWithViewer src={order.product_image_url} alt={order.product_name}>
            <img src={order.product_image_url} alt="" style={{ maxWidth: imgW, maxHeight: imgW, width: "100%", height: "auto" }} className="rounded-lg object-cover border border-gray-100 cursor-pointer" />
          </ImageWithViewer>
        : <div style={{ width: imgW, height: imgW }} className="rounded-lg bg-gray-100 flex items-center justify-center">
            <Package className="w-5 h-5 text-gray-300" />
          </div>;
    }
    case "order_number":
      return <span className="font-mono text-xs text-gray-500">{order.order_number || "-"}</span>;
    case "product_name":
      return (
        <span className="text-sm font-medium text-gray-900 truncate">{order.product_name}</span>
      );
    case "prepayment_amount": {
      const val = order.prepayment_amount;
      const cur = order.prepayment_currency;
      let display = "-";
      if (val > 0) {
        if (cur === "JPY") display = `${Math.round(val).toLocaleString()} yen`;
        else if (cur === "CNY") display = `${Math.round(val)} yuan`;
        else display = `${cur} ${val.toFixed(2)}`;
      }
      return <span className="text-sm text-gray-700">{display}</span>;
    }
    case "weight_g":
      return <span className="text-sm text-gray-700">{order.weight_g ? `${order.weight_g}g` : "-"}</span>;
    case "order_status":
      return (
        <Badge className={`text-xs ${getStatusColor(order.order_status, "user")}`}>
          {getStatusLabel(order.order_status, "user")}
        </Badge>
      );
    case "product_description":
      return <span className="text-xs text-gray-600 line-clamp-2 max-w-[200px]">{order.product_description || "-"}</span>;
    case "arrival_photo_url": {
      const imgW2 = col.imageWidth || 40;
      return order.arrival_photo_url
        ? <ImageWithViewer src={order.arrival_photo_url} alt="入库图片">
            <img src={order.arrival_photo_url} alt="" style={{ maxWidth: imgW2, maxHeight: imgW2, width: "100%", height: "auto" }} className="rounded object-cover border border-gray-100 cursor-pointer" />
          </ImageWithViewer>
        : <span className="text-xs text-gray-300">-</span>;
    }
    case "admin_note":
      return <span className="text-xs text-gray-600 line-clamp-2 max-w-[200px]">{order.admin_note || "-"}</span>;
    case "user_note":
      return <span className="text-xs text-gray-600 line-clamp-2 max-w-[200px]">{order.user_note || "-"}</span>;
    case "payment_due_date":
      return <span className="text-xs text-gray-700">{order.payment_due_date || "-"}</span>;
    case "submit_date":
      return <span className="text-xs text-gray-700">{order.created_date ? new Date(order.created_date).toLocaleDateString("zh-CN") : "-"}</span>;
    case "online_store_tag": {
      const tagRules = col._rules || [];
      const firstUrl = (order.product_url || "").split("\n").map(s => s.trim()).filter(Boolean)[0] || "";
      const tagResult = matchStoreTagResult(firstUrl, tagRules);
      return <Badge className={`text-xs ${tagResult.tag_color}`}>{tagResult.tag_label}</Badge>;
    }
    case "purchased_date":

      return <span className="text-xs text-gray-700">{order.purchased_date ? new Date(order.purchased_date).toLocaleDateString("zh-CN") : "-"}</span>;
    case "in_warehouse_date":
      return <span className="text-xs text-gray-700">{order.in_warehouse_date ? new Date(order.in_warehouse_date).toLocaleDateString("zh-CN") : "-"}</span>;
    case "shipped_date":
      return <span className="text-xs text-gray-700">{order.shipped_date ? new Date(order.shipped_date).toLocaleDateString("zh-CN") : "-"}</span>;
    default:
      return "-";
  }
}

export default function MyOrders() {
  const { user, loading: authLoading } = useCurrentUser();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alipayReturnMsg, setAlipayReturnMsg] = useState(null);

  // Handle Alipay sync return: clean up URL params and show a notice
  const [isAlipayReturn, setIsAlipayReturn] = useState(() => {
    // Check synchronously at init time before any history manipulation
    return !!new URLSearchParams(window.location.search).get("out_trade_no");
  });
  const [alipayTradeNo] = useState(() => {
    return new URLSearchParams(window.location.search).get("out_trade_no") || null;
  });

  useEffect(() => {
    if (alipayTradeNo) {
      setAlipayReturnMsg(`支付宝付款已提交（单号: ${alipayTradeNo}），系统将在数分钟内自动确认订单状态。`);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);


  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [paymentOrder, setPaymentOrder] = useState(null);
  const [shipmentOrder, setShipmentOrder] = useState(null);
  const [shipmentOrders, setShipmentOrders] = useState(null); // multi-order bulk
  const [bulkPaymentOrders, setBulkPaymentOrders] = useState(null); // multi-order bulk payment
  const [editShipOrder, setEditShipOrder] = useState(null); // order being edit-shipped
  const [editShipPool, setEditShipPool] = useState(null); // current pool of that order
  const [shippingPools, setShippingPools] = useState([]); // cached pools for lookup
  const [selectedIds, setSelectedIds] = useState([]);
  const [columns, setColumns] = useState(loadColumns);
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [storeTagRules, setStoreTagRules] = useState([]);

  const [pageData, setPageData] = useState({});
  const [pendingEditRequests, setPendingEditRequests] = useState([]);

  const fetchOrders = async (u) => {
    if (!u) return;
    setLoading(true);
    const r = await base44.functions.invoke('getMyOrdersPageData', {});
    const data = r.data || {};
    setOrders(data.orders || []);
    setShippingPools(data.pools || []);
    setStoreTagRules(data.storeTagRules || []);
    setPageData(data);
    setPendingEditRequests(data.pendingEditRequests || []);
    setLoading(false);
  };

  useEffect(() => {
    if (user) {
      fetchOrders(user);
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [user, authLoading]);

  // On Alipay return: the page was fully reloaded, so auth may not be ready on first render.
  // We wait for user to be ready, then fetch. Also retry once after 3s for the callback to settle.
  useEffect(() => {
    if (!isAlipayReturn || !user) return;
    // Immediate fetch (user is now ready)
    fetchOrders(user);
    // Retry after 3s in case alipay callback hasn't updated the order yet
    const timer = setTimeout(() => fetchOrders(user), 3000);
    return () => clearTimeout(timer);
  }, [isAlipayReturn, user?.email]);

  const handleColumnsChange = (newCols) => {
    setColumns(newCols);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newCols.map(c => ({
      key: c.key,
      visible: c.visible,
      ...(c.imageWidth ? { imageWidth: c.imageWidth } : {}),
    }))));
  };

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const handleConfirmDelivered = async (order) => {
    await base44.functions.invoke('updateTenantOrder', { order_id: order.id, order_status: "delivered" });
    fetchOrders(user);
  };

  const filtered = orders.filter(o => {
    const matchStatus = statusFilter === "all" || o.order_status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      (o.product_name || "").toLowerCase().includes(q) ||
      (o.order_number || "").toLowerCase().includes(q);
    return matchStatus && matchSearch;
  }).sort((a, b) => {
    if (!sortKey) return 0;
    const rk = sortKey === "submit_date" ? "created_date" : sortKey;
    let va = a[rk], vb = b[rk];
    if (typeof va === "string" && typeof vb === "string") { va = va.toLowerCase(); vb = vb.toLowerCase(); }
    if (va == null) va = ""; if (vb == null) vb = "";
    if (va < vb) return sortDir === "asc" ? -1 : 1;
    if (va > vb) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const visibleCols = columns.filter(c => c.visible);

  // Orders eligible for bulk notify (in_warehouse only)
  const inWarehouseOrders = filtered.filter(o => o.order_status === "in_warehouse");
  const selectedInWarehouse = filtered.filter(o => selectedIds.includes(o.id) && o.order_status === "in_warehouse");

  // Orders eligible for bulk payment
  const paymentPendingOrders = filtered.filter(o => o.order_status === "payment_pending" && o.payment_status !== "awaiting_confirmation");
  const selectedPaymentPending = filtered.filter(o => selectedIds.includes(o.id) && o.order_status === "payment_pending" && o.payment_status !== "awaiting_confirmation");

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleAllInWarehouse = () => {
    const ids = inWarehouseOrders.map(o => o.id);
    const allSelected = ids.every(id => selectedIds.includes(id));
    if (allSelected) setSelectedIds(prev => prev.filter(id => !ids.includes(id)));
    else setSelectedIds(prev => [...new Set([...prev, ...ids])]);
  };

  const toggleAllPaymentPending = () => {
    const ids = paymentPendingOrders.map(o => o.id);
    const allSelected = ids.every(id => selectedIds.includes(id));
    if (allSelected) setSelectedIds(prev => prev.filter(id => !ids.includes(id)));
    else setSelectedIds(prev => [...new Set([...prev, ...ids])]);
  };

  return (
    <div className="space-y-4">
      {alipayReturnMsg && (
        <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800">
          <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-green-600" />
          <span>{alipayReturnMsg}</span>
          <button className="ml-auto text-green-500 hover:text-green-700" onClick={() => setAlipayReturnMsg(null)}>✕</button>
        </div>
      )}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold text-gray-900">我的订单</h1>
        <div className="flex items-center gap-2">
          <ColumnCustomizer columns={columns} onChange={handleColumnsChange} />
          <Button variant="outline" size="sm" onClick={() => fetchOrders(user)}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />刷新
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <Input placeholder="搜索商品名、订单号..." className="pl-8 h-8 text-sm"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Bulk action bars */}
      {selectedInWarehouse.length > 0 && (
        <div className="flex items-center gap-3 bg-teal-50 border border-teal-200 rounded-xl px-4 py-2.5">
          <span className="text-sm text-teal-700 font-medium">已选 {selectedInWarehouse.length} 件已入库包裹</span>
          <Button size="sm" className="h-7 text-xs bg-teal-600 hover:bg-teal-700 ml-auto"
            onClick={() => setShipmentOrders(selectedInWarehouse)}>
            <Truck className="w-3 h-3 mr-1" />批量通知发货
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs"
            onClick={() => setSelectedIds([])}>取消</Button>
        </div>
      )}
      {selectedPaymentPending.length > 1 && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
          <span className="text-sm text-red-700 font-medium">已选 {selectedPaymentPending.length} 笔待付款订单</span>
          <Button size="sm" className="h-7 text-xs bg-red-600 hover:bg-red-700 ml-auto"
            onClick={() => setBulkPaymentOrders(selectedPaymentPending)}>
            <CreditCard className="w-3 h-3 mr-1" />批量付款
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs"
            onClick={() => setSelectedIds([])}>取消</Button>
        </div>
      )}

      {/* Orders table */}
      <div className="border border-gray-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="w-8 px-3 py-2">
                {(inWarehouseOrders.length > 0 || paymentPendingOrders.length > 0) && (
                  <Checkbox
                    checked={
                      [...inWarehouseOrders, ...paymentPendingOrders].length > 0 &&
                      [...inWarehouseOrders, ...paymentPendingOrders].every(o => selectedIds.includes(o.id))
                    }
                    onCheckedChange={() => {
                      const all = [...inWarehouseOrders, ...paymentPendingOrders];
                      const allSelected = all.every(o => selectedIds.includes(o.id));
                      if (allSelected) setSelectedIds(prev => prev.filter(id => !all.map(o => o.id).includes(id)));
                      else setSelectedIds(prev => [...new Set([...prev, ...all.map(o => o.id)])]);
                    }}
                  />
                )}
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
              <tr>
                <td colSpan={visibleCols.length + 2} className="py-16">
                  <div className="flex flex-col items-center text-gray-400">
                    <Package className="w-10 h-10 mb-3 opacity-30" />
                    <p className="text-sm">暂无订单</p>
                  </div>
                </td>
              </tr>
            ) : filtered.map(order => (
              <tr key={order.id} className={`hover:bg-gray-50 cursor-pointer ${selectedIds.includes(order.id) ? "bg-teal-50/50" : ""}`}
                onClick={() => setSelectedOrder(order)}>
                <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                  {(order.order_status === "in_warehouse" || (order.order_status === "payment_pending" && order.payment_status !== "awaiting_confirmation")) && (
                    <Checkbox
                      checked={selectedIds.includes(order.id)}
                      onCheckedChange={() => toggleSelect(order.id)}
                    />
                  )}
                </td>
                {visibleCols.map(col => (
                  <td key={col.key} className="px-3 py-3 max-w-[220px]">
                    <CellValue col={{ ...col, _rules: storeTagRules }} order={order} />
                  </td>
                ))}
                <td className="px-3 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                  <div className="flex flex-col gap-1">
                  {(order.unread_roles || []).includes("user") && (
                    <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-600 border border-red-200 px-1.5 py-0.5 rounded-full font-medium animate-pulse w-fit">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />新消息
                    </span>
                  )}
                  {order.order_status === "payment_pending" && order.payment_status !== "awaiting_confirmation" && (
                    <Button size="sm" className="h-7 text-xs bg-red-600 hover:bg-red-700"
                      onClick={() => setPaymentOrder(order)}>
                      <CreditCard className="w-3 h-3 mr-1" />付款
                    </Button>
                  )}
                  {order.order_status === "in_warehouse" && (
                    <Button size="sm" className="h-7 text-xs bg-teal-600 hover:bg-teal-700"
                      onClick={() => setShipmentOrder(order)}>
                      <Truck className="w-3 h-3 mr-1" />通知发货
                    </Button>
                  )}
                  {order.order_status === "notified_shipment" && (() => {
                    const pool = shippingPools.find(p => (p.order_ids || []).includes(order.id));
                    const hasPendingEdit = pendingEditRequests.some(r => r.order_id === order.id);
                    return (
                      <div className="flex flex-col gap-1 items-start">
                        {pool && (
                          <span className="text-xs font-mono text-purple-700 bg-purple-50 border border-purple-100 px-1.5 py-0.5 rounded">
                            {pool.pool_code || pool.id.slice(-6).toUpperCase()}
                          </span>
                        )}
                        {hasPendingEdit && (
                          <span className="text-xs text-orange-600 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded flex items-center gap-1">
                            ⏳ 申请更改中
                          </span>
                        )}
                        {pool && pool.status !== "shipped" && pool.status !== "delivered" && !hasPendingEdit && (
                          <Button size="sm" variant="outline" className="h-6 text-xs px-2"
                            onClick={() => { setEditShipOrder(order); setEditShipPool(pool); }}>
                            编辑出货
                          </Button>
                        )}
                      </div>
                    );
                  })()}
                  {order.order_status === "shipped" && (
                    <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700"
                      onClick={() => handleConfirmDelivered(order)}>
                      <CheckCircle className="w-3 h-3 mr-1" />收货
                    </Button>
                  )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-gray-400 text-right">共 {filtered.length} 条</div>

      {selectedOrder && user && (
        <OrderDetailDrawer
          order={selectedOrder}
          currentUser={user}
          initialUserPreference={pageData.userPreference}
          initialPaidOrderReminder={pageData.paidOrderReminder}
          onClose={() => setSelectedOrder(null)}
          onAction={(action) => {
            fetchOrders(user);
            if (action === "delivered") setSelectedOrder(null);
          }}
          onUpdated={() => {
            setSelectedOrder(null);
            fetchOrders(user);
          }}
        />
      )}

      {paymentOrder && (
        <PaymentModal
          order={paymentOrder}
          mode="prepay"
          onClose={() => setPaymentOrder(null)}
          onSuccess={() => {
            setPaymentOrder(null);
            fetchOrders(user);
          }}
        />
      )}

      {shipmentOrder && (
        <UserNotifyShipmentModal
          order={shipmentOrder}
          initialData={pageData}
          onClose={() => setShipmentOrder(null)}
          onSuccess={() => {
            setShipmentOrder(null);
            fetchOrders(user);
          }}
        />
      )}

      {shipmentOrders && (
        <UserNotifyShipmentModal
          orders={shipmentOrders}
          initialData={pageData}
          onClose={() => setShipmentOrders(null)}
          onSuccess={() => {
            setShipmentOrders(null);
            setSelectedIds([]);
            fetchOrders(user);
          }}
        />
      )}

      {bulkPaymentOrders && (
        <BulkPaymentModal
          orders={bulkPaymentOrders}
          onClose={() => setBulkPaymentOrders(null)}
          onSuccess={() => {
            setBulkPaymentOrders(null);
            setSelectedIds([]);
            fetchOrders(user);
          }}
        />
      )}

      {editShipOrder && editShipPool && user && (
        <ShippingEditModal
          order={editShipOrder}
          currentPool={editShipPool}
          currentUser={user}
          onClose={() => { setEditShipOrder(null); setEditShipPool(null); }}
          onSuccess={() => {
            setEditShipOrder(null);
            setEditShipPool(null);
            fetchOrders(user);
          }}
        />
      )}
    </div>
  );
}