import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Package, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getStatusLabel, getStatusColor } from "@/lib/orderStatus";
import OrderDetailDrawer from "@/components/orders/OrderDetailDrawer";
import ColumnCustomizer from "@/components/orders/ColumnCustomizer";

const STORAGE_KEY = "my_orders_columns";

const ALL_COLUMNS = [
  { key: "product_image_url", label: "商品图片", defaultVisible: true },
  { key: "order_number", label: "订单号", defaultVisible: true },
  { key: "product_name", label: "商品名", defaultVisible: true },
  { key: "prepayment_amount", label: "付款金额", defaultVisible: true },
  { key: "weight_g", label: "订单重量", defaultVisible: true },
  { key: "order_status", label: "订单状态", defaultVisible: true },
  { key: "product_description", label: "商品描述", defaultVisible: false },
  { key: "arrival_photo_url", label: "入库图片", defaultVisible: false },
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
    const keyOrder = parsed.map(c => c.key);
    return [
      ...parsed.map(p => {
        const def = ALL_COLUMNS.find(c => c.key === p.key);
        return def ? { ...def, visible: p.visible } : null;
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
    case "product_image_url":
      return order.product_image_url
        ? <img src={order.product_image_url} alt="" className="w-10 h-10 rounded-lg object-cover border border-gray-100" />
        : <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
            <Package className="w-5 h-5 text-gray-300" />
          </div>;
    case "order_number":
      return <span className="font-mono text-xs text-gray-500">{order.order_number || "-"}</span>;
    case "product_name":
      return <span className="text-sm font-medium text-gray-900 truncate">{order.product_name}</span>;
    case "prepayment_amount": {
      const val = order.prepayment_amount;
      const cur = order.prepayment_currency;
      const display = val > 0 ? (cur === "CNY" ? `${val.toFixed(2)} yuan` : `${cur} ${val.toFixed(2)}`) : "-";
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
    case "arrival_photo_url":
      return order.arrival_photo_url
        ? <img src={order.arrival_photo_url} alt="" className="w-10 h-10 rounded object-cover border border-gray-100" />
        : <span className="text-xs text-gray-300">-</span>;
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

export default function MyOrders() {
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [columns, setColumns] = useState(loadColumns);

  const fetchOrders = async (u) => {
    if (!u) return;
    setLoading(true);
    const data = await base44.entities.Order.filter({ user_email: u.email }, "-updated_date", 100);
    setOrders(data);
    setLoading(false);
  };

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      fetchOrders(u);
    }).catch(() => base44.auth.redirectToLogin());
  }, []);

  const handleColumnsChange = (newCols) => {
    setColumns(newCols);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newCols.map(c => ({ key: c.key, visible: c.visible }))));
  };

  const filtered = orders.filter(o => {
    const matchStatus = statusFilter === "all" || o.order_status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      (o.product_name || "").toLowerCase().includes(q) ||
      (o.order_number || "").toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const visibleCols = columns.filter(c => c.visible);

  return (
    <div className="space-y-4">
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

      {/* Orders table */}
      <div className="border border-gray-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {visibleCols.map(col => (
                <th key={col.key} className="px-3 py-2 text-left text-xs font-medium text-gray-500 whitespace-nowrap">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={visibleCols.length} className="text-center py-12 text-gray-400 text-sm">加载中...</td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={visibleCols.length} className="py-16">
                  <div className="flex flex-col items-center text-gray-400">
                    <Package className="w-10 h-10 mb-3 opacity-30" />
                    <p className="text-sm">暂无订单</p>
                  </div>
                </td>
              </tr>
            ) : filtered.map(order => (
              <tr key={order.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedOrder(order)}>
                {visibleCols.map(col => (
                  <td key={col.key} className="px-3 py-3 max-w-[220px]">
                    <CellValue col={col} order={order} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-gray-400 text-right">共 {filtered.length} 条</div>

      {selectedOrder && (
        <OrderDetailDrawer
          order={selectedOrder}
          currentUser={user}
          onClose={() => setSelectedOrder(null)}
          onAction={(action) => {
            if (action === "notify_ship" || action === "pay_shipping" || action === "delivered" || action === "message_sent") {
              fetchOrders(user);
            }
          }}
          onUpdated={() => {
            setSelectedOrder(null);
            fetchOrders(user);
          }}
        />
      )}
    </div>
  );
}