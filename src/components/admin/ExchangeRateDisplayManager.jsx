/**
 * ExchangeRateDisplayManager
 * 主页自定义 → 汇率显示设置
 * 配置存储在 SiteSettings key = "home_exchange_rate_config" (JSON)
 *
 * 结构：
 * {
 *   enabled: boolean,
 *   currencies: ["CNY","USD","EUR","TWD"],  // 至多4个
 *   position: "hero_left" | "hero_right" | "quick_actions" | "steps_title" | "status_board" | "faq",
 * }
 */
import { useState, useEffect } from "react";
import { tenantEntity } from "@/lib/tenantApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Save, TrendingUp, Plus, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";

const ALL_CURRENCIES = [
  { code: "CNY", label: "人民币 (CNY)" },
  { code: "USD", label: "美元 (USD)" },
  { code: "EUR", label: "欧元 (EUR)" },
  { code: "TWD", label: "新台币 (TWD)" },
  { code: "HKD", label: "港币 (HKD)" },
  { code: "SGD", label: "新加坡元 (SGD)" },
  { code: "KRW", label: "韩元 (KRW)" },
  { code: "GBP", label: "英镑 (GBP)" },
  { code: "AUD", label: "澳元 (AUD)" },
  { code: "CAD", label: "加元 (CAD)" },
  { code: "THB", label: "泰铢 (THB)" },
  { code: "MYR", label: "马来西亚林吉特 (MYR)" },
];

const POSITIONS = [
  { value: "hero_left",    label: "Hero 区块左侧" },
  { value: "hero_right",   label: "Hero 区块右侧" },
  { value: "quick_actions", label: "快捷操作区块（需开启快捷操作）" },
  { value: "steps_title",  label: "流程区块标题旁（需开启流程区块）" },
  { value: "status_board", label: "状态看板（需开启看板）" },
  { value: "faq",          label: "常见问题（自动生成汇率 FAQ 条目）" },
];

const DEFAULT_CONFIG = {
  enabled: false,
  currencies: ["CNY", "USD"],
  position: "hero_right",
  textColor: "",
  unit: 100,
};

