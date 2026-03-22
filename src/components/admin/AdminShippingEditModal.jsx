import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { tenantEntity } from "@/lib/tenantApi";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STATUSES = [
  { v: "pending", l: "待确认" }, { v: "fee_confirmed", l: "运费已确认" },
  { v: "payment_pending", l: "待付运费" }, { v: "paid", l: "运费已付" },
  { v: "shipped", l: "已发货" }, { v: "delivered", l: "已签收" }
];

export default function AdminShippingEditModal({ request, onClose, onSaved }) {
  const [form, setForm] = useState({
    status: request.status || "pending",
    estimated_shipping_fee: request.estimated_shipping_fee || "",
    actual_shipping_fee: request.actual_shipping_fee || "",
    credit_applied: request.credit_applied || 0,
    tracking_number: request.tracking_number || "",
    shipped_date: request.shipped_date || "",
    admin_note: request.admin_note || "",
  });
  const [saving, setSaving] = useState(false);
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    await tenantEntity.update('ShippingRequest', request.id, {
      status: form.status,
      estimated_shipping_fee: parseFloat(form.estimated_shipping_fee) || 0,
      actual_shipping_fee: parseFloat(form.actual_shipping_fee) || 0,
      credit_applied: parseFloat(form.credit_applied) || 0,
      tracking_number: form.tracking_number,
      shipped_date: form.shipped_date,
      admin_note: form.admin_note,
    });
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="font-semibold text-gray-900">编辑发货申请</h2>
            <p className="text-xs text-gray-400">{request.recipient_name} · {request.country}</p>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-500" /></button>
        </div>

        <div className="px-5 py-5 space-y-4">
          <div className="p-3 bg-gray-50 rounded-lg text-sm space-y-1">
            <div className="flex justify-between"><span className="text-gray-500">收件地址</span><span className="text-right text-xs max-w-[200px]">{request.address_line1}, {request.city}, {request.country}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">运输方式</span><span>{request.shipping_method}</span></div>
            {request.user_note && <div className="flex justify-between"><span className="text-gray-500">用户备注</span><span className="text-xs">{request.user_note}</span></div>}
          </div>

          <div>
            <Label className="text-sm">发货状态</Label>
            <Select value={form.status} onValueChange={v => f("status", v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm">预估运费 (USD)</Label>
              <Input type="number" step="0.01" className="mt-1" value={form.estimated_shipping_fee} onChange={e => f("estimated_shipping_fee", e.target.value)} />
            </div>
            <div>
              <Label className="text-sm">实际运费 (USD)</Label>
              <Input type="number" step="0.01" className="mt-1" value={form.actual_shipping_fee} onChange={e => f("actual_shipping_fee", e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="text-sm">余额抵扣金额 (USD)</Label>
            <Input type="number" step="0.01" className="mt-1" value={form.credit_applied} onChange={e => f("credit_applied", e.target.value)} />
          </div>

          <div>
            <Label className="text-sm">追踪号码</Label>
            <Input className="mt-1" placeholder="EMS/DHL 追踪号" value={form.tracking_number} onChange={e => f("tracking_number", e.target.value)} />
          </div>

          <div>
            <Label className="text-sm">发货日期</Label>
            <Input type="date" className="mt-1" value={form.shipped_date} onChange={e => f("shipped_date", e.target.value)} />
          </div>

          <div>
            <Label className="text-sm">管理员备注</Label>
            <Textarea rows={2} className="mt-1" value={form.admin_note} onChange={e => f("admin_note", e.target.value)} />
          </div>
        </div>

        <div className="px-5 py-3 border-t flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
          <Button size="sm" className="bg-gray-900 hover:bg-gray-800" onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : "保存变更"}
          </Button>
        </div>
      </div>
    </div>
  );
}