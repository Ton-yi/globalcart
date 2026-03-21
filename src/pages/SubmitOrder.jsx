import { useState, useEffect } from "react";
import { getRatesWithIncrements } from "@/lib/exchangeRates";
import { detectPrimaryStoreTagResult } from "@/lib/onlineStoreTag";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ShoppingBag, Calculator, Info, Upload, Plus, X, ChevronsUpDown } from "lucide-react";
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
  const [user, setUser] = useState(null);
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
  const [paymentMethod, setPaymentMethod] = useState("alipay");
  const [paymentMode, setPaymentMode] = useState("prepay"); // "prepay" | "deferred"

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
    Promise.all([
      base44.entities.AddonOption.filter({ is_active: true }),
      getRatesWithIncrements(),
      base44.entities.SiteSettings.list()
    ]).then(([addons, rates, settingsList]) => {
      setAddonOptions(addons);
      setRates(rates);
      const settingsMap = {};
      settingsList.forEach(s => { settingsMap[s.key] = parseFloat(s.value) || 0; });
      setSettings(settingsMap);
    }).catch(() => {});
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
    const serviceFeeRate = (settings.service_fee_rate || DEFAULT_SERVICE_FEE_RATE) / 100;
    const prepayRate = (settings.prepay_rate || DEFAULT_PREPAY_RATE) / 100;
    // Calculate all fees in JPY
    const serviceFeeJpy = jpy * serviceFeeRate;
    const addonTotalJpy = getAddonTotal();
    const totalJpy = jpy + serviceFeeJpy + addonTotalJpy;
    const prepayJpy = totalJpy * prepayRate;
    setCalculated({
      jpy: jpy,
      serviceFeeJpy: serviceFeeJpy.toFixed(2),
      addonTotal: addonTotalJpy.toFixed(2),
      totalJpy: totalJpy.toFixed(2),
      prepayJpy: prepayJpy.toFixed(2),
      feeRate: (serviceFeeRate * 100).toFixed(0),
      prepayRate: (prepayRate * 100).toFixed(0)
    });
  };

  useEffect(() => { if (form.estimated_jpy) calculate(); }, [form.estimated_jpy, selectedAddons, settings]);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
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
  };

  const addUrl = () => setProductUrls(prev => [...prev, ""]);
  const removeUrl = (idx) => setProductUrls(prev => prev.filter((_, i) => i !== idx));

  const toggleAddon = (id) => {
    setSelectedAddons(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const now = new Date();
    const yyyymmdd = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}`;
    // Generate sequential order number: TY+YYYYMMDD+0001
    const allOrders = await base44.entities.Order.list("-created_date", 500);
    const prefix = `TY${yyyymmdd}`;
    const todayCount = allOrders.filter(o => (o.order_number || "").startsWith(prefix)).length;
    const seq = String(todayCount + 1).padStart(4, "0");
    const orderNum = `${prefix}${seq}`;
    const selectedAddonNames = selectedAddons.map(id => addonOptions.find(a => a.id === id)?.name).filter(Boolean).join(", ");
    const urlsText = urlMode === "textarea"
      ? (productUrls[0] || "").split("\n").map(s => s.trim()).filter(Boolean).join("\n")
      : productUrls.filter(u => u.trim()).join("\n");
    const isDeferred = paymentMode === "deferred";
    const { base44: b44 } = await import('@/api/base44Client');
    const { detectPrimaryStoreTagResult } = await import('@/lib/onlineStoreTag');
    const tagResult = await detectPrimaryStoreTagResult(urlsText);
    const order = await base44.entities.Order.create({
      ...form,
      product_url: urlsText,
      order_number: orderNum,
      user_email: user.email,
      user_name: user.full_name || user.email,
      quantity: 1,
      estimated_jpy: parseFloat(form.estimated_jpy) || 0,
      service_fee_rate: settings.service_fee_rate || (DEFAULT_SERVICE_FEE_RATE * 100),
      prepayment_amount: calculated ? parseFloat(calculated.prepayJpy) : 0,
      prepayment_currency: "JPY",
      online_store_tag: tagResult.tag_label,
      online_store_tag_color: tagResult.tag_color,
      payment_mode: isDeferred ? "deferred" : "prepay",
      order_status: isDeferred ? "pending_confirmation" : "payment_pending",
      payment_status: isDeferred ? "pending" : "awaiting_payment",
      user_note: [form.user_note, selectedAddonNames ? `增值服务：${selectedAddonNames}` : ""].filter(Boolean).join("\n"),
    });
    if (isDeferred) {
      navigate(createPageUrl("MyOrders"));
    } else {
      navigate(createPageUrl(`Payment?order_id=${order.id}&method=${paymentMethod}`));
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">提交购买需求</h1>
        <p className="text-sm text-gray-500 mt-1">填写您想购买的日本商品信息，我们将为您代购</p>
      </div>

      <Alert className="border-blue-200 bg-blue-50">
         <Info className="w-4 h-4 text-blue-600" />
         <AlertDescription className="text-blue-800 text-sm">
           预付款 = (日元货款总价 + {settings.service_fee_rate || (DEFAULT_SERVICE_FEE_RATE * 100)}% 服务费 + 增值费用) × {settings.prepay_rate || (DEFAULT_PREPAY_RATE * 100)}%。订单确认后可补款或抵扣余额。
         </AlertDescription>
       </Alert>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Card className="border-gray-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700">商品信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Multi-URL input */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-sm">商品链接</Label>
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
                <Textarea
                  placeholder={"https://www.amazon.co.jp/...\nhttps://www.rakuten.co.jp/..."}
                  value={productUrls[0] || ""}
                  onChange={e => setProductUrls([e.target.value])}
                  className="mt-1 text-sm"
                  rows={3}
                />
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
                分行模式：Shift+Enter 快速添加下一条 · 请按商城为单位提交，不同商城请分开提交
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
               <Input type="number" placeholder="15000" required value={form.estimated_jpy}
                 onChange={e => setForm(f => ({ ...f, estimated_jpy: e.target.value }))} className="mt-1" />
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
                          <span className="text-sm text-red-600 font-medium">+{opt.fee_currency || "JPY"} {parseFloat(opt.fee).toFixed(2)}</span>
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
              <div className="mt-1 flex items-center gap-2">
                <label className="cursor-pointer">
                  <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded text-sm text-gray-600 hover:bg-gray-50">
                    <Upload className="w-3.5 h-3.5" />
                    {uploading ? "上传中..." : "上传图片"}
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </label>
                {form.product_image_url && <span className="text-xs text-green-600">✓ 已上传</span>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Price Calculator */}
        {calculated && (
          <Card className="border-gray-200 bg-gray-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Calculator className="w-4 h-4" /> 预付款估算
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
              {/* Prepay highlight */}
              <div className="flex items-center justify-between bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
                <span className="text-sm text-gray-700 font-medium">预付款 ({calculated.prepayRate}%)</span>
                <span className="text-lg font-bold text-red-600">¥{calculated.prepayJpy}</span>
              </div>
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
            </div>

            {paymentMode === "prepay" && (
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: "alipay", label: "支付宝" },
                  { value: "wechatpay", label: "微信支付" },
                  { value: "other", label: "其他" },
                ].map(m => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setPaymentMethod(m.value)}
                    className={`p-2.5 rounded-lg border-2 text-xs font-medium transition-all ${
                      paymentMethod === m.value
                        ? "border-red-500 bg-red-50 text-red-700"
                        : "border-gray-200 text-gray-500 hover:border-gray-300"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Button type="submit" disabled={submitting || !form.product_name} className="w-full bg-red-600 hover:bg-red-700">
          <ShoppingBag className="w-4 h-4 mr-2" />
          {submitting ? "提交中..." : paymentMode === "deferred" ? "提交需求（后付款）" : "提交并前往付款"}
        </Button>
      </form>
    </div>
  );
}