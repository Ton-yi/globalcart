import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ShoppingBag, Calculator, Info, Upload, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";

const SERVICE_FEE_RATE = 0.10;
const PREPAY_RATE = 0.80;

const JPY_RATES = { CNY: 0.048, USD: 0.0067, TWD: 0.22, HKD: 0.052, EUR: 0.0062, SGD: 0.0090 };

export default function SubmitOrder() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [productUrls, setProductUrls] = useState([""]);
  const [addonOptions, setAddonOptions] = useState([]);
  const [selectedAddons, setSelectedAddons] = useState([]);
  const [form, setForm] = useState({
    product_name: "", product_description: "",
    quantity: 1, estimated_jpy: "", prepayment_currency: "CNY",
    user_note: "", product_image_url: ""
  });
  const [calculated, setCalculated] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
    base44.entities.AddonOption.filter({ is_active: true }).then(setAddonOptions).catch(() => {});
  }, []);

  const getAddonTotal = () => selectedAddons.reduce((sum, id) => {
    const opt = addonOptions.find(a => a.id === id);
    return sum + (opt ? parseFloat(opt.fee) : 0);
  }, 0);

  const calculate = () => {
    const jpy = parseFloat(form.estimated_jpy);
    const rate = JPY_RATES[form.prepayment_currency] || JPY_RATES.CNY;
    if (!jpy || jpy <= 0) { setCalculated(null); return; }
    const qty = parseFloat(form.quantity || 1);
    const converted = jpy * qty * rate;
    const serviceFee = converted * SERVICE_FEE_RATE;
    const addonTotal = getAddonTotal();
    const total = converted + serviceFee + addonTotal;
    const prepay = total * PREPAY_RATE;
    setCalculated({
      jpy: jpy * qty,
      rate,
      converted: converted.toFixed(2),
      serviceFee: serviceFee.toFixed(2),
      addonTotal: addonTotal.toFixed(2),
      total: total.toFixed(2),
      prepay: prepay.toFixed(2),
      cur: form.prepayment_currency,
      feeRate: (SERVICE_FEE_RATE * 100).toFixed(0)
    });
  };

  useEffect(() => { if (form.estimated_jpy) calculate(); }, [form.estimated_jpy, form.quantity, form.prepayment_currency, selectedAddons]);

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
    const orderNum = "TY" + Date.now().toString().slice(-8);
    const selectedAddonNames = selectedAddons.map(id => addonOptions.find(a => a.id === id)?.name).filter(Boolean).join(", ");
    await base44.entities.Order.create({
      ...form,
      product_url: productUrls.filter(u => u.trim()).join("\n"),
      order_number: orderNum,
      user_email: user.email,
      user_name: user.full_name || user.email,
      quantity: parseInt(form.quantity),
      estimated_jpy: parseFloat(form.estimated_jpy) || 0,
      service_fee_rate: SERVICE_FEE_RATE * 100,
      prepayment_amount: calculated ? parseFloat(calculated.prepay) : 0,
      order_status: "submitted",
      payment_status: "awaiting_payment",
      user_note: [form.user_note, selectedAddonNames ? `增值服务：${selectedAddonNames}` : ""].filter(Boolean).join("\n"),
    });
    navigate(createPageUrl("MyOrders"));
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
          预付款 = (商品价格 × 数量 + {SERVICE_FEE_RATE * 100}% 服务费 + 增值费用) × 80%。订单确认后可补款或抵扣余额。
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
              <Label className="text-sm">商品链接</Label>
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
              <p className="text-xs text-gray-400 mt-1.5">
                Shift+Enter 以添加多个商品链接 · 请按商城为单位提交订单，不同商城购买需求请分开提交
              </p>
            </div>

            <div>
              <Label className="text-sm">订单名称 *</Label>
              <Input placeholder="随意起一个方便自己辨认的名字即可" required value={form.product_name}
                onChange={e => setForm(f => ({ ...f, product_name: e.target.value }))} className="mt-1" />
            </div>

            <div>
              <Label className="text-sm">商品描述 / 规格要求</Label>
              <Textarea placeholder="颜色、尺码、特殊要求等..." value={form.product_description}
                onChange={e => setForm(f => ({ ...f, product_description: e.target.value }))}
                className="mt-1" rows={3} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">数量 *</Label>
                <Input type="number" min="1" required value={form.quantity}
                  onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">日元价格 (¥) *</Label>
                <Input type="number" placeholder="15000" required value={form.estimated_jpy}
                  onChange={e => setForm(f => ({ ...f, estimated_jpy: e.target.value }))} className="mt-1" />
              </div>
            </div>

            <div>
              <Label className="text-sm">付款货币</Label>
              <Select value={form.prepayment_currency} onValueChange={v => setForm(f => ({ ...f, prepayment_currency: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.keys(JPY_RATES).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
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
                          <span className="text-sm text-red-600 font-medium">+{form.prepayment_currency} {parseFloat(opt.fee).toFixed(2)}</span>
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

        {/* Price Calculator with formula */}
        {calculated && (
          <Card className="border-gray-200 bg-gray-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Calculator className="w-4 h-4" /> 预付款估算
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Formula display */}
              <div className="bg-white border border-gray-200 rounded-lg p-3 text-xs text-gray-500 font-mono leading-relaxed">
                <div>¥{calculated.jpy.toLocaleString()} × {calculated.rate} <span className="text-gray-400">（汇率）</span> = {calculated.cur} {calculated.converted}</div>
                <div className="mt-1">+ ¥{calculated.jpy.toLocaleString()} × {calculated.feeRate}% <span className="text-gray-400">（服务费）</span> = {calculated.cur} {calculated.serviceFee}</div>
                {parseFloat(calculated.addonTotal) > 0 && (
                  <div className="mt-1">+ {calculated.cur} {calculated.addonTotal} <span className="text-gray-400">（增值服务）</span></div>
                )}
                <div className="mt-1 pt-1 border-t border-dashed border-gray-200 text-gray-700 font-semibold">
                  = {calculated.cur} {calculated.total} <span className="text-gray-400 font-normal">（订单总额）</span>
                </div>
              </div>
              {/* Prepay highlight */}
              <div className="flex items-center justify-between bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
                <span className="text-sm text-gray-700 font-medium">预付款 (80%)</span>
                <span className="text-lg font-bold text-red-600">{calculated.cur} {calculated.prepay}</span>
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

        <Button type="submit" disabled={submitting || !form.product_name} className="w-full bg-red-600 hover:bg-red-700">
          <ShoppingBag className="w-4 h-4 mr-2" />
          {submitting ? "提交中..." : "提交购买需求"}
        </Button>
      </form>
    </div>
  );
}