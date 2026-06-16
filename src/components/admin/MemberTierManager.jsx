/**
 * MemberTierManager - Master-detail two-column layout
 * Left: detail editor | Right: sortable tier list
 */
import { useState, useEffect } from "react";
import { Plus, Trash2, Save, X, CreditCard, Crown, Star, Gem, Award, Medal, Trophy, Sparkles, Shield, Zap, Lock, Eye, EyeOff, ChevronUp, ChevronDown } from "lucide-react";
import { tenantEntity } from "@/lib/tenantApi";
import { useLocale } from "@/lib/LocaleContext";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import MemberStatsScanCard from "@/components/admin/MemberStatsScanCard";
import TierEvaluateCard from "@/components/admin/TierEvaluateCard";
import TierTriggerConditionEditor from "@/components/admin/TierTriggerConditionEditor";
import TierTriggerRuleManager from "@/components/admin/TierTriggerRuleManager";

const CYCLE_LABELS = { weekly: "周结", monthly: "月结" };
const TIER_ICONS = { Crown, Star, Gem, Award, Medal, Trophy, Sparkles, Shield, Zap };
const ICON_OPTIONS = [
  { value: "none", label: "无图标" },
  ...Object.keys(TIER_ICONS).map(k => ({ value: k, label: k })),
];
const COLOR_OPTIONS = [
  { value: "bg-blue-100 text-blue-700", label: "蓝色" },
  { value: "bg-green-100 text-green-700", label: "绿色" },
  { value: "bg-purple-100 text-purple-700", label: "紫色" },
  { value: "bg-orange-100 text-orange-700", label: "橙色" },
  { value: "bg-red-100 text-red-700", label: "红色" },
  { value: "bg-yellow-100 text-yellow-700", label: "黄色" },
  { value: "bg-teal-100 text-teal-700", label: "青色" },
  { value: "bg-gray-100 text-gray-700", label: "灰色" },
  { value: "bg-pink-100 text-pink-700", label: "粉色" },
];

const EMPTY_FORM = {
  name: "", color: "bg-blue-100 text-blue-700", icon: "", name_font_color: "",
  description: "", sort_order: 0, price_jpy: 0, purchasable: false, is_permanent: false,
  associated_role_ids: [], trigger_enabled: false, trigger_condition: { logic: "and", conditions: [] },
  credit_enabled: false, default_credit_limit_jpy: 0, credit_cycle: "monthly",
  credit_overdue_limit_days: 7, is_active: true,
};