export default function ExchangeRateDisplayManager({ settings, onReload }) {
  const [form, setForm] = useState(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [customInput, setCustomInput] = useState("");

  useEffect(() => {
    const s = (settings || []).find(s => s.key === "home_exchange_rate_config");
    if (s?.value) {
      try { setForm({ ...DEFAULT_CONFIG, ...JSON.parse(s.value) }); } catch { /* noop */ }
    }
  }, [settings]);

  const toggleCurrency = (code) => {
    setForm(prev => {
      const cur = prev.currencies || [];
      if (cur.includes(code)) {
        return { ...prev, currencies: cur.filter(c => c !== code) };
      }
      if (cur.length >= 4) return prev; // max 4
      return { ...prev, currencies: [...cur, code] };
    });
  };

  const addCustomCurrency = () => {
    const code = customInput.trim().toUpperCase();
    if (!code || code.length < 2 || code.length > 6) return;
    if ((form.currencies || []).includes(code)) { setCustomInput(""); return; }
    if ((form.currencies || []).length >= 4) return;
    setForm(prev => ({ ...prev, currencies: [...(prev.currencies || []), code] }));
    setCustomInput("");
  };

  const handleSave = async () => {
    setSaving(true);
    const existing = (settings || []).find(s => s.key === "home_exchange_rate_config");
    const value = JSON.stringify(form);
    if (existing?.id) {
      await tenantEntity.update("SiteSettings", existing.id, { value });
    } else {
      await tenantEntity.create("SiteSettings", {
        key: "home_exchange_rate_config",
        value,
        description: "主页汇率显示配置（JSON）",
        category: "general",
      });
    }
    await onReload();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <Card className="border-emerald-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <CardTitle className="text-sm font-semibold text-gray-700">主页汇率显示设置</CardTitle>
          </div>
          <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={handleSave} disabled={saving}>
            <Save className="w-3 h-3 mr-1" />{saved ? "已保存 ✓" : saving ? "保存中..." : "保存"}
          </Button>
        </div>
        <p className="text-xs text-gray-400 mt-1">在主页指定位置展示实时日元汇率（数据来自平台汇率缓存，含租户增量）。</p>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* 总开关 */}
        <div className="flex items-center gap-2">
          <Switch checked={!!form.enabled} onCheckedChange={v => setForm(p => ({ ...p, enabled: !!v }))} />
          <Label className="text-sm cursor-pointer select-none" onClick={() => setForm(p => ({ ...p, enabled: !p.enabled }))}>启用主页汇率显示</Label>
        </div>

        {form.enabled && (
          <>
            {/* 货币选择 */}
            <div>
              <Label className="text-xs text-gray-500 block mb-2">
                显示币种（最多同时选 4 个，已选 {form.currencies?.length || 0}/4）
              </Label>
              <div className="grid grid-cols-2 gap-1.5">
                {ALL_CURRENCIES.map(c => {
                  const checked = (form.currencies || []).includes(c.code);
                  const disabled = !checked && (form.currencies || []).length >= 4;
                  return (
                    <div
                      key={c.code}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer select-none transition-colors ${
                        checked ? "bg-emerald-50 border-emerald-300 text-emerald-800" :
                        disabled ? "opacity-40 cursor-not-allowed border-gray-200" :
                        "border-gray-200 hover:border-gray-300 text-gray-700"
                      }`}
                      onClick={() => !disabled && toggleCurrency(c.code)}
                    >
                      <Checkbox checked={checked} disabled={disabled} onCheckedChange={() => !disabled && toggleCurrency(c.code)} />
                      <span>{c.label}</span>
                    </div>
                  );
                })}
              </div>

              {/* 自定义币种 */}
              <div className="mt-3 space-y-2">
                <p className="text-xs text-gray-400">自定义币种（输入标准 ISO 4217 代码，如 MXN、BRL）</p>
                {/* 已添加的自定义币种标签 */}
                {(form.currencies || []).filter(c => !ALL_CURRENCIES.some(a => a.code === c)).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {(form.currencies || []).filter(c => !ALL_CURRENCIES.some(a => a.code === c)).map(code => (
                      <span key={code} className="inline-flex items-center gap-1 text-xs bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-full px-2.5 py-1 font-medium">
                        {code}
                        <button onClick={() => toggleCurrency(code)} className="ml-0.5 hover:text-red-600 transition-colors">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Input
                    className="h-8 text-xs uppercase flex-1"
                    placeholder="例：MXN"
                    value={customInput}
                    maxLength={6}
                    onChange={e => setCustomInput(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key === "Enter" && addCustomCurrency()}
                    disabled={(form.currencies || []).length >= 4}
                  />
                  <Button size="sm" variant="outline" className="h-8 px-3 text-xs" onClick={addCustomCurrency}
                    disabled={(form.currencies || []).length >= 4 || !customInput.trim()}>
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>

            {/* 比例单位 */}
            <div>
              <Label className="text-xs text-gray-500 block mb-1.5">汇率比例单位（日元）</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  className="h-8 text-xs w-28"
                  value={form.unit ?? 100}
                  onChange={e => {
                    const v = parseInt(e.target.value, 10);
                    setForm(p => ({ ...p, unit: isNaN(v) || v < 1 ? 1 : v }));
                  }}
                />
                <span className="text-xs text-gray-400">日元 = 对应币种金额（仅显示币种金额，不显示日元数字）</span>
              </div>
            </div>

            {/* 字体颜色（仅 Hero 模式有效） */}
            {(form.position === "hero_left" || form.position === "hero_right") && (
              <div>
                <Label className="text-xs text-gray-500 block mb-2">字体颜色（叠加在 Hero 上时）</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={form.textColor || "#ffffff"}
                    onChange={e => setForm(p => ({ ...p, textColor: e.target.value }))}
                    className="w-8 h-8 rounded cursor-pointer border border-gray-200"
                  />
                  <span className="text-xs text-gray-500">{form.textColor || "#ffffff"}</span>
                  {form.textColor && (
                    <button
                      className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                      onClick={() => setForm(p => ({ ...p, textColor: "" }))}
                    >重置默认</button>
                  )}
                </div>
              </div>
            )}

            {/* 显示位置 */}
            <div>
              <Label className="text-xs text-gray-500 block mb-2">显示位置</Label>
              <div className="space-y-1.5">
                {POSITIONS.map(pos => (
                  <div
                    key={pos.value}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs cursor-pointer select-none transition-colors ${
                      form.position === pos.value
                        ? "bg-emerald-50 border-emerald-300 text-emerald-800 font-medium"
                        : "border-gray-200 hover:border-gray-300 text-gray-700"
                    }`}
                    onClick={() => setForm(p => ({ ...p, position: pos.value }))}
                  >
                    <div className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${
                      form.position === pos.value ? "border-emerald-600 bg-emerald-600" : "border-gray-300"
                    }`} />
                    {pos.label}
                  </div>
                ))}
              </div>
              {form.position === "faq" && (
                <p className="text-xs text-amber-600 mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  选择"常见问题"时，系统将在 FAQ 末尾自动插入一条「{form.unit ?? 100}日元兑 [币种] 是多少？」的问答条目，答案实时显示当前汇率。
                </p>
              )}
            </div>

            {/* 预览 */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
              <p className="text-xs text-gray-400 mb-1.5">显示预览（实际数字会用实时汇率替换）</p>
              <div className="flex flex-wrap gap-2">
                {(form.currencies || []).map(code => (
                  <span key={code} className="inline-flex items-center gap-1 text-xs bg-white border border-emerald-200 text-emerald-800 rounded-full px-2.5 py-1 font-medium">
                    <TrendingUp className="w-3 h-3" />
                    <span className="font-bold">---</span> {code}
                  </span>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1">（以 {form.unit ?? 100} 日元为单位计算后，仅显示换算后的币种金额）</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}