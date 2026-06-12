import { useState } from "react";
import { tenantEntity } from "@/lib/tenantApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Save, Truck } from "lucide-react";

function Toggle({ enabled, onToggle, color = "bg-blue-600", size = "md" }) {
  const sizes = size === "sm"
    ? { outer: "h-5 w-9", inner: "h-3 w-3", on: "translate-x-5", off: "translate-x-1" }
    : { outer: "h-6 w-11", inner: "h-4 w-4", on: "translate-x-6", off: "translate-x-1" };
  return (
    <button type="button" onClick={onToggle}
      className={`relative inline-flex ${sizes.outer} items-center rounded-full transition-colors focus:outline-none ${enabled ? color : 'bg-gray-200'}`}>
      <span className={`inline-block ${sizes.inner} transform rounded-full bg-white transition-transform ${enabled ? sizes.on : sizes.off}`} />
    </button>
  );
}

const SUB_KEYS = [
  { key: 'allow_ship_without_payment_single', label: '单独发货', desc: '允许单独发货未付款直接发货' },
  { key: 'allow_ship_without_payment_user_pool', label: '用户拼邮发货', desc: '允许用户拼邮未付款直接发货' },
  { key: 'allow_ship_without_payment_official_pool', label: '官方拼邮发货', desc: '允许官方拼邮未付款直接发货' },
];

const DESCRIPTIONS = {
  allow_ship_without_payment: '允许未付款时进入已发货状态（总开关）',
  allow_ship_without_payment_single: '单独发货 - 允许未付款直接发货',
  allow_ship_without_payment_user_pool: '用户拼邮发货 - 允许未付款直接发货',
  allow_ship_without_payment_official_pool: '官方拼邮发货 - 允许未付款直接发货',
};

/**
 * 发货设置：允许未付款时进入已发货状态（含分类型子开关）
 */
export default function ShipWithoutPaymentSettings({ settings, onReload }) {
  const get = (key) => settings.find(s => s.key === key);
  const [values, setValues] = useState(() => {
    const init = {};
    ['allow_ship_without_payment', ...SUB_KEYS.map(s => s.key)].forEach(k => {
      init[k] = get(k)?.value === 'true';
    });
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const toggle = (key) => setValues(prev => ({ ...prev, [key]: !prev[key] }));

  const handleSave = async () => {
    setSaving(true);
    await Promise.all(Object.entries(values).map(([key, enabled]) => {
      const s = get(key);
      const value = enabled ? 'true' : 'false';
      return s?.id
        ? tenantEntity.update('SiteSettings', s.id, { value })
        : tenantEntity.create('SiteSettings', { key, value, description: DESCRIPTIONS[key] || '', category: 'shipping' });
    }));
    await onReload();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <Card className="border-blue-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Truck className="w-4 h-4 text-blue-500" />发货付款控制
          </CardTitle>
          <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700" onClick={handleSave} disabled={saving}>
            <Save className="w-3 h-3 mr-1" />{saved ? "已保存 ✓" : saving ? "保存中..." : "保存"}
          </Button>
        </div>
        <p className="text-xs text-gray-400 mt-1">控制管理员是否可在用户未付运费的情况下直接发货</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
          <div>
            <Label className="text-sm">允许未付款时进入已发货状态</Label>
            <p className="text-xs text-gray-400 mt-0.5">开启后，管理员可在用户未付款情况下直接将发货申请进入已发货状态</p>
          </div>
          <Toggle enabled={values.allow_ship_without_payment} onToggle={() => toggle('allow_ship_without_payment')} color="bg-blue-600" />
        </div>
        {values.allow_ship_without_payment && (
          <div className="pl-4 space-y-2 border-l-2 border-l-blue-200">
            {SUB_KEYS.map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between">
                <div>
                  <Label className="text-xs text-gray-600">{label}</Label>
                  <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                </div>
                <Toggle enabled={values[key]} onToggle={() => toggle(key)} color="bg-blue-600" size="sm" />
              </div>
            ))}
          </div>
        )}
        <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs text-amber-700">
          注意：跳过付款发货的订单不会标记货款尾款已结算，且该发货池收入不计入财务报表（未实际收款）。
        </div>
      </CardContent>
    </Card>
  );
}