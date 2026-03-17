/**
 * UserNotifyShipmentModal
 * User selects shipping method and confirms shipment request.
 * Transitions order: in_warehouse → notified_shipment
 */
import { useState } from "react";
import { X, Truck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

const SHIPPING_METHODS = [
  { value: "EMS", label: "日本邮政 EMS" },
  { value: "SAL", label: "日本邮政 SAL（慢船）" },
  { value: "surface", label: "日本邮政海运" },
  { value: "DHL", label: "DHL" },
  { value: "FedEx", label: "FedEx" },
  { value: "other", label: "其他" },
];

export default function UserNotifyShipmentModal({ order, onClose, onSuccess }) {
  const [method, setMethod] = useState(order.shipping_method || "");
  const [consolidation, setConsolidation] = useState(order.consolidation_requested || false);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!method) return;
    setSubmitting(true);
    await base44.entities.Order.update(order.id, {
      shipping_method: method,
      consolidation_requested: consolidation,
      order_status: "notified_shipment",
      user_note: [order.user_note, note ? `发货备注：${note}` : ""].filter(Boolean).join("\n"),
    });
    onSuccess?.();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="font-semibold text-gray-900">通知发货</h2>
            <p className="text-xs text-gray-400 mt-0.5">{order.product_name}</p>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-500" /></button>
        </div>

        <div className="px-5 py-5 space-y-4">
          <div>
            <Label className="text-sm">选择发货方式 *</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="请选择发货方式" /></SelectTrigger>
              <SelectContent>
                {SHIPPING_METHODS.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-gray-100 hover:bg-gray-50">
            <Checkbox
              checked={consolidation}
              onCheckedChange={setConsolidation}
              className="mt-0.5"
            />
            <div>
              <div className="text-sm font-medium text-gray-800">申请拼邮</div>
              <p className="text-xs text-gray-400 mt-0.5">与其他用户合并发货，可降低运费（须等待凑单，时间不确定）</p>
            </div>
          </label>

          <div>
            <Label className="text-sm">备注（可选）</Label>
            <Textarea
              rows={2}
              placeholder="收件地址或特殊要求..."
              value={note}
              onChange={e => setNote(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>

        <div className="px-5 py-3 border-t flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
          <Button
            size="sm"
            className="bg-red-600 hover:bg-red-700"
            onClick={handleSubmit}
            disabled={!method || submitting}
          >
            <Truck className="w-3.5 h-3.5 mr-1.5" />
            {submitting ? "提交中..." : "确认通知发货"}
          </Button>
        </div>
      </div>
    </div>
  );
}