/**
 * BulkPaymentModal
 * Allows user to pay for multiple payment_pending orders at once.
 * Shows a summary of all selected orders, then lets user upload proof and confirm.
 */
import { useState } from "react";
import { X, CreditCard, Upload, CheckCircle, Package, Loader2, ExternalLink } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const METHODS = [
  { value: "alipay",        label: "支付宝" },
  { value: "wechatpay",     label: "微信支付" },
  { value: "bank_transfer", label: "银行转账" },
  { value: "other",         label: "其他" },
];

export default function BulkPaymentModal({ orders, onClose, onSuccess }) {
  const [method, setMethod] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [alipayUrl, setAlipayUrl] = useState(null);
  const [generating, setGenerating] = useState(false);

  // Total by currency
  const totals = orders.reduce((acc, o) => {
    const cur = o.prepayment_currency || "CNY";
    acc[cur] = (acc[cur] || 0) + (o.prepayment_amount || 0);
    return acc;
  }, {});

  const formatTotal = (cur, val) => {
    if (cur === "JPY") return `${Math.round(val).toLocaleString()} yen`;
    if (cur === "CNY") return `${Math.round(val)} yuan`;
    return `${cur} ${val.toFixed(2)}`;
  };

  const handleUploadProof = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setProofUrl(file_url);
    setUploading(false);
  };

  const handleManualSubmit = async () => {
    setSubmitting(true);
    await Promise.all(orders.map(o =>
      base44.entities.Order.update(o.id, {
        payment_method: method,
        payment_proof_url: proofUrl,
        payment_status: "paid",
        order_status: "paid",
        paid_amount: (o.paid_amount || 0) + (o.prepayment_amount || 0),
      })
    ));
    onSuccess?.();
  };

  // Alipay: generate link for each order individually
  const handleGenerateAlipay = async () => {
    setGenerating(true);
    const results = {};
    for (const o of orders) {
      const res = await base44.functions.invoke("generateAlipayPaymentLink", {
        orderId: o.id,
        amount: o.prepayment_amount,
        currency: o.prepayment_currency || "CNY",
        subject: `同一物流代购 - ${o.product_name}`,
        paymentType: "order",
      });
      if (res.data?.paymentUrl) {
        results[o.id] = res.data.paymentUrl;
      }
    }
    setAlipayUrls(results);
    setGenerating(false);
    // Open first one automatically
    const first = Object.values(results)[0];
    if (first) window.open(first, "_blank");
  };

  const allAlipayGenerated = orders.every(o => alipayUrls[o.id]);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="font-semibold text-gray-900">批量付款</h2>
            <p className="text-xs text-gray-400 mt-0.5">已选 {orders.length} 笔待付款订单</p>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-500" /></button>
        </div>

        <div className="px-5 py-5 space-y-5">
          {/* Order list */}
          <div className="border border-gray-100 rounded-lg overflow-hidden">
            {orders.map((o, i) => (
              <div key={o.id} className={`flex items-center justify-between px-3 py-2.5 text-sm ${i > 0 ? "border-t border-gray-100" : ""}`}>
                <div className="flex items-center gap-2 min-w-0">
                  <Package className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-800 truncate">{o.product_name}</span>
                  {o.order_number && <span className="text-xs text-gray-400 flex-shrink-0">{o.order_number}</span>}
                </div>
                <span className="text-gray-700 font-medium flex-shrink-0 ml-2">
                  {o.prepayment_currency === "JPY"
                    ? `${Math.round(o.prepayment_amount || 0).toLocaleString()} yen`
                    : `${o.prepayment_currency || "CNY"} ${Math.round(o.prepayment_amount || 0)}`}
                </span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-3">
            <p className="text-xs text-red-500 font-medium mb-1">合计金额</p>
            {Object.entries(totals).map(([cur, val]) => (
              <p key={cur} className="text-lg font-bold text-red-700">{formatTotal(cur, val)}</p>
            ))}
            {Object.keys(totals).length > 1 && (
              <p className="text-xs text-red-400 mt-1">含多种货币，请按实际金额分别付款</p>
            )}
          </div>

          {/* Method selection */}
          <div>
            <Label className="text-sm mb-2 block">选择支付方式</Label>
            <div className="grid grid-cols-2 gap-2">
              {METHODS.map(m => (
                <button key={m.value} type="button"
                  onClick={() => { setMethod(m.value); setAlipayUrls({}); setProofUrl(""); }}
                  className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                    method === m.value
                      ? "border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-200"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                >{m.label}</button>
              ))}
            </div>
          </div>

          {/* Alipay: generate individual links */}
          {method === "alipay" && (
            <div className="space-y-3">
              {!allAlipayGenerated ? (
                <Button className="w-full bg-blue-600 hover:bg-blue-700"
                  onClick={handleGenerateAlipay} disabled={generating}>
                  {generating
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />生成付款链接中...</>
                    : <><ExternalLink className="w-4 h-4 mr-2" />为所有订单生成支付宝链接</>}
                </Button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-green-600 font-medium flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" />已生成全部付款链接，请逐一完成付款
                  </p>
                  {orders.map(o => (
                    alipayUrls[o.id] && (
                      <a key={o.id} href={alipayUrls[o.id]} target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-between gap-2 w-full border border-blue-200 bg-blue-50 text-blue-700 text-sm px-3 py-2 rounded-lg hover:bg-blue-100 transition-colors">
                        <span className="truncate">{o.product_name}</span>
                        <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                      </a>
                    )
                  ))}
                  <p className="text-xs text-gray-400 text-center">支付宝付款成功后系统将自动更新订单状态</p>
                </div>
              )}
            </div>
          )}

          {/* Other methods: single proof upload */}
          {method && method !== "alipay" && (
            <div className="space-y-3">
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500 text-center">
                请联系客服获取收款账号，付款后上传凭证（可上传同一张截图）
              </div>
              <div>
                <Label className="text-sm">上传付款凭证</Label>
                <label className="cursor-pointer block mt-1">
                  <div className={`flex items-center gap-2 px-3 py-2.5 border-2 border-dashed rounded-lg text-sm justify-center transition-colors ${
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
              {submitting ? "提交中..." : `确认付款 (${orders.length} 笔)`}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}