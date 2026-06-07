/**
 * GroupBuy - 拼下单页面
 * Tabs: 拼单广场（open requests）| 我的拼单 | 店铺模板管理
 */
import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { usePermissions } from "@/hooks/usePermissions";
import { ShoppingBag, Store, Plus, RefreshCw, Search, Filter, Loader2, Users, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import GroupBuyRequestCard from "@/components/groupbuy/GroupBuyRequestCard";
import GroupBuyDetailModal from "@/components/groupbuy/GroupBuyDetailModal";
import GroupBuyTemplateManager from "@/components/groupbuy/GroupBuyTemplateManager";
import GroupBuyJoinForm from "@/components/groupbuy/GroupBuyJoinForm";

const TABS = [
  { key: 'plaza', label: '拼单广场', icon: ShoppingBag },
  { key: 'mine',  label: '我的拼单', icon: Users },
  { key: 'templates', label: '店铺模板', icon: Store },
];

// Detect template from URL using keywords
function detectTemplate(url, templates) {
  if (!url) return null;
  for (const t of templates) {
    if (t.status !== 'approved' || t.is_active === false) continue;
    const keywords = t.url_keywords || [];
    if (keywords.some(kw => url.toLowerCase().includes(kw.toLowerCase()))) {
      return t;
    }
  }
  return null;
}

export default function GroupBuy() {
  const { user } = useCurrentUser();
  const { can } = usePermissions();
  const isAdmin = user?.role === 'admin' || user?.role === 'platform_admin' || user?.role === 'staff';

  const [tab, setTab] = useState('plaza');
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [myEntries, setMyEntries] = useState([]); // [{request_id, status}]
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('open');

  // Detail modal
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [detailEntries, setDetailEntries] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Create new request form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '', template_id: '', deadline: '', on_deadline_action: 'cancel', condition_tier_id: '',
  });
  const [entryForm, setEntryForm] = useState(null); // the join form data


  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [reqRes, tplRes] = await Promise.all([
      base44.functions.invoke('manageGroupBuy', { action: 'list_requests', status_filter: 'all' }),
      base44.functions.invoke('manageGroupBuy', { action: 'list_templates' }),
    ]);
    const allRequests = reqRes.data?.requests || [];
    const allTemplates = tplRes.data?.templates || [];
    setRequests(allRequests);
    setTemplates(allTemplates);

    // Find my entries by searching requests where I joined
    // We load entries lazily in detail modal; here just track via completed/active entries
    setLoading(false);
  }, [user?.email]);

  useEffect(() => { loadData(); }, [loadData]);

  const openDetail = async (req) => {
    setSelectedRequest(req);
    setLoadingDetail(true);
    const res = await base44.functions.invoke('manageGroupBuy', { action: 'get_request', request_id: req.id });
    setDetailEntries(res.data?.entries || []);
    setLoadingDetail(false);
  };

  const closeDetail = () => { setSelectedRequest(null); setDetailEntries([]); };

  // Filtered requests for plaza tab
  const filtered = requests.filter(r => {
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchSearch = !search.trim() || r.title.toLowerCase().includes(search.toLowerCase()) || (r.template_name || '').toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  // My requests: where I'm creator or have an entry
  // We approximate by creator; entries loaded on detail open
  const myCreatedRequests = requests.filter(r => r.creator_email === user?.email);

  // Called when user types product URL in join form
  const handleProductUrlDetect = (url) => {
    if (!url || templates.length === 0) return;
    const detected = detectTemplate(url, templates);
    if (detected) {
      setCreateForm(f => ({ ...f, template_id: detected.id, condition_tier_id: '' }));
    }
  };

  const selectedTemplate = templates.find(t => t.id === createForm.template_id);
  const availableTiers = selectedTemplate?.shipping_tiers || [];
  const defaultTier = availableTiers.find(t => t.is_default) || availableTiers[0];

  // Build natural language summary
  const buildSummary = () => {
    if (!createForm.deadline) return null;
    const tier = availableTiers.find(t => t.id === createForm.condition_tier_id) || defaultTier;
    const feeText = tier ? (tier.shipping_fee_jpy === 0 ? '免运费' : `运费约 ¥${tier.shipping_fee_jpy}`) : '达到条件';
    const actionText = createForm.on_deadline_action === 'cancel' ? '取消订单' : '继续单独下单';
    return `在 ${createForm.deadline} 之前${tier ? `，满 ¥${tier.min_amount_jpy?.toLocaleString()} 时 ${feeText} 下单` : ''}，未下单则${actionText}`;
  };

  const handleCreate = async () => {
    if (!createForm.title || !createForm.template_id || !createForm.deadline) return;
    setCreating(true);
    const res = await base44.functions.invoke('manageGroupBuy', {
      action: 'create_request',
      ...createForm,
      condition_tier_id: createForm.condition_tier_id || defaultTier?.id || '',
      // Include entry data if filled
      ...(entryForm?.product_name && entryForm?.estimated_jpy ? {
        product_url: entryForm.product_url || '',
        product_name: entryForm.product_name,
        product_description: entryForm.product_description || '',
        product_image_url: entryForm.product_image_url || '',
        estimated_jpy: parseFloat(entryForm.estimated_jpy) || 0,
        user_note: entryForm.user_note || '',
        custom_deadline: entryForm.custom_deadline || createForm.deadline,
      } : {}),
    });
    setCreating(false);
    if (res.data?.success) {
      setShowCreateForm(false);
      setCreateForm({ title: '', template_id: '', deadline: '', on_deadline_action: 'cancel', condition_tier_id: '' });
      setEntryForm(null);
      loadData();
    }
  };

  // Default deadline = 3 days from now
  const defaultDeadline = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const summary = buildSummary();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-indigo-600" />拼下单
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">多人拼单，享受满减满额免运费优惠</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={loadData} className="h-8 text-xs gap-1">
            <RefreshCw className="w-3.5 h-3.5" />刷新
          </Button>
          {tab === 'plaza' && (isAdmin || can('order:submit_group_buy_request')) && (
            <Button size="sm" className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 gap-1"
              onClick={() => { setShowCreateForm(true); setCreateForm(f => ({ ...f, deadline: defaultDeadline })); }}>
              <Plus className="w-3.5 h-3.5" />发起拼单
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              <Icon className="w-4 h-4" />{t.label}
              {t.key === 'templates' && templates.filter(t => t.status === 'pending_review').length > 0 && isAdmin && (
                <Badge className="text-[10px] bg-yellow-100 text-yellow-700 ml-1 px-1 py-0">
                  {templates.filter(t => t.status === 'pending_review').length}
                </Badge>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Plaza Tab ─────────────────────────────────────────── */}
      {tab === 'plaza' && (
        <div className="space-y-4">
          {/* Create form */}
          {showCreateForm && (
            <Card className="border-indigo-200 bg-indigo-50/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-indigo-800">发起新拼单</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Summary */}
                {summary && (
                  <div className="bg-white border border-indigo-100 rounded-xl px-3 py-2">
                    <p className="text-xs text-indigo-700 font-medium">📝 {summary}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label className="text-xs text-gray-500">拼单名称 *</Label>
                    <Input className="mt-1 h-8 text-sm" placeholder="如：本周亚马逊拼单"
                      value={createForm.title} onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))} />
                  </div>

                  <div>
                    <Label className="text-xs text-gray-500">拼单店铺 *</Label>
                    <Select value={createForm.template_id} onValueChange={v => setCreateForm(f => ({ ...f, template_id: v, condition_tier_id: '' }))}>
                      <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue placeholder="选择店铺..." /></SelectTrigger>
                      <SelectContent>
                        {templates.filter(t => t.status === 'approved' && t.is_active !== false).map(t => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs text-gray-500">截止日期 *</Label>
                    <Input type="date" className="mt-1 h-8 text-sm"
                      value={createForm.deadline} min={new Date().toISOString().slice(0, 10)}
                      onChange={e => setCreateForm(f => ({ ...f, deadline: e.target.value }))} />
                  </div>

                  {availableTiers.length > 0 && (
                    <div>
                      <Label className="text-xs text-gray-500">成立条件</Label>
                      <Select value={createForm.condition_tier_id || defaultTier?.id || ''}
                        onValueChange={v => setCreateForm(f => ({ ...f, condition_tier_id: v }))}>
                        <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue placeholder="选择阶梯..." /></SelectTrigger>
                        <SelectContent>
                          {availableTiers.map(tier => (
                            <SelectItem key={tier.id} value={tier.id}>
                              {tier.name}（满¥{tier.min_amount_jpy?.toLocaleString()} · 运费¥{tier.shipping_fee_jpy}）
                              {tier.is_default && ' ⭐'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div>
                    <Label className="text-xs text-gray-500">到期未达成</Label>
                    <Select value={createForm.on_deadline_action} onValueChange={v => setCreateForm(f => ({ ...f, on_deadline_action: v }))}>
                      <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cancel">取消订单（默认）</SelectItem>
                        <SelectItem value="proceed">继续单独下单</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Creator's own entry */}
                <div className="border-t border-indigo-100 pt-3">
                  <p className="text-xs text-gray-500 mb-2 font-medium">我的需求（可选，发起时一并参团）</p>
                  <GroupBuyJoinForm
                    request={{ id: 'preview', deadline: createForm.deadline, template_color: selectedTemplate?.color }}
                    currentUser={user}
                    isCreateMode={true}
                    onDataChange={setEntryForm}
                    onSuccess={() => {}}
                    onCancel={() => {}}
                    templates={templates.filter(t => t.status === 'approved' && t.is_active !== false)}
                    currentTemplateId={createForm.template_id}
                    onTemplateDetected={(tpl) => setCreateForm(f => ({ ...f, template_id: tpl.id, condition_tier_id: '' }))}
                  />
                </div>

                <div className="flex gap-2">
                  <Button size="sm" onClick={handleCreate}
                    disabled={creating || !createForm.title || !createForm.template_id || !createForm.deadline}
                    className="bg-indigo-600 hover:bg-indigo-700 text-xs h-8">
                    {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                    发起拼单
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowCreateForm(false)} className="text-xs h-8">取消</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-40 relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <Input className="pl-8 h-8 text-sm" placeholder="搜索拼单..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="open">招募中</SelectItem>
                <SelectItem value="completed">已完成</SelectItem>
                <SelectItem value="all">全部</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Grid */}
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">暂无拼单</p>
              {(isAdmin || can('order:submit_group_buy_request')) && (
                <Button size="sm" className="mt-3 bg-indigo-600 hover:bg-indigo-700 text-xs"
                  onClick={() => { setShowCreateForm(true); setCreateForm(f => ({ ...f, deadline: defaultDeadline })); }}>
                  发起第一个拼单
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(req => (
                <GroupBuyRequestCard
                  key={req.id}
                  request={req}
                  onClick={openDetail}
                  myEntryStatus={null}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Mine Tab ──────────────────────────────────────────── */}
      {tab === 'mine' && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">我发起的拼单</h3>
          {myCreatedRequests.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">您还没有发起过拼单</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {myCreatedRequests.map(req => (
                <GroupBuyRequestCard key={req.id} request={req} onClick={openDetail} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Templates Tab ─────────────────────────────────────── */}
      {tab === 'templates' && (
        <GroupBuyTemplateManager
          templates={templates}
          onRefresh={loadData}
          isAdmin={isAdmin}
          currentUser={user}
        />
      )}

      {/* Detail Modal */}
      {selectedRequest && (
        <GroupBuyDetailModal
          request={selectedRequest}
          entries={loadingDetail ? [] : detailEntries}
          currentUser={user}
          isAdmin={isAdmin}
          onClose={closeDetail}
          onRefresh={() => { loadData(); openDetail(selectedRequest); }}
          templates={templates.filter(t => t.status === 'approved' && t.is_active !== false)}
        />
      )}
    </div>
  );
}