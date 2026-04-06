/**
 * BoxTemplateManager
 * Admin can manage reusable box templates (外箱模板).
 * Each template: name, description, image, weight (g), price (JPY).
 */
import { useState } from "react";
import { tenantEntity } from "@/lib/tenantApi";
import { Plus, Trash2, Package, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";

const EMPTY = { name: "", description: "", image_url: "", weight_g: "", price_jpy: "" };

export default function BoxTemplateManager({ initialData = [], onReload }) {
  const [items, setItems] = useState(initialData);
  const [form, setForm] = useState(EMPTY);
  const [adding, setAdding] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleAdd = async () => {
    if (!form.name) return;
    setAdding(true);
    const created = await tenantEntity.create('BoxTemplate', {
      name: form.name,
      description: form.description,
      image_url: form.image_url,
      weight_g: parseFloat(form.weight_g) || 0,
      price_jpy: parseFloat(form.price_jpy) || 0,
      is_active: true,
    });
    setItems(prev => [...prev, created]);
    setForm(EMPTY);
    setAdding(false);
    onReload?.();
  };

  const handleDelete = async (id) => {
    await tenantEntity.delete('BoxTemplate', id);
    setItems(prev => prev.filter(i => i.id !== id));
    onReload?.();
  };

  const handleToggle = async (item) => {
    await tenantEntity.update('BoxTemplate', item.id, { is_active: !item.is_active });
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_active: !i.is_active } : i));
  };

  const handleUploadImage = async (file) => {
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(p => ({ ...p, image_url: file_url }));
    setUploading(false);
  };

  return (
    <div className="space-y-4">
      {/* Existing templates */}
      {items.length === 0 && (
        <p className="text-xs text-gray-400 py-2">暂无外箱模板，在下方添加</p>
      )}
      <div className="space-y-2">
        {items.map(item => (
          <div key={item.id}
            className={`flex items-center gap-3 p-3 rounded-lg border transition-opacity ${item.is_active ? "border-gray-200" : "border-gray-100 opacity-50"}`}>
            {item.image_url ? (
              <img src={item.image_url} alt={item.name} className="w-10 h-10 rounded-lg object-cover border border-gray-100 flex-shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                <Package className="w-5 h-5 text-gray-300" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-gray-800">{item.name}</span>
                {item.weight_g > 0 && (
                  <span className="text-xs text-gray-500">{item.weight_g}g</span>
                )}
                {item.price_jpy > 0 && (
                  <span className="text-xs text-orange-600">¥{item.price_jpy} JPY</span>
                )}
                {!item.is_active && (
                  <span className="text-xs bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded">已停用</span>
                )}
              </div>
              {item.description && (
                <p className="text-xs text-gray-400 mt-0.5 truncate">{item.description}</p>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleToggle(item)}>
                {item.is_active ? "停用" : "启用"}
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-red-400" onClick={() => handleDelete(item.id)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Add new */}
      <div className="border-t border-dashed border-gray-200 pt-4 space-y-3">
        <p className="text-xs font-medium text-gray-500">新增外箱模板</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-gray-400">外箱名称 *</Label>
            <Input className="mt-0.5 h-8 text-sm" placeholder="例：60サイズ" value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs text-gray-400">描述</Label>
            <Input className="mt-0.5 h-8 text-sm" placeholder="例：60×40×30cm" value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs text-gray-400">自重 (g)</Label>
            <Input type="number" className="mt-0.5 h-8 text-sm" placeholder="0" value={form.weight_g}
              onChange={e => setForm(p => ({ ...p, weight_g: e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs text-gray-400">价格 (JPY)</Label>
            <Input type="number" className="mt-0.5 h-8 text-sm" placeholder="0" value={form.price_jpy}
              onChange={e => setForm(p => ({ ...p, price_jpy: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <Label className="text-xs text-gray-400">图片</Label>
            <div className="mt-0.5 flex items-center gap-2">
              <label className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-gray-300 rounded-md text-xs text-gray-500 hover:border-gray-400 transition-colors">
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {uploading ? "上传中..." : "上传图片"}
                <input type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files[0]; if (f) handleUploadImage(f); }}
                  disabled={uploading} />
              </label>
              {form.image_url && (
                <img src={form.image_url} alt="" className="w-8 h-8 rounded object-cover border border-gray-100" />
              )}
            </div>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={handleAdd}
          disabled={adding || !form.name}>
          <Plus className="w-3.5 h-3.5 mr-1" />{adding ? "添加中..." : "添加"}
        </Button>
      </div>
    </div>
  );
}