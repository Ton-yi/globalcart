import { useState } from "react";
import { tenantEntity } from "@/lib/tenantApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Wallet, Clock } from "lucide-react";

function Toggle({ enabled, onToggle, color = "bg-blue-600" }) {
  return (
    <button type="button" onClick={onToggle}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${enabled ? color : 'bg-gray-200'}`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

/**
 * 付款模式设置区块（支付方式 tab）
 * - 预付款：开关、预付比率、尾款加值比例
 * - 后付款：开关、加算比例（在原比例 100% 基础上加算，付运费时收取货款）
 */
export default function PaymentModeSettings({ settings, onReload }) {
  const get = (key) => settings.find(s => s.key === key);

  const [prepayEnabled, setPrepayEnabled] = useState(get('prepay_enabled')?.value !== 'false');
  const [prepayRate, setPrepayRate] = useState(get('prepay_rate')?.value || '80');
  const [surchargeRate, setSurchargeRate] = useState(get('pre_shipment_balance_surcharge_rate')?.value || '0');
  const [deferredEnabled, setDeferredEnabled] = useState(get('deferred_payment_enabled')?.value !== 'false');
  const [deferredRate, setDeferredRate] = useState(get('deferred_payment_surcharge_rate')?.value || '0');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const saveKey = async (key, value, description, category = 'fee') => {
    const s = get(key);
    if (s?.id) {
      await tenantEntity.update('SiteSettings', s.id, { value });
    } else {
      await tenantEntity.create('SiteSettings', { key, value, description, category });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const pr = parseFloat(prepayRate);
    const safePr = (isNaN(pr) || pr <= 0 || pr > 100) ? '80' : String(pr);
    const sr = parseFloat(surchargeRate);
    const safeSr = (isNaN(sr) || sr < 0) ? '0' : String(sr);
    const dr = parseFloat(deferredRate);
    const safeDr = (isNaN(dr) || dr < 0) ? '0' : String(dr);
    await Promise.all([
      saveKey('prepay_enabled', prepayEnabled ? 'true' : 'false', '是否开启预付款'),
      saveKey('prepay_rate', safePr, '预付款比率 (%)'),
      saveKey('pre_shipment_balance_surcharge_rate', safeSr, '尾款加值比例 (%)'),
      saveKey('deferred_payment_enabled', deferredEnabled ? 'true' : 'false', '是否允许后付款'),
      saveKey('deferred_payment_surcharge_rate', safeDr, '后付款加算比例 (%)'),
    ]);
    setPrepayRate(safePr);
    setSurchargeRate(safeSr);
    setDeferredRate(safeDr);
    await onReload();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <Card className="border-amber-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-amber-500" />付款模式设置
          </CardTitle>
          <Button size="sm" className="h-7 text-xs bg-amber-600 hover:bg-amber-700" onClick={handleSave} disabled={saving}>
            <Save className="w-3 h-3 mr-1" />{saved ? "已保存 ✓" : saving ? "保存中..." : "保存"}
          </Button>
        </div>
        <p className="text-xs text-gray-400 mt-1">配置下单阶段的预付款与后付款规则</p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* ── 预付款设置 ── */}
        <div className="border border-yellow-200 rounded-xl p-3 bg-yellow-50/50 space-y-3">
          <div className="text-sm font-medium text-yellow-800">预付款设置</div>
          <div className="flex items-center justify-between pb-2 border-b border-yellow-100">
            <div>
              <Label className="text-sm">开启预付款</Label>
              <p className="text-xs text-gray-400 mt-0.5">关闭后，用户提交订单时不再需要预付款，提交即按全额计算</p>
            </div>
            <Toggle enabled={prepayEnabled} onToggle={() => setPrepayEnabled(v => !v)} color="bg-yellow-500" />
          </div>
          {prepayEnabled && (
            <>
              <div className="pb-2 border-b border-yellow-100">
                <Label className="text-xs text-gray-600">预付款比率 (%)</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input type="text" inputMode="decimal" className="h-8 text-sm w-28 bg-white"
                    value={prepayRate} onChange={e => setPrepayRate(e.target.value)} />
                  <span className="text-xs text-gray-400">%（有效范围 1–100，无效值按 80% 处理）</span>
                </div>
                {(parseFloat(prepayRate) <= 0 || parseFloat(prepayRate) > 100) && (
                  <p className="text-xs text-red-500 mt-0.5">有效范围 1–100，无效值将按 80% 处理</p>
                )}
              </div>
              <div>
                <Label className="text-xs text-gray-600">尾款加值比例 (%)</Label>
                <p className="text-xs text-gray-400 mt-0.5">对预付款尾款比例直接加算，相对订单总额。例：预付 80% 时尾款为 20%，设为 10% 后尾款变为 30%。加值部分会在运费费用明细中单独列出。</p>
                <div className="flex items-center gap-2 mt-1">
                  <Input type="text" inputMode="decimal" className="h-8 text-sm w-28 bg-white" placeholder="0"
                    value={surchargeRate} onChange={e => setSurchargeRate(e.target.value)} />
                  <span className="text-xs text-gray-400">%（默认 0）</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── 后付款设置 ── */}
        <div className="border border-purple-200 rounded-xl p-3 bg-purple-50/50 space-y-3">
          <div className="text-sm font-medium text-purple-800 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />后付款设置
          </div>
          <div className="flex items-center justify-between pb-2 border-b border-purple-100">
            <div>
              <Label className="text-sm">允许后付款</Label>
              <p className="text-xs text-gray-400 mt-0.5">后付款 = 下单时不付货款，在支付运费时再一并支付货款</p>
            </div>
            <Toggle enabled={deferredEnabled} onToggle={() => setDeferredEnabled(v => !v)} color="bg-purple-600" />
          </div>
          {deferredEnabled && (
            <div>
              <Label className="text-xs text-gray-600">后付款加算比例 (%)</Label>
              <p className="text-xs text-gray-400 mt-0.5">在原比例 100% 基础上加算。例：设为 5% 时，用户在付运费时需支付货款总额的 105%，加算部分会在运费费用明细中单独列出。</p>
              <div className="flex items-center gap-2 mt-1">
                <Input type="text" inputMode="decimal" className="h-8 text-sm w-28 bg-white" placeholder="0"
                  value={deferredRate} onChange={e => setDeferredRate(e.target.value)} />
                <span className="text-xs text-gray-400">%（默认 0）</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}