/**
 * TierTriggerRuleManager - Master-detail two-column layout
 * Left: detail editor | Right: sortable rule list
 */
import { useState, useEffect } from "react";
import { Plus, Trash2, Save, X, Zap, Crown, Tag, Eye, EyeOff, ChevronUp, ChevronDown } from "lucide-react";
import { tenantEntity } from "@/lib/tenantApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import TierTriggerConditionEditor from "@/components/admin/TierTriggerConditionEditor";

const EMPTY_FORM = {
  name: "", description: "", trigger_condition: { logic: "and", conditions: [] },
  target_tier_id: "", add_role_ids: [], remove_role_ids: [], sort_order: 0, is_active: true,
};

function RoleMultiSelect({ label, roles, value, onChange }) {
  return (
    <div>
      <Label className="text-xs text-gray-500">{label}</Label>
      {roles.length === 0 ? (
        <p className="text-xs text-gray-400 mt-1">暂无可用角色标签</p>
      ) : (
        <div className="flex flex-wrap gap-2 mt-1.5">
          {roles.map(r => (
            <label key={r.id} className="flex items-center gap-1.5 text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white cursor-pointer hover:bg-gray-50">
              <Checkbox
                checked={(value || []).includes(r.id)}
                onCheckedChange={(v) => {
                  const cur = new Set(value || []);
                  if (v) cur.add(r.id); else cur.delete(r.id);
                  onChange([...cur]);
                }}
              />
              {r.name}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Left detail editor panel ─────────────────────────────────
function RuleDetailPanel({ selected, tiers, roles, onSave, onCancel }) {
  const [form, setForm] = useState(selected ? { ...EMPTY_FORM, ...selected } : null);
  const [saving, setSaving] = useState(false);
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    if (selected) {
      setForm({
        ...EMPTY_FORM,
        ...selected,
        trigger_condition: (selected.trigger_condition && Array.isArray(selected.trigger_condition.conditions))
          ? selected.trigger_condition : { logic: "and", conditions: [] },
      });
      setIsNew(false);
    } else {
      setForm(null);
      setIsNew(false);
    }
  }, [selected?.id]);

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const data = {
      ...form,
      sort_order: parseFloat(form.sort_order) || 0,
      target_tier_name: form.target_tier_id ? (tiers.find(t => t.id === form.target_tier_id)?.name || "") : "",
      trigger_condition: {
        logic: form.trigger_condition?.logic || "and",
        conditions: (form.trigger_condition?.conditions || []).filter(c => c.field && c.operator && c.value !== ""),
      },
    };
    await onSave(data, isNew, selected?.id);
    setSaving(false);
  };

  const handleStartNew = () => {
    setForm({ ...EMPTY_FORM });
    setIsNew(true);
  };

  const tierName = (id) => tiers.find(t => t.id === id)?.name || "";

  if (!form) {
    return (
      <div className="border border-dashed border-gray-200 rounded-xl p-6 text-center space-y-3 flex flex-col items-center justify-center min-h-[200px]">
        <p className="text-xs text-gray-400">点击右侧独立触发规则条目进行编辑</p>
        <Button size="sm" className="bg-red-600 hover:bg-red-700 h-7 text-xs" onClick={handleStartNew}>
          <Plus className="w-3 h-3 mr-1" />新增规则
        </Button>
      </div>
    );
  }

  return (
    <div className="border border-amber-200 rounded-xl p-4 bg-amber-50/30 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-800">{isNew ? "新增触发规则" : `编辑：${form.name}`}</h4>
        <div className="flex items-center gap-2">
          {!isNew && (
            <Button size="sm" variant="outline" className="h-6 text-xs" onClick={handleStartNew}>
              <Plus className="w-3 h-3 mr-1" />新增
            </Button>
          )}
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-gray-500">规则名称 *</Label>
          <Input className="mt-1 h-8 text-sm" placeholder="如：高消费用户自动升级" value={form.name} onChange={e => f("name", e.target.value)} />
        </div>
        <div>
          <Label className="text-xs text-gray-500">排序</Label>
          <Input type="number" className="mt-1 h-8 text-sm" value={form.sort_order} onChange={e => f("sort_order", e.target.value)} />
        </div>
      </div>

      <div>
        <Label className="text-xs text-gray-500">规则说明（可选）</Label>
        <Textarea className="mt-1 text-sm h-14" value={form.description} onChange={e => f("description", e.target.value)} />
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-3">
        <p className="text-xs font-medium text-gray-600 mb-2">触发条件</p>
        <TierTriggerConditionEditor value={form.trigger_condition} onChange={v => f("trigger_condition", v)} />
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-3">
        <p className="text-xs font-medium text-gray-600">满足条件后执行</p>
        <div>
          <Label className="text-xs text-gray-500 flex items-center gap-1"><Crown className="w-3 h-3" />变更用户阶级（可选）</Label>
          <Select value={form.target_tier_id || "none"} onValueChange={v => f("target_tier_id", v === "none" ? "" : v)}>
            <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">不变更阶级（仅操作角色标签）</SelectItem>
              {tiers.filter(t => t.is_active !== false).map(t => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <RoleMultiSelect label="添加角色权限标签（可多选）" roles={roles} value={form.add_role_ids} onChange={v => f("add_role_ids", v)} />
        <RoleMultiSelect label="移除角色权限标签（可多选）" roles={roles} value={form.remove_role_ids} onChange={v => f("remove_role_ids", v)} />
      </div>

      <div className="flex items-center justify-between py-1">
        <Label className="text-sm">启用此规则</Label>
        <Switch checked={form.is_active} onCheckedChange={v => f("is_active", v)} />
      </div>

      <div className="flex gap-2 justify-end pt-1">
        <Button variant="outline" size="sm" onClick={onCancel}>取消</Button>
        <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={handleSave} disabled={saving || !form.name.trim()}>
          <Save className="w-3.5 h-3.5 mr-1" />{saving ? "保存中..." : "保存"}
        </Button>
      </div>
    </div>
  );
}

// ─── Right list/sort panel ────────────────────────────────────
function RuleListPanel({ rules, tiers, roles, activeId, onSelect, onToggle, onDelete, onMoveUp, onMoveDown }) {
  const sorted = [...rules].sort((a, b) => (b.sort_order || 0) - (a.sort_order || 0));
  const tierName = (id) => tiers.find(t => t.id === id)?.name || "";
  const roleName = (id) => roles.find(r => r.id === id)?.name || id;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-gray-600">独立触发规则 &amp; 排序</p>
        <p className="text-xs text-gray-400">点击条目在左侧编辑</p>
      </div>
      {sorted.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-6">暂无独立触发规则</p>
      )}
      {sorted.map((rule, idx) => (
        <div key={rule.id}
          className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
            activeId === rule.id ? "border-amber-300 bg-amber-50" : "border-gray-200 bg-white hover:bg-gray-50"
          } ${!rule.is_active ? "opacity-50" : ""}`}
          onClick={() => onSelect(rule)}
        >
          <Zap className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-medium text-gray-800">{rule.name}</span>
              {rule.target_tier_id && (
                <Badge variant="outline" className="text-[10px] px-1 py-0 text-purple-600 border-purple-200">
                  <Crown className="w-2.5 h-2.5 mr-0.5" />→{tierName(rule.target_tier_id)}
                </Badge>
              )}
              {(rule.add_role_ids || []).slice(0, 2).map(id => (
                <Badge key={id} variant="outline" className="text-[10px] px-1 py-0 text-green-600 border-green-200">
                  <Tag className="w-2.5 h-2.5 mr-0.5" />+{roleName(id)}
                </Badge>
              ))}
              {(rule.remove_role_ids || []).slice(0, 2).map(id => (
                <Badge key={id} variant="outline" className="text-[10px] px-1 py-0 text-red-500 border-red-200">
                  <Tag className="w-2.5 h-2.5 mr-0.5" />−{roleName(id)}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">
              {(rule.trigger_condition?.conditions || []).length} 个条件 · {rule.description || ""}
            </p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
            <button className="p-1 rounded hover:bg-gray-100 text-gray-300 hover:text-gray-600 disabled:opacity-30" disabled={idx === 0} onClick={() => onMoveUp(idx)}>
              <ChevronUp className="w-3 h-3" />
            </button>
            <button className="p-1 rounded hover:bg-gray-100 text-gray-300 hover:text-gray-600 disabled:opacity-30" disabled={idx === sorted.length - 1} onClick={() => onMoveDown(idx)}>
              <ChevronDown className="w-3 h-3" />
            </button>
            <button className="p-1 rounded hover:bg-gray-100 text-gray-300 hover:text-gray-600" onClick={() => onToggle(rule)}>
              {rule.is_active ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            </button>
            <button className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500" onClick={() => onDelete(rule.id)}>
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────
export default function TierTriggerRuleManager({ tiers = [], roles = [] }) {
  const [rules, setRules] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    tenantEntity.list('TierTriggerRule').then(list => setRules(list || [])).catch(() => {});
  }, []);

  const reload = async () => {
    const updated = await tenantEntity.list('TierTriggerRule');
    setRules(updated || []);
  };

  const handleSave = async (data, isNew, editingId) => {
    if (isNew) {
      const created = await tenantEntity.create('TierTriggerRule', data);
      await reload();
      setSelected(created);
    } else {
      await tenantEntity.update('TierTriggerRule', editingId, data);
      await reload();
      setSelected(prev => prev ? { ...prev, ...data } : null);
    }
  };

  const handleToggle = async (rule) => {
    await tenantEntity.update('TierTriggerRule', rule.id, { is_active: !rule.is_active });
    setRules(prev => prev.map(r => r.id === rule.id ? { ...r, is_active: !r.is_active } : r));
    if (selected?.id === rule.id) setSelected(prev => ({ ...prev, is_active: !prev.is_active }));
  };

  const handleDelete = async (id) => {
    if (!window.confirm('确认删除此触发规则？')) return;
    await tenantEntity.delete('TierTriggerRule', id);
    setRules(prev => prev.filter(r => r.id !== id));
    if (selected?.id === id) setSelected(null);
  };

  const handleMoveUp = (idx) => {
    const sorted = [...rules].sort((a, b) => (b.sort_order || 0) - (a.sort_order || 0));
    if (idx === 0) return;
    const a = sorted[idx], b = sorted[idx - 1];
    const aOrder = a.sort_order || 0, bOrder = b.sort_order || 0;
    setRules(prev => prev.map(r => {
      if (r.id === a.id) return { ...r, sort_order: bOrder === aOrder ? aOrder + 1 : bOrder };
      if (r.id === b.id) return { ...r, sort_order: aOrder };
      return r;
    }));
    tenantEntity.update('TierTriggerRule', a.id, { sort_order: bOrder === aOrder ? aOrder + 1 : bOrder });
    tenantEntity.update('TierTriggerRule', b.id, { sort_order: aOrder });
  };

  const handleMoveDown = (idx) => {
    const sorted = [...rules].sort((a, b) => (b.sort_order || 0) - (a.sort_order || 0));
    if (idx >= sorted.length - 1) return;
    const a = sorted[idx], b = sorted[idx + 1];
    const aOrder = a.sort_order || 0, bOrder = b.sort_order || 0;
    setRules(prev => prev.map(r => {
      if (r.id === a.id) return { ...r, sort_order: bOrder };
      if (r.id === b.id) return { ...r, sort_order: aOrder === bOrder ? bOrder - 1 : aOrder };
      return r;
    }));
    tenantEntity.update('TierTriggerRule', a.id, { sort_order: bOrder });
    tenantEntity.update('TierTriggerRule', b.id, { sort_order: aOrder === bOrder ? bOrder - 1 : aOrder });
  };

  return (
    <div className="space-y-3 pt-4 border-t border-gray-200">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-amber-500" />独立触发规则
          </h4>
          <p className="text-xs text-gray-500 mt-0.5">
            满足条件后自动变更用户阶级，或添加/移除角色权限标签（可只设角色标签，不设阶级）。
          </p>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-5 items-start">
        {/* Left: detail editor */}
        <div className="flex-1 min-w-0">
          <RuleDetailPanel
            selected={selected}
            tiers={tiers}
            roles={roles}
            onSave={handleSave}
            onCancel={() => setSelected(null)}
          />
        </div>
        {/* Right: list & sort */}
        <div className="w-full xl:w-72 flex-shrink-0">
          <RuleListPanel
            rules={rules}
            tiers={tiers}
            roles={roles}
            activeId={selected?.id}
            onSelect={r => setSelected(r)}
            onToggle={handleToggle}
            onDelete={handleDelete}
            onMoveUp={handleMoveUp}
            onMoveDown={handleMoveDown}
          />
        </div>
      </div>
    </div>
  );
}