/**
 * GroupBuyTemplateManager - 管理店铺拼下单模板
 * Used by admins (full management) and users (create + view own)
 */
import { useState } from "react";
import { Plus, Edit2, Trash2, CheckCircle2, XCircle, Clock, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { base44 } from "@/api/base44Client";
import { usePermissions } from "@/hooks/usePermissions";
import GroupBuyTierEditor from "./GroupBuyTierEditor";

const STATUS_CONFIG = {
  pending_review: { label: "待审核", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  approved:       { label: "已审核", color: "bg-green-100 text-green-700",  icon: CheckCircle2 },
  rejected:       { label: "已拒绝", color: "bg-red-100 text-red-600",      icon: XCircle },
};

const PRESET_COLORS = ['#6366f1','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444','#8b5cf6','#06b6d4'];

const emptyForm = {
  name: '', description: '', color: '#6366f1', logo_url: '',
  url_keywords: [], shipping_tiers: [], is_active: true,
};

export default function GroupBuyTemplateManager({ templates, onRefresh, isAdmin, currentUser }) {
  const { can } = usePermissions();
  const canSubmitTemplate = isAdmin || can('order:submit_group_buy_template');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [keywordInput, setKeywordInput] = useState('');
  const [reviewingId, setReviewingId] = useState(null);
  const [reviewDecision, setReviewDecision] = useState({ decision: 'approve', reject_reason: '' });

  const sf = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const openCreate = () => { setForm(emptyForm); setEditingId(null); setShowForm(true); };
  const openEdit = (t) => {
    setForm({
      name: t.name, description: t.description || '', color: t.color || '#6366f1',
      logo_url: t.logo_url || '', url_keywords: t.url_keywords || [],
      shipping_tiers: t.shipping_tiers || [], is_active: t.is_active !== false,
    });
    setEditingId(t.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    if (editingId) {
      await base44.functions.invoke('manageGroupBuy', { action: 'update_template', template_id: editingId, ...form });
    } else {
      await base44.functions.invoke('manageGroupBuy', { action: 'create_template', ...form });
    }
    setSaving(false);
    setShowForm(false);
    onRefresh?.();
  };

  const handleDelete = async (id) => {
    if (!confirm('确定删除此模板？')) return;
    await base44.functions.invoke('manageGroupBuy', { action: 'delete_template', template_id: id });
    onRefresh?.();
  };

  const handleReview = async (id) => {
    await base44.functions.invoke('manageGroupBuy', { action: 'review_template', template_id: id, ...reviewDecision });
    setReviewingId(null);
    onRefresh?.();
  };

  const addKeyword = () => {
    const kw = keywordInput.trim();
    if (kw && !form.url_keywords.includes(kw)) {
      sf('url_keywords', [...form.url_keywords, kw]);
    }
    setKeywordInput('');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">店铺模板</h3>
        {canSubmitTemplate && (
          <Button size="sm" variant="outline" onClick={openCreate} className="h-7 text-xs gap-1">
            <Plus className="w-3.5 h-3.5" />新建模板
          </Button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="border border-indigo-200 rounded-xl p-4 bg-indigo-50/30 space-y-3">
          <h4 className="text-sm font-semibold text-gray-800">{editingId ? '编辑模板' : '新建模板'}</h4>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs text-gray-500">店铺名称 *</Label>
              <Input className="mt-1 h-8 text-sm" value={form.name} onChange={e => sf('name', e.target.value)} placeholder="如：Amazon JP" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs text-gray-500">描述</Label>
              <Textarea className="mt-1 text-sm" rows={2} value={form.description} onChange={e => sf('description', e.target.value)} />
            </div>
          </div>

          {/* Color */}
          <div>
            <Label className="text-xs text-gray-500">主题色</Label>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {PRESET_COLORS.map(c => (
                <button key={c} type="button"
                  onClick={() => sf('color', c)}
                  className={`w-6 h-6 rounded-full border-2 transition-all ${form.color === c ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }} />
              ))}
              <input type="color" value={form.color} onChange={e => sf('color', e.target.value)}
                className="w-8 h-6 rounded border border-gray-200 cursor-pointer" />
            </div>
          </div>

          {/* URL keywords */}
          <div>
            <Label className="text-xs text-gray-500">URL识别关键词（用于自动匹配店铺）</Label>
            <div className="flex gap-2 mt-1">
              <Input className="h-8 text-sm flex-1" placeholder="如：www.amazon.co.jp" value={keywordInput}
                onChange={e => setKeywordInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKeyword(); } }} />
              <Button size="sm" type="button" variant="outline" onClick={addKeyword} className="h-8 text-xs">添加</Button>
            </div>
            {form.url_keywords.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {form.url_keywords.map((kw, i) => (
                  <span key={i} className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded px-2 py-0.5 text-xs text-gray-600">
                    {kw}
                    <button type="button" onClick={() => sf('url_keywords', form.url_keywords.filter((_, j) => j !== i))}
                      className="text-gray-400 hover:text-red-500 ml-0.5">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Shipping tiers */}
          <GroupBuyTierEditor tiers={form.shipping_tiers} onChange={tiers => sf('shipping_tiers', tiers)} />

          {/* Active toggle */}
          <div className="flex items-center gap-2">
            <Switch checked={form.is_active} onCheckedChange={v => sf('is_active', v)} />
            <span className="text-xs text-gray-600">启用</span>
          </div>

          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={handleSave} disabled={saving || !form.name.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8">
              {saving ? '保存中...' : '保存'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowForm(false)} className="text-xs h-8">取消</Button>
          </div>
        </div>
      )}

      {/* Template list */}
      <div className="space-y-2">
        {templates.length === 0 && <p className="text-xs text-gray-400 text-center py-4">暂无模板</p>}
        {templates.map(t => {
          const sc = STATUS_CONFIG[t.status] || STATUS_CONFIG.pending_review;
          const StatusIcon = sc.icon;
          const canEdit = isAdmin || t.created_by_email === currentUser?.email;
          return (
            <div key={t.id} className="bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-3">
              {/* Color swatch */}
              <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: t.color || '#6366f1' }}>
                {t.logo_url ? <img src={t.logo_url} alt="" className="w-7 h-7 object-contain rounded" /> : <Store className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-800">{t.name}</span>
                  <Badge className={`text-xs ${sc.color}`}><StatusIcon className="w-2.5 h-2.5 mr-0.5 inline" />{sc.label}</Badge>
                  {t.is_active === false && <Badge className="text-xs bg-gray-100 text-gray-400">已停用</Badge>}
                </div>
                {t.description && <p className="text-xs text-gray-400 mt-0.5 truncate">{t.description}</p>}
                {t.status === 'rejected' && t.reject_reason && (
                  <p className="text-xs text-red-500 mt-0.5">拒绝原因：{t.reject_reason}</p>
                )}
                {(t.url_keywords || []).length > 0 && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate">识别词：{t.url_keywords.join(', ')}</p>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {isAdmin && t.status === 'pending_review' && (
                  reviewingId === t.id ? (
                    <div className="flex items-center gap-1">
                      <select className="text-xs border rounded px-1 h-7"
                        value={reviewDecision.decision} onChange={e => setReviewDecision(d => ({ ...d, decision: e.target.value }))}>
                        <option value="approve">通过</option>
                        <option value="reject">拒绝</option>
                      </select>
                      {reviewDecision.decision === 'reject' && (
                        <Input className="h-7 text-xs w-20" placeholder="原因"
                          value={reviewDecision.reject_reason} onChange={e => setReviewDecision(d => ({ ...d, reject_reason: e.target.value }))} />
                      )}
                      <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700" onClick={() => handleReview(t.id)}>确认</Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setReviewingId(null)}>取消</Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" className="h-7 text-xs text-yellow-600 border-yellow-300 hover:bg-yellow-50"
                      onClick={() => { setReviewingId(t.id); setReviewDecision({ decision: 'approve', reject_reason: '' }); }}>
                      审核
                    </Button>
                  )
                )}
                {canEdit && (
                  <button onClick={() => openEdit(t)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                )}
                {(isAdmin || (t.created_by_email === currentUser?.email && t.status === 'pending_review')) && (
                  <button onClick={() => handleDelete(t.id)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}