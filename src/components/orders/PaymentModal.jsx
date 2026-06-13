/**
 * PaymentModal (v2)
 * Handles: prepayment, supplement payment, shipping fee payment.
 * Alipay: auto-generates signed link, user clicks pay, callback updates status automatically.
 * Other: upload proof manually.
 */
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { X, CreditCard, ExternalLink, CheckCircle, Loader2, Upload, Lock } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { usePermissions } from "@/hooks/usePermissions";
import { updateOrder } from "@/lib/tenantApi";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import PaymentMethodSelector from "@/components/common/PaymentMethodSelector";

/**
 * @param {object}   order
 * @param {"prepay"|"supplement"|"shipping"} mode
 * @param {function} onClose
 * @param {function} onSuccess
 */
export default function PaymentModal({ order, mode = "prepay", onClose, onSuccess }) {
  const navigate = useNavigate();
  const { can } = usePermissions();
  
  // Check payment permissions based on mode
  const canPayment = mode === "shipping" ? true : can("payment:self_pay") || can("payment:manual_pay");
  
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
  const [selectedMethodMeta, setSelectedMethodMeta] = useState(null); // { value, label, payment_note, image_url, payment_currency }
  const [paidAmount, setPaidAmount] = useState(String(defaultAmount));
  const [rates, setRates] = useState(null);
  // Store as state so async handlers (handleProofUploaded) capture the latest value
  const [snapshotRate, setSnapshotRate] = useState(null); // { payCurrency, rate } when non-JPY method selected
  // Surcharge from backend (computed per selected payment method)
  const [surchargeJpy, setSurchargeJpy] = useState(0);
  const [finalAmountJpy, setFinalAmountJpy] = useState(defaultAmount);

  // Fetch exchange rates once on mount (for non-JPY currency display)
  useEffect(() => {
    fetch('https://v6.exchangerate-api.com/v6/89e2f91c758d92aa2c06667b/latest/JPY')
      .then(r => r.json())
      .then(d => { if (d?.result === 'success') setRates(d.conversion_rates); })
      .catch(() => {});
  }, []);

  // When method changes (for prepay mode), reload surcharge from backend
  useEffect(() => {
    if (!isShipping && !isSupp && order?.id && method) {
      base44.functions.invoke('getPaymentPageData', { order_id: order.id, payment_method_key: method })
        .then(r => {
          const d = r.data || {};
          const sc = d.surchargeJpy ?? 0;
          const total = d.paymentAmountWithSurcharge ?? defaultAmount;
          setSurchargeJpy(sc);
          setFinalAmountJpy(total);
          setPaidAmount(String(Math.round(total)));
        })
        .catch(() => {});
    } else if (!method) {
      setSurchargeJpy(0);
      setFinalAmountJpy(defaultAmount);
      setPaidAmount(String(defaultAmount));
    }
  }, [method]);

  // Currency conversion helpers
  const CURRENCY_SYMBOLS = { JPY: "¥", CNY: "¥", USD: "$", TWD: "NT$", HKD: "HK$", EUR: "€", SGD: "S$" };
  const payCurrency = selectedMethodMeta?.payment_currency || cur;

  // Compute converted amount from JPY base → payCurrency
  // defaultAmount is in `cur`; rates are relative to JPY
  let convertedDisplay = null;
  let convertedRate = null;
  if (payCurrency !== "JPY" && rates && rates[payCurrency] && rates[cur]) {
    const amountInJpy = defaultAmount / rates[cur]; // cur → JPY
    const converted = amountInJpy * rates[payCurrency]; // JPY → payCurrency
    const decimals = ["TWD", "HKD", "CNY"].includes(payCurrency) ? 1 : 2;
    const sym = CURRENCY_SYMBOLS[payCurrency] || payCurrency;
    convertedDisplay = `${sym}${converted.toFixed(decimals)} ${payCurrency}`;
    convertedRate = rates[payCurrency]; // JPY→payCurrency rate
  }

  // Keep snapshotRate in sync with current convertedRate so async handlers can read it reliably
  useEffect(() => {
    if (convertedRate && payCurrency && payCurrency !== "JPY") {
      setSnapshotRate({ payCurrency, rate: convertedRate });
    } else if (!selectedMethodMeta || selectedMethodMeta.payment_currency === "JPY") {
      setSnapshotRate(null);
    }
  }, [convertedRate, payCurrency, selectedMethodMeta]);

  // Alipay
  const [alipayUrl, setAlipayUrl] = useState(null);
  const [generating, setGenerating] = useState(false);

  // Manual
  const [proofUrl, setProofUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  const handleGenerateAlipay = async () => {
    setGenerating(true);
    const subject = isShipping
      ? `同一物流运费 - ${order.product_name}`
      : `同一物流代购 - ${order.product_name}`;

    // For prepay, use finalAmountJpy (includes surcharge); for shipping/supplement use paidAmount as-is
    const amountToCharge = (!isShipping && !isSupp && surchargeJpy > 0) ? finalAmountJpy : parseFloat(paidAmount);

    const res = await base44.functions.invoke("generateAlipayPaymentLink", {
      orderId: order.id,
      amount: amountToCharge,
      currency: cur,
      subject,
      paymentType: isShipping ? "shipping" : "order",
    });
    const url = res.data?.paymentUrl;
    setAlipayUrl(url);
    setGenerating(false);
    // Open Alipay in a new tab; after payment, that tab auto-closes and notifies this page via postMessage
    if (url) window.open(url, "_blank");
  };

  // Build actual-currency fields when paying in a non-JPY currency.
  // Per architecture: prepayment_amount stays in JPY (internal base currency).
  // Uses snapshotRate (state) to avoid stale-closure bugs in async handlers.
  const buildActualCurrencyUpdates = (currentPaidAmount) => {
    const snap = snapshotRate;
    if (!snap || snap.payCurrency === "JPY") return {};
    const jpyAmount = parseFloat(currentPaidAmount ?? paidAmount) || 0;
    const foreignAmount = parseFloat((jpyAmount * snap.rate).toFixed(2));
    if (!foreignAmount) return {};
    const updates = {
      prepayment_currency: snap.payCurrency,
      prepayment_amount_jpy: jpyAmount,
      prepayment_rate_jpy_cny: snap.rate,
    };
    if (snap.payCurrency === "CNY") {
      updates.prepayment_amount_cny = foreignAmount;
    }
    return updates;
  };

  // For non-alipay: manual confirm
  const handleManualSubmit = async () => {
    setSubmitting(true);
    const currentPaidAmount = paidAmount;
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
      updates.paid_amount = (order.paid_amount || 0) + parseFloat(currentPaidAmount);
      Object.assign(updates, buildActualCurrencyUpdates(currentPaidAmount));
    } else {
      updates.order_status = "paid";
      updates.paid_amount = (order.paid_amount || 0) + parseFloat(currentPaidAmount);
      Object.assign(updates, buildActualCurrencyUpdates(currentPaidAmount));
    }
    await updateOrder(order.id, updates);
    onSuccess?.();
  };

  // Upload proof then auto-submit and navigate to MyOrders
  const handleProofUploaded = async (file) => {
    // Capture current values before any async gaps
    const currentPaidAmount = paidAmount;
    const currencyUpdates = buildActualCurrencyUpdates(currentPaidAmount);

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
      updates.paid_amount = (order.paid_amount || 0) + parseFloat(currentPaidAmount);
      Object.assign(updates, currencyUpdates);
    } else {
      updates.paid_amount = (order.paid_amount || 0) + parseFloat(currentPaidAmount);
      Object.assign(updates, currencyUpdates);
    }
    await updateOrder(order.id, updates);
    setSubmitting(false);
    onSuccess?.();
    navigate(createPageUrl("MyOrders"));
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onMouseDown={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onMouseDown={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="font-semibold text-gray-900">{title}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{order.product_name} · {order.order_number}</p>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-500" /></button>
        </div>

        <div className="px-5 py-5 space-y-4">
           {!canPayment && (
             <Alert className="border-red-200 bg-red-50 py-2.5">
               <Lock className="w-4 h-4 text-red-600" />
               <AlertDescription className="text-red-800 text-sm font-medium">您没有权限进行此支付操作</AlertDescription>
             </Alert>
           )}
           <Alert className="border-yellow-200 bg-yellow-50 py-2.5">
             <CreditCard className="w-4 h-4 text-yellow-600" />
             <AlertDescription className="text-yellow-800 text-sm font-medium">{amountLabel}</AlertDescription>
           </Alert>

           {/* Surcharge breakdown — only for prepay mode when a surcharge applies */}
           {!isShipping && !isSupp && surchargeJpy > 0 && method && (
             <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-xs space-y-1">
               <div className="flex justify-between text-yellow-700">
                 <span>订单金额</span>
                 <span>¥{defaultAmount.toLocaleString()} JPY</span>
               </div>
               <div className="flex justify-between text-yellow-700">
                 <span>支付手续费（{selectedMethodMeta?.surcharge_rate > 0 ? `${selectedMethodMeta.surcharge_rate}%` : ''}{selectedMethodMeta?.surcharge_rate > 0 && selectedMethodMeta?.surcharge_fixed_jpy > 0 ? ' + ' : ''}{selectedMethodMeta?.surcharge_fixed_jpy > 0 ? `¥${selectedMethodMeta.surcharge_fixed_jpy}` : ''}）</span>
                 <span>+¥{Math.round(surchargeJpy).toLocaleString()} JPY</span>
               </div>
               <div className="flex justify-between font-semibold text-yellow-800 border-t border-yellow-200 pt-1">
                 <span>实付合计</span>
                 <span>¥{Math.round(finalAmountJpy).toLocaleString()} JPY</span>
               </div>
             </div>
           )}

           {/* Non-JPY currency conversion notice — only show when a method is selected */}
           {convertedDisplay && method && (
             <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 space-y-1">
               <div className="flex items-center justify-between text-xs text-gray-500">
                 <span>汇率换算参考</span>
                 <span>1 JPY ≈ {convertedRate?.toFixed(4)} {payCurrency}</span>
               </div>
               <div className="flex items-center justify-between">
                 <span className="text-sm font-semibold text-orange-700">实际应付（{payCurrency}）</span>
                 <span className="text-lg font-bold text-orange-600">{convertedDisplay}</span>
               </div>
               <p className="text-xs text-orange-400">汇率实时参考，以实际到账为准</p>
             </div>
           )}

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
            <PaymentMethodSelector
              value={method}
              onChange={m => { setMethod(m.value); setSelectedMethodMeta(m); setAlipayUrl(null); setProofUrl(""); }}
              disabled={!canPayment}
            />
          </div>

          {/* Alipay flow */}
          {method === "alipay" && canPayment && (
            <div className="space-y-3">
              <Button className="w-full bg-blue-600 hover:bg-blue-700"
                onClick={handleGenerateAlipay} disabled={generating || !paidAmount || !canPayment}>
                {generating
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />生成链接中...</>
                  : <><ExternalLink className="w-4 h-4 mr-2" />{alipayUrl ? "重新打开支付宝付款" : "打开支付宝付款"}</>}
              </Button>
              {alipayUrl && (
                <p className="text-xs text-green-600 text-center bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                  ✓ 支付宝已在新标签打开，付款完成后该标签将自动关闭并刷新此页面
                </p>
              )}
              {!alipayUrl && (
                <p className="text-xs text-gray-400 text-center">
                  点击后将在新标签打开支付宝，付款成功后自动关闭并返回
                </p>
              )}
            </div>
          )}

          {/* Other methods: upload proof */}
          {method && method !== "alipay" && canPayment && (
            <div className="space-y-3">
              {/* Show payment note + QR from admin config if available */}
              {(selectedMethodMeta?.payment_note || selectedMethodMeta?.image_url) ? (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
                  {selectedMethodMeta.image_url && (
                    <div className="text-center">
                      <img src={selectedMethodMeta.image_url} alt="收款码" className="h-40 mx-auto rounded object-contain border border-gray-200" />
                    </div>
                  )}
                  {selectedMethodMeta.payment_note && (
                    <p className="text-sm text-gray-700 whitespace-pre-wrap text-center">{selectedMethodMeta.payment_note}</p>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500 text-center">
                  请联系客服获取收款账号，完成付款后上传凭证
                </div>
              )}
              <div>
                <Label className="text-sm">上传付款凭证（上传后自动提交）</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => { const f = e.target.files[0]; if (f) handleProofUploaded(f); e.target.value = ""; }}
                  disabled={uploading || submitting}
                />
                <div
                  className={`mt-1 flex flex-col items-center gap-1.5 px-3 py-5 border-2 border-dashed rounded-lg text-sm transition-colors cursor-pointer ${
                    proofUrl ? "border-green-300 bg-green-50 text-green-700" :
                    uploading ? "border-blue-200 bg-blue-50 text-blue-500" :
                    "border-gray-200 text-gray-400 hover:border-blue-300 hover:text-blue-500"
                  }`}
                  onClick={() => { if (!uploading && !submitting) fileInputRef.current?.click(); }}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file && file.type.startsWith("image/")) handleProofUploaded(file);
                  }}
                >
                  {proofUrl
                    ? <><CheckCircle className="w-5 h-5" /><span>凭证已上传，正在提交...</span></>
                    : uploading
                    ? <><Loader2 className="w-5 h-5 animate-spin" /><span>上传中...</span></>
                    : <><Upload className="w-5 h-5" /><span>点击选择图片或拖拽到此处</span></>}
                </div>
                <input
                  type="text"
                  placeholder="或点击此处后粘贴截图（Ctrl+V / ⌘V）"
                  className="w-full h-9 px-3 mt-2 text-xs border border-gray-300 rounded-md bg-white text-gray-500 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 transition-colors"
                  disabled={uploading || submitting}
                  onPaste={e => {
                    const item = Array.from(e.clipboardData.items).find(i => i.type.startsWith("image/"));
                    if (item) { e.preventDefault(); const f = item.getAsFile(); if (f) handleProofUploaded(f); }
                  }}
                  readOnly
                />
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