import { useState } from "react";
import { X, Upload, CreditCard, ExternalLink, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";

const PAYMENT_METHODS = [
  { value: "alipay",        label: "支付宝",   color: "border-blue-400 bg-blue-50 text-blue-700",   active: "border-blue-500 bg-blue-100 ring-2 ring-blue-400" },
  { value: "wechatpay",     label: "微信支付", color: "border-green-400 bg-green-50 text-green-700", active: "border-green-500 bg-green-100 ring-2 ring-green-400" },
  { value: "bank_transfer", label: "银行转账", color: "border-gray-300 bg-gray-50 text-gray-600",   active: "border-gray-500 bg-gray-100 ring-2 ring-gray-400" },
  { value: "other",         label: "其他",     color: "border-gray-300 bg-gray-50 text-gray-600",   active: "border-gray-500 bg-gray-100 ring-2 ring-gray-400" },
];

export default function PaymentModal({ order, onClose, onSuccess }) {
  const isSupplementRequest = order.supplement_requested;
  const defaultAmount = isSupplementRequest ? order.supplement_amount : order.prepayment_amount;

  const [method, setMethod] = useState("");
  const [paidAmount, setPaidAmount] = useState(defaultAmount);

  // Alipay flow
  const [alipayUrl, setAlipayUrl] = useState(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [alipayLinkGenerated, setAlipayLinkGenerated] = useState(false);

  // Manual proof flow (non-alipay)
  const [proofUrl, setProofUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const cur = order.prepayment_currency || "CNY";
  const amountLabel = isSupplementRequest
    ? `补款金额：${cur} ${order.supplement_amount}`
    : `预付款金额：${cur} ${parseFloat(defaultAmount || 0).toFixed(2)}`;

  const handleMethodSelect = (val) => {
    setMethod(val);
    setAlipayUrl(null);
    setAlipayLinkGenerated(false);
    setProofUrl("");
  };

  const handleGenerateAlipay = async () => {
    setGeneratingLink(true);
    const res = await base44.functions.invoke("generateAlipayPaymentLink", {
      orderId: order.id,
      amount: parseFloat(paidAmount),
      currency: cur,
      subject: `同一物流代购 - ${order.product_name}`,
    });
    const url = res.data?.paymentUrl;
    setAlipayUrl(url);
    setAlipayLinkGenerated(true);
    setGeneratingLink(false);
    // Auto open in new tab
    if (url) window.open(url, "_blank");
  };

  const handleUploadProof = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setProofUrl(file_url);
    setUploading(false);
  };

  // For non-alipay: manual confirm after uploading proof
  const handleManualSubmit = async () => {
    setSubmitting(true);
    await base44.entities.Order.update(order.id, {
      payment_method: method,
      payment_proof_url: proofUrl,
      paid_amount: (order.paid_amount || 0) + parseFloat(paidAmount),
      payment_status: "paid",
      order_status: isSupplementRequest ? "payment_confirmed" : "payment_pending",
      supplement_requested: false,
    });
    onSuccess();
  };

  // For alipay: user confirms they've paid, mark as awaiting review
  const handleAlipayDone = async () => {
    setSubmitting(true);
    await base44.entities.Order.update(order.id, {
      payment_method: "alipay",
      paid_amount: (order.paid_amount || 0) + parseFloat(paidAmount),
      payment_status: "awaiting_payment",
      order_status: isSupplementRequest ? "payment_confirmed" : "payment_pending",
      supplement_requested: false,
    });
    onSuccess();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="font-semibold text-gray-900">{isSupplementRequest ? "补款" : "预付款"}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{order.product_name}</p>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-500" /></button>
        </div>

        <div className="px-5 py-5 space-y-4">
          {/* Amount */}
          <Alert className="border-yellow-200 bg-yellow-50 py-2.5">
            <CreditCard className="w-4 h-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800 text-sm font-medium">{amountLabel}</AlertDescription>
          </Alert>

          <div>
            <Label className="text-sm">实付金额 ({cur})</Label>
            <Input type="number" className="mt-1" value={paidAmount}
              onChange={e => setPaidAmount(e.target.value)} step="0.01" />
          </div>

          {/* Payment method selection */}
          <div>
            <Label className="text-sm mb-2 block">选择支付方式</Label>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map(m => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => handleMethodSelect(m.value)}
                  className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                    method === m.value ? m.active : "border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Alipay flow ── */}
          {method === "alipay" && (
            <div className="space-y-3">
              {!alipayLinkGenerated ? (
                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  onClick={handleGenerateAlipay}
                  disabled={generatingLink || !paidAmount}
                >
                  {generatingLink
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />生成付款链接中...</>
                    : <><ExternalLink className="w-4 h-4 mr-2" />生成支付宝付款链接</>}
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 text-green-700 text-sm font-medium mb-2">
                      <CheckCircle className="w-4 h-4" />付款链接已生成
                    </div>
                    <a
                      href={alipayUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 rounded-md transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />重新打开支付宝付款页
                    </a>
                    <p className="text-xs text-gray-400 mt-1.5 text-center">如已完成支付，点击下方按钮确认</p>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => { setAlipayLinkGenerated(false); setAlipayUrl(null); }}>
                      重新生成
                    </Button>
                    <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700" onClick={handleAlipayDone} disabled={submitting}>
                      {submitting ? "提交中..." : "✓ 我已完成支付"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Other methods: manual proof upload ── */}
          {method && method !== "alipay" && (
            <div className="space-y-3">
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500 text-center">
                {method === "wechatpay" ? "微信支付" : method === "bank_transfer" ? "银行转账" : "其他方式"}
                · 请联系客服获取收款账号，完成后上传凭证
              </div>
              <div>
                <Label className="text-sm">上传付款凭证</Label>
                <label className="cursor-pointer block mt-1">
                  <div className={`flex items-center gap-2 px-3 py-2.5 border-2 border-dashed rounded-lg text-sm transition-colors text-center justify-center ${
                    proofUrl ? "border-green-300 bg-green-50 text-green-700" : "border-gray-200 text-gray-400 hover:border-gray-300"
                  }`}>
                    {proofUrl
                      ? <><CheckCircle className="w-4 h-4" />凭证已上传</>
                      : <><Upload className="w-4 h-4" />{uploading ? "上传中..." : "点击上传付款截图"}</>}
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={handleUploadProof} disabled={uploading} />
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
          {method && method !== "alipay" && (
            <Button size="sm" disabled={!proofUrl || submitting} className="bg-red-600 hover:bg-red-700"
              onClick={handleManualSubmit}>
              {submitting ? "提交中..." : "确认已付款"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}