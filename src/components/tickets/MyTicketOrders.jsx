import { useState } from 'react';
import { Ticket, Search, Filter, X, Calendar, MapPin, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import UserTicketOrderDetailPanel from '@/components/tickets/UserTicketOrderDetailPanel';
import { ticketStatusLabel, TICKET_STATUS_COLORS, salesMethodLabel, ticketingMethodLabel } from '@/lib/ticketConfig';

const STATUS_FILTERS = [
  { v: "all", l: "全部状态" },
  { v: "pending_confirmation", l: "待确认" },
  { v: "accepted", l: "已受理" },
  { v: "awaiting_lottery_result", l: "待抽选结果" },
  { v: "purchased_pending_warehouse", l: "已购买待入库" },
  { v: "in_warehouse", l: "已入库" },
  { v: "shipped", l: "已发货" },
  { v: "delivered", l: "已收货" },
  { v: "cancelled", l: "已取消" },
];

export default function MyTicketOrders({ orders, loading, onRefresh, currentUser, userProfileMap }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState(null);

  const filteredOrders = orders.filter(o => {
    const matchStatus = statusFilter === "all" || o.ticket_status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      (o.product_name || "").toLowerCase().includes(q) ||
      (o.order_number || "").toLowerCase().includes(q) ||
      (o.ticket_data?.performance_name || "").toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <Input 
            placeholder="搜索订单/演出..." 
            className="pl-8 h-8 text-sm"
            value={search} 
            onChange={e => setSearch(e.target.value)} 
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-8 text-sm shrink-0">
            <Filter className="w-3.5 h-3.5 mr-1 text-gray-400 shrink-0" />
            <SelectValue placeholder="所有状态" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}
          </SelectContent>
        </Select>
        {(statusFilter !== "all" || search) && (
          <button 
            onClick={() => { setStatusFilter("all"); setSearch(""); }}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 h-8 px-1 shrink-0"
          >
            <X className="w-3 h-3" />清除
          </button>
        )}
      </div>

      {/* Orders Grid - 2 columns */}
      {loading ? (
        <p className="text-gray-400 text-sm py-8 text-center">加载中...</p>
      ) : filteredOrders.length === 0 ? (
        <div className="flex flex-col items-center text-gray-400 py-16">
          <Ticket className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm">无匹配的票务需求</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {filteredOrders.map(o => (
            <TicketOrderCard 
              key={o.id} 
              order={o} 
              onClick={() => setSelectedOrder(o)} 
            />
          ))}
        </div>
      )}

      {/* Detail Panel */}
      {selectedOrder && (
        <UserTicketOrderDetailPanel
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onRefresh={() => {
            onRefresh();
            // also refresh the selected order data
            const refreshedOrder = orders.find(o => o.id === selectedOrder.id);
            if (refreshedOrder) {
              setSelectedOrder(refreshedOrder);
            } else {
              setSelectedOrder(null); // if it was deleted/archived
            }
          }}
          currentUser={currentUser}
          userProfileMap={userProfileMap}
        />
      )}
    </div>
  );
}

/**
 * 票务订单卡片 - 两列布局版本，显示更多外部信息
 */
function TicketOrderCard({ order, onClick }) {
  const td = order.ticket_data || {};
  const seats = td.seats || [];
  const totalTickets = seats.reduce((sum, s) => sum + (s.quantity || 0), 0);
  const isLottery = td.sales_method === "lottery";

  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <div 
      onClick={onClick}
      className="bg-white border border-gray-200 rounded-xl p-4 hover:border-violet-300 hover:shadow-lg transition-all cursor-pointer group"
    >
      {/* Header: Status + Order Number */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
          <Ticket className="w-4 h-4 text-violet-600 flex-shrink-0" />
          <Badge className={`${TICKET_STATUS_COLORS[order.ticket_status] || "bg-gray-100 text-gray-700"} text-xs flex-shrink-0`}>
            {ticketStatusLabel(order.ticket_status, "user", isLottery)}
          </Badge>
          <span className="text-xs text-gray-400 font-mono truncate">{order.order_number}</span>
        </div>
        {order.ticket_refund_settled && (order.ticket_refund_jpy || 0) > 0 && (
          <Badge className="bg-green-100 text-green-700 text-xs flex-shrink-0">
            已退差价
          </Badge>
        )}
      </div>

      {/* Product Name */}
      <h3 className="font-semibold text-gray-900 text-sm mb-2 truncate group-hover:text-violet-700 transition-colors">
        {order.product_name}
      </h3>

      {/* Performance Info */}
      {td.performance_name && (
        <div className="mb-2">
          <p className="text-xs text-gray-600 font-medium truncate">{td.performance_name}</p>
        </div>
      )}

      {/* Key Info Grid */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {/* Date */}
        {td.performance_datetime && (
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <Calendar className="w-3 h-3 text-gray-400 flex-shrink-0" />
            <span className="truncate">{formatDate(td.performance_datetime)} {formatTime(td.performance_datetime)}</span>
          </div>
        )}
        
        {/* Location */}
        {td.prefecture && (
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
            <span className="truncate">{td.prefecture}</span>
          </div>
        )}

        {/* Tickets Count */}
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          <Users className="w-3 h-3 text-gray-400 flex-shrink-0" />
          <span>共 {totalTickets} 票</span>
        </div>

        {/* Accounts */}
        {(td.account_count || 1) > 1 && (
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <Users className="w-3 h-3 text-gray-400 flex-shrink-0" />
            <span>×{td.account_count} 账户</span>
          </div>
        )}
      </div>

      {/* Sales & Ticketing Method */}
      <div className="flex items-center gap-2 mb-3">
        {td.sales_method && (
          <Badge variant="outline" className="text-xs">
            {salesMethodLabel(td.sales_method)}
          </Badge>
        )}
        {td.ticketing_method && (
          <Badge variant="outline" className="text-xs">
            {ticketingMethodLabel(td.ticketing_method)}
          </Badge>
        )}
      </div>

      {/* Footer: Price + Payment */}
      <div className="border-t border-gray-100 pt-3 flex items-end justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-xs text-gray-500 mb-0.5">预付总额</div>
          <div className="text-base font-bold text-violet-700">
            ¥{(order.ticket_prepaid_total_jpy || 0).toLocaleString()}
          </div>
          {order.order_stage_payment_jpy ? (
            <div className="text-xs text-gray-400">已付 ¥{order.order_stage_payment_jpy.toLocaleString()}</div>
          ) : null}
        </div>
        <div className="text-right">
          {order.payment_method && (
            <div className="text-xs text-gray-500 mb-0.5">
              {{ 
                alipay: "支付宝", 
                wechatpay: "微信支付", 
                paypay: "PayPay", 
                credit: "记账"
              }[order.payment_method] || '其它'}
            </div>
          )}
          <div className="text-xs text-gray-400">{new Date(order.created_date).toLocaleDateString('zh-CN')}</div>
        </div>
      </div>
    </div>
  );
}