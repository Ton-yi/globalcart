/**
 * TransitShippingMethodManager - Admin only
 * Manage transit shipping methods (中转运输方式)
 */
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Trash2, Edit2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CURRENCIES = ["JPY", "CNY", "USD", "TWD", "HKD", "EUR", "SGD"];

function MethodCard({ method, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...method });
  const [saving, setSaving] = useState(false);

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    await onSave(form);
    setEditing(false);
    setSaving(false);
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
            <Badge className="text-xs bg-orange-100 text-orange-700">
              {method.fee_currency || "JPY"} {Number(method.fee || 0).toLocaleString()}
            </Badge>
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
        <div className="border-t border-gray-100 px-4 py-4 space-y-3 bg-gray-50">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-500">运输方式名 *</Label>
              <Input className="mt-1 h-8 text-sm" value={form.name} onChange={e => f("name", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-gray-500">费用 *</Label>
              <Input type="number" step="0.01" className="mt-1 h-8 text-sm" value={form.fee} onChange={e => f("fee", parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <Label className="text-xs text-gray-500">费用货币</Label>
              <Select value={form.fee_currency || "JPY"} onValueChange={v => f("fee_currency", v)}>
                <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs text-gray-500">描述</Label>
            <Textarea rows={2} className="mt-1 text-sm" value={form.description || ""} onChange={e => f("description", e.target.value)} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => { setEditing(false); setForm({ ...method }); }}>取消</Button>
            <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={handleSave} disabled={saving || !form.name}>
              {saving ? "保存中..." : "保存"}
            </Button>
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
  const [newForm, setNewForm] = useState({ name: "", description: "", fee: "", fee_currency: "JPY", is_active: true });

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

  const handleAddNew = async () => {
    if (!newForm.name || newForm.fee === "") return;
    await base44.entities.TransitShippingMethod.create({ ...newForm, fee: parseFloat(newForm.fee) || 0 });
    setNewForm({ name: "", description: "", fee: "", fee_currency: "JPY", is_active: true });
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
        <div className="border border-dashed border-gray-300 rounded-xl p-4 space-y-3 bg-gray-50">
          <p className="text-xs font-medium text-gray-600">新增中转运输方式</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-500">名称 *</Label>
              <Input className="mt-1 h-8 text-sm" value={newForm.name} onChange={e => setNewForm(p => ({ ...p, name: e.target.value }))} placeholder="如：顺丰速运" />
            </div>
            <div>
              <Label className="text-xs text-gray-500">费用 *</Label>
              <Input type="number" step="0.01" className="mt-1 h-8 text-sm" value={newForm.fee} onChange={e => setNewForm(p => ({ ...p, fee: e.target.value }))} placeholder="500" />
            </div>
            <div>
              <Label className="text-xs text-gray-500">费用货币</Label>
              <Select value={newForm.fee_currency} onValueChange={v => setNewForm(p => ({ ...p, fee_currency: v }))}>
                <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-gray-500">描述（可选）</Label>
              <Input className="mt-1 h-8 text-sm" value={newForm.description} onChange={e => setNewForm(p => ({ ...p, description: e.target.value }))} placeholder="如：次日达" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>取消</Button>
            <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={handleAddNew} disabled={!newForm.name || newForm.fee === ""}>添加</Button>
          </div>
        </div>
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