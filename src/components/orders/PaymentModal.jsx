/**
 * PaymentModal (v2)
 * Handles: prepayment, supplement payment, shipping fee payment.
 * Alipay: auto-generates signed link, user clicks pay, callback updates status automatically.
 * Other: upload proof manually.
 */
import { useState } from "react";
import { X, CreditCard, ExternalLink, CheckCircle, Loader2, Upload } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";

const METHODS = [
  { value: "alipay",        label: "支付宝" },
  { value: "wechatpay",     label: "微信支付" },
  { value: "bank_transfer", label: "银行转账" },
  { value: "other",         label: "其他" },
];

/**
 * @param {object}   order
 * @param {"prepay"|"supplement"|"shipping"} mode
 * @param {function} onClose
 * @param {function} onSuccess
 */
export default function PaymentModal({ order, mode = "prepay", onClose, onSuccess }) {
  const isSupp = mode === "supplement";
  const isShipping = mode === "shipping";

  const defaultAmount = isSupp
    ? order.supplement_amount
    : isShipping
    ? order.shipping_fee_amount
    : order.prepayment_amount;

  const cur = isShipping ? (order.shipping_fee_currency || "CNY") : (order.prepayment_currency || "CNY");

  const title = isSupp ? "补款" : isShipping ? "运费付款" : "预付款";
  const amountLabel = `${title}金额：${cur} ${parseFloat(defaultAmount || 0).toFixed(2)}`;

  const [method, setMethod] = useState("");
  const [paidAmount, setPaidAmount] = useState(parseFloat(defaultAmount || 0).toFixed(2));

  // Alipay
  const [alipayUrl, setAlipayUrl] = useState(null);
  const [generating, setGenerating] = useState(false);

  // Manual
  const [proofUrl, setProofUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleGenerateAlipay = async () => {
    setGenerating(true);
    const subject = isShipping
      ? `同一物流运费 - ${order.product_name}`
      : `同一物流代购 - ${order.product_name}`;

    const res = await base44.functions.invoke("generateAlipayPaymentLink", {
      orderId: order.id,
      amount: parseFloat(paidAmount),
      currency: cur,
      subject,
      paymentType: isShipping ? "shipping" : "order",
    });
    const url = res.data?.paymentUrl;
    setAlipayUrl(url);
    setGenerating(false);
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

  // For non-alipay: manual confirm
  const handleManualSubmit = async () => {
    setSubmitting(true);
    const updates = {
      payment_method: method,
      payment_proof_url: proofUrl,
      payment_status: "paid",
    };
    if (isShipping) {
      updates.order_status = "ready_to_ship";
    } else if (isSupp) {
      updates.order_status = "paid";
      updates.supplement_requested = false;
      updates.paid_amount = (order.paid_amount || 0) + parseFloat(paidAmount);
    } else {
      updates.order_status = "paid";
      updates.paid_amount = (order.paid_amount || 0) + parseFloat(paidAmount);
    }
    await base44.entities.Order.update(order.id, updates);
    onSuccess?.();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="font-semibold text-gray-900">{title}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{order.product_name} · {order.order_number}</p>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-500" /></button>
        </div>

        <div className="px-5 py-5 space-y-4">
          <Alert className="border-yellow-200 bg-yellow-50 py-2.5">
            <CreditCard className="w-4 h-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800 text-sm font-medium">{amountLabel}</AlertDescription>
          </Alert>

          <div>
            <Label className="text-sm">实付金额 ({cur})</Label>
            <Input type="number" className="mt-1" value={paidAmount}
              onChange={e => setPaidAmount(e.target.value)} step="0.01" />
          </div>

          {/* Method selection */}
          <div>
            <Label className="text-sm mb-2 block">选择支付方式</Label>
            <div className="grid grid-cols-2 gap-2">
              {METHODS.map(m => (
                <button key={m.value} type="button"
                  onClick={() => { setMethod(m.value); setAlipayUrl(null); setProofUrl(""); }}
                  className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                    method === m.value
                      ? "border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-200"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                >{m.label}</button>
              ))}
            </div>
          </div>

          {/* Alipay flow */}
          {method === "alipay" && (
            <div className="space-y-3">
              {!alipayUrl ? (
                <Button className="w-full bg-blue-600 hover:bg-blue-700"
                  onClick={handleGenerateAlipay} disabled={generating || !paidAmount}>
                  {generating
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />生成付款链接中...</>
                    : <><ExternalLink className="w-4 h-4 mr-2" />生成支付宝付款链接</>}
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 text-green-700 text-sm font-medium mb-2">
                      <CheckCircle className="w-4 h-4" />付款链接已生成，已自动在新标签打开
                    </div>
                    <a href={alipayUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 rounded-md transition-colors">
                      <ExternalLink className="w-4 h-4" />重新打开支付宝付款页
                    </a>
                  </div>
                  <p className="text-xs text-gray-400 text-center">
                    支付宝付款成功后系统将自动更新订单状态，无需手动确认
                  </p>
                  <Button variant="outline" size="sm" className="w-full text-xs"
                    onClick={() => { setAlipayUrl(null); }}>
                    重新生成链接
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Other methods: upload proof */}
          {method && method !== "alipay" && (
            <div className="space-y-3">
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500 text-center">
                请联系客服获取收款账号，完成付款后上传凭证
              </div>
              <div>
                <Label className="text-sm">上传付款凭证</Label>
                <label className="cursor-pointer block mt-1">
                  <div className={`flex items-center gap-2 px-3 py-2.5 border-2 border-dashed rounded-lg text-sm transition-colors justify-center ${
                    proofUrl ? "border-green-300 bg-green-50 text-green-700" : "border-gray-200 text-gray-400 hover:border-gray-300"
                  }`}>
                    {proofUrl
                      ? <><CheckCircle className="w-4 h-4" />凭证已上传</>
                      : <><Upload className="w-4 h-4" />{uploading ? "上传中..." : "点击上传截图"}</>}
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={handleUploadProof} disabled={uploading} />
                </label>
              </div>
            </div>
          )}
        </div>

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