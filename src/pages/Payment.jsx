import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ExternalLink, Copy, CheckCircle, AlertCircle, ArrowLeft, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Payment() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get("order_id");
  const method = urlParams.get("method") || "alipay";

  const [order, setOrder] = useState(null);
  const [settings, setSettings] = useState({});
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [rates, setRates] = useState(null);
  const [proofFile, setProofFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generatingLink, setGeneratingLink] = useState(false);

  useEffect(() => {
    if (!orderId) { navigate(createPageUrl("MyOrders")); return; }
    base44.functions.invoke('getPaymentPageData', { order_id: orderId })
      .then(r => {
        const data = r.data || {};
        if (!data.order) { navigate(createPageUrl("MyOrders")); return; }
        setOrder(data.order);
        setSettings(data.settings || {});
        setPaymentMethods(data.paymentMethods || []);
        setRates(data.rates || null);
        setLoading(false);
      });
  }, [orderId]);

  const handleGenerateAlipayLink = async () => {
    setGeneratingLink(true);
    const res = await base44.functions.invoke('generateAlipayPaymentLink', {
      orderId: order.id,
      amount: order.prepayment_amount,
      subject: `同一物流代购 - ${order.product_name}`,
    });
    setGeneratingLink(false);
    window.open(res.data.paymentUrl, '_blank');
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUploadAndSubmit = async (file) => {
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setProofFile(file_url);
    setUploading(false);
    await base44.functions.invoke('updateTenantOrder', {
      order_id: order.id,
      payment_proof_url: file_url,
      payment_method: method,
      payment_status: "paid",
      order_status: "pending_purchase",
      paid_amount: order.prepayment_amount,
    });
    setSubmitted(true);
    setTimeout(() => navigate(createPageUrl("MyOrders")), 2000);
  };

  if (loading) return <div className="text-center py-20 text-gray-400">加载中...</div>;

  const amountJpy = order?.prepayment_amount || 0;
  const amountJpyDisplay = Math.round(amountJpy).toLocaleString();

  // Find the configured payment method for current selection
  const activeMethod = paymentMethods.find(m => (m.provider_key || m.name) === method);
  // Alipay gateway info: prefer PaymentMethod entity, fall back to SiteSettings
  const alipayAccount = settings["alipay_account"] || "";
  const alipayName = settings["alipay_account_name"] || "";
  const alipayQr = activeMethod?.image_url || settings["alipay_qr_url"] || "";
  const methodLabel = activeMethod?.name || method;

  // Currency conversion
  const payCurrency = activeMethod?.payment_currency || "JPY";
  const isJpy = payCurrency === "JPY";
  let convertedAmount = null;
  let convertedDisplay = null;
  if (!isJpy && rates && rates[payCurrency]) {
    const converted = amountJpy * rates[payCurrency];
    // Round to 2 decimals for most currencies, 0 for TWD/HKD
    const decimals = ["TWD", "HKD", "CNY"].includes(payCurrency) ? 1 : 2;
    convertedAmount = converted.toFixed(decimals);
    convertedDisplay = `${payCurrency} ${parseFloat(convertedAmount).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
  }

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(createPageUrl("MyOrders"))}>
          <ArrowLeft className="w-4 h-4 mr-1" />返回
        </Button>
        <h1 className="text-xl font-bold text-gray-900">付款</h1>
      </div>

      {/* Order Summary */}
      <Card className="border-gray-200">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm font-medium text-gray-800">{order.product_name}</div>
              <div className="text-xs text-gray-400 mt-0.5">订单号：{order.order_number}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-400">预付款金额（JPY）</div>
              <div className="text-2xl font-bold text-red-600">¥{amountJpyDisplay}</div>
              {convertedDisplay && (
                <div className="text-sm font-semibold text-orange-600 mt-0.5">≈ {convertedDisplay}</div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Method: Alipay */}
      {method === "alipay" && (
        <Card className="border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <div className="w-6 h-6 bg-blue-500 rounded flex items-center justify-center">
                <span className="text-white text-xs font-bold">支</span>
              </div>
              支付宝付款
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Auto-generate Alipay payment link */}
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700"
              onClick={handleGenerateAlipayLink}
              disabled={generatingLink}
            >
              {generatingLink
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />生成链接并前往支付中...</>
                : <><ExternalLink className="w-4 h-4 mr-2" />前往支付宝完成付款</>}
            </Button>

            {alipayQr ? (
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-2">扫描二维码付款</p>
                <img src={alipayQr} alt="支付宝收款码" className="w-48 h-48 mx-auto border border-gray-200 rounded-lg object-contain" />
              </div>
            ) : null}

            {alipayAccount && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-gray-500">支付宝账号</div>
                    <div className="text-sm font-medium text-gray-800">{alipayAccount}</div>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleCopy(alipayAccount)}>
                    {copied ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                </div>
                {alipayName && (
                  <div>
                    <div className="text-xs text-gray-500">收款人姓名</div>
                    <div className="text-sm font-medium text-gray-800">{alipayName}</div>
                  </div>
                )}
              </div>
            )}

            <div className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-200 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">付款金额（JPY）</span>
                <span className="text-lg font-bold text-red-600">¥{amountJpyDisplay}</span>
              </div>
              {convertedDisplay && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-orange-600">实付金额（{payCurrency}）</span>
                  <span className="text-lg font-bold text-orange-600">{convertedDisplay}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Other methods — show QR and note from admin config */}
      {method !== "alipay" && (
        <Card className="border-gray-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              {activeMethod?.icon && <span className="text-base">{activeMethod.icon}</span>}
              {methodLabel} 付款
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeMethod?.image_url && (
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-2">扫描二维码付款</p>
                <img src={activeMethod.image_url} alt="收款码" className="w-48 h-48 mx-auto border border-gray-200 rounded-lg object-contain" />
              </div>
            )}
            {activeMethod?.payment_note ? (
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{activeMethod.payment_note}</p>
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center">请联系客服获取付款信息</p>
            )}
            <div className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-200 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">付款金额（JPY）</span>
                <span className="text-lg font-bold text-red-600">¥{amountJpyDisplay}</span>
              </div>
              {convertedDisplay && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-orange-600">实付金额（{payCurrency}）</span>
                  <span className="text-lg font-bold text-orange-600">{convertedDisplay}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload proof - only for non-alipay methods */}
      {method !== "alipay" && (
        !submitted ? (
          <Card className="border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-700">上传付款凭证（上传后自动提交）</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-gray-400">请在付款完成后上传付款截图或凭证，上传后将自动提交</p>
              <label
                className="cursor-pointer block"
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file && file.type.startsWith("image/")) handleUploadAndSubmit(file);
                }}
              >
                <div className={`flex flex-col items-center gap-2 border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                  proofFile ? "border-green-300 bg-green-50 text-green-700" :
                  uploading ? "border-blue-200 bg-blue-50 text-blue-500" :
                  "border-gray-200 text-gray-400 hover:border-blue-300 hover:text-blue-500"
                }`}>
                  {proofFile ? (
                    <><CheckCircle className="w-8 h-8" /><p className="text-sm font-medium">凭证已上传，正在提交...</p></>
                  ) : uploading ? (
                    <><Loader2 className="w-8 h-8 animate-spin" /><p className="text-sm">上传中...</p></>
                  ) : (
                    <><Upload className="w-8 h-8" /><p className="text-sm">点击选择图片或拖拽到此处</p></>
                  )}
                </div>
                <input type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files[0]; if (f) handleUploadAndSubmit(f); }}
                  disabled={uploading} />
                </label>
                <input
                 type="text"
                 placeholder="或点击此处后粘贴截图（Ctrl+V / ⌘V）"
                 className="w-full h-9 px-3 text-xs border border-gray-300 rounded-md bg-white text-gray-500 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 transition-colors"
                 disabled={uploading}
                 onPaste={(e) => {
                   const item = Array.from(e.clipboardData.items).find(i => i.type.startsWith("image/"));
                   if (item) { e.preventDefault(); const f = item.getAsFile(); if (f) handleUploadAndSubmit(f); }
                 }}
                 onChange={() => {}}
                />
                </CardContent>
          </Card>
        ) : (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <AlertDescription className="text-green-800">付款凭证已提交！管理员确认后将更新订单状态。正在跳转...</AlertDescription>
          </Alert>
        )
      )}
    </div>
  );
}