import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Truck, Plus, Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const STATUS_LABELS = { pending: "待确认", fee_confirmed: "运费已确认", payment_pending: "待付运费", paid: "运费已付", shipped: "已发货", delivered: "已签收" };
const STATUS_COLORS = { pending: "bg-gray-100 text-gray-600", fee_confirmed: "bg-yellow-100 text-yellow-700", payment_pending: "bg-orange-100 text-orange-700", paid: "bg-green-100 text-green-700", shipped: "bg-blue-100 text-blue-700", delivered: "bg-emerald-100 text-emerald-700" };
const COUNTRIES = ["中国大陆","台湾","香港","澳门","日本","韩国","美国","加拿大","英国","法国","德国","澳大利亚","新加坡","马来西亚","泰国","其他"];
const SHIP_METHODS = [{ v: "EMS", l: "EMS 国际快递" }, { v: "DHL", l: "DHL" }, { v: "FedEx", l: "FedEx" }, { v: "SAL", l: "SAL 经济航空" }, { v: "surface", l: "海运" }, { v: "other", l: "其他" }];

export default function ShippingRequests() {
  const [user, setUser] = useState(null);
  const [requests, setRequests] = useState([]);
  const [readyOrders, setReadyOrders] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ order_id: "", recipient_name: "", recipient_phone: "", address_line1: "", address_line2: "", city: "", state: "", postal_code: "", country: "", shipping_method: "EMS", user_note: "" });
  const [submitting, setSubmitting] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);

  useEffect(() => {
    base44.auth.me().then(async u => {
      setUser(u);
      const [reqs, orders] = await Promise.all([
        base44.entities.ShippingRequest.filter({ user_email: u.email }, "-created_date"),
        base44.entities.Order.filter({ user_email: u.email, order_status: "awaiting_shipment" })
      ]);
      setRequests(reqs);
      setReadyOrders(orders);
    }).catch(() => base44.auth.redirectToLogin());
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    await base44.entities.ShippingRequest.create({ ...form, user_email: user.email, status: "pending" });
    const [reqs] = await Promise.all([base44.entities.ShippingRequest.filter({ user_email: user.email }, "-created_date")]);
    setRequests(reqs);
    setShowForm(false);
    setForm({ order_id: "", recipient_name: "", recipient_phone: "", address_line1: "", address_line2: "", city: "", state: "", postal_code: "", country: "", shipping_method: "EMS", user_note: "" });
    setSubmitting(false);
  };

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">发货需求</h1>
          <p className="text-sm text-gray-500 mt-0.5">提交发货申请，填写收货地址</p>
        </div>
        {readyOrders.length > 0 && !showForm && (
          <Button className="bg-red-600 hover:bg-red-700 text-sm" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-1" />提交发货需求
          </Button>
        )}
      </div>

      {showForm && (
        <Card className="border-gray-200">
          <CardContent className="p-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              <h3 className="font-semibold text-gray-800">新增发货申请</h3>
              <div>
                <Label className="text-sm">关联订单 *</Label>
                <Select value={form.order_id} onValueChange={v => f("order_id", v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="选择已购买的订单" /></SelectTrigger>
                  <SelectContent>
                    {readyOrders.map(o => <SelectItem key={o.id} value={o.id}>{o.product_name} ({o.order_number || o.id.slice(0,8)})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm">收件人姓名 *</Label>
                  <Input required className="mt-1" value={form.recipient_name} onChange={e => f("recipient_name", e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm">联系电话</Label>
                  <Input className="mt-1" value={form.recipient_phone} onChange={e => f("recipient_phone", e.target.value)} />
                </div>
              </div>
              <div>
                <Label className="text-sm">地址行1 *</Label>
                <Input required className="mt-1" placeholder="街道、门牌号" value={form.address_line1} onChange={e => f("address_line1", e.target.value)} />
              </div>
              <div>
                <Label className="text-sm">地址行2</Label>
                <Input className="mt-1" placeholder="单元、楼层（可选）" value={form.address_line2} onChange={e => f("address_line2", e.target.value)} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-sm">城市</Label>
                  <Input className="mt-1" value={form.city} onChange={e => f("city", e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm">州/省</Label>
                  <Input className="mt-1" value={form.state} onChange={e => f("state", e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm">邮编</Label>
                  <Input className="mt-1" value={form.postal_code} onChange={e => f("postal_code", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm">国家 *</Label>
                  <Select value={form.country} onValueChange={v => f("country", v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="选择国家" /></SelectTrigger>
                    <SelectContent>{COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm">运输方式</Label>
                  <Select value={form.shipping_method} onValueChange={v => f("shipping_method", v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{SHIP_METHODS.map(m => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-sm">备注</Label>
                <Textarea rows={2} className="mt-1" value={form.user_note} onChange={e => f("user_note", e.target.value)} />
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>取消</Button>
                <Button type="submit" size="sm" disabled={submitting || !form.order_id || !form.recipient_name || !form.country} className="bg-red-600 hover:bg-red-700">
                  {submitting ? "提交中..." : "提交发货需求"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {requests.length === 0 ? (
        <div className="text-center py-16 bg-white border border-gray-200 rounded-xl">
          <Truck className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">暂无发货申请</p>
          {readyOrders.length === 0 && <p className="text-xs text-gray-300 mt-1">商品购买完成后即可申请发货</p>}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">收件人</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 hidden sm:table-cell">目的地</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 hidden md:table-cell">运输方式</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">状态</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 hidden lg:table-cell">追踪号</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 hidden md:table-cell">运费</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {requests.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{r.recipient_name}</span>
                      <button onClick={() => setSelectedRequest(r)} className="text-gray-400 hover:text-blue-600">
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{r.country}{r.city ? `, ${r.city}` : ""}</td>
                  <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{r.shipping_method}</td>
                  <td className="px-4 py-3">
                    <Badge className={`text-xs ${STATUS_COLORS[r.status] || "bg-gray-100 text-gray-600"}`}>
                      {STATUS_LABELS[r.status] || r.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-blue-600 hidden lg:table-cell">{r.tracking_number || "-"}</td>
                  <td className="px-4 py-3 text-gray-700 hidden md:table-cell">
                    {r.actual_shipping_fee ? `USD ${r.actual_shipping_fee.toFixed(2)}` : r.estimated_shipping_fee ? `≈ USD ${r.estimated_shipping_fee.toFixed(2)}` : "-"}
                    {r.credit_applied > 0 && <span className="text-green-600 text-xs ml-1">(-{r.credit_applied.toFixed(2)} 抵扣)</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <Card className="w-full max-w-md max-h-[85vh] overflow-y-auto">
            <div className="p-6 space-y-4 sticky top-0 bg-white border-b">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">发货申请详情</h2>
                <button onClick={() => setSelectedRequest(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <CardContent className="p-6 space-y-4">
              <div>
                <Label className="text-xs text-gray-500">收件人</Label>
                <p className="text-sm font-medium text-gray-900 mt-1">{selectedRequest.recipient_name}</p>
              </div>
              {selectedRequest.recipient_phone && (
                <div>
                  <Label className="text-xs text-gray-500">联系电话</Label>
                  <p className="text-sm text-gray-700 mt-1">{selectedRequest.recipient_phone}</p>
                </div>
              )}
              <div>
                <Label className="text-xs text-gray-500">发货目的地</Label>
                <p className="text-sm text-gray-700 mt-1">
                  {selectedRequest.address_line1}{selectedRequest.address_line2 ? ` ${selectedRequest.address_line2}` : ""}
                  <br />
                  {selectedRequest.city && `${selectedRequest.city} `}
                  {selectedRequest.state && `${selectedRequest.state} `}
                  {selectedRequest.postal_code && `${selectedRequest.postal_code}`}
                  <br />
                  {selectedRequest.country}
                </p>
              </div>
              <div>
                <Label className="text-xs text-gray-500">运输方式</Label>
                <p className="text-sm text-gray-700 mt-1">{selectedRequest.shipping_method}</p>
              </div>
              <div>
                <Label className="text-xs text-gray-500">状态</Label>
                <Badge className={`text-xs mt-1 ${STATUS_COLORS[selectedRequest.status] || "bg-gray-100 text-gray-600"}`}>
                  {STATUS_LABELS[selectedRequest.status] || selectedRequest.status}
                </Badge>
              </div>
              {selectedRequest.tracking_number && (
                <div>
                  <Label className="text-xs text-gray-500">追踪号</Label>
                  <p className="text-sm font-mono text-blue-600 mt-1">{selectedRequest.tracking_number}</p>
                </div>
              )}
              {selectedRequest.actual_shipping_fee || selectedRequest.estimated_shipping_fee ? (
                <div>
                  <Label className="text-xs text-gray-500">运费</Label>
                  <p className="text-sm text-gray-700 mt-1">
                    {selectedRequest.actual_shipping_fee ? `USD ${selectedRequest.actual_shipping_fee.toFixed(2)}` : `≈ USD ${selectedRequest.estimated_shipping_fee.toFixed(2)}`}
                    {selectedRequest.credit_applied > 0 && <span className="text-green-600 text-xs ml-1">(-{selectedRequest.credit_applied.toFixed(2)} 抵扣)</span>}
                  </p>
                </div>
              ) : null}
              {selectedRequest.user_note && (
                <div>
                  <Label className="text-xs text-gray-500">备注</Label>
                  <p className="text-sm text-gray-700 mt-1">{selectedRequest.user_note}</p>
                </div>
              )}
              <Button type="button" variant="outline" className="w-full" onClick={() => setSelectedRequest(null)}>
                关闭
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}