import { useState } from "react";
import { X, Upload, CreditCard } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";

const PAYMENT_METHODS = [
  { value: "alipay", label: "支付宝 Alipay" },
  { value: "wechatpay", label: "微信支付 WeChat Pay" },
  { value: "paypay", label: "PayPay" },
  { value: "paypal", label: "PayPal" },
  { value: "credit_card", label: "信用卡" },
  { value: "bank_transfer", label: "银行转账" },
  { value: "other", label: "其他" },
];

export default function PaymentModal({ order, onClose, onSuccess }) {
  const [method, setMethod] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [paidAmount, setPaidAmount] = useState(
    order.supplement_requested ? order.supplement_amount : order.prepayment_amount
  );
  const [note, setNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setProofUrl(file_url);
    setUploading(false);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    await base44.entities.Order.update(order.id, {
      payment_method: method,
      payment_proof_url: proofUrl,
      paid_amount: (order.paid_amount || 0) + parseFloat(paidAmount),
      payment_status: "paid",
      order_status: order.supplement_requested ? "payment_confirmed" : "payment_pending",
      supplement_requested: false,
      user_note: note || order.user_note,
    });
    onSuccess();
  };

  const amountLabel = order.supplement_requested
    ? `补款金额：${order.prepayment_currency} ${order.supplement_amount}`
    : `预付款金额：${order.prepayment_currency} ${order.prepayment_amount?.toFixed(2)}`;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-gray-900">
            {order.supplement_requested ? "补款" : "预付款"}
          </h2>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-500" /></button>
        </div>

        <div className="px-5 py-5 space-y-4">
          <Alert className="border-yellow-200 bg-yellow-50">
            <CreditCard className="w-4 h-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800 text-sm">{amountLabel}</AlertDescription>
          </Alert>

          <div>
            <Label className="text-sm">实付金额</Label>
            <Input type="number" className="mt-1" value={paidAmount}
              onChange={e => setPaidAmount(e.target.value)} step="0.01" />
          </div>

          <div>
            <Label className="text-sm">支付方式 *</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="选择支付方式" /></SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm">付款凭证（截图）</Label>
            <div className="mt-1">
              <label className="cursor-pointer">
                <div className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded text-sm text-gray-500 hover:bg-gray-50">
                  <Upload className="w-4 h-4" />
                  {uploading ? "上传中..." : proofUrl ? "重新上传" : "上传付款截图"}
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
              </label>
              {proofUrl && <p className="text-xs text-green-600 mt-1">✓ 凭证已上传</p>}
            </div>
          </div>

          <div>
            <Label className="text-sm">备注（可选）</Label>
            <Textarea rows={2} className="mt-1" placeholder="交易流水号等..." value={note}
              onChange={e => setNote(e.target.value)} />
          </div>
        </div>

        <div className="px-5 py-3 border-t flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
          <Button size="sm" disabled={!method || submitting} className="bg-red-600 hover:bg-red-700"
            onClick={handleSubmit}>
            {submitting ? "提交中..." : "确认已付款"}
          </Button>
        </div>
      </div>
    </div>
  );
}