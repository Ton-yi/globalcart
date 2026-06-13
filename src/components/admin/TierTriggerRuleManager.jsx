/**
 * TierTriggerRuleManager - 独立触发规则管理（角色阶级及角色权限标签触发条件系统）
 * 规则 = 条件 + 动作：满足条件后 变更用户阶级（可选）和/或 添加/移除角色权限标签（可多选）
 */
import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, Save, X, Zap, Crown, Tag } from "lucide-react";
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
  name: "",
  description: "",
  trigger_condition: { logic: "and", conditions: [] },
  target_tier_id: "",
  add_role_ids: [],
  remove_role_ids: [],
  sort_order: 0,
  is_active: true,
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

export default function TierTriggerRuleManager({ tiers = [], roles = [] }) {
  const [rules, setRules] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    tenantEntity.list('TierTriggerRule').then(list => setRules(list || [])).catch(() => {});
  }, []);

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const roleName = (id) => roles.find(r => r.id === id)?.name || id;
  const tierName = (id) => tiers.find(t => t.id === id)?.name || "";

  const handleNew = () => { setEditingId(null); setForm(EMPTY_FORM); setShowForm(true); };

  const handleEdit = (rule) => {
    setEditingId(rule.id);
    setForm({
      name: rule.name || "",
      description: rule.description || "",
      trigger_condition: (rule.trigger_condition && Array.isArray(rule.trigger_condition.conditions))
        ? rule.trigger_condition : { logic: "and", conditions: [] },
      target_tier_id: rule.target_tier_id || "",
      add_role_ids: rule.add_role_ids || [],
      remove_role_ids: rule.remove_role_ids || [],
      sort_order: rule.sort_order || 0,
      is_active: rule.is_active !== false,
    });
    setShowForm(true);
  };

  const reload = async () => {
    const updated = await tenantEntity.list('TierTriggerRule');
    setRules(updated || []);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const data = {
      ...form,
      sort_order: parseFloat(form.sort_order) || 0,
      target_tier_name: form.target_tier_id ? tierName(form.target_tier_id) : "",
      trigger_condition: {
        logic: form.trigger_condition?.logic || "and",
        conditions: (form.trigger_condition?.conditions || []).filter(c => c.field && c.operator && c.value !== ""),
      },
    };
    if (editingId) {
      await tenantEntity.update('TierTriggerRule', editingId, data);
    } else {
      await tenantEntity.create('TierTriggerRule', data);
    }
    setSaving(false);
    setShowForm(false);
    setEditingId(null);
    await reload();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('确认删除此触发规则？')) return;
    await tenantEntity.delete('TierTriggerRule', id);
    await reload();
  };

  const handleToggle = async (rule) => {
    await tenantEntity.update('TierTriggerRule', rule.id, { is_active: !rule.is_active });
    setRules(prev => prev.map(r => r.id === rule.id ? { ...r, is_active: !r.is_active } : r));
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
        <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={handleNew}>
          <Plus className="w-3.5 h-3.5 mr-1" />新增规则
        </Button>
      </div>

      {showForm && (
        <div className="border border-amber-200 rounded-xl p-4 bg-amber-50/30 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-800">{editingId ? "编辑触发规则" : "新增触发规则"}</h4>
            <button onClick={() => { setShowForm(false); setEditingId(null); }}>
              <X className="w-4 h-4 text-gray-400" />
            </button>
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
            <TierTriggerConditionEditor
              value={form.trigger_condition}
              onChange={v => f("trigger_condition", v)}
            />
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
            <Button variant="outline" size="sm" onClick={() => { setShowForm(false); setEditingId(null); }}>取消</Button>
            <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={handleSave} disabled={saving || !form.name.trim()}>
              <Save className="w-3.5 h-3.5 mr-1" />{saving ? "保存中..." : "保存"}
            </Button>
          </div>
        </div>
      )}

      {rules.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">暂无独立触发规则</p>
      ) : (
        <div className="space-y-2">
          {rules.slice().sort((a, b) => (b.sort_order || 0) - (a.sort_order || 0)).map(rule => (
            <div key={rule.id} className={`flex items-center gap-3 border rounded-xl p-3 bg-white ${!rule.is_active ? 'opacity-60' : ''}`}>
              <Zap className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-800">{rule.name}</span>
                  {rule.target_tier_id && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-purple-600 border-purple-200">
                      <Crown className="w-2.5 h-2.5 mr-0.5" />阶级 → {rule.target_tier_name || tierName(rule.target_tier_id)}
                    </Badge>
                  )}
                  {(rule.add_role_ids || []).map(id => (
                    <Badge key={id} variant="outline" className="text-[10px] px-1.5 py-0 text-green-600 border-green-200">
                      <Tag className="w-2.5 h-2.5 mr-0.5" />+{roleName(id)}
                    </Badge>
                  ))}
                  {(rule.remove_role_ids || []).map(id => (
                    <Badge key={id} variant="outline" className="text-[10px] px-1.5 py-0 text-red-500 border-red-200">
                      <Tag className="w-2.5 h-2.5 mr-0.5" />−{roleName(id)}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {(rule.trigger_condition?.conditions || []).length} 个条件
                  （{rule.trigger_condition?.logic === 'or' ? '任一满足' : '全部满足'}）
                  {rule.description ? ` · ${rule.description}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => handleToggle(rule)} className="p-1.5 rounded hover:bg-gray-100 text-xs text-gray-400 hover:text-gray-700">
                  {rule.is_active ? "停用" : "启用"}
                </button>
                <button onClick={() => handleEdit(rule)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDelete(rule.id)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}