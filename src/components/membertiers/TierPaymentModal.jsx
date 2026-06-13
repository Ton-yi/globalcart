/**
 * TierPaymentModal — 会员阶级购买支付弹窗
 * 完整支付方式选择：支付宝（自动确认，跳转支付）/ 手动确认方式（上传凭证后提交，等管理员确认）
 */
import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import PaymentMethodSelector from "@/components/common/PaymentMethodSelector";
import { X, CreditCard, ExternalLink, Loader2, Upload, CheckCircle } from "lucide-react";

const CURRENCY_SYMBOLS = { JPY: "¥", CNY: "¥", USD: "$", TWD: "NT$", HKD: "HK$", EUR: "€", SGD: "S$" };

export default function TierPaymentModal({ tier, onClose, onSuccess }) {
  const [method, setMethod] = useState("");
  const [meta, setMeta] = useState(null);
  const [rates, setRates] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [proofUrl, setProofUrl] = useState("");
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetch('https://v6.exchangerate-api.com/v6/89e2f91c758d92aa2c06667b/latest/JPY')
      .then(r => r.json())
      .then(d => { if (d?.result === 'success') setRates(d.conversion_rates); })
      .catch(() => {});
  }, []);

  const payable = tier.payable_jpy || 0;
  const payCurrency = meta?.payment_currency || "JPY";
  let convertedDisplay = null;
  let convertedRate = null;
  if (payCurrency !== "JPY" && rates?.[payCurrency]) {
    convertedRate = rates[payCurrency];
    const converted = payable * convertedRate;
    const decimals = ["TWD", "HKD", "CNY"].includes(payCurrency) ? 1 : 2;
    const sym = CURRENCY_SYMBOLS[payCurrency] || payCurrency;
    convertedDisplay = `${sym}${converted.toFixed(decimals)} ${payCurrency}`;
  }

  const isAlipay = method === "alipay";

  const handleAlipay = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("purchaseMemberTier", {
        action: "create_payment",
        tier_id: tier.id,
      });
      if (res.data?.error) {
        setError(res.data.error);
      } else if (res.data?.paymentUrl) {
        window.location.href = res.data.paymentUrl;
        return;
      }
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    }
    setGenerating(false);
  };

  const submitManual = async (finalProofUrl) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("purchaseMemberTier", {
        action: "submit_manual",
        tier_id: tier.id,
        payment_method: meta?.label || method,
        payment_proof_url: finalProofUrl || "",
      });
      if (res.data?.error) {
        setError(res.data.error);
        setSubmitting(false);
        return;
      }
      onSuccess?.();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
      setSubmitting(false);
    }
  };

  const handleProofUploaded = async (file) => {
    setUploading(true);
    setError(null);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setProofUrl(file_url);
    setUploading(false);
    await submitManual(file_url);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onMouseDown={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="font-semibold text-gray-900">购买会员阶级</h2>
            <p className="text-xs text-gray-400 mt-0.5">{tier.name}</p>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-500" /></button>
        </div>

        <div className="px-5 py-5 space-y-4">
          {error && (
            <Alert className="border-red-200 bg-red-50 py-2.5">
              <AlertDescription className="text-red-700 text-sm">{error}</AlertDescription>
            </Alert>
          )}

          <Alert className="border-yellow-200 bg-yellow-50 py-2.5">
            <CreditCard className="w-4 h-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800 text-sm font-medium">
              应付差价：¥{payable.toLocaleString()} JPY
            </AlertDescription>
          </Alert>

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

          <div>
            <Label className="text-sm mb-2 block">选择支付方式</Label>
            <PaymentMethodSelector
              value={method}
              onChange={m => { setMethod(m.value); setMeta(m); setProofUrl(""); setError(null); }}
            />
          </div>

          {/* Alipay: auto-confirm flow */}
          {isAlipay && (
            <div className="space-y-2">
              <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={handleAlipay} disabled={generating}>
                {generating
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />生成链接中...</>
                  : <><ExternalLink className="w-4 h-4 mr-2" />打开支付宝付款</>}
              </Button>
              <p className="text-xs text-gray-400 text-center">支付成功后系统将自动为您升级阶级</p>
            </div>
          )}

          {/* Manual methods: payment note + proof upload */}
          {method && !isAlipay && (
            <div className="space-y-3">
              {(meta?.payment_note || meta?.image_url) ? (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
                  {meta.image_url && (
                    <div className="text-center">
                      <img src={meta.image_url} alt="收款码" className="h-40 mx-auto rounded object-contain border border-gray-200" />
                    </div>
                  )}
                  {meta.payment_note && (
                    <p className="text-sm text-gray-700 whitespace-pre-wrap text-center">{meta.payment_note}</p>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500 text-center">
                  请联系客服获取收款账号，完成付款后上传凭证
                </div>
              )}
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                此方式需管理员人工确认收款后才会升级阶级
              </p>
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
                <Button variant="outline" size="sm" className="w-full mt-2" disabled={uploading || submitting}
                  onClick={() => submitManual("")}>
                  {submitting ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : null}
                  暂不上传凭证，直接提交
                </Button>
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