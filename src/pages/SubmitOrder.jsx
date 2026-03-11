import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ShoppingBag, Calculator, Info, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

const SERVICE_FEE_RATE = 0.10;
const PREPAY_RATE = 0.80; // 预付80%

export default function SubmitOrder() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({
    product_url: "", product_name: "", product_description: "",
    quantity: 1, estimated_jpy: "", prepayment_currency: "USD",
    user_note: "", product_image_url: ""
  });
  const [calculated, setCalculated] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const JPY_RATES = { USD: 0.0067, CNY: 0.048, TWD: 0.22, HKD: 0.052, EUR: 0.0062, SGD: 0.0090 };

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => base44.auth.redirectToLogin());
  }, []);

  const calculate = () => {
    const jpy = parseFloat(form.estimated_jpy);
    const rate = JPY_RATES[form.prepayment_currency] || JPY_RATES.USD;
    if (!jpy || jpy <= 0) return;
    const converted = jpy * parseFloat(form.quantity || 1) * rate;
    const serviceFee = converted * SERVICE_FEE_RATE;
    const total = converted + serviceFee;
    const prepay = total * PREPAY_RATE;
    setCalculated({ converted: converted.toFixed(2), serviceFee: serviceFee.toFixed(2), total: total.toFixed(2), prepay: prepay.toFixed(2) });
  };

  useEffect(() => { if (form.estimated_jpy) calculate(); }, [form.estimated_jpy, form.quantity, form.prepayment_currency]);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, product_image_url: file_url }));
    setUploading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const orderNum = "JP" + Date.now().toString().slice(-8);
    await base44.entities.Order.create({
      ...form,
      order_number: orderNum,
      user_email: user.email,
      user_name: user.full_name || user.email,
      quantity: parseInt(form.quantity),
      estimated_jpy: parseFloat(form.estimated_jpy) || 0,
      service_fee_rate: SERVICE_FEE_RATE * 100,
      prepayment_amount: calculated ? parseFloat(calculated.prepay) : 0,
      order_status: "submitted",
      payment_status: "awaiting_payment",
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
          预付款 = (商品价格 × 数量 + 10% 服务费) × 80%。订单确认后可补款或抵扣余额。
        </AlertDescription>
      </Alert>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Card className="border-gray-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700">商品信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm">商品链接</Label>
              <Input placeholder="https://www.amazon.co.jp/..." value={form.product_url}
                onChange={e => setForm(f => ({ ...f, product_url: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label className="text-sm">商品名称 *</Label>
              <Input placeholder="例：Apple AirPods Pro 第2代" required value={form.product_name}
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
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(JPY_RATES).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
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
            <CardContent>
              <table className="w-full text-sm">
                <tbody className="space-y-1 divide-y divide-gray-200">
                  <tr><td className="py-1.5 text-gray-500">商品估价</td><td className="py-1.5 text-right font-medium">{form.prepayment_currency} {calculated.converted}</td></tr>
                  <tr><td className="py-1.5 text-gray-500">服务费 (10%)</td><td className="py-1.5 text-right font-medium">{form.prepayment_currency} {calculated.serviceFee}</td></tr>
                  <tr><td className="py-1.5 text-gray-700 font-medium">订单总额</td><td className="py-1.5 text-right font-semibold">{form.prepayment_currency} {calculated.total}</td></tr>
                  <tr className="bg-yellow-50">
                    <td className="py-2 text-gray-900 font-semibold">预付款 (80%)</td>
                    <td className="py-2 text-right font-bold text-red-600 text-base">{form.prepayment_currency} {calculated.prepay}</td>
                  </tr>
                </tbody>
              </table>
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