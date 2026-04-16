/**
 * PaymentModal (v2)
 * Handles: prepayment, supplement payment, shipping fee payment.
 * Alipay: auto-generates signed link, user clicks pay, callback updates status automatically.
 * Other: upload proof manually.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { X, CreditCard, ExternalLink, CheckCircle, Loader2, Upload } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { updateOrder } from "@/lib/tenantApi";
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
  const navigate = useNavigate();
  const isSupp = mode === "supplement";
  const isShipping = mode === "shipping";

  const rawAmount = isSupp
    ? order.supplement_amount
    : isShipping
    ? order.shipping_fee_amount
    : order.prepayment_amount;

  const cur = isShipping ? (order.shipping_fee_currency || "CNY") : (order.prepayment_currency || "CNY");

  // For shipping: combine shipping fee + item size fee
  const itemSizeFee = isShipping && order.item_size_extra_fee > 0 ? order.item_size_extra_fee : 0;

  // JPY and CNY amounts round to nearest integer
  const roundAmount = (val, currency) => {
    if (!val) return 0;
    const num = parseFloat(val);
    return (currency === "CNY" || currency === "JPY") ? Math.round(num) : num;
  };

  const defaultAmount = roundAmount(rawAmount, cur);

  const title = isSupp ? "补款" : isShipping ? "运费付款" : "预付款";
  const amountLabel = cur === "JPY"
    ? `${title}金额：${Math.round(defaultAmount).toLocaleString()} yen`
    : cur === "CNY"
    ? `${title}金额：${Math.round(defaultAmount)} yuan`
    : `${title}金额：${cur} ${Math.round(defaultAmount)}`;

  const [method, setMethod] = useState("");
  const [paidAmount, setPaidAmount] = useState(String(defaultAmount));

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
    // Navigate current tab to alipay — return_url will bring user back to MyOrders
    if (url) window.location.href = url;
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
    await updateOrder(order.id, updates);
    onSuccess?.();
  };

  // Upload proof then auto-submit and navigate to MyOrders
  const handleProofUploaded = async (file) => {
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setProofUrl(file_url);
    setUploading(false);
    // Auto-submit
    setSubmitting(true);
    const updates = {
      payment_method: method,
      payment_proof_url: file_url,
      payment_status: "paid",
      order_status: "pending_purchase",
    };
    if (isShipping) {
      updates.order_status = "ready_to_ship";
    } else if (isSupp) {
      updates.supplement_requested = false;
      updates.paid_amount = (order.paid_amount || 0) + parseFloat(paidAmount);
    } else {
      updates.paid_amount = (order.paid_amount || 0) + parseFloat(paidAmount);
    }
    await updateOrder(order.id, updates);
    setSubmitting(false);
    onSuccess?.();
    navigate(createPageUrl("MyOrders"));
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
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

           {/* Item size fee breakdown for shipping */}
           {isShipping && itemSizeFee > 0 && (
             <div className="bg-purple-50 border border-purple-100 rounded-lg px-3 py-2.5 space-y-1.5">
               <p className="text-xs text-purple-600 font-medium">费用明细</p>
               <div className="flex items-center justify-between text-xs">
                 <span className="text-gray-600">运费：</span>
                 <span className="font-medium text-gray-800">{cur} {order.shipping_fee_amount}</span>
               </div>
               <div className="flex items-center justify-between text-xs border-t border-purple-100 pt-1">
                 <span className="text-gray-600">物品尺寸费：</span>
                 <span className="font-medium text-purple-700">{order.item_size_fee_currency} {itemSizeFee}</span>
               </div>
               {order.item_size_title && (
                 <div className="text-xs text-gray-500 pt-1 border-t border-purple-100">
                   {order.item_size_title}
                 </div>
               )}
             </div>
           )}

          {/* Only show editable amount for supplement/shipping; for prepay show read-only */}
          <div>
            <Label className="text-sm">付款金额 ({cur})</Label>
            {mode === "prepay" ? (
              <div className="mt-1 h-9 flex items-center px-3 rounded-md border border-input bg-muted text-sm font-medium text-gray-700">
                {paidAmount}
              </div>
            ) : (
              <Input type="number" className="mt-1" value={paidAmount}
                onChange={e => setPaidAmount((cur === "CNY" || cur === "JPY") ? String(Math.round(parseFloat(e.target.value) || 0)) : e.target.value)}
                step={(cur === "CNY" || cur === "JPY") ? "1" : "0.01"} />
            )}
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
              <Button className="w-full bg-blue-600 hover:bg-blue-700"
                onClick={handleGenerateAlipay} disabled={generating || !paidAmount}>
                {generating
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />跳转支付宝中...</>
                  : <><ExternalLink className="w-4 h-4 mr-2" />前往支付宝付款</>}
              </Button>
              <p className="text-xs text-gray-400 text-center">
                点击后将跳转至支付宝，付款成功后自动返回订单页面
              </p>
            </div>
          )}

          {/* Other methods: upload proof */}
          {method && method !== "alipay" && (
            <div className="space-y-3">
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500 text-center">
                请联系客服获取收款账号，完成付款后上传凭证
              </div>
              <div>
                <Label className="text-sm">上传付款凭证（上传后自动提交）</Label>
                <label
                  className="cursor-pointer block mt-1"
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file && file.type.startsWith("image/")) handleProofUploaded(file);
                  }}
                >
                  <div className={`flex flex-col items-center gap-1.5 px-3 py-5 border-2 border-dashed rounded-lg text-sm transition-colors ${
                    proofUrl ? "border-green-300 bg-green-50 text-green-700" :
                    uploading ? "border-blue-200 bg-blue-50 text-blue-500" :
                    "border-gray-200 text-gray-400 hover:border-blue-300 hover:text-blue-500"
                  }`}>
                    {proofUrl
                      ? <><CheckCircle className="w-5 h-5" /><span>凭证已上传，正在提交...</span></>
                      : uploading
                      ? <><Loader2 className="w-5 h-5 animate-spin" /><span>上传中...</span></>
                      : <><Upload className="w-5 h-5" /><span>点击选择图片或拖拽到此处</span></>}
                  </div>
                  <input type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files[0]; if (f) handleProofUploaded(f); }}
                    disabled={uploading || submitting} />
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>取消</Button>
        </div>
      </div>
    </div>
  );
}