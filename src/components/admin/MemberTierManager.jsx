/**
 * MemberTierManager - Admin component to manage member tiers
 * Placed in AdminSettings under a "会员阶级" tab
 */
import { useState } from "react";
import { Plus, Edit2, Trash2, Save, X, CreditCard } from "lucide-react";
import { tenantEntity } from "@/lib/tenantApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import MemberStatsScanCard from "@/components/admin/MemberStatsScanCard";

const CYCLE_LABELS = { weekly: "周结", monthly: "月结" };

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

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleEdit = (tier) => {
    setEditingId(tier.id);
    setForm({
      name: tier.name || "",
      color: tier.color || "bg-blue-100 text-blue-700",
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
      default_credit_limit_jpy: parseFloat(form.default_credit_limit_jpy) || 0,
      credit_overdue_limit_days: parseInt(form.credit_overdue_limit_days) || 7,
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
          {tiers.map(tier => (
            <div key={tier.id} className={`flex items-center gap-3 border rounded-xl p-3 bg-white ${!tier.is_active ? 'opacity-60' : ''}`}>
              <Badge className={`text-xs flex-shrink-0 ${tier.color || 'bg-gray-100 text-gray-700'}`}>{tier.name}</Badge>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
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
    </div>
  );
}