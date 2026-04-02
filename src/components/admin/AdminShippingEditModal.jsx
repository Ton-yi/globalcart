import { useState } from "react";
import { tenantEntity } from "@/lib/tenantApi";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STATUSES = [
  { v: "draft", l: "草稿" },
  { v: "submitted", l: "已提交" },
  { v: "quote_ready", l: "报价已出" },
  { v: "waiting_payment", l: "待付运费" },
  { v: "paid", l: "运费已付" },
  { v: "packing", l: "打包中" },
  { v: "shipped", l: "已发货" },
  { v: "delivered", l: "已签收" },
  { v: "cancelled", l: "已取消" },
];

export default function AdminShippingEditModal({ request, onClose, onSaved }) {
  const [form, setForm] = useState({
    shipping_request_status: request.shipping_request_status || "submitted",
    estimated_shipping_fee_jpy: request.estimated_shipping_fee_jpy || "",
    actual_shipping_fee_jpy: request.actual_shipping_fee_jpy || "",
    credit_applied_jpy: request.credit_applied_jpy || 0,
    tracking_number: request.tracking_number || "",
    actual_shipped_date: request.actual_shipped_date || "",
    admin_note: request.admin_note || "",
  });
  const [saving, setSaving] = useState(false);
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    await tenantEntity.update('ShipmentRequest', request.id, {
      shipping_request_status: form.shipping_request_status,
      estimated_shipping_fee_jpy: parseFloat(form.estimated_shipping_fee_jpy) || 0,
      actual_shipping_fee_jpy: parseFloat(form.actual_shipping_fee_jpy) || 0,
      credit_applied_jpy: parseFloat(form.credit_applied_jpy) || 0,
      tracking_number: form.tracking_number,
      actual_shipped_date: form.actual_shipped_date,
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
            <p className="text-xs text-gray-400">{request.recipient_name || request.creator_user_id} · {request.country}</p>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-500" /></button>
        </div>

        <div className="px-5 py-5 space-y-4">
          <div className="p-3 bg-gray-50 rounded-lg text-sm space-y-1">
            {request.address_line1 && (
              <div className="flex justify-between">
                <span className="text-gray-500">收件地址</span>
                <span className="text-right text-xs max-w-[200px]">
                  {request.address_line1}{request.city ? `, ${request.city}` : ""}, {request.country}
                </span>
              </div>
            )}
            {request.selected_shipping_method && (
              <div className="flex justify-between">
                <span className="text-gray-500">运输方式</span>
                <span>{request.selected_shipping_method}</span>
              </div>
            )}
            {request.remark && (
              <div className="flex justify-between">
                <span className="text-gray-500">用户备注</span>
                <span className="text-xs">{request.remark}</span>
              </div>
            )}
          </div>

          <div>
            <Label className="text-sm">发货状态</Label>
            <Select value={form.shipping_request_status} onValueChange={v => f("shipping_request_status", v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm">预估运费 (JPY)</Label>
              <Input type="number" step="1" className="mt-1" value={form.estimated_shipping_fee_jpy} onChange={e => f("estimated_shipping_fee_jpy", e.target.value)} />
            </div>
            <div>
              <Label className="text-sm">实际运费 (JPY)</Label>
              <Input type="number" step="1" className="mt-1" value={form.actual_shipping_fee_jpy} onChange={e => f("actual_shipping_fee_jpy", e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="text-sm">余额抵扣金额 (JPY)</Label>
            <Input type="number" step="1" className="mt-1" value={form.credit_applied_jpy} onChange={e => f("credit_applied_jpy", e.target.value)} />
          </div>

          <div>
            <Label className="text-sm">追踪号码</Label>
            <Input className="mt-1" placeholder="EMS/DHL 追踪号" value={form.tracking_number} onChange={e => f("tracking_number", e.target.value)} />
          </div>

          <div>
            <Label className="text-sm">发货日期</Label>
            <Input type="date" className="mt-1" value={form.actual_shipped_date} onChange={e => f("actual_shipped_date", e.target.value)} />
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