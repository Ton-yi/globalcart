import { useState } from 'react';
import { Ticket, Search, Filter, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import UserTicketOrderCard from '@/components/tickets/UserTicketOrderCard';
import UserTicketOrderDetailPanel from '@/components/tickets/UserTicketOrderDetailPanel';

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

      {/* Orders List */}
      {loading ? (
        <p className="text-gray-400 text-sm py-8 text-center">加载中...</p>
      ) : filteredOrders.length === 0 ? (
        <div className="flex flex-col items-center text-gray-400 py-16">
          <Ticket className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm">无匹配的票务需求</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map(o => (
            <div key={o.id} onClick={() => setSelectedOrder(o)} className="cursor-pointer">
              <UserTicketOrderCard order={o} />
            </div>
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