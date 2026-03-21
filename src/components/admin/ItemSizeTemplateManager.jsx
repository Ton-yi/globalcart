import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const CURRENCIES = ["JPY", "CNY", "USD", "TWD", "HKD", "EUR", "SGD"];

export default function ItemSizeTemplateManager() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    extra_fee: 0,
    fee_currency: "JPY",
    is_active: true,
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.ItemSizeTemplate.list("-created_date", 100);
      setTemplates(data || []);
    } catch (err) {
      console.error("Failed to load templates:", err);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!formData.title.trim()) return;
    setSaving(true);

    try {
      if (editingId) {
        await base44.entities.ItemSizeTemplate.update(editingId, formData);
      } else {
        await base44.entities.ItemSizeTemplate.create(formData);
      }
      await loadTemplates();
      setShowForm(false);
      resetForm();
    } catch (err) {
      console.error("Failed to save template:", err);
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    try {
      await base44.entities.ItemSizeTemplate.delete(id);
      await loadTemplates();
      setDeleting(null);
    } catch (err) {
      console.error("Failed to delete template:", err);
    }
  };

  const handleEdit = (template) => {
    setFormData(template);
    setEditingId(template.id);
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      extra_fee: 0,
      fee_currency: "JPY",
      is_active: true,
    });
    setEditingId(null);
  };

  const handleCancel = () => {
    setShowForm(false);
    resetForm();
  };

  if (loading) {
    return <div className="text-sm text-gray-500">加载中...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900">物品尺寸模板</h3>
        <Button size="sm" className="h-8 text-xs" onClick={() => setShowForm(true)}>
          <Plus className="w-3.5 h-3.5 mr-1" />
          新增模板
        </Button>
      </div>

      {showForm && (
        <div className="border border-blue-100 rounded-lg bg-blue-50 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-600">模板名称 *</Label>
              <Input
                className="mt-1 h-8 text-sm"
                placeholder="如: Small, Medium, Large"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs text-gray-600">额外费用</Label>
              <Input
                className="mt-1 h-8 text-sm"
                type="number"
                placeholder="0"
                value={formData.extra_fee}
                onChange={(e) => setFormData({ ...formData, extra_fee: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div>
            <Label className="text-xs text-gray-600">描述</Label>
            <Textarea
              className="mt-1 text-sm"
              rows={2}
              placeholder="如: 适合小型物品，特殊包装处理"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-600">货币</Label>
              <Select value={formData.fee_currency} onValueChange={(v) => setFormData({ ...formData, fee_currency: v })}>
                <SelectTrigger className="mt-1 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded"
                />
                <span className="text-xs text-gray-600">启用</span>
              </label>
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleCancel}>
              取消
            </Button>
            <Button size="sm" className="h-8 text-xs bg-blue-600 hover:bg-blue-700" onClick={handleSave} disabled={saving}>
              {saving ? "保存中..." : "保存"}
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {templates.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">暂无模板，点击"新增模板"创建</p>
        ) : (
          templates.map((template) => (
            <div key={template.id} className="border border-gray-200 rounded-lg p-3 flex items-start justify-between hover:bg-gray-50 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-medium text-gray-900">{template.title}</h4>
                  {!template.is_active && <Badge className="text-xs bg-gray-100 text-gray-600">已禁用</Badge>}
                </div>
                {template.description && <p className="text-xs text-gray-500 mt-1">{template.description}</p>}
                <p className="text-xs text-gray-600 mt-1.5 font-mono">
                  额外费用: {template.fee_currency} {template.extra_fee}
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                <button
                  onClick={() => handleEdit(template)}
                  className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
                  title="编辑">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setDeleting(template.id)}
                  className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-600 transition-colors"
                  title="删除">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {deleting && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-sm p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">删除模板？</h3>
            <p className="text-sm text-gray-600">此操作不可撤销。</p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setDeleting(null)}>
                取消
              </Button>
              <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={() => handleDelete(deleting)}>
                删除
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}