/**
 * OnlineStoreTagManager - Master-detail two-column layout
 * Left: detail editor | Right: sortable list
 * Reference: TransitShippingMethodManager layout
 */
import { useState, useEffect } from "react";
import { tenantEntity } from "@/lib/tenantApi";
import { Plus, Trash2, X, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const COLOR_PRESETS = [
  { value: "bg-gray-100 text-gray-700", label: "灰色" },
  { value: "bg-blue-100 text-blue-700", label: "蓝色" },
  { value: "bg-red-100 text-red-700", label: "红色" },
  { value: "bg-green-100 text-green-700", label: "绿色" },
  { value: "bg-yellow-100 text-yellow-700", label: "黄色" },
  { value: "bg-purple-100 text-purple-700", label: "紫色" },
  { value: "bg-orange-100 text-orange-700", label: "橙色" },
  { value: "bg-pink-100 text-pink-700", label: "粉色" },
];

const BLANK_RULE = { keyword: "", tag_label: "", tag_color: "bg-gray-100 text-gray-700", priority: 0, is_active: true };

// ─── Left detail editor panel ─────────────────────────────────
function TagRuleDetailPanel({ selected, onSave, onCancel }) {
  const [form, setForm] = useState(selected ? { ...selected } : null);
  const [saving, setSaving] = useState(false);
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    if (selected) { setForm({ ...selected }); setIsNew(false); }
    else { setForm(null); setIsNew(false); }
  }, [selected?.id]);

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.keyword || !form.tag_label) return;
    setSaving(true);
    await onSave({ ...form, priority: parseInt(form.priority) || 0 }, isNew);
    setSaving(false);
  };

  const handleStartNew = () => { 
    setForm({ keyword: "", tag_label: "", tag_color: "bg-gray-100 text-gray-700", priority: 0, is_active: true }); 
    setIsNew(true); 
  };

  if (!form) {
    return (
      <div className="border border-dashed border-gray-200 rounded-xl p-6 text-center space-y-3 flex flex-col items-center justify-center min-h-[200px]">
        <p className="text-xs text-gray-400">点击右侧规则条目进行编辑</p>
        <Button size="sm" className="bg-blue-600 hover:bg-blue-700 h-7 text-xs" onClick={handleStartNew}>
          <Plus className="w-3 h-3 mr-1" />新增规则
        </Button>
      </div>
    );
  }

  return (
    <div className="border border-blue-200 rounded-xl p-4 space-y-3 bg-blue-50">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-700">{isNew ? "新增商城标签规则" : `编辑：${form.keyword}`}</p>
        <div className="flex items-center gap-2">
          {!isNew && (
            <Button size="sm" variant="outline" className="h-6 text-xs" onClick={handleStartNew}>
              <Plus className="w-3 h-3 mr-1" />新增
            </Button>
          )}
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      <div>
        <Label className="text-xs text-gray-500">关键词 *</Label>
        <Input 
          className="mt-1 h-9 text-sm font-mono" 
          value={form.keyword} 
          onChange={e => f("keyword", e.target.value)} 
          placeholder="如：www.suruga-ya.jp" 
        />
        <p className="text-xs text-gray-400 mt-1">商品 URL 中包含此关键词时匹配</p>
      </div>

      <div>
        <Label className="text-xs text-gray-500">标签名称 *</Label>
        <Input 
          className="mt-1 h-9 text-sm" 
          value={form.tag_label} 
          onChange={e => f("tag_label", e.target.value)} 
          placeholder="如：駿河屋" 
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-gray-500">优先级</Label>
          <Input 
            type="number" 
            className="mt-1 h-9 text-sm" 
            value={form.priority || 0} 
            onChange={e => f("priority", e.target.value)} 
          />
          <p className="text-xs text-gray-400 mt-1">数字越大优先级越高</p>
        </div>
        <div>
          <Label className="text-xs text-gray-500">状态</Label>
          <div className="mt-1.5">
            <Badge className={form.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}>
              {form.is_active ? "启用中" : "已禁用"}
            </Badge>
          </div>
        </div>
      </div>

      <div>
        <Label className="text-xs text-gray-500 block mb-2">显示颜色</Label>
        <div className="flex gap-1 flex-wrap">
          {COLOR_PRESETS.map(c => (
            <button
              key={c.value}
              onClick={() => f("tag_color", c.value)}
              className={`px-2 py-1 rounded text-xs border-2 transition-colors ${form.tag_color === c.value ? "border-blue-400 shadow-sm" : "border-transparent"}`}
            >
              <Badge className={`text-xs ${c.value}`}>{c.label}</Badge>
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-1">
        <Button variant="outline" size="sm" onClick={onCancel}>取消</Button>
        <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={handleSave} disabled={saving || !form.keyword || !form.tag_label}>
          {saving ? "保存中..." : "保存"}
        </Button>
      </div>
    </div>
  );
}

// ─── Right list/sort panel ────────────────────────────────────
function TagRuleListPanel({ rules, activeId, onSelect, onToggle, onDelete, onMoveUp, onMoveDown }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-gray-600">商城标签规则 &amp; 排序</p>
        <p className="text-xs text-gray-400">点击条目在左侧编辑</p>
      </div>
      {rules.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-6">暂无商城标签规则</p>
      )}
      {rules.map((r, idx) => (
        <div 
          key={r.id}
          className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
            activeId === r.id ? "border-blue-300 bg-blue-50" : "border-gray-200 bg-white hover:bg-gray-50"
          } ${!r.is_active ? "opacity-50" : ""}`}
          onClick={() => onSelect(r)}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <code className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono text-gray-700 truncate max-w-[120px]">{r.keyword}</code>
              <Badge className={`text-xs ${r.tag_color || "bg-gray-100 text-gray-700"}`}>{r.tag_label}</Badge>
              <span className="text-xs text-gray-400">优先级：{r.priority || 0}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
            <button className="p-1 rounded hover:bg-gray-100 text-gray-300 hover:text-gray-600 disabled:opacity-30" disabled={idx === 0} onClick={() => onMoveUp(idx)}>
              <ChevronUp className="w-3 h-3" />
            </button>
            <button className="p-1 rounded hover:bg-gray-100 text-gray-300 hover:text-gray-600 disabled:opacity-30" disabled={idx === rules.length - 1} onClick={() => onMoveDown(idx)}>
              <ChevronDown className="w-3 h-3" />
            </button>
            <button className="p-1 rounded hover:bg-gray-100 text-gray-300 hover:text-gray-600" onClick={() => onToggle(r)}>
              {r.is_active ? <span className="text-xs">✓</span> : <span className="text-xs">✕</span>}
            </button>
            <button className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500" onClick={() => onDelete(r.id)}>
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────
export default function OnlineStoreTagManager({ initialData = null }) {
  const [rules, setRules] = useState(initialData ? [...initialData].sort((a, b) => (b.priority || 0) - (a.priority || 0)) : []);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const data = await tenantEntity.list('OnlineStoreTagRule');
    setRules((data || []).sort((a, b) => (b.priority || 0) - (a.priority || 0)));
    setLoading(false);
  };

  useEffect(() => {
    if (initialData === null) load();
  }, []);

  const handleSave = async (updated, isNew) => {
    if (isNew) {
      const created = await tenantEntity.create('OnlineStoreTagRule', updated);
      setRules(prev => [...prev, created].sort((a, b) => (b.priority || 0) - (a.priority || 0)));
      setSelected(created);
    } else {
      await tenantEntity.update('OnlineStoreTagRule', updated.id, updated);
      setRules(prev => prev.map(r => r.id === updated.id ? { ...r, ...updated } : r).sort((a, b) => (b.priority || 0) - (a.priority || 0)));
      setSelected(prev => prev?.id === updated.id ? { ...prev, ...updated } : prev);
    }
  };

  const handleToggle = async (r) => {
    const updated = { ...r, is_active: !r.is_active };
    await tenantEntity.update('OnlineStoreTagRule', r.id, { is_active: updated.is_active });
    setRules(prev => prev.map(x => x.id === r.id ? updated : x).sort((a, b) => (b.priority || 0) - (a.priority || 0)));
    if (selected?.id === r.id) setSelected(updated);
  };

  const handleDelete = async (id) => {
    if (!confirm("确认删除此规则？")) return;
    await tenantEntity.delete('OnlineStoreTagRule', id);
    setRules(prev => prev.filter(r => r.id !== id));
    if (selected?.id === id) setSelected(null);
  };

  const handleMoveUp = async (idx) => {
    if (idx === 0) return;
    const r = rules[idx];
    await tenantEntity.update('OnlineStoreTagRule', r.id, { priority: (r.priority || 0) + 1 });
    await load();
  };

  const handleMoveDown = async (idx) => {
    if (idx >= rules.length - 1) return;
    const r = rules[idx];
    await tenantEntity.update('OnlineStoreTagRule', r.id, { priority: (r.priority || 0) - 1 });
    await load();
  };

  if (loading) return <div className="py-8 text-center text-gray-400 text-sm">加载中...</div>;

  return (
    <div className="flex flex-col xl:flex-row gap-5 items-start">
      {/* Left: detail editor */}
      <div className="flex-1 min-w-0">
        <TagRuleDetailPanel
          selected={selected}
          onSave={handleSave}
          onCancel={() => setSelected(null)}
        />
      </div>
      {/* Right: list & sort */}
      <div className="w-full xl:w-80 flex-shrink-0">
        <TagRuleListPanel
          rules={rules}
          activeId={selected?.id}
          onSelect={r => setSelected(r)}
          onToggle={handleToggle}
          onDelete={handleDelete}
          onMoveUp={handleMoveUp}
          onMoveDown={handleMoveDown}
        />
      </div>
    </div>
  );
}