import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Ticket, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import AdminTicketOrderCard from "@/components/tickets/AdminTicketOrderCard";
import { TICKET_STATUSES, ticketStatusLabel } from "@/lib/ticketConfig";

export default function AdminTicketOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    base44.functions.invoke("getAdminTicketOrders", {})
      .then(r => {
        if (r.data?.error) { setError(r.data.error); }
        else setOrders(r.data?.orders || []);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleUpdated = (updated) => {
    setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
  };

  const filtered = orders.filter(o => {
    if (statusFilter !== "all" && o.ticket_status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return [o.order_number, o.product_name, o.user_name, o.user_email, o.ticket_data?.performance_name]
        .some(v => (v || "").toLowerCase().includes(q));
    }
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Ticket className="w-5 h-5 text-violet-600" />票务订单管理
        </h1>
        <p className="text-sm text-gray-500 mt-1">管理票务代购需求的状态流转与退差价处理</p>
      </div>

      {error && (
        <Alert className="border-red-200"><AlertTriangle className="w-4 h-4 text-red-500" />
          <AlertDescription className="text-red-600 text-sm">{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <Input className="h-9 text-sm max-w-xs" placeholder="搜索单号/演出/用户..."
          value={search} onChange={e => setSearch(e.target.value)} />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 text-sm w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-sm">全部状态</SelectItem>
            {TICKET_STATUSES.map(s => (
              <SelectItem key={s} value={s} className="text-sm">{ticketStatusLabel(s, "admin")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm py-8 text-center">加载中...</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-400 text-sm py-8 text-center">暂无票务订单</p>
      ) : (
        <div className="space-y-3">
          {filtered.map(o => (
            <AdminTicketOrderCard key={o.id} order={o} onUpdated={handleUpdated} />
          ))}
        </div>
      )}
    </div>
  );
}