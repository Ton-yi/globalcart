import { useState, useEffect } from "react";
import { detectPrimaryStoreTagResult } from "@/lib/onlineStoreTag";
import { base44 } from "@/api/base44Client";

import { useCurrentUser } from "@/hooks/useCurrentUser";
import { timePage } from "@/lib/timing";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ShoppingBag, Calculator, Info, Upload, Plus, X, ChevronsUpDown, HelpCircle, CreditCard, AlertTriangle, Lock } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { usePermissions } from "@/hooks/usePermissions";
import PaymentMethodSelector from "@/components/common/PaymentMethodSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";

// Default rates (overridden by settings)
const DEFAULT_SERVICE_FEE_RATE = 0.10;
const DEFAULT_PREPAY_RATE = 0.80;

export default function SubmitOrder() {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const { can } = usePermissions();
  const canSubmitOrder = can("order:submit_purchase_request");
  const canSplitOrder = can("order:submit_split_request");
  const [rates, setRates] = useState(null);
  const [settings, setSettings] = useState({});
  const [productUrls, setProductUrls] = useState([""]);
  const [urlMode, setUrlMode] = useState("multi"); // "textarea" | "multi"
  const [addonOptions, setAddonOptions] = useState([]);
  const [selectedAddons, setSelectedAddons] = useState([]);
  const [form, setForm] = useState({
    product_name: "", product_description: "",
    estimated_jpy: "", prepayment_currency: "JPY",
    user_note: "", product_image_url: "", online_store_tag: "其它"
  });
  const [calculated, setCalculated] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [paymentMode, setPaymentMode] = useState(""); // set after settings load: "prepay" | "deferred" | "credit_weekly" | "credit_monthly"
  const [userCredit, setUserCredit] = useState(null); // user's credit status
  const [creditDowngradeMsg, setCreditDowngradeMsg] = useState(null); // shown after submit if credit downgraded

  useEffect(() => {
    const t = timePage('SubmitOrder');
    Promise.all([
      t.timeCall('getSubmitOrderPageData', () => base44.functions.invoke('getSubmitOrderPageData', {})),
      base44.functions.invoke('manageCreditApplication', { action: 'get_user_credit' }),
    ]).then(([r, creditR]) => {
      const data = r.data || {};
      setAddonOptions(data.addons || []);
      setRates(data.rates || null);
      const parsed = {};
      Object.entries(data.settings || {}).forEach(([k, v]) => { parsed[k] = v; });
      setSettings(parsed);
      // Default payment mode based on prepay_enabled setting
      const prepayOn = parsed.prepay_enabled !== 'false';
      setPaymentMode(prepayOn ? "prepay" : "fullpay");
      setUserCredit(creditR.data || null);
      t.done('data ready');
    }).catch(() => {});
    // Load payment methods separately (lightweight)
    base44.functions.invoke('managePaymentMethod', { action: 'list' })
      .then(r => { setPaymentMethods(r.data?.methods || []); })
      .catch(() => {});
  }, []);

  // Convert addon fee to JPY (all calculations in JPY)
  const convertAddonFee = (opt) => {
    if (!opt || !rates) return 0;
    const fee = parseFloat(opt.fee) || 0;
    const feeCur = opt.fee_currency || "JPY";
    if (feeCur === "JPY") return fee;
    // Convert from other currencies to JPY
    const rateKey = `jpy_${feeCur.toLowerCase()}`;
    const rate = rates[rateKey] || 1;
    return fee / rate; // fee in feeCur → divide by rate to get JPY
  };

  const getAddonTotal = () => selectedAddons.reduce((sum, id) => {
    const opt = addonOptions.find(a => a.id === id);
    return sum + convertAddonFee(opt);
  }, 0);

  const calculate = () => {
    const jpy = parseFloat(form.estimated_jpy);
    if (!jpy || jpy <= 0) { setCalculated(null); return; }
    // Get rates from settings
    const serviceFeeRate = (parseFloat(settings.service_fee_rate) || DEFAULT_SERVICE_FEE_RATE) / 100;
    const prepayRate = (parseFloat(settings.prepay_rate) || DEFAULT_PREPAY_RATE) / 100;
    // Calculate all fees in JPY
    const serviceFeeJpy = jpy * serviceFeeRate;
    const addonTotalJpy = getAddonTotal();
    const totalJpy = jpy + serviceFeeJpy + addonTotalJpy;
    const prepayJpy = totalJpy * prepayRate;
    setCalculated({
      jpy: jpy,
      serviceFeeJpy: Math.round(serviceFeeJpy),
      addonTotal: Math.round(addonTotalJpy),
      totalJpy: Math.round(totalJpy),
      prepayJpy: Math.round(prepayJpy),
      feeRate: (serviceFeeRate * 100).toFixed(0),
      prepayRate: (prepayRate * 100).toFixed(0)
    });
  };

  useEffect(() => { if (form.estimated_jpy) calculate(); }, [form.estimated_jpy, selectedAddons, settings]);

  const handleImageUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, product_image_url: file_url }));
    setUploading(false);
  };

  const handleUrlChange = (idx, val) => {
    setProductUrls(prev => prev.map((u, i) => i === idx ? val : u));
  };

  const handleUrlKeyDown = (e, idx) => {
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      setProductUrls(prev => [...prev.slice(0, idx + 1), "", ...prev.slice(idx + 1)]);
    }
    if (e.ctrlKey && e.shiftKey && e.code === "KeyS") {
      e.preventDefault();
      const urlsText = productUrls.filter(u => u.trim()).join("\n");
      setUrlMode("textarea");
      setProductUrls([urlsText]);
    }
  };

  const addUrl = () => setProductUrls(prev => [...prev, ""]);
  const removeUrl = (idx) => setProductUrls(prev => prev.filter((_, i) => i !== idx));

  const toggleAddon = (id) => {
    setSelectedAddons(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const selectedAddonObjects = selectedAddons.map(id => addonOptions.find(a => a.id === id)).filter(Boolean);
    const urlsText = urlMode === "textarea"
      ? (productUrls[0] || "").split("\n").map(s => s.trim()).filter(Boolean).join("\n")
      : productUrls.filter(u => u.trim()).join("\n");
    const isCredit = paymentMode === "credit_weekly" || paymentMode === "credit_monthly";
    const isDeferred = paymentMode === "deferred";
    const isFullpay = paymentMode === "fullpay";
    const tagResult = await detectPrimaryStoreTagResult(urlsText);
    // createTenantOrder auto-assigns tenant_id from session
    const res = await base44.functions.invoke('createTenantOrder', {
      ...form,
      product_url: urlsText,

      user_email: user.email,
      user_name: user.full_name || user.email,
      quantity: 1,
      estimated_jpy: parseFloat(form.estimated_jpy) || 0,
      service_fee_rate: parseFloat(settings.service_fee_rate) || (DEFAULT_SERVICE_FEE_RATE * 100),
      prepayment_amount: isFullpay ? (calculated ? parseFloat(calculated.totalJpy) : 0) : (calculated ? parseFloat(calculated.prepayJpy) : 0),
      prepayment_currency: "JPY",
      online_store_tag: tagResult.tag_label,
      online_store_tag_color: tagResult.tag_color,
      payment_mode: isCredit ? "credit" : isDeferred ? "deferred" : "prepay",
      credit_cycle: isCredit ? (paymentMode === "credit_weekly" ? "weekly" : "monthly") : null,
      order_status: (isDeferred || isCredit) ? "paid" : "payment_pending",
      payment_status: (isDeferred || isCredit) ? "paid" : "awaiting_payment",
      user_note: form.user_note || "",
      selected_addon_ids: selectedAddons,
      selected_addons: selectedAddonObjects.map(a => ({ id: a.id, name: a.name, fee: parseFloat(a.fee) || 0, fee_currency: a.fee_currency || "JPY" })),
    });
    const order = res.data?.order;

    // Backend downgraded credit order to deferred due to insufficient limit
    if (res.data?.credit_downgraded) {
      setCreditDowngradeMsg(res.data.credit_downgrade_reason);
      setSubmitting(false);
      // Show the alert then redirect after a brief delay so user sees it
      setTimeout(() => navigate(createPageUrl("MyOrders")), 4000);
      return;
    }

    if (isDeferred || isCredit) {
      navigate(createPageUrl("MyOrders"));
    } else {
      // prepay or fullpay — both go to Payment page
      // Find the selected payment method's currency to pass to Payment page
      const selectedMethodObj = paymentMethods.find(m => (m.provider_key || m.name) === paymentMethod);
      const selectedCurrency = selectedMethodObj?.payment_currency || "JPY";
      navigate(`/Payment?order_id=${order.id}&method=${paymentMethod || "other"}&pay_currency=${selectedCurrency}`);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">提交购买需求</h1>
        <p className="text-sm text-gray-500 mt-1">填写您想购买的日本商品信息，我们将为您代购</p>
      </div>

      {/* Credit downgrade warning — shown after submit when credit limit exceeded */}
      {creditDowngradeMsg && (
        <Alert className="border-orange-300 bg-orange-50">
          <AlertTriangle className="w-4 h-4 text-orange-600" />
          <AlertDescription className="text-orange-800 text-sm font-medium">
            {creditDowngradeMsg}
            <p className="text-xs mt-1 font-normal text-orange-700">正在跳转到订单列表，请前往付款页完成支付…</p>
          </AlertDescription>
        </Alert>
      )}

      {settings.prepay_enabled !== 'false' && (
        <Alert className="border-blue-200 bg-blue-50">
          <Info className="w-4 h-4 text-blue-600" />
          <AlertDescription className="text-blue-800 text-sm">
            预付款 = (日元货款总价 + {parseFloat(settings.service_fee_rate) || (DEFAULT_SERVICE_FEE_RATE * 100)}% 服务费 + 增值费用) × {parseFloat(settings.prepay_rate) || (DEFAULT_PREPAY_RATE * 100)}%。订单确认后可补款或抵扣余额。
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <Card className="border-gray-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700">商品信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Multi-URL input */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <Label className="text-sm">商品链接</Label>
                  <div className="group relative">
                    <HelpCircle className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" />
                    <div className="invisible group-hover:visible absolute left-0 top-full mt-1 bg-gray-800 text-white text-xs rounded-lg px-3 py-2 w-48 z-10 pointer-events-none whitespace-normal">
                      {settings.product_url_tips ? settings.product_url_tips : "？？？"}
                    </div>
                  </div>
                </div>
                <button type="button" onClick={() => {
                  if (urlMode === "multi") {
                    setUrlMode("textarea");
                    setProductUrls([productUrls.filter(u => u.trim()).join("\n")]);
                  } else {
                    setUrlMode("multi");
                    const lines = (productUrls[0] || "").split("\n").map(s => s.trim()).filter(Boolean);
                    setProductUrls(lines.length > 0 ? lines : [""]);
                  }
                }} className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1">
                  <ChevronsUpDown className="w-3 h-3" />
                  {urlMode === "multi" ? "切换为文本框模式" : "切换为分行模式"}
                </button>
              </div>
              {urlMode === "textarea" ? (
                <>
                  <Textarea
                    placeholder={settings.allow_order_split === 'true'
                      ? "https://www.amazon.co.jp/... （第一批商品）\nhttps://www.amazon.co.jp/...\n---\nhttps://www.suruga-ya.jp/... （第二批商品）\nhttps://www.suruga-ya.jp/..."
                      : "https://www.melonbooks.co.jp/detail/detail.php?product_id=148282 3件\nhttps://www.melonbooks.co.jp/detail/detail.php?product_id=17543 1件 \nhttps://www.melonbooks.co.jp/detail/detail.php?product_id=26026 5件 ..."}
                    value={productUrls[0] || ""}
                    onChange={e => setProductUrls([e.target.value])}
                    className="mt-1 text-sm font-mono"
                    rows={4}
                  />
                  {(productUrls[0] || '').trim() && (
                    <div className="mt-1.5 border border-gray-200 rounded-lg bg-gray-50 px-3 py-2">
                      <p className="text-[10px] text-gray-400 mb-1">预览</p>
                      <ReactMarkdown
                        className="text-xs text-gray-700 prose prose-xs max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_hr]:border-indigo-300 [&_hr]:my-1.5 [&_p]:my-0.5 [&_a]:text-blue-500 [&_a]:break-all"
                        components={{
                          hr: () => (
                            <div className="flex items-center gap-2 my-2">
                              <div className="flex-1 border-t border-indigo-300" />
                              <span className="text-[10px] text-indigo-400 font-medium">— 拆单分隔线 —</span>
                              <div className="flex-1 border-t border-indigo-300" />
                            </div>
                          ),
                          a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-500 break-all">{children}</a>,
                          p: ({ children }) => <p className="my-0.5 break-all">{children}</p>,
                        }}
                      >
                        {productUrls[0] || ''}
                      </ReactMarkdown>
                    </div>
                  )}
                  {settings.allow_order_split === 'true' && canSplitOrder && (() => {
                                 const sections = (productUrls[0] || '').split(/\n-{3,}\n/).map(s => s.trim()).filter(Boolean);
                                 if (sections.length > 1) {
                                   return (
                                     <div className="mt-1.5 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 text-xs text-indigo-700">
                                       <span className="font-medium">检测到 {sections.length} 组链接</span> — 管理员下单后将自动拆分为 {sections.length} 个子订单，货款平均分配
                                     </div>
                                   );
                                 }
                                 return null;
                               })()}
                </>
              ) : (
                <div className="mt-1 space-y-2">
                  {productUrls.map((url, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        placeholder="https://www.amazon.co.jp/..."
                        value={url}
                        onChange={e => handleUrlChange(idx, e.target.value)}
                        onKeyDown={e => handleUrlKeyDown(e, idx)}
                        className="flex-1"
                      />
                      {productUrls.length > 1 && (
                        <button type="button" onClick={() => removeUrl(idx)} className="text-gray-400 hover:text-red-500 flex-shrink-0">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                      {idx === productUrls.length - 1 && (
                        <button type="button" onClick={addUrl} className="text-gray-400 hover:text-blue-600 flex-shrink-0">
                          <Plus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-400 mt-1.5">
                分行模式：Shift+Enter 快速添加下一条 · Ctrl+Shift+S 切换文本框 · 请按商城为单位提交，不同商城请分开提交
                {settings.allow_order_split === 'true' && (
                  <span className="ml-2 text-indigo-400">· 文本框模式下可用 <code className="bg-gray-100 px-1 rounded">---</code> 分割多批商品</span>
                )}
              </p>
            </div>

            <div>
              <Label className="text-sm">订单名称 *</Label>
              <Input placeholder="随意起一个方便自己辨认的名字即可" required value={form.product_name}
                onChange={e => setForm(f => ({ ...f, product_name: e.target.value }))} className="mt-1" />
            </div>

            <div>
               <Label className="text-sm">商品描述 / 规格要求</Label>
               <Textarea placeholder="数量 颜色 尺码 特殊要求等..." value={form.product_description}
                 onChange={e => setForm(f => ({ ...f, product_description: e.target.value }))}
                 className="mt-1" rows={3} />
             </div>

             <div>
               <Label className="text-sm">日元货款总价（包括日本运费）(¥) *</Label>
               <Input
                 type="text"
                 inputMode="decimal"
                 placeholder="15000 或 500+500"
                 required
                 value={form.estimated_jpy}
                 onChange={e => setForm(f => ({ ...f, estimated_jpy: e.target.value }))}
                 onBlur={e => {
                   const raw = e.target.value.trim();
                   if (/^[\d+\-*/().\s]+$/.test(raw)) {
                     try {
                       // eslint-disable-next-line no-new-func
                       const result = Function('"use strict"; return (' + raw + ')')();
                       if (typeof result === "number" && isFinite(result) && result > 0) {
                         setForm(f => ({ ...f, estimated_jpy: String(Math.round(result)) }));
                       }
                     } catch (_) {}
                   }
                 }}
                 className="mt-1"
               />
               <p className="text-xs text-gray-400 mt-1">支持四则运算，如 500+500</p>
             </div>

            {/* Addon options */}
            {addonOptions.length > 0 && (
              <div>
                <Label className="text-sm mb-2 block">增值服务（可选）</Label>
                <div className="space-y-2">
                  {addonOptions.map(opt => (
                    <label key={opt.id} className="flex items-start gap-3 cursor-pointer p-2 rounded-lg border border-gray-100 hover:bg-gray-50">
                      <Checkbox
                        checked={selectedAddons.includes(opt.id)}
                        onCheckedChange={() => toggleAddon(opt.id)}
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-800">{opt.name}</span>
                          <span className="text-sm text-red-600 font-medium">+{opt.fee_currency || "JPY"} {opt.fee_currency === "JPY" ? Math.round(parseFloat(opt.fee)) : parseFloat(opt.fee)}</span>
                        </div>
                        {opt.description && <p className="text-xs text-gray-400 mt-0.5">{opt.description}</p>}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div>
              <Label className="text-sm">商品图片（可选）</Label>
              <div className="space-y-2">
                <div
                  className={`cursor-text p-3 border-2 rounded-lg transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                    form.product_image_url ? "border-green-300 bg-green-50" :
                    uploading ? "border-blue-200 bg-blue-50" :
                    "border-gray-200 hover:border-blue-300"
                  }`}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file && file.type.startsWith("image/")) handleImageUpload(file);
                  }}
                  onPaste={e => {
                    const item = Array.from(e.clipboardData.items).find(i => i.type.startsWith("image/"));
                    if (item) {
                      const file = item.getAsFile();
                      if (file) handleImageUpload(file);
                    }
                  }}
                  onClick={() => document.getElementById("product-image-input")?.click()}
                  tabIndex={0}
                >
                  {form.product_image_url
                    ? <div className="flex items-center gap-3">
                        <img src={form.product_image_url} alt="" className="h-12 rounded object-cover" />
                        <div className="text-sm text-green-700">✓ 已上传，点击、粘贴或拖拽可更换</div>
                      </div>
                    : uploading
                    ? <div className="flex items-center gap-2 text-blue-500 text-sm"><Upload className="w-4 h-4 animate-pulse" /><span>上传中...</span></div>
                    : <div className="text-sm text-gray-500">粘贴图片、点击选择或拖拽图片到此处上传</div>}
                </div>
                <div>
                  <Label className="text-xs text-gray-500">或粘贴图片URL</Label>
                  <Input
                    type="text"
                    placeholder="https://example.com/image.jpg"
                    value={form.product_image_url || ""}
                    onChange={e => setForm(f => ({ ...f, product_image_url: e.target.value }))}
                    onPaste={e => {
                      const item = Array.from(e.clipboardData.items).find(i => i.type.startsWith("image/"));
                      if (item) {
                        e.preventDefault();
                        const file = item.getAsFile();
                        if (file) handleImageUpload(file);
                      }
                    }}
                    className="mt-1 text-sm"
                  />
                </div>
              </div>
              <input
                id="product-image-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => { const f = e.target.files[0]; if (f) handleImageUpload(f); }}
                disabled={uploading}
              />
            </div>
          </CardContent>
        </Card>

        {/* Price Calculator */}
        {calculated && (
          <Card className="border-gray-200 bg-gray-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Calculator className="w-4 h-4" /> {settings.prepay_enabled !== 'false' ? '预付款估算' : '费用估算'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Compact formula above */}
              <div className="text-xs text-gray-400 font-mono leading-5 bg-white border border-gray-100 rounded px-3 py-2">
                <span className="text-gray-500">¥{parseFloat(calculated.jpy).toLocaleString()}</span>
                <span className="text-gray-300 mx-1 ml-2">+</span>
                <span className="text-gray-500">{calculated.feeRate}%服务费</span>
                <span className="text-gray-300 mx-1">=</span>
                <span className="text-gray-600">¥{calculated.serviceFeeJpy}</span>
                {parseFloat(calculated.addonTotal) > 0 && (
                  <>
                    <span className="text-gray-300 mx-1 ml-2">+</span>
                    <span className="text-gray-500">增值</span>
                    <span className="text-gray-300 mx-1">=</span>
                    <span className="text-gray-600">¥{calculated.addonTotal}</span>
                  </>
                )}
                <span className="text-gray-300 mx-1 ml-2">→</span>
                <span className="font-semibold text-gray-700">总额 ¥{calculated.totalJpy}</span>
              </div>
              {/* Prepay highlight — only when prepay is enabled */}
              {settings.prepay_enabled !== 'false' && (
                <div className="flex items-center justify-between bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
                  <span className="text-sm text-gray-700 font-medium">预付款 ({calculated.prepayRate}%)</span>
                  <span className="text-lg font-bold text-red-600">¥{calculated.prepayJpy}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="border-gray-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700">备注</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea placeholder="其他特殊说明..." value={form.user_note}
              onChange={e => setForm(f => ({ ...f, user_note: e.target.value }))} rows={2} />
          </CardContent>
        </Card>

        {/* Payment mode selection */}
        <Card className="border-gray-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700">付款方式</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {settings.prepay_enabled !== 'false' && (
                <button
                  type="button"
                  onClick={() => setPaymentMode("prepay")}
                  className={`p-3 rounded-lg border-2 text-sm font-medium transition-all text-left ${
                    paymentMode === "prepay" ? "border-red-500 bg-red-50 text-red-700" : "border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  <div className="font-semibold">立即预付款</div>
                  <div className="text-xs mt-0.5 opacity-70">提交后直接前往付款页</div>
                </button>
              )}
              {settings.prepay_enabled === 'false' && (
                <button
                  type="button"
                  onClick={() => setPaymentMode("fullpay")}
                  className={`p-3 rounded-lg border-2 text-sm font-medium transition-all text-left ${
                    paymentMode === "fullpay" ? "border-red-500 bg-red-50 text-red-700" : "border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  <div className="font-semibold">立即全额付款</div>
                  <div className="text-xs mt-0.5 opacity-70">提交后前往付款页全额支付</div>
                </button>
              )}
              <button
                type="button"
                onClick={() => setPaymentMode("deferred")}
                className={`p-3 rounded-lg border-2 text-sm font-medium transition-all text-left ${
                  paymentMode === "deferred" ? "border-purple-500 bg-purple-50 text-purple-700" : "border-gray-200 text-gray-500 hover:border-gray-300"
                }`}
              >
                <div className="font-semibold">后付款</div>
                <div className="text-xs mt-0.5 opacity-70">提交后等待客服确认报价</div>
              </button>

              {/* Credit payment options — only shown to users with credit enabled, restricted to their assigned cycle */}
              {userCredit?.credit_enabled && userCredit?.credit_cycle === 'weekly' && (
                <button
                  type="button"
                  onClick={() => setPaymentMode("credit_weekly")}
                  className={`p-3 rounded-lg border-2 text-sm font-medium transition-all text-left ${
                    paymentMode === "credit_weekly" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  <div className="font-semibold flex items-center gap-1">
                    <CreditCard className="w-3.5 h-3.5" />记账周结
                  </div>
                  <div className="text-xs mt-0.5 opacity-70">记账日起7天结清</div>
                </button>
              )}
              {userCredit?.credit_enabled && userCredit?.credit_cycle === 'monthly' && (
                <button
                  type="button"
                  onClick={() => setPaymentMode("credit_monthly")}
                  className={`p-3 rounded-lg border-2 text-sm font-medium transition-all text-left ${
                    paymentMode === "credit_monthly" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  <div className="font-semibold flex items-center gap-1">
                    <CreditCard className="w-3.5 h-3.5" />记账月结
                  </div>
                  <div className="text-xs mt-0.5 opacity-70">每月1日结清欠款</div>
                </button>
              )}
            </div>

            {/* Credit balance info */}
            {(paymentMode === "credit_weekly" || paymentMode === "credit_monthly") && userCredit && (
              <div className={`border rounded-lg px-3 py-2.5 text-xs space-y-1 ${
                calculated && calculated.totalJpy > Math.max(0, (userCredit.credit_limit_jpy || 0) - (userCredit.credit_balance_jpy || 0))
                  ? "bg-orange-50 border-orange-200 text-orange-800"
                  : "bg-blue-50 border-blue-100 text-blue-700"
              }`}>
                <p>当前欠款：<span className="font-bold">¥{(userCredit.credit_balance_jpy || 0).toLocaleString()}</span></p>
                <p>欠款上限：¥{(userCredit.credit_limit_jpy || 0).toLocaleString()}</p>
                <p>剩余可用额度：<span className="font-bold">¥{Math.max(0, (userCredit.credit_limit_jpy || 0) - (userCredit.credit_balance_jpy || 0)).toLocaleString()}</span></p>
                {userCredit.credit_next_due_date && <p>下次结帐日：{userCredit.credit_next_due_date}</p>}
                {calculated && (
                  <p className="font-medium">本次将记账：¥{calculated.totalJpy.toLocaleString()} JPY（全额）</p>
                )}
                {calculated && calculated.totalJpy > Math.max(0, (userCredit.credit_limit_jpy || 0) - (userCredit.credit_balance_jpy || 0)) && (
                  <p className="font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    额度不足，提交后将自动改为后付款方式
                  </p>
                )}
              </div>
            )}

            {(paymentMode === "prepay" || paymentMode === "fullpay") && (
              <PaymentMethodSelector
                value={paymentMethod}
                onChange={m => setPaymentMethod(m.value)}
                prefetched={paymentMethods.length > 0 ? paymentMethods : null}
                activeColor="border-red-500 bg-red-50 text-red-700"
              />
            )}
          </CardContent>
        </Card>

        {!canSubmitOrder ? (
          <Button type="button" disabled className="w-full bg-gray-400">
            <Lock className="w-4 h-4 mr-2" />
            您没有权限提交购买需求
          </Button>
        ) : (
          <Button type="submit" disabled={submitting || !form.product_name} className="w-full bg-red-600 hover:bg-red-700">
            <ShoppingBag className="w-4 h-4 mr-2" />
            {submitting ? "提交中..." :
              (paymentMode === "credit_weekly" || paymentMode === "credit_monthly") ? "提交需求（记账）" :
              paymentMode === "deferred" ? "提交需求（后付款）" : "提交并前往付款"}
          </Button>
        )}
      </form>
    </div>
  );
}