// ─── Left detail editor panel ─────────────────────────────────
function TierDetailPanel({ selected, onSave, onCancel, roles, locale }) {
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
      price_jpy: parseFloat(form.price_jpy) || 0,
      default_credit_limit_jpy: parseFloat(form.default_credit_limit_jpy) || 0,
      credit_overdue_limit_days: parseInt(form.credit_overdue_limit_days) || 7,
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

  if (!form) {
    return (
      <div className="border border-dashed border-gray-200 rounded-xl p-6 text-center space-y-3 flex flex-col items-center justify-center min-h-[200px]">
        <p className="text-xs text-gray-400">{t("点击右侧会员阶级条目进行编辑", locale)}</p>
        <Button size="sm" className="bg-red-600 hover:bg-red-700 h-7 text-xs" onClick={handleStartNew}>
          <Plus className="w-3 h-3 mr-1" />{t("新增会员阶级", locale)}
        </Button>
      </div>
    );
  }

  return (
    <div className="border border-blue-200 rounded-xl p-4 bg-blue-50/30 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-800">{isNew ? t("新增会员阶级", locale) : `${t("编辑", locale)}: ${form.name}`}</h4>
        <div className="flex items-center gap-2">
          {!isNew && (
            <Button size="sm" variant="outline" className="h-6 text-xs" onClick={handleStartNew}>
              <Plus className="w-3 h-3 mr-1" />{t("新增", locale)}
            </Button>
          )}
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-gray-500">{t("阶级名称", locale)} *</Label>
          <Input className="mt-1 h-8 text-sm" placeholder={t("如：周结会员", locale)} value={form.name} onChange={e => f("name", e.target.value)} />
        </div>
        <div>
          <Label className="text-xs text-gray-500">{t("显示颜色", locale)}</Label>
          <Select value={form.color} onValueChange={v => f("color", v)}>
            <SelectTrigger className="mt-1 h-8 text-sm">
              <SelectValue>
                <Badge className={`text-xs ${form.color}`}>{form.name || "预览"}</Badge>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {COLOR_OPTIONS.map(c => (
                <SelectItem key={c.value} value={c.value}>
                  <Badge className={`text-xs ${c.value}`}>{c.label}</Badge>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <Label className="text-xs text-gray-500">阶级图标</Label>
          <Select value={form.icon || "none"} onValueChange={v => f("icon", v === "none" ? "" : v)}>
            <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ICON_OPTIONS.map(o => {
                const Ic = TIER_ICONS[o.value];
                return (
                  <SelectItem key={o.value} value={o.value}>
                    <span className="flex items-center gap-1.5">
                      {Ic ? <Ic className="w-3.5 h-3.5" /> : null}{o.label}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-gray-500">用户名字体颜色</Label>
          <div className="flex items-center gap-1.5 mt-1">
            <input type="color" className="h-8 w-12 rounded border border-gray-200 cursor-pointer p-0.5"
              value={form.name_font_color || "#000000"} onChange={e => f("name_font_color", e.target.value)} />
            {form.name_font_color && (
              <button className="text-xs text-gray-400 hover:text-gray-600" onClick={() => f("name_font_color", "")}>清除</button>
            )}
          </div>
        </div>
        <div>
          <Label className="text-xs text-gray-500">排序（越大越高）</Label>
          <Input type="number" className="mt-1 h-8 text-sm" value={form.sort_order} onChange={e => f("sort_order", e.target.value)} />
        </div>
        <div>
          <Label className="text-xs text-gray-500">阶级价格（JPY）</Label>
          <Input type="number" className="mt-1 h-8 text-sm" value={form.price_jpy} onChange={e => f("price_jpy", e.target.value)} />
        </div>
      </div>

      <div>
        <Label className="text-xs text-gray-500">阶级说明（展示给用户）</Label>
        <Textarea className="mt-1 text-sm h-16" placeholder="如：累计消费满 10 万日元自动升级，享 8% 服务费率"
          value={form.description} onChange={e => f("description", e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center justify-between border border-gray-200 rounded-lg p-2.5 bg-white">
          <div>
            <Label className="text-sm">允许付费购买</Label>
            <p className="text-xs text-gray-400 mt-0.5">用户可付差价升级到此阶级</p>
          </div>
          <Switch checked={form.purchasable} onCheckedChange={v => f("purchasable", v)} />
        </div>
        <div className="flex items-center justify-between border border-gray-200 rounded-lg p-2.5 bg-white">
          <div>
            <Label className="text-sm flex items-center gap-1"><Lock className="w-3 h-3" />不再降级</Label>
            <p className="text-xs text-gray-400 mt-0.5">达到此阶级后永久保留</p>
          </div>
          <Switch checked={form.is_permanent} onCheckedChange={v => f("is_permanent", v)} />
        </div>
      </div>

      {roles.length > 0 && (
        <div>
          <Label className="text-xs text-gray-500">关联角色标签（进入此阶级时自动同步）</Label>
          <div className="flex flex-wrap gap-2 mt-1.5">
            {roles.map(r => (
              <label key={r.id} className="flex items-center gap-1.5 text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white cursor-pointer hover:bg-gray-50">
                <Checkbox
                  checked={(form.associated_role_ids || []).includes(r.id)}
                  onCheckedChange={(v) => {
                    const cur = new Set(form.associated_role_ids || []);
                    if (v) cur.add(r.id); else cur.delete(r.id);
                    f("associated_role_ids", [...cur]);
                  }}
                />
                {r.name}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between py-2 border-t border-gray-200">
        <div>
          <Label className="text-sm">自动触发升级</Label>
          <p className="text-xs text-gray-400 mt-0.5">用户统计满足条件后自动升入此阶级</p>
        </div>
        <Switch checked={form.trigger_enabled} onCheckedChange={v => f("trigger_enabled", v)} />
      </div>

      {form.trigger_enabled && (
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <p className="text-xs font-medium text-gray-600 mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />触发条件
          </p>
          <TierTriggerConditionEditor value={form.trigger_condition} onChange={v => f("trigger_condition", v)} />
        </div>
      )}

      <div className="flex items-center justify-between py-2 border-t border-gray-200">
        <div>
          <Label className="text-sm">开启记账功能</Label>
          <p className="text-xs text-gray-400 mt-0.5">开启后此阶级用户可申请使用记账付款</p>
        </div>
        <Switch checked={form.credit_enabled} onCheckedChange={v => f("credit_enabled", v)} />
      </div>

      {form.credit_enabled && (
        <div className="space-y-3 bg-white border border-gray-200 rounded-lg p-3">
          <p className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5" />记账规则
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-500">默认欠款上限（JPY）</Label>
              <Input type="number" className="mt-1 h-8 text-sm" placeholder="0" value={form.default_credit_limit_jpy} onChange={e => f("default_credit_limit_jpy", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-gray-500">结帐周期</Label>
              <Select value={form.credit_cycle} onValueChange={v => f("credit_cycle", v)}>
                <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">周结（每周一结算）</SelectItem>
                  <SelectItem value="monthly">月结（每月1日结算）</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-gray-500">逾期宽限天数</Label>
              <Input type="number" className="mt-1 h-8 text-sm" placeholder="7" value={form.credit_overdue_limit_days} onChange={e => f("credit_overdue_limit_days", e.target.value)} />
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between py-1">
        <Label className="text-sm">启用此阶级</Label>
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
function TierListPanel({ tiers, activeId, onSelect, onToggle, onDelete, onMoveUp, onMoveDown }) {
  const sorted = [...tiers].sort((a, b) => (b.sort_order || 0) - (a.sort_order || 0));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-gray-600">会员阶级 &amp; 排序</p>
        <p className="text-xs text-gray-400">点击条目在左侧编辑</p>
      </div>
      {sorted.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-6">暂无会员阶级</p>
      )}
      {sorted.map((tier, idx) => {
        const Ic = TIER_ICONS[tier.icon];
        return (
          <div key={tier.id}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
              activeId === tier.id ? "border-blue-300 bg-blue-50" : "border-gray-200 bg-white hover:bg-gray-50"
            } ${!tier.is_active ? "opacity-50" : ""}`}
            onClick={() => onSelect(tier)}
          >
            <Badge className={`text-xs flex-shrink-0 ${tier.color || "bg-gray-100 text-gray-700"}`}>
              {Ic ? <Ic className="w-3 h-3 mr-1" /> : null}
              <span style={tier.name_font_color ? { color: tier.name_font_color } : undefined}>{tier.name}</span>
            </Badge>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-gray-400">排序 {tier.sort_order || 0}</span>
                {tier.trigger_enabled && <Badge variant="outline" className="text-[10px] px-1 py-0 text-amber-600 border-amber-200">自动触发</Badge>}
                {tier.is_permanent && <Badge variant="outline" className="text-[10px] px-1 py-0 text-purple-600 border-purple-200"><Lock className="w-2.5 h-2.5 mr-0.5" />永久</Badge>}
                {tier.credit_enabled && <Badge variant="outline" className="text-[10px] px-1 py-0 text-green-600 border-green-200"><CreditCard className="w-2.5 h-2.5 mr-0.5" />{CYCLE_LABELS[tier.credit_cycle]}</Badge>}
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
              <button className="p-1 rounded hover:bg-gray-100 text-gray-300 hover:text-gray-600 disabled:opacity-30" disabled={idx === 0} onClick={() => onMoveUp(idx)}>
                <ChevronUp className="w-3 h-3" />
              </button>
              <button className="p-1 rounded hover:bg-gray-100 text-gray-300 hover:text-gray-600 disabled:opacity-30" disabled={idx === sorted.length - 1} onClick={() => onMoveDown(idx)}>
                <ChevronDown className="w-3 h-3" />
              </button>
              <button className="p-1 rounded hover:bg-gray-100 text-gray-300 hover:text-gray-600" onClick={() => onToggle(tier)}>
                {tier.is_active ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              </button>
              <button className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500" onClick={() => onDelete(tier.id)}>
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────
export default function MemberTierManager({ initialData = [], onReload }) {
  const { locale } = useLocale();
  const [tiers, setTiers] = useState(initialData);
  const [selected, setSelected] = useState(null);
  const [roles, setRoles] = useState([]);

  useEffect(() => {
    tenantEntity.list('Role').then(list => setRoles((list || []).filter(r => !r.is_archived))).catch(() => {});
  }, []);

  const reload = async () => {
    const updated = await tenantEntity.list('MemberTier');
    setTiers(updated);
    onReload?.();
  };

  const handleSave = async (data, isNew, editingId) => {
    if (isNew) {
      const created = await tenantEntity.create('MemberTier', data);
      await reload();
      setSelected(created);
    } else {
      await tenantEntity.update('MemberTier', editingId, data);
      await reload();
      setSelected(prev => prev ? { ...prev, ...data } : null);
    }
  };

  const handleToggle = async (tier) => {
    await tenantEntity.update('MemberTier', tier.id, { is_active: !tier.is_active });
    setTiers(prev => prev.map(t => t.id === tier.id ? { ...t, is_active: !t.is_active } : t));
    if (selected?.id === tier.id) setSelected(prev => ({ ...prev, is_active: !prev.is_active }));
  };

  const handleDelete = async (id) => {
    if (!window.confirm('确认删除此会员阶级？已分配该阶级的用户不受影响。')) return;
    await tenantEntity.delete('MemberTier', id);
    setTiers(prev => prev.filter(t => t.id !== id));
    if (selected?.id === id) setSelected(null);
  };

  const handleMoveUp = (idx) => {
    const sorted = [...tiers].sort((a, b) => (b.sort_order || 0) - (a.sort_order || 0));
    if (idx === 0) return;
    // swap sort_order values
    const a = sorted[idx], b = sorted[idx - 1];
    const aOrder = a.sort_order || 0, bOrder = b.sort_order || 0;
    setTiers(prev => prev.map(t => {
      if (t.id === a.id) return { ...t, sort_order: bOrder === aOrder ? aOrder + 1 : bOrder };
      if (t.id === b.id) return { ...t, sort_order: aOrder };
      return t;
    }));
    tenantEntity.update('MemberTier', a.id, { sort_order: bOrder === aOrder ? aOrder + 1 : bOrder });
    tenantEntity.update('MemberTier', b.id, { sort_order: aOrder });
  };

  const handleMoveDown = (idx) => {
    const sorted = [...tiers].sort((a, b) => (b.sort_order || 0) - (a.sort_order || 0));
    if (idx >= sorted.length - 1) return;
    const a = sorted[idx], b = sorted[idx + 1];
    const aOrder = a.sort_order || 0, bOrder = b.sort_order || 0;
    setTiers(prev => prev.map(t => {
      if (t.id === a.id) return { ...t, sort_order: bOrder };
      if (t.id === b.id) return { ...t, sort_order: aOrder === bOrder ? bOrder - 1 : aOrder };
      return t;
    }));
    tenantEntity.update('MemberTier', a.id, { sort_order: bOrder });
    tenantEntity.update('MemberTier', b.id, { sort_order: aOrder === bOrder ? bOrder - 1 : aOrder });
  };

  return (
    <div className="space-y-4">
      <MemberStatsScanCard />
      <TierEvaluateCard onChanged={onReload} />

      <div className="flex flex-col xl:flex-row gap-5 items-start">
        {/* Left: detail editor */}
        <div className="flex-1 min-w-0">
          <TierDetailPanel
            selected={selected}
            onSave={handleSave}
            onCancel={() => setSelected(null)}
            roles={roles}
            locale={locale}
          />
        </div>
        {/* Right: list & sort */}
        <div className="w-full xl:w-72 flex-shrink-0">
          <TierListPanel
            tiers={tiers}
            activeId={selected?.id}
            onSelect={t => setSelected(t)}
            onToggle={handleToggle}
            onDelete={handleDelete}
            onMoveUp={handleMoveUp}
            onMoveDown={handleMoveDown}
          />
        </div>
      </div>

      <TierTriggerRuleManager tiers={tiers} roles={roles} />
    </div>
  );
}