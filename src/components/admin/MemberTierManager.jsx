/**
 * MemberTierManager - Admin component to manage member tiers
 * Placed in AdminSettings under a "会员阶级" tab
 */
import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, Save, X, CreditCard, Crown, Star, Gem, Award, Medal, Trophy, Sparkles, Shield, Zap, Lock } from "lucide-react";
import { tenantEntity } from "@/lib/tenantApi";
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
  name: "",
  color: "bg-blue-100 text-blue-700",
  icon: "",
  name_font_color: "",
  description: "",
  sort_order: 0,
  price_jpy: 0,
  purchasable: false,
  is_permanent: false,
  associated_role_ids: [],
  trigger_enabled: false,
  trigger_condition: { logic: "and", conditions: [] },
  credit_enabled: false,
  default_credit_limit_jpy: 0,
  credit_cycle: "monthly",
  credit_overdue_limit_days: 7,
  is_active: true,
};

export default function MemberTierManager({ initialData = [], onReload }) {
  const [tiers, setTiers] = useState(initialData);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [roles, setRoles] = useState([]);

  useEffect(() => {
    tenantEntity.list('Role').then(list => setRoles((list || []).filter(r => !r.is_archived))).catch(() => {});
  }, []);

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleEdit = (tier) => {
    setEditingId(tier.id);
    setForm({
      name: tier.name || "",
      color: tier.color || "bg-blue-100 text-blue-700",
      icon: tier.icon || "",
      name_font_color: tier.name_font_color || "",
      description: tier.description || "",
      sort_order: tier.sort_order || 0,
      price_jpy: tier.price_jpy || 0,
      purchasable: tier.purchasable || false,
      is_permanent: tier.is_permanent || false,
      associated_role_ids: tier.associated_role_ids || [],
      trigger_enabled: tier.trigger_enabled || false,
      trigger_condition: (tier.trigger_condition && Array.isArray(tier.trigger_condition.conditions))
        ? tier.trigger_condition : { logic: "and", conditions: [] },
      credit_enabled: tier.credit_enabled || false,
      default_credit_limit_jpy: tier.default_credit_limit_jpy || 0,
      credit_cycle: tier.credit_cycle || "monthly",
      credit_overdue_limit_days: tier.credit_overdue_limit_days || 7,
      is_active: tier.is_active !== false,
    });
    setShowForm(true);
  };

  const handleNew = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

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
    if (editingId) {
      await tenantEntity.update('MemberTier', editingId, data);
    } else {
      await tenantEntity.create('MemberTier', data);
    }
    setSaving(false);
    setShowForm(false);
    setEditingId(null);
    onReload?.();
    // Reload local tiers
    const updated = await tenantEntity.list('MemberTier');
    setTiers(updated);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('确认删除此会员阶级？已分配该阶级的用户不受影响。')) return;
    await tenantEntity.delete('MemberTier', id);
    const updated = await tenantEntity.list('MemberTier');
    setTiers(updated);
  };

  const handleToggle = async (tier) => {
    await tenantEntity.update('MemberTier', tier.id, { is_active: !tier.is_active });
    setTiers(prev => prev.map(t => t.id === tier.id ? { ...t, is_active: !t.is_active } : t));
  };

  return (
    <div className="space-y-4">
      <MemberStatsScanCard />
      <TierEvaluateCard onChanged={onReload} />
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">定义会员阶级，可为每个阶级配置记账功能和结帐规则。</p>
        </div>
        <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={handleNew}>
          <Plus className="w-3.5 h-3.5 mr-1" />新增阶级
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="border border-blue-200 rounded-xl p-4 bg-blue-50/30 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-800">{editingId ? "编辑会员阶级" : "新增会员阶级"}</h4>
            <button onClick={() => { setShowForm(false); setEditingId(null); }}>
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-500">阶级名称 *</Label>
              <Input className="mt-1 h-8 text-sm" placeholder="如：周结会员" value={form.name} onChange={e => f("name", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-gray-500">显示颜色</Label>
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
              <Label className="text-xs text-gray-500">排序（越大等级越高）</Label>
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
                <p className="text-xs text-gray-400 mt-0.5">达到此阶级后永久保留，不会被自动降级</p>
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
              <TierTriggerConditionEditor
                value={form.trigger_condition}
                onChange={v => f("trigger_condition", v)}
              />
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
                  <p className="text-xs text-gray-400 mt-0.5">超过此天数视为逾期</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between py-1">
            <Label className="text-sm">启用此阶级</Label>
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

      {/* Tier list */}
      {tiers.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-6">暂无会员阶级，点击"新增阶级"创建</p>
      ) : (
        <div className="space-y-2">
          {tiers.slice().sort((a, b) => (b.sort_order || 0) - (a.sort_order || 0)).map(tier => (
            <div key={tier.id} className={`flex items-center gap-3 border rounded-xl p-3 bg-white ${!tier.is_active ? 'opacity-60' : ''}`}>
              <Badge className={`text-xs flex-shrink-0 ${tier.color || 'bg-gray-100 text-gray-700'}`}>
                {(() => { const Ic = TIER_ICONS[tier.icon]; return Ic ? <Ic className="w-3 h-3 mr-1" /> : null; })()}
                <span style={tier.name_font_color ? { color: tier.name_font_color } : undefined}>{tier.name}</span>
              </Badge>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-400">排序 {tier.sort_order || 0}</span>
                  {tier.trigger_enabled && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-amber-600 border-amber-200">自动触发</Badge>
                  )}
                  {tier.is_permanent && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-purple-600 border-purple-200">
                      <Lock className="w-2.5 h-2.5 mr-0.5" />不再降级
                    </Badge>
                  )}
                  {tier.purchasable && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-blue-600 border-blue-200">
                      可购买 ¥{(tier.price_jpy || 0).toLocaleString()}
                    </Badge>
                  )}
                  <span className="text-xs text-gray-400">·</span>
                  {tier.credit_enabled ? (
                    <>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <CreditCard className="w-3 h-3" />记账开启
                      </span>
                      <span className="text-xs text-gray-400">·</span>
                      <span className="text-xs text-gray-500">{CYCLE_LABELS[tier.credit_cycle] || tier.credit_cycle}</span>
                      <span className="text-xs text-gray-400">·</span>
                      <span className="text-xs text-gray-500">上限 ¥{(tier.default_credit_limit_jpy || 0).toLocaleString()}</span>
                      <span className="text-xs text-gray-400">·</span>
                      <span className="text-xs text-gray-500">逾期宽限 {tier.credit_overdue_limit_days || 7} 天</span>
                    </>
                  ) : (
                    <span className="text-xs text-gray-400">记账未开启</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => handleToggle(tier)} className="p-1.5 rounded hover:bg-gray-100 text-xs text-gray-400 hover:text-gray-700">
                  {tier.is_active ? "停用" : "启用"}
                </button>
                <button onClick={() => handleEdit(tier)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDelete(tier.id)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 独立触发规则：变更阶级 或 增删角色权限标签 */}
      <TierTriggerRuleManager tiers={tiers} roles={roles} />
    </div>
  );
}