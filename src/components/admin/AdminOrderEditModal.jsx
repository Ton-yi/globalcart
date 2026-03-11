import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { X, AlertTriangle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const ORDER_STATUSES = [
  { v: "submitted", l: "已提交" }, { v: "price_confirmed", l: "已报价" },
  { v: "payment_pending", l: "待付款" }, { v: "payment_confirmed", l: "已付款" },
  { v: "purchasing", l: "采购中" }, { v: "purchased", l: "已购买" },
  { v: "awaiting_shipment", l: "等待发货" }, { v: "shipped", l: "已发货" },
  { v: "delivered", l: "已签收" }, { v: "cancelled", l: "已取消" }
];

export default function AdminOrderEditModal({ order, onClose, onSaved }) {
  const [form, setForm] = useState({
    order_status: order.order_status || "submitted",
    payment_status: order.payment_status || "pending",
    admin_confirmed_amount: order.admin_confirmed_amount || order.prepayment_amount || "",
    admin_note: order.admin_note || "",
    supplement_requested: order.supplement_requested || false,
    supplement_amount: order.supplement_amount || "",
    balance_credit: order.balance_credit || 0,
    prepayment_amount: order.prepayment_amount || "",
    estimated_jpy: order.estimated_jpy || "",
  });
  const [saving, setSaving] = useState(false);

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleConfirmPayment = async (action) => {
    setSaving(true);
    const paid = parseFloat(order.paid_amount || 0);
    const required = parseFloat(form.admin_confirmed_amount || form.prepayment_amount);
    const diff = paid - required;

    let updates = {
      admin_confirmed_amount: parseFloat(form.admin_confirmed_amount),
      admin_note: form.admin_note,
      order_status: form.order_status,
      payment_status: form.payment_status,
    };

    if (action === "confirm_exact" || action === "confirm_over") {
      updates.payment_status = "confirmed";
      updates.order_status = "payment_confirmed";
      if (diff > 0) updates.balance_credit = (order.balance_credit || 0) + diff;
    } else if (action === "request_supplement") {
      updates.supplement_requested = true;
      updates.supplement_amount = Math.abs(diff);
      updates.payment_status = "underpaid";
    }

    await base44.entities.Order.update(order.id, updates);
    onSaved();
  };

  const handleSave = async () => {
    setSaving(true);
    await base44.entities.Order.update(order.id, {
      order_status: form.order_status,
      payment_status: form.payment_status,
      admin_note: form.admin_note,
      admin_confirmed_amount: parseFloat(form.admin_confirmed_amount) || 0,
      supplement_requested: form.supplement_requested,
      supplement_amount: parseFloat(form.supplement_amount) || 0,
      balance_credit: parseFloat(form.balance_credit) || 0,
      prepayment_amount: parseFloat(form.prepayment_amount) || 0,
      estimated_jpy: parseFloat(form.estimated_jpy) || 0,
    });
    onSaved();
  };

  const paid = parseFloat(order.paid_amount || 0);
  const confirmed = parseFloat(form.admin_confirmed_amount || 0);
  const diff = paid - confirmed;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="font-semibold text-gray-900">编辑订单</h2>
            <p className="text-xs text-gray-400">{order.product_name} · {order.user_email}</p>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-500" /></button>
        </div>

        <div className="px-5 py-5 space-y-4">
          {/* Payment Review */}
          {order.paid_amount > 0 && (
            <div className="p-3 bg-gray-50 rounded-lg text-sm space-y-1.5">
              <div className="font-medium text-gray-700 mb-2">付款审核</div>
              <div className="flex justify-between"><span className="text-gray-500">用户已付</span><span className="font-medium">{order.prepayment_currency} {order.paid_amount?.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">支付方式</span><span>{order.payment_method || "-"}</span></div>
              {order.payment_proof_url && (
                <div className="mt-2">
                  <p className="text-xs text-gray-500 mb-1">付款凭证</p>
                  <a href={order.payment_proof_url} target="_blank" rel="noopener noreferrer">
                    <img src={order.payment_proof_url} alt="凭证" className="h-24 rounded border cursor-pointer" />
                  </a>
                </div>
              )}
            </div>
          )}

          <div>
            <Label className="text-sm">管理员确认金额</Label>
            <Input type="number" step="0.01" className="mt-1" value={form.admin_confirmed_amount}
              onChange={e => f("admin_confirmed_amount", e.target.value)} />
          </div>

          {confirmed > 0 && order.paid_amount > 0 && (
            <div className={`p-3 rounded-lg text-sm ${diff === 0 ? "bg-green-50 text-green-800" : diff > 0 ? "bg-blue-50 text-blue-800" : "bg-red-50 text-red-800"}`}>
              {diff === 0 && <><CheckCircle className="inline w-4 h-4 mr-1" />金额正好，可以确认</>}
              {diff > 0 && <><span>多付 {order.prepayment_currency} {diff.toFixed(2)}，将自动存入余额供运费抵扣</span></>}
              {diff < 0 && <><AlertTriangle className="inline w-4 h-4 mr-1" />付款不足 {order.prepayment_currency} {Math.abs(diff).toFixed(2)}</>}
            </div>
          )}

          {confirmed > 0 && order.paid_amount > 0 && (
            <div className="flex gap-2 flex-wrap">
              {diff >= 0 && (
                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-xs"
                  onClick={() => handleConfirmPayment(diff > 0 ? "confirm_over" : "confirm_exact")} disabled={saving}>
                  <CheckCircle className="w-3 h-3 mr-1" />确认付款{diff > 0 ? "（余额抵扣）" : ""}
                </Button>
              )}
              {diff < 0 && (
                <Button size="sm" className="bg-orange-600 hover:bg-orange-700 text-xs"
                  onClick={() => handleConfirmPayment("request_supplement")} disabled={saving}>
                  <AlertTriangle className="w-3 h-3 mr-1" />向用户索取补款
                </Button>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm">订单状态</Label>
              <Select value={form.order_status} onValueChange={v => f("order_status", v)}>
                <SelectTrigger className="mt-1 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{ORDER_STATUSES.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">余额 (供运费抵扣)</Label>
              <Input type="number" step="0.01" className="mt-1" value={form.balance_credit}
                onChange={e => f("balance_credit", e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="text-sm">日元报价</Label>
            <Input type="number" className="mt-1" value={form.estimated_jpy}
              onChange={e => f("estimated_jpy", e.target.value)} />
          </div>

          <div>
            <Label className="text-sm">预付款金额</Label>
            <Input type="number" step="0.01" className="mt-1" value={form.prepayment_amount}
              onChange={e => f("prepayment_amount", e.target.value)} />
          </div>

          <div>
            <Label className="text-sm">管理员备注</Label>
            <Textarea rows={3} className="mt-1" value={form.admin_note}
              onChange={e => f("admin_note", e.target.value)} />
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