/**
 * TransitShippingMethodManager - Admin only
 * Manage transit shipping methods with country selection and rate configuration
 */
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Trash2, Edit2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CountrySelect from "@/components/common/CountrySelect";
import { getCountry } from "@/lib/countries";

const CURRENCIES = ["JPY", "CNY", "USD", "TWD", "HKD", "EUR", "SGD"];

const EMPTY_RATE = { zone: "通用", first_weight_g: 500, first_weight_fee: 0, additional_unit_g: 500, additional_unit_fee: 0, currency: "CNY" };

function RateRow({ rate, onChange, onDelete }) {
  return (
    <div className="grid grid-cols-6 gap-2 items-end text-xs">
      <div>
        <span className="text-gray-400 block mb-1">区域</span>
        <Input className="h-7 text-xs" value={rate.zone} onChange={e => onChange({ ...rate, zone: e.target.value })} />
      </div>
      <div>
        <span className="text-gray-400 block mb-1">首重(g)</span>
        <Input type="number" className="h-7 text-xs" value={rate.first_weight_g} onChange={e => onChange({ ...rate, first_weight_g: parseFloat(e.target.value) || 0 })} />
      </div>
      <div>
        <span className="text-gray-400 block mb-1">首重运费</span>
        <Input type="number" step="0.01" className="h-7 text-xs" value={rate.first_weight_fee} onChange={e => onChange({ ...rate, first_weight_fee: parseFloat(e.target.value) || 0 })} />
      </div>
      <div>
        <span className="text-gray-400 block mb-1">续重(g)</span>
        <Input type="number" className="h-7 text-xs" value={rate.additional_unit_g} onChange={e => onChange({ ...rate, additional_unit_g: parseFloat(e.target.value) || 0 })} />
      </div>
      <div>
        <span className="text-gray-400 block mb-1">续重运费</span>
        <Input type="number" step="0.01" className="h-7 text-xs" value={rate.additional_unit_fee} onChange={e => onChange({ ...rate, additional_unit_fee: parseFloat(e.target.value) || 0 })} />
      </div>
      <div className="flex items-end gap-1">
        <div className="flex-1">
          <span className="text-gray-400 block mb-1">货币</span>
          <Select value={rate.currency || "CNY"} onValueChange={v => onChange({ ...rate, currency: v })}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <button onClick={onDelete} className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 mb-0.5">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function MethodForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: "", description: "", country: "CN", fee: 0, fee_currency: "CNY",
    rate_mode: "simple", simple_rates: [{ ...EMPTY_RATE }], is_active: true,
    ...initial,
  });
  const [saving, setSaving] = useState(false);
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const updateRate = (i, updated) => {
    const rates = [...(form.simple_rates || [])];
    rates[i] = updated;
    f("simple_rates", rates);
  };
  const removeRate = (i) => f("simple_rates", (form.simple_rates || []).filter((_, idx) => idx !== i));
  const addRate = () => f("simple_rates", [...(form.simple_rates || []), { ...EMPTY_RATE }]);

  const handleSave = async () => {
    setSaving(true);
    // For fixed mode, sync fee/fee_currency from first simple_rate
    const saveData = { ...form };
    if (form.rate_mode === "fixed") {
      saveData.fee = parseFloat(form.fee) || 0;
    }
    await onSave(saveData);
    setSaving(false);
  };

  return (
    <div className="border border-dashed border-gray-300 rounded-xl p-4 space-y-3 bg-gray-50">
      <p className="text-xs font-medium text-gray-600">{initial?.id ? "编辑中转运输方式" : "新增中转运输方式"}</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-gray-500">名称 *</Label>
          <Input className="mt-1 h-8 text-sm" value={form.name} onChange={e => f("name", e.target.value)} placeholder="如：顺丰速运" />
        </div>
        <div>
          <Label className="text-xs text-gray-500">中转国家 *</Label>
          <CountrySelect value={form.country || "CN"} onChange={v => f("country", v)} className="mt-1" />
        </div>
      </div>
      <div>
        <Label className="text-xs text-gray-500">描述（可选）</Label>
        <Input className="mt-1 h-8 text-sm" value={form.description || ""} onChange={e => f("description", e.target.value)} placeholder="如：次日达" />
      </div>

      {/* Rate mode */}
      <div>
        <Label className="text-xs text-gray-500">费率模式</Label>
        <div className="flex gap-3 mt-1.5">
          {[{ v: "simple", l: "首续重计费" }, { v: "fixed", l: "固定费用" }].map(opt => (
            <label key={opt.v} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors ${form.rate_mode === opt.v ? "border-orange-400 bg-orange-50 text-orange-700" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}>
              <input type="radio" checked={form.rate_mode === opt.v} onChange={() => f("rate_mode", opt.v)} className="accent-orange-500" />
              {opt.l}
            </label>
          ))}
        </div>
      </div>

      {form.rate_mode === "fixed" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-gray-500">固定费用 *</Label>
            <Input type="number" step="0.01" className="mt-1 h-8 text-sm" value={form.fee || ""} onChange={e => f("fee", e.target.value)} placeholder="0" />
          </div>
          <div>
            <Label className="text-xs text-gray-500">货币</Label>
            <Select value={form.fee_currency || "CNY"} onValueChange={v => f("fee_currency", v)}>
              <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      )}

      {form.rate_mode === "simple" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-gray-500">首续重费率</Label>
            <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={addRate}>
              <Plus className="w-3 h-3 mr-1" />添加区域
            </Button>
          </div>
          {(form.simple_rates || []).length === 0 && (
            <p className="text-xs text-gray-400 text-center py-2">点击"添加区域"添加费率行</p>
          )}
          <div className="space-y-2">
            {(form.simple_rates || []).map((r, i) => (
              <RateRow key={i} rate={r} onChange={updated => updateRate(i, updated)} onDelete={() => removeRate(i)} />
            ))}
          </div>
          {(form.simple_rates || []).length > 0 && (
            <p className="text-xs text-gray-400">货币以各行的货币设置为准</p>
          )}
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={onCancel}>取消</Button>
        <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={handleSave} disabled={saving || !form.name}>
          {saving ? "保存中..." : "保存"}
        </Button>
      </div>
    </div>
  );
}

function MethodCard({ method, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const countryName = getCountry(method.country)?.name || method.country || "中国";

  const getRateSummary = () => {
    if (method.rate_mode === "fixed") {
      return `固定 ${method.fee_currency || "CNY"} ${Number(method.fee || 0).toLocaleString()}`;
    }
    const rates = method.simple_rates || [];
    if (rates.length === 0) return "无费率";
    const r = rates[0];
    return `首 ${r.first_weight_g}g/${r.first_weight_fee}${r.currency} 续 ${r.additional_unit_g}g/${r.additional_unit_fee}${r.currency}`;
  };

  return (
    <div className={`border rounded-xl overflow-hidden ${method.is_active ? "border-gray-200" : "border-gray-100 opacity-60"}`}>
      <div className="flex items-center gap-3 px-4 py-3 bg-white">
        <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600 text-xs font-bold flex-shrink-0">
          {(method.name || "")[0] || "T"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-gray-900">{method.name}</span>
            <Badge variant="outline" className="text-xs">{countryName}</Badge>
            <Badge className="text-xs bg-orange-100 text-orange-700">{getRateSummary()}</Badge>
            {!method.is_active && <Badge className="text-xs bg-gray-100 text-gray-400">已禁用</Badge>}
          </div>
          {method.description && <p className="text-xs text-gray-400 mt-0.5 truncate">{method.description}</p>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Switch checked={!!method.is_active} onCheckedChange={v => onSave({ ...method, is_active: v })} />
          <button onClick={() => setEditing(!editing)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(method.id)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {editing && (
        <div className="border-t border-gray-100">
          <div className="px-4 py-4 bg-gray-50">
            <MethodForm
              initial={method}
              onSave={async (data) => { await onSave(data); setEditing(false); }}
              onCancel={() => setEditing(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function TransitShippingMethodManager() {
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.TransitShippingMethod.list();
    setMethods(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (updated) => {
    await base44.entities.TransitShippingMethod.update(updated.id, updated);
    await load();
  };

  const handleDelete = async (id) => {
    if (!confirm("确认删除此中转运输方式？")) return;
    await base44.entities.TransitShippingMethod.delete(id);
    await load();
  };

  const handleAddNew = async (data) => {
    await base44.entities.TransitShippingMethod.create(data);
    setShowAdd(false);
    await load();
  };

  if (loading) return <div className="py-8 text-center text-gray-400 text-sm">加载中...</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-700">中转运输方式管理</p>
          <p className="text-xs text-gray-400 mt-0.5">用户在提交拼邮发货申请时可选择中转段的运输方式</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowAdd(v => !v)}>
          <Plus className="w-3.5 h-3.5 mr-1.5" />添加中转方式
        </Button>
      </div>

      {showAdd && (
        <MethodForm
          onSave={handleAddNew}
          onCancel={() => setShowAdd(false)}
        />
      )}

      {methods.length === 0 && !showAdd && (
        <p className="text-xs text-gray-400 text-center py-6">暂无中转运输方式，点击"添加中转方式"创建</p>
      )}

      {methods.map(m => (
        <MethodCard key={m.id} method={m} onSave={handleSave} onDelete={handleDelete} />
      ))}
    </div>
  );
}