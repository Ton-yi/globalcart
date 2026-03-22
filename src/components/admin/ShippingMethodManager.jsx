/**
 * ShippingMethodManager - Admin only
 * Manage shipping methods with zone-based rate configuration aligned with lib/countries.js
 */
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { tenantEntity } from "@/lib/tenantApi";
import { Plus, Trash2, Edit2, ChevronDown, ChevronUp, Check, X, Download, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CountrySelect from "@/components/common/CountrySelect";
import { getCountry, getCountryZone, EMS_RATES, COUNTRY_ZONES, ALL_COUNTRIES } from "@/lib/countries";

const CURRENCIES = ["JPY", "CNY", "USD", "TWD", "HKD", "EUR"];

const ZONE_LABELS = {
  zone1: "第1地帯",
  zone2: "第2地帯",
  zone3: "第3地帯",
  zone4: "第4地帯",
  zone5: "第5地帯",
};

const DEFAULT_METHODS = [
  { name: "EMS空运", code: "EMS", icon: "Plane", color: "#2563EB", transit_days: "5-10个工作日", description: "日本邮政EMS国际特快专递，速度快，适合贵重物品", is_active: true, rate_mode: "simple", simple_rates: [], detailed_rates: [] },
  { name: "海运", code: "surface", icon: "Ship", color: "#0891B2", transit_days: "30-60天", description: "日本邮政海运，价格实惠，适合大件/重件", is_active: true, rate_mode: "simple", simple_rates: [], detailed_rates: [] },
  { name: "小型包装物空运", code: "small_packet_air", icon: "Package", color: "#7C3AED", transit_days: "10-20个工作日", description: "小型包裹空运，价格适中，适合轻小件", is_active: true, rate_mode: "simple", simple_rates: [], detailed_rates: [] },
];

/** Generate detailed_rates for EMS from lib/countries.js EMS_RATES, per zone */
function generateEMSDetailedRates() {
  const rates = [];
  Object.entries(EMS_RATES).forEach(([zone, brackets]) => {
    // Use zone as the "country" key (e.g. "zone1"), so one row per zone per bracket
    // But for display purposes we use zone codes
    // We'll use one row per zone bracket with country = zone code
    brackets.forEach((b, idx) => {
      const from = idx === 0 ? 0 : brackets[idx - 1].maxWeight;
      rates.push({
        country: zone, // zone code as country key
        weight_from_g: from,
        weight_to_g: b.maxWeight,
        fee: b.fee,
        currency: "JPY",
      });
    });
  });
  return rates;
}

/** Generate simple_rates for EMS: one row per zone using first-weight style */
function generateEMSSimpleRatesByZone() {
  return Object.entries(EMS_RATES).map(([zone, brackets]) => {
    // first bracket as base, next bracket delta as additional
    const first = brackets[0];
    const second = brackets[1];
    const addUnit = second ? (second.maxWeight - first.maxWeight) : 500;
    const addFee = second ? (second.fee - first.fee) : 0;
    return {
      country: zone,
      first_weight_g: first.maxWeight,
      first_weight_fee: first.fee,
      additional_unit_g: addUnit,
      additional_unit_fee: addFee,
      currency: "JPY",
    };
  });
}

function countryLabel(code) {
  if (!code) return "";
  // If it looks like a zone code
  if (ZONE_LABELS[code]) return ZONE_LABELS[code];
  const c = getCountry(code);
  return c ? c.name : code;
}

function RateRow({ rate, onChange, onDelete }) {
  return (
    <div className="grid grid-cols-6 gap-1.5 items-end">
      <div>
        <Label className="text-xs text-gray-400">国家/地带</Label>
        <CountrySelect
          value={rate.country || ""}
          onChange={v => onChange({ ...rate, country: v })}
          placeholder="选择"
          className="mt-0.5"
          compact
          allowZone
        />
      </div>
      <div>
        <Label className="text-xs text-gray-400">首重(g)</Label>
        <Input type="number" className="h-7 text-xs mt-0.5" value={rate.first_weight_g || ""} onChange={e => onChange({ ...rate, first_weight_g: parseFloat(e.target.value) || 0 })} placeholder="500" />
      </div>
      <div>
        <Label className="text-xs text-gray-400">首重运费</Label>
        <Input type="number" className="h-7 text-xs mt-0.5" value={rate.first_weight_fee || ""} onChange={e => onChange({ ...rate, first_weight_fee: parseFloat(e.target.value) || 0 })} placeholder="1200" />
      </div>
      <div>
        <Label className="text-xs text-gray-400">续重单位(g)</Label>
        <Input type="number" className="h-7 text-xs mt-0.5" value={rate.additional_unit_g || ""} onChange={e => onChange({ ...rate, additional_unit_g: parseFloat(e.target.value) || 0 })} placeholder="500" />
      </div>
      <div>
        <Label className="text-xs text-gray-400">续重运费</Label>
        <Input type="number" className="h-7 text-xs mt-0.5" value={rate.additional_unit_fee || ""} onChange={e => onChange({ ...rate, additional_unit_fee: parseFloat(e.target.value) || 0 })} placeholder="600" />
      </div>
      <div className="flex items-end gap-1">
        <div className="flex-1">
          <Label className="text-xs text-gray-400">货币</Label>
          <Select value={rate.currency || "JPY"} onValueChange={v => onChange({ ...rate, currency: v })}>
            <SelectTrigger className="h-7 text-xs mt-0.5"><SelectValue /></SelectTrigger>
            <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <button onClick={onDelete} className="text-red-400 hover:text-red-600 mb-0.5"><X className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  );
}

function DetailedRateRow({ rate, onChange, onDelete }) {
  return (
    <div className="grid grid-cols-5 gap-1.5 items-end">
      <div>
        <Label className="text-xs text-gray-400">国家/地带</Label>
        <CountrySelect
          value={rate.country || ""}
          onChange={v => onChange({ ...rate, country: v })}
          placeholder="选择"
          className="mt-0.5"
          compact
          allowZone
        />
      </div>
      <div>
        <Label className="text-xs text-gray-400">起始(g)</Label>
        <Input type="number" className="h-7 text-xs mt-0.5" value={rate.weight_from_g || ""} onChange={e => onChange({ ...rate, weight_from_g: parseFloat(e.target.value) || 0 })} placeholder="0" />
      </div>
      <div>
        <Label className="text-xs text-gray-400">结束(g)</Label>
        <Input type="number" className="h-7 text-xs mt-0.5" value={rate.weight_to_g || ""} onChange={e => onChange({ ...rate, weight_to_g: parseFloat(e.target.value) || 0 })} placeholder="1000" />
      </div>
      <div>
        <Label className="text-xs text-gray-400">运费</Label>
        <Input type="number" className="h-7 text-xs mt-0.5" value={rate.fee || ""} onChange={e => onChange({ ...rate, fee: parseFloat(e.target.value) || 0 })} placeholder="1500" />
      </div>
      <div className="flex items-end gap-1">
        <div className="flex-1">
          <Label className="text-xs text-gray-400">货币</Label>
          <Select value={rate.currency || "JPY"} onValueChange={v => onChange({ ...rate, currency: v })}>
            <SelectTrigger className="h-7 text-xs mt-0.5"><SelectValue /></SelectTrigger>
            <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <button onClick={onDelete} className="text-red-400 hover:text-red-600 mb-0.5"><X className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  );
}

function MethodCard({ method, onSave, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...method });
  const [saving, setSaving] = useState(false);

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const addSimpleRate = () => {
    setForm(p => ({ ...p, simple_rates: [...(p.simple_rates || []), { country: "", first_weight_g: 500, first_weight_fee: 0, additional_unit_g: 500, additional_unit_fee: 0, currency: "JPY" }] }));
  };

  const updateSimpleRate = (idx, updated) => {
    const arr = [...(form.simple_rates || [])];
    arr[idx] = updated;
    setForm(p => ({ ...p, simple_rates: arr }));
  };

  const deleteSimpleRate = (idx) => {
    setForm(p => ({ ...p, simple_rates: (p.simple_rates || []).filter((_, i) => i !== idx) }));
  };

  const addDetailedRate = () => {
    setForm(p => ({ ...p, detailed_rates: [...(p.detailed_rates || []), { country: "", weight_from_g: 0, weight_to_g: 1000, fee: 0, currency: "JPY" }] }));
  };

  const updateDetailedRate = (idx, updated) => {
    const arr = [...(form.detailed_rates || [])];
    arr[idx] = updated;
    setForm(p => ({ ...p, detailed_rates: arr }));
  };

  const deleteDetailedRate = (idx) => {
    setForm(p => ({ ...p, detailed_rates: (p.detailed_rates || []).filter((_, i) => i !== idx) }));
  };

  const handleImportEMS = () => {
    if (form.rate_mode === "simple") {
      setForm(p => ({ ...p, simple_rates: generateEMSSimpleRatesByZone() }));
    } else {
      setForm(p => ({ ...p, detailed_rates: generateEMSDetailedRates() }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(form);
    setEditing(false);
    setSaving(false);
  };

  const isEMS = method.code === "EMS";

  return (
    <div className={`border rounded-xl overflow-hidden ${method.is_active ? "border-gray-200" : "border-gray-100 opacity-60"}`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
          style={{ backgroundColor: method.color || "#6B7280" }}>
          {(method.name || "")[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-gray-900">{method.name}</span>
            <Badge variant="outline" className="text-xs">{method.code}</Badge>
            {method.transit_days && <span className="text-xs text-gray-400">{method.transit_days}</span>}
            <Badge className={`text-xs ${method.rate_mode === "detailed" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
              {method.rate_mode === "detailed" ? "详细费率" : "简易费率"}
            </Badge>
            {method.simple_rates?.length > 0 && <Badge className="text-xs bg-green-100 text-green-700">{method.simple_rates.length} 条费率</Badge>}
            {method.detailed_rates?.length > 0 && <Badge className="text-xs bg-green-100 text-green-700">{method.detailed_rates.length} 条区间</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Switch checked={method.is_active} onCheckedChange={v => onSave({ ...method, is_active: v })} />
          <button onClick={() => { setEditing(!editing); setExpanded(true); }} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(method.id)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setExpanded(v => !v)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-4 space-y-4 bg-gray-50">
          {editing ? (
            <>
              {/* Basic info */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-500">运输方式名 *</Label>
                  <Input className="mt-1 h-8 text-sm" value={form.name} onChange={e => f("name", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">代码 *</Label>
                  <Input className="mt-1 h-8 text-sm" value={form.code} onChange={e => f("code", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">颜色</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <input type="color" value={form.color || "#6B7280"} onChange={e => f("color", e.target.value)} className="w-8 h-8 rounded cursor-pointer border border-gray-200" />
                    <Input className="h-8 text-sm flex-1" value={form.color || ""} onChange={e => f("color", e.target.value)} placeholder="#2563EB" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">时效</Label>
                  <Input className="mt-1 h-8 text-sm" value={form.transit_days || ""} onChange={e => f("transit_days", e.target.value)} placeholder="5-10个工作日" />
                </div>
              </div>
              <div>
                <Label className="text-xs text-gray-500">描述</Label>
                <Textarea rows={2} className="mt-1 text-sm" value={form.description || ""} onChange={e => f("description", e.target.value)} />
              </div>

              {/* Rate mode */}
              <div>
                <Label className="text-xs text-gray-500 font-medium">费率设置模式</Label>
                <div className="flex gap-3 mt-2">
                  {["simple", "detailed"].map(mode => (
                    <label key={mode} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm ${form.rate_mode === mode ? "border-red-300 bg-red-50 text-red-700" : "border-gray-200 text-gray-600"}`}>
                      <input type="radio" className="hidden" checked={form.rate_mode === mode} onChange={() => f("rate_mode", mode)} />
                      {form.rate_mode === mode && <Check className="w-3.5 h-3.5" />}
                      {mode === "simple" ? "简易设置（首重+续重）" : "详细设置（按重量区间）"}
                    </label>
                  ))}
                </div>
              </div>

              {/* EMS import button */}
              {isEMS && (
                <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-lg p-3">
                  <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <span className="text-xs text-blue-700 flex-1">EMS 方式可直接从日本邮政官方费率表（lib/countries.js）导入，按5个地带自动生成费率。</span>
                  <Button size="sm" variant="outline" className="h-7 text-xs border-blue-300 text-blue-700 hover:bg-blue-100 flex-shrink-0" onClick={handleImportEMS}>
                    <Download className="w-3 h-3 mr-1" />导入官方费率
                  </Button>
                </div>
              )}

              {/* Simple rates */}
              {form.rate_mode === "simple" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-gray-500 font-medium">按国家/地带费率（简易）</Label>
                    <Button size="sm" variant="outline" className="h-6 text-xs" onClick={addSimpleRate}>
                      <Plus className="w-3 h-3 mr-1" />添加
                    </Button>
                  </div>
                  <p className="text-xs text-gray-400">费率 = 首重费 + 续重费 × ceil((实重 - 首重) / 续重单位)。国家字段支持输入国家代码(CN/US)或地带代码(zone1~zone5)。</p>
                  {(form.simple_rates || []).map((rate, idx) => (
                    <RateRow key={idx} rate={rate} onChange={u => updateSimpleRate(idx, u)} onDelete={() => deleteSimpleRate(idx)} />
                  ))}
                  {(form.simple_rates || []).length === 0 && (
                    <p className="text-xs text-gray-400 py-2">暂无费率，点击"添加"或使用上方导入功能</p>
                  )}
                </div>
              )}

              {/* Detailed rates */}
              {form.rate_mode === "detailed" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-gray-500 font-medium">按重量区间费率（详细）</Label>
                    <Button size="sm" variant="outline" className="h-6 text-xs" onClick={addDetailedRate}>
                      <Plus className="w-3 h-3 mr-1" />添加区间
                    </Button>
                  </div>
                  <p className="text-xs text-gray-400">国家字段支持输入国家代码(CN/US)或地带代码(zone1~zone5)。</p>
                  <div className="max-h-80 overflow-y-auto space-y-1.5 pr-1">
                    {(form.detailed_rates || []).map((rate, idx) => (
                      <DetailedRateRow key={idx} rate={rate} onChange={u => updateDetailedRate(idx, u)} onDelete={() => deleteDetailedRate(idx)} />
                    ))}
                  </div>
                  {(form.detailed_rates || []).length === 0 && (
                    <p className="text-xs text-gray-400 py-2">暂无区间，点击"添加区间"或使用上方导入功能</p>
                  )}
                </div>
              )}

              <div className="flex gap-2 justify-end pt-1">
                <Button variant="outline" size="sm" onClick={() => { setEditing(false); setForm({ ...method }); }}>取消</Button>
                <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={handleSave} disabled={saving}>
                  {saving ? "保存中..." : "保存"}
                </Button>
              </div>
            </>
          ) : (
            // Read-only view
            <div className="space-y-3 text-sm text-gray-700">
              {method.description && <p className="text-gray-600">{method.description}</p>}
              {method.rate_mode === "simple" && (method.simple_rates || []).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">简易费率</p>
                  <div className="overflow-x-auto">
                    <table className="text-xs w-full">
                      <thead>
                        <tr className="text-gray-400 border-b border-gray-200">
                          <th className="text-left py-1 pr-3">国家/地带</th>
                          <th className="text-right py-1 pr-3">首重</th>
                          <th className="text-right py-1 pr-3">首重费</th>
                          <th className="text-right py-1 pr-3">续重单位</th>
                          <th className="text-right py-1">续重费</th>
                        </tr>
                      </thead>
                      <tbody>
                        {method.simple_rates.map((r, i) => (
                          <tr key={i} className="border-b border-gray-50">
                            <td className="py-1 pr-3">{countryLabel(r.country)}</td>
                            <td className="text-right py-1 pr-3">{r.first_weight_g}g</td>
                            <td className="text-right py-1 pr-3">{r.currency} {r.first_weight_fee}</td>
                            <td className="text-right py-1 pr-3">{r.additional_unit_g}g</td>
                            <td className="text-right py-1">{r.currency} {r.additional_unit_fee}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {method.rate_mode === "detailed" && (method.detailed_rates || []).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">详细费率（{method.detailed_rates.length} 条）</p>
                  <div className="overflow-x-auto max-h-60 overflow-y-auto">
                    <table className="text-xs w-full">
                      <thead className="sticky top-0 bg-gray-50">
                        <tr className="text-gray-400 border-b border-gray-200">
                          <th className="text-left py-1 pr-3">国家/地带</th>
                          <th className="text-right py-1 pr-3">起始重量</th>
                          <th className="text-right py-1 pr-3">结束重量</th>
                          <th className="text-right py-1">运费</th>
                        </tr>
                      </thead>
                      <tbody>
                        {method.detailed_rates.map((r, i) => (
                          <tr key={i} className="border-b border-gray-50">
                            <td className="py-1 pr-3">{countryLabel(r.country)}</td>
                            <td className="text-right py-1 pr-3">{r.weight_from_g}g</td>
                            <td className="text-right py-1 pr-3">{r.weight_to_g}g</td>
                            <td className="text-right py-1">{r.currency} {r.fee}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {((method.rate_mode === "simple" && (!method.simple_rates || method.simple_rates.length === 0)) ||
               (method.rate_mode === "detailed" && (!method.detailed_rates || method.detailed_rates.length === 0))) && (
                <p className="text-xs text-gray-400 italic">暂未设置费率，点击编辑添加</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ShippingMethodManager() {
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newForm, setNewForm] = useState({ name: "", code: "", color: "#6B7280", transit_days: "", description: "", is_active: true, rate_mode: "simple", simple_rates: [], detailed_rates: [] });

  const load = async () => {
    setLoading(true);
    let data = await tenantEntity.list('ShippingMethod');
    if (data.length === 0) {
      await Promise.all(DEFAULT_METHODS.map(m => tenantEntity.create('ShippingMethod', m)));
      data = await tenantEntity.list('ShippingMethod');
    }
    setMethods(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (updated) => {
    await tenantEntity.update('ShippingMethod', updated.id, updated);
    await load();
  };

  const handleDelete = async (id) => {
    if (!confirm("确认删除此运输方式？")) return;
    await tenantEntity.delete('ShippingMethod', id);
    await load();
  };

  const handleAddNew = async () => {
    if (!newForm.name || !newForm.code) return;
    await tenantEntity.create('ShippingMethod', newForm);
    setNewForm({ name: "", code: "", color: "#6B7280", transit_days: "", description: "", is_active: true, rate_mode: "simple", simple_rates: [], detailed_rates: [] });
    setShowAdd(false);
    await load();
  };

  if (loading) return <div className="py-8 text-center text-gray-400 text-sm">加载中...</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-700">运输方式管理</p>
          <p className="text-xs text-gray-400 mt-0.5">国家/地带代码与 lib/countries.js 中的日邮地带规则一致（zone1~zone5）</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowAdd(v => !v)}>
          <Plus className="w-3.5 h-3.5 mr-1.5" />添加运输方式
        </Button>
      </div>

      {/* Add new form */}
      {showAdd && (
        <div className="border border-dashed border-gray-300 rounded-xl p-4 space-y-3 bg-gray-50">
          <p className="text-xs font-medium text-gray-600">新增运输方式</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-500">名称 *</Label>
              <Input className="mt-1 h-8 text-sm" value={newForm.name} onChange={e => setNewForm(p => ({ ...p, name: e.target.value }))} placeholder="EMS空运" />
            </div>
            <div>
              <Label className="text-xs text-gray-500">代码 *</Label>
              <Input className="mt-1 h-8 text-sm" value={newForm.code} onChange={e => setNewForm(p => ({ ...p, code: e.target.value }))} placeholder="EMS" />
            </div>
            <div>
              <Label className="text-xs text-gray-500">颜色</Label>
              <div className="flex items-center gap-2 mt-1">
                <input type="color" value={newForm.color} onChange={e => setNewForm(p => ({ ...p, color: e.target.value }))} className="w-8 h-8 rounded cursor-pointer border border-gray-200" />
                <Input className="h-8 text-sm" value={newForm.color} onChange={e => setNewForm(p => ({ ...p, color: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-500">时效</Label>
              <Input className="mt-1 h-8 text-sm" value={newForm.transit_days} onChange={e => setNewForm(p => ({ ...p, transit_days: e.target.value }))} placeholder="5-10个工作日" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>取消</Button>
            <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={handleAddNew} disabled={!newForm.name || !newForm.code}>添加</Button>
          </div>
        </div>
      )}

      {methods.map(m => (
        <MethodCard key={m.id} method={m} onSave={handleSave} onDelete={handleDelete} />
      ))}
    </div>
  );
}