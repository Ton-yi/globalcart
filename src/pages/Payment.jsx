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

const METHOD_LABELS = {
  alipay: "支付宝",
  wechatpay: "微信支付",
  paypay: "PayPay",
  paypal: "PayPal",
  bank_transfer: "银行转账",
  other: "其他"
};

export default function Payment() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get("order_id");
  const method = urlParams.get("method") || "alipay";

  const [order, setOrder] = useState(null);
  const [settings, setSettings] = useState({});
  const [proofFile, setProofFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generatingLink, setGeneratingLink] = useState(false);

  useEffect(() => {
    if (!orderId) { navigate(createPageUrl("MyOrders")); return; }
    Promise.all([
      base44.entities.Order.filter({ id: orderId }),
      base44.entities.SiteSettings.list()
    ]).then(([orders, siteSettings]) => {
      if (orders.length === 0) { navigate(createPageUrl("MyOrders")); return; }
      setOrder(orders[0]);
      const map = {};
      siteSettings.forEach(s => { map[s.key] = s.value; });
      setSettings(map);
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
    window.location.href = res.data.paymentUrl;
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setProofFile(file_url);
    setUploading(false);
  };

  const handleConfirm = async () => {
    if (!proofFile) return;
    await base44.entities.Order.update(order.id, {
      payment_proof_url: proofFile,
      payment_method: method,
      payment_status: "awaiting_payment",
      order_status: "payment_pending",
      paid_amount: order.prepayment_amount
    });
    setSubmitted(true);
    setTimeout(() => navigate(createPageUrl("MyOrders")), 2500);
  };

  if (loading) return <div className="text-center py-20 text-gray-400">加载中...</div>;

  const cur = "JPY";
  const amount = order?.prepayment_amount?.toFixed(0) || "0";

  // Alipay gateway info from settings
  const alipayAccount = settings["alipay_account"] || "";
  const alipayName = settings["alipay_account_name"] || "";
  const alipayQr = settings["alipay_qr_url"] || "";
  const alipayNote = settings["alipay_payment_note"] || "请在备注中填写订单号";

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
              <div className="text-xs text-gray-400">预付款金额</div>
              <div className="text-2xl font-bold text-red-600">{cur} {amount}</div>
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

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertCircle className="w-3.5 h-3.5 text-yellow-600" />
                <span className="text-xs font-medium text-yellow-800">付款备注</span>
              </div>
              <p className="text-xs text-yellow-700">{alipayNote}</p>
              <div className="mt-1 flex items-center gap-2">
                <code className="text-xs bg-yellow-100 px-2 py-0.5 rounded font-mono text-yellow-800">{order.order_number}</code>
                <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => handleCopy(order.order_number)}>
                  复制
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
              <span className="text-sm text-gray-700">付款金额</span>
              <span className="text-lg font-bold text-red-600">{cur} {amount}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Other methods placeholder */}
      {method !== "alipay" && (
        <Card className="border-gray-200">
          <CardContent className="pt-6 pb-6 text-center text-sm text-gray-400">
            {METHOD_LABELS[method] || method} 付款方式，请联系客服获取付款信息
          </CardContent>
        </Card>
      )}

      {/* Upload proof */}
      {!submitted ? (
        <Card className="border-gray-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700">上传付款凭证</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-gray-400">请在付款完成后上传付款截图或凭证，以便我们尽快确认</p>
            <label className="cursor-pointer block">
              <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${proofFile ? "border-green-300 bg-green-50" : "border-gray-200 hover:border-gray-300"}`}>
                {proofFile ? (
                  <div className="text-green-600">
                    <CheckCircle className="w-8 h-8 mx-auto mb-1" />
                    <p className="text-sm font-medium">凭证已上传</p>
                  </div>
                ) : (
                  <div className="text-gray-400">
                    <Upload className="w-8 h-8 mx-auto mb-1" />
                    <p className="text-sm">{uploading ? "上传中..." : "点击上传付款截图"}</p>
                  </div>
                )}
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
            </label>
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700"
              onClick={handleConfirm}
              disabled={!proofFile || uploading}
            >
              <CheckCircle className="w-4 h-4 mr-2" />我已完成付款，提交凭证
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <AlertDescription className="text-green-800">付款凭证已提交！管理员确认后将更新订单状态。正在跳转...</AlertDescription>
        </Alert>
      )}
    </div>
  );
}