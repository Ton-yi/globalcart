/**
 * BoxTemplateManager
 * Admin CRUD for outer box templates used in shipment quotations.
 */
import { useState } from "react";
import { Plus, Trash2, Edit2, Save, X, Package } from "lucide-react";
import { tenantEntity } from "@/lib/tenantApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const EMPTY_FORM = { box_name: "", description: "", image_url: "", weight_g: "", price_jpy: "", is_active: true };

export default function BoxTemplateManager({ initialData }) {
  const [templates, setTemplates] = useState(initialData || []);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.box_name) return;
    setSaving(true);
    const data = {
      box_name: form.box_name.trim(),
      description: form.description.trim(),
      image_url: form.image_url.trim(),
      weight_g: parseFloat(form.weight_g) || 0,
      price_jpy: Math.round(parseFloat(form.price_jpy) || 0),
      is_active: form.is_active,
    };
    if (editingId) {
      await tenantEntity.update('BoxTemplate', editingId, data);
      setTemplates(prev => prev.map(t => t.id === editingId ? { ...t, ...data } : t));
    } else {
      const created = await tenantEntity.create('BoxTemplate', data);
      setTemplates(prev => [...prev, created]);
    }
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(false);
    setSaving(false);
  };

  const handleEdit = (t) => {
    setForm({ box_name: t.box_name, description: t.description || "", image_url: t.image_url || "", weight_g: t.weight_g?.toString() || "0", price_jpy: t.price_jpy?.toString() || "0", is_active: t.is_active !== false });
    setEditingId(t.id);
    setShowForm(true);
  };

  const handleToggle = async (t) => {
    await tenantEntity.update('BoxTemplate', t.id, { is_active: !t.is_active });
    setTemplates(prev => prev.map(x => x.id === t.id ? { ...x, is_active: !x.is_active } : x));
  };

  const handleDelete = async (id) => {
    await tenantEntity.delete('BoxTemplate', id);
    setTemplates(prev => prev.filter(t => t.id !== id));
  };

  const handleCancel = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-700">外箱模板</span>
          <Badge className="text-xs bg-gray-100 text-gray-500">{templates.length} 个</Badge>
        </div>
        {!showForm && (
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowForm(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" />新增外箱
          </Button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="border border-blue-200 rounded-lg p-4 bg-blue-50 space-y-3">
          <p className="text-xs font-medium text-blue-700">{editingId ? "编辑外箱模板" : "新增外箱模板"}</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs text-gray-500">模板名称 *</Label>
              <Input className="mt-0.5 h-8 text-sm" placeholder="例：标准纸箱 (40×30×20cm)" value={form.box_name} onChange={e => f('box_name', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-gray-500">空箱重量 (g)</Label>
              <Input type="number" min="0" step="1" className="mt-0.5 h-8 text-sm" placeholder="500" value={form.weight_g} onChange={e => f('weight_g', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-gray-500">箱子费用 (JPY)</Label>
              <Input type="number" min="0" step="1" className="mt-0.5 h-8 text-sm" placeholder="200" value={form.price_jpy} onChange={e => f('price_jpy', e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs text-gray-500">说明（可选）</Label>
              <Input className="mt-0.5 h-8 text-sm" placeholder="可选描述" value={form.description} onChange={e => f('description', e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs text-gray-500">图片URL（可选）</Label>
              <Input className="mt-0.5 h-8 text-sm" placeholder="https://..." value={form.image_url} onChange={e => f('image_url', e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 h-7 text-xs" onClick={handleSave} disabled={saving || !form.box_name}>
              <Save className="w-3 h-3 mr-1" />{saving ? "保存中..." : "保存"}
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleCancel}>
              <X className="w-3 h-3 mr-1" />取消
            </Button>
          </div>
        </div>
      )}

      {/* List */}
      {templates.length === 0 && !showForm ? (
        <p className="text-xs text-gray-400 py-2">暂无外箱模板，点击「新增外箱」创建。</p>
      ) : (
        <div className="space-y-2">
          {templates.map(t => (
            <div key={t.id} className={`flex items-center gap-3 p-3 rounded-lg border ${t.is_active ? "border-gray-200 bg-white" : "border-gray-100 bg-gray-50 opacity-60"}`}>
              {t.image_url ? (
                <img src={t.image_url} alt={t.box_name} className="w-10 h-10 object-cover rounded border border-gray-200 flex-shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded border border-gray-200 bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <Package className="w-5 h-5 text-gray-300" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-800">{t.box_name}</span>
                  <span className="text-xs text-gray-500">¥{(t.price_jpy || 0).toLocaleString()} JPY</span>
                  <span className="text-xs text-gray-400">{(t.weight_g || 0)}g</span>
                  {!t.is_active && <Badge className="text-xs bg-gray-100 text-gray-400">已禁用</Badge>}
                </div>
                {t.description && <p className="text-xs text-gray-400 mt-0.5 truncate">{t.description}</p>}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => handleEdit(t)}>
                  <Edit2 className="w-3.5 h-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => handleToggle(t)}>
                  {t.is_active ? "禁用" : "启用"}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs px-2 text-red-400 hover:text-red-600" onClick={() => handleDelete(t.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}