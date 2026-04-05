import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { tenantEntity } from "@/lib/tenantApi";
import { Search, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AdminShippingEditModal from "@/components/admin/AdminShippingEditModal";

const STATUS_LABELS = { pending: "待确认", fee_confirmed: "运费已确认", payment_pending: "待付运费", paid: "运费已付", shipped: "已发货", delivered: "已签收" };
const STATUS_COLORS = { pending: "bg-gray-100 text-gray-600", fee_confirmed: "bg-yellow-100 text-yellow-700", payment_pending: "bg-orange-100 text-orange-700", paid: "bg-green-100 text-green-700", shipped: "bg-blue-100 text-blue-700", delivered: "bg-emerald-100 text-emerald-700" };

export default function AdminShipping() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editing, setEditing] = useState(null);

  const load = async () => {
    const data = await tenantEntity.list('ShippingRequest');
    setRequests(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = requests.filter(r => {
    const matchSearch = !search || r.recipient_name?.toLowerCase().includes(search.toLowerCase()) || r.user_email?.includes(search);
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">发货需求管理</h1>
        <span className="text-sm text-gray-400">{filtered.length} 笔</span>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <Input placeholder="搜索收件人、邮箱..." className="pl-8 h-8 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">用户</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">收件人</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">目的地</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">运输方式</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">运费</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">追踪号</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">状态</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={8} className="text-center py-8 text-gray-400">加载中...</td></tr>
            ) : filtered.map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-xs text-gray-500 truncate max-w-[100px]">{r.user_email}</td>
                <td className="px-4 py-3 font-medium text-gray-800">{r.recipient_name}</td>
                <td className="px-4 py-3 text-gray-600">{r.country}{r.city ? `, ${r.city}` : ""}</td>
                <td className="px-4 py-3 text-gray-600">{r.shipping_method}</td>
                <td className="px-4 py-3 text-gray-700">
                  {r.actual_shipping_fee ? `USD ${r.actual_shipping_fee.toFixed(2)}` : r.estimated_shipping_fee ? `≈${r.estimated_shipping_fee.toFixed(2)}` : "-"}
                  {r.credit_applied > 0 && <div className="text-xs text-green-600">-{r.credit_applied.toFixed(2)} 抵扣</div>}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-blue-600">{r.tracking_number || "-"}</td>
                <td className="px-4 py-3">
                  <Badge className={`text-xs ${STATUS_COLORS[r.status] || "bg-gray-100"}`}>
                    {STATUS_LABELS[r.status] || r.status}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditing(r)}>
                    <Edit2 className="w-3 h-3 mr-1" />编辑
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && <AdminShippingEditModal request={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}