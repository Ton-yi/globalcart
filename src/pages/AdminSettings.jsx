import { useState, useEffect } from "react";
import { timePage } from "@/lib/timing";
import { base44 } from "@/api/base44Client";
import { tenantEntity } from "@/lib/tenantApi";
import { setTenantConfigCache } from "@/lib/configCache";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Settings, Save, Plus, Trash2, Star, Lock, Eye, EyeOff, Truck, Palette, TrendingUp, Zap, Building2, Users, CheckCircle2 } from "lucide-react";
import ThemeSelector from "@/components/common/ThemeSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import ShippingMethodManager from "@/components/admin/ShippingMethodManager";
import OnlineStoreTagManager from "@/components/admin/OnlineStoreTagManager";
import TransitShippingMethodManager from "@/components/admin/TransitShippingMethodManager";
import ItemSizeTemplateManager from "@/components/admin/ItemSizeTemplateManager";
import BoxTemplateManager from "@/components/admin/BoxTemplateManager";

const DEFAULT_SETTINGS = [
  { key: "service_fee_rate", value: "10", description: "服务费率 (%)", category: "fee" },
  { key: "prepay_rate", value: "80", description: "预付款比率 (%)", category: "fee" },
  { key: "jpy_usd_increment", value: "0", description: "日元/美元汇率增量 (基于实时汇率)", category: "fee" },
  { key: "jpy_cny_increment", value: "0", description: "日元/人民币汇率增量 (基于实时汇率)", category: "fee" },
  { key: "site_name", value: "同一物流", description: "网站名称", category: "general" },
  { key: "contact_email", value: "", description: "联系邮箱", category: "general" },
  { key: "whatsapp", value: "", description: "WhatsApp", category: "general" },
  { key: "line_id", value: "", description: "Line ID", category: "general" },
  { key: "wechat_id", value: "", description: "微信号", category: "general" },
  { key: "paid_order_reminder", value: "感谢付款！我们会尽快开始处理您的订单。", description: "已付款订单的提示消息", category: "general" },
  { key: "customs_dangerous_goods_text", value: "I confirm that the shipment does not contain any prohibited or dangerous goods, including but not limited to flammable items, batteries, aerosols, or weapons.", description: "报关危险品确认文本（Markdown支持）", category: "general" },
  { key: "alipay_account", value: "", description: "支付宝账号", category: "payment" },
  { key: "alipay_account_name", value: "", description: "支付宝收款人姓名", category: "payment" },
  { key: "alipay_qr_url", value: "", description: "支付宝收款码图片URL", category: "payment" },
  { key: "alipay_payment_note", value: "请在付款备注中填写您的订单号", description: "支付宝付款备注提示", category: "payment" },
];

// 支付相关设置键名，仅超级管理员可见
const PAYMENT_RESTRICTED_KEYS = ["alipay_account", "alipay_account_name", "alipay_qr_url", "alipay_payment_note"];

const CAT_LABELS = { fee: "费率设置", payment: "支付设置", shipping: "运输设置", general: "基本信息" };
const CAT_COLORS = { fee: "bg-yellow-100 text-yellow-700", payment: "bg-green-100 text-green-700", shipping: "bg-blue-100 text-blue-700", general: "bg-gray-100 text-gray-600" };

const TABS = [
{ key: "general", label: "基本设置" },
{ key: "shipping_methods", label: "运输方式" },
{ key: "transit_methods", label: "中转运输方式" },
{ key: "item_sizes", label: "物品尺寸" },
{ key: "box_templates", label: "外箱模板" },
{ key: "store_tags", label: "商城标签规则" },
{ key: "theme", label: "界面主题" },
{ key: "tenants", label: "租户管理" },
];

export default function AdminSettings() {
  const { user } = useCurrentUser();
  const [activeTab, setActiveTab] = useState("general");
  const [settings, setSettings] = useState([]);
  const [addons, setAddons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPayment, setShowPayment] = useState(false);
  const [liveRates, setLiveRates] = useState(null);
  const [newAddon, setNewAddon] = useState({ name: "", description: "", fee: "", fee_currency: "JPY", addon_type: "order" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newVal, setNewVal] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCat, setNewCat] = useState("general");

  // Tenant management state
  const [shippingMethods, setShippingMethods] = useState(null);
  const [transitMethods, setTransitMethods] = useState(null);
  const [itemSizeTemplates, setItemSizeTemplates] = useState(null);
  const [storeTagRules, setStoreTagRules] = useState(null);
  const [boxTemplates, setBoxTemplates] = useState(null);

  const [tenants, setTenants] = useState([]);
  const [tenantsLoading, setTenantsLoading] = useState(false);
  const [newTenant, setNewTenant] = useState({ name: "", code: "", branding_name: "", timezone: "Asia/Tokyo", login_title: "", login_subtitle: "", logo_url: "", favicon_url: "", theme_color: "#dc2626", contact_info: "" });
  const [creatingTenant, setCreatingTenant] = useState(false);
  const [tenantMsg, setTenantMsg] = useState(null); // { type: 'success'|'error', text }
  const [assigningAll, setAssigningAll] = useState(false);
  const [editingTenant, setEditingTenant] = useState(null); // tenant being edited
  const [editTenantFields, setEditTenantFields] = useState({});
  const [savingTenant, setSavingTenant] = useState(false);
  const isPlatformAdmin = user?.role === 'platform_admin';

  const load = async () => {
    const t = timePage('AdminSettings');
    try {
      const r = await t.timeCall('getAdminSettingsPageData', () => base44.functions.invoke('getAdminSettingsPageData', {}));
      const data = r.data || {};
      let settingsData = data.settings || [];

      if (settingsData.length === 0) {
        // Seed defaults; silently skip if user has no tenant yet
        try {
          await Promise.all(DEFAULT_SETTINGS.map(s => tenantEntity.create('SiteSettings', s)));
          // Only re-fetch settings, not the full page payload
          settingsData = await tenantEntity.list('SiteSettings');
        } catch (_) {
          // No tenant assigned yet — stay empty
        }
      }

      setSettings(settingsData);
      setAddons(data.addons || []);
      setShippingMethods(data.shippingMethods || []);
      setTransitMethods(data.transitMethods || []);
      setItemSizeTemplates(data.itemSizeTemplates || []);
      setStoreTagRules(data.storeTagRules || []);
      setBoxTemplates(data.boxTemplates || []);
      if (data.rates) setLiveRates(data.rates);

      // Populate the shared config cache so Layout's fetchTenantConfig() is a cache-hit
      // and does NOT fire a separate getTenantConfigData request
      if (data.announcements !== undefined) {
        setTenantConfigCache({
          announcements: data.announcements || [],
          shippingMethods: data.shippingMethods || [],
          transitMethods: data.transitMethods || [],
          transitLocations: [],
          itemSizeTemplates: data.itemSizeTemplates || [],
          storeTagRules: data.storeTagRules || [],
          addons: data.addons || [],
        });
      }

      t.done('data ready');
    } catch (_) {
      // Degraded mode: no tenant assigned yet
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTenants = async () => {
    setTenantsLoading(true);
    const r = await base44.functions.invoke('manageTenants', { action: 'list' });
    setTenants(r.data?.tenants || []);
    setTenantsLoading(false);
  };

  useEffect(() => {
    if (activeTab === 'tenants') loadTenants();
  }, [activeTab]);

  const handleCreateTenant = async () => {
    if (!newTenant.name || !newTenant.code) return;
    setCreatingTenant(true);
    setTenantMsg(null);
    const r = await base44.functions.invoke('manageTenants', { action: 'create', ...newTenant });
    if (r.data?.error) {
      setTenantMsg({ type: 'error', text: r.data.error });
    } else {
      setTenantMsg({ type: 'success', text: `租户 "${r.data.tenant.name}" 创建成功！` });
      setNewTenant({ name: "", code: "", branding_name: "", timezone: "Asia/Tokyo", login_title: "", login_subtitle: "", logo_url: "", favicon_url: "", theme_color: "#dc2626", contact_info: "" });
      await loadTenants();
    }
    setCreatingTenant(false);
  };

  const handleAssignAll = async (tenantId) => {
    setAssigningAll(true);
    setTenantMsg(null);
    const r = await base44.functions.invoke('manageTenants', { action: 'assign_all', tenant_id: tenantId });
    if (r.data?.error) {
      setTenantMsg({ type: 'error', text: r.data.error });
    } else {
      setTenantMsg({ type: 'success', text: `已将 ${r.data.assigned} 名用户分配到此租户。` });
    }
    setAssigningAll(false);
  };

  const handleToggleTenant = async (t) => {
    await base44.functions.invoke('manageTenants', { action: 'update', id: t.id, is_active: !t.is_active });
    await loadTenants();
  };

  const handleEditTenant = (t) => {
    setEditingTenant(t.id);
    setEditTenantFields({
      branding_name: t.branding_name || "",
      code: t.code || "",
      logo_url: t.logo_url || "",
      favicon_url: t.favicon_url || "",
      theme_color: t.theme_color || "#dc2626",
      login_title: t.login_title || "",
      login_subtitle: t.login_subtitle || "",
      contact_info: t.contact_info || "",
      subdomain: t.subdomain || (t.code || "").toLowerCase(),
    });
    setTenantMsg(null);
  };

  const handleSaveTenant = async (tenantId) => {
    setSavingTenant(true);
    setTenantMsg(null);
    const r = await base44.functions.invoke('manageTenants', { action: 'update', id: tenantId, ...editTenantFields });
    if (r.data?.error) {
      setTenantMsg({ type: 'error', text: r.data.error });
    } else {
      setTenantMsg({ type: 'success', text: '保存成功' });
      setEditingTenant(null);
      await loadTenants();
    }
    setSavingTenant(false);
  };

  const updateSetting = (id, field, value) => {
    setSettings(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const handleSaveCategory = async (category) => {
    setSaving(true);
    const itemsToSave = settings.filter(s => s.category === category);
    await Promise.all(itemsToSave.map(s => tenantEntity.update('SiteSettings', s.id, { value: s.value, description: s.description })));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSaveAll = async () => {
    setSaving(true);
    await Promise.all(settings.map(s => tenantEntity.update('SiteSettings', s.id, { value: s.value, description: s.description })));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleAdd = async () => {
    if (!newKey || !newVal) return;
    await tenantEntity.create('SiteSettings', { key: newKey, value: newVal, description: newDesc, category: newCat });
    setNewKey(""); setNewVal(""); setNewDesc(""); setNewCat("general");
    await load();
  };

  const handleDelete = async (id) => {
    await tenantEntity.delete('SiteSettings', id);
    await load();
  };

  const handleAddAddon = async () => {
    if (!newAddon.name || newAddon.fee === "") return;
    await tenantEntity.create('AddonOption', { ...newAddon, fee: parseFloat(newAddon.fee) || 0, is_active: true });
    setNewAddon({ name: "", description: "", fee: "", fee_currency: "JPY", addon_type: "order" });
    await load();
  };

  const handleDeleteAddon = async (id) => {
    await tenantEntity.delete('AddonOption', id);
    await load();
  };

  const toggleAddon = async (a) => {
    await tenantEntity.update('AddonOption', a.id, { is_active: !a.is_active });
    await load();
  };

  const grouped = settings.reduce((acc, s) => {
    const cat = s.category || "general";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">网站后台设置</h1>
        {activeTab === "general" && (
          <Button className="bg-gray-900 hover:bg-gray-800" size="sm" onClick={handleSaveAll} disabled={saving}>
            <Save className="w-4 h-4 mr-1.5" />{saved ? "已保存 ✓" : saving ? "保存中..." : "保存全部"}
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${activeTab === tab.key ? "border-red-600 text-red-600" : "border-transparent text-gray-500 hover:text-gray-800"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "shipping_methods" && (
        <Card className="border-gray-200">
          <CardContent className="pt-5">
            <ShippingMethodManager initialData={shippingMethods} />
          </CardContent>
        </Card>
      )}

      {activeTab === "transit_methods" && (
        <Card className="border-gray-200">
          <CardContent className="pt-5">
            <TransitShippingMethodManager initialData={transitMethods} />
          </CardContent>
        </Card>
      )}

      {activeTab === "item_sizes" && (
        <Card className="border-gray-200">
          <CardContent className="pt-5">
            <ItemSizeTemplateManager initialData={itemSizeTemplates} />
          </CardContent>
        </Card>
      )}

      {activeTab === "box_templates" && (
        <Card className="border-gray-200">
          <CardContent className="pt-5">
            <BoxTemplateManager initialData={boxTemplates} />
          </CardContent>
        </Card>
      )}

      {activeTab === "store_tags" && (
        <Card className="border-gray-200">
          <CardContent className="pt-5">
            <OnlineStoreTagManager initialData={storeTagRules} />
          </CardContent>
        </Card>
      )}

      {activeTab === "tenants" && (
        <div className="space-y-5">
          {/* Create tenant — platform_admin only */}
          {isPlatformAdmin && (
            <Card className="border-blue-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-500" />新建租户
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-gray-500">租户名称 *</Label>
                    <Input className="mt-0.5 h-8 text-sm" placeholder="例：同一物流" value={newTenant.name}
                      onChange={e => setNewTenant(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">代码/子域名 (唯一) *</Label>
                    <Input className="mt-0.5 h-8 text-sm font-mono" placeholder="例：tongyi" value={newTenant.code}
                      onChange={e => setNewTenant(p => ({ ...p, code: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))} />
                    <p className="text-xs text-gray-400 mt-0.5">访问地址：{newTenant.code || "code"}.yourdomain.com</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">品牌显示名</Label>
                    <Input className="mt-0.5 h-8 text-sm" placeholder="同上则留空" value={newTenant.branding_name}
                      onChange={e => setNewTenant(p => ({ ...p, branding_name: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">登录页标题</Label>
                    <Input className="mt-0.5 h-8 text-sm" placeholder="留空则使用品牌名" value={newTenant.login_title}
                      onChange={e => setNewTenant(p => ({ ...p, login_title: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">主题色</Label>
                    <div className="flex items-center gap-2 mt-0.5">
                      <input type="color" value={newTenant.theme_color} onChange={e => setNewTenant(p => ({ ...p, theme_color: e.target.value }))}
                        className="h-8 w-10 rounded border border-gray-200 cursor-pointer" />
                      <Input className="h-8 text-sm flex-1 font-mono" value={newTenant.theme_color}
                        onChange={e => setNewTenant(p => ({ ...p, theme_color: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">时区</Label>
                    <Input className="mt-0.5 h-8 text-sm" value={newTenant.timezone}
                      onChange={e => setNewTenant(p => ({ ...p, timezone: e.target.value }))} />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs text-gray-500">联系方式</Label>
                    <Input className="mt-0.5 h-8 text-sm" placeholder="微信/WhatsApp/邮箱等" value={newTenant.contact_info}
                      onChange={e => setNewTenant(p => ({ ...p, contact_info: e.target.value }))} />
                  </div>
                </div>
                {tenantMsg && !editingTenant && (
                  <p className={`text-xs px-3 py-2 rounded border ${tenantMsg.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                    {tenantMsg.type === 'success' ? '✓ ' : '⚠ '}{tenantMsg.text}
                  </p>
                )}
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={handleCreateTenant}
                  disabled={creatingTenant || !newTenant.name || !newTenant.code}>
                  <Plus className="w-3.5 h-3.5 mr-1" />{creatingTenant ? "创建中..." : "创建租户"}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Tenant list */}
          <Card className="border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-gray-400" />现有租户
              </CardTitle>
            </CardHeader>
            <CardContent>
              {tenantsLoading ? (
                <p className="text-xs text-gray-400">加载中...</p>
              ) : tenants.length === 0 ? (
                <p className="text-xs text-gray-400">暂无租户，请在上方创建第一个租户。</p>
              ) : (
                <div className="space-y-3">
                  {tenants.map(t => (
                    <div key={t.id} className={`rounded-lg border ${t.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
                      {/* Collapsed row */}
                      <div className="flex items-center gap-3 p-3">
                        {t.logo_url ? (
                          <img src={t.logo_url} alt={t.branding_name} className="h-7 w-auto object-contain flex-shrink-0" />
                        ) : (
                          <div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: t.theme_color || '#dc2626' }}>
                            <span className="text-white text-xs font-bold">{(t.branding_name || t.name || '?').slice(0, 2)}</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-gray-800">{t.branding_name || t.name}</span>
                            <Badge className="text-xs font-mono bg-gray-100 text-gray-600">{t.code}</Badge>
                            {t.subdomain && t.subdomain !== (t.code || '').toLowerCase() && (
                              <Badge className="text-xs font-mono bg-blue-100 text-blue-700">{t.subdomain}.*</Badge>
                            )}
                            {!t.is_active && <Badge className="text-xs bg-red-100 text-red-600">停用</Badge>}
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {t.subdomain || (t.code || '').toLowerCase()}.yourdomain.com
                            {t.contact_info && <span className="ml-2 text-gray-300">·</span>}
                            {t.contact_info && <span className="ml-2">{t.contact_info}</span>}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Button size="sm" variant="outline" className="h-7 text-xs"
                            onClick={() => editingTenant === t.id ? setEditingTenant(null) : handleEditTenant(t)}>
                            {editingTenant === t.id ? "收起" : "编辑品牌"}
                          </Button>
                          {isPlatformAdmin && (
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                              onClick={() => handleAssignAll(t.id)} disabled={assigningAll}>
                              <Users className="w-3 h-3" />{assigningAll ? "分配中..." : "批量分配"}
                            </Button>
                          )}
                          {isPlatformAdmin && (
                            <Button size="sm" variant="ghost" className="h-7 text-xs"
                              onClick={() => handleToggleTenant(t)}>
                              {t.is_active ? "停用" : "启用"}
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Inline edit form */}
                      {editingTenant === t.id && (
                        <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs text-gray-500">品牌显示名</Label>
                              <Input className="mt-0.5 h-8 text-sm" value={editTenantFields.branding_name}
                                onChange={e => setEditTenantFields(p => ({ ...p, branding_name: e.target.value }))} />
                            </div>
                            {isPlatformAdmin && (
                              <div>
                                <Label className="text-xs text-gray-500">租户代码 <span className="text-orange-500">（仅平台管理员）</span></Label>
                                <Input className="mt-0.5 h-8 text-sm font-mono uppercase" value={editTenantFields.code}
                                  onChange={e => setEditTenantFields(p => ({ ...p, code: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '') }))} />
                                <p className="text-xs text-gray-400 mt-0.5">用于系统识别租户（唯一）</p>
                              </div>
                            )}
                            {isPlatformAdmin && (
                              <div>
                                <Label className="text-xs text-gray-500">子域名 Slug <span className="text-orange-500">（仅平台管理员）</span></Label>
                                <Input className="mt-0.5 h-8 text-sm font-mono" value={editTenantFields.subdomain}
                                  onChange={e => setEditTenantFields(p => ({ ...p, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))} />
                                <p className="text-xs text-gray-400 mt-0.5">域名读取此值匹配租户</p>
                              </div>
                            )}
                            <div>
                              <Label className="text-xs text-gray-500">登录页标题</Label>
                              <Input className="mt-0.5 h-8 text-sm" value={editTenantFields.login_title}
                                onChange={e => setEditTenantFields(p => ({ ...p, login_title: e.target.value }))} />
                            </div>
                            <div>
                              <Label className="text-xs text-gray-500">登录页副标题</Label>
                              <Input className="mt-0.5 h-8 text-sm" value={editTenantFields.login_subtitle}
                                onChange={e => setEditTenantFields(p => ({ ...p, login_subtitle: e.target.value }))} />
                            </div>
                            <div>
                              <Label className="text-xs text-gray-500">主题色</Label>
                              <div className="flex items-center gap-2 mt-0.5">
                                <input type="color" value={editTenantFields.theme_color || '#dc2626'}
                                  onChange={e => setEditTenantFields(p => ({ ...p, theme_color: e.target.value }))}
                                  className="h-8 w-10 rounded border border-gray-200 cursor-pointer" />
                                <Input className="h-8 text-sm flex-1 font-mono" value={editTenantFields.theme_color}
                                  onChange={e => setEditTenantFields(p => ({ ...p, theme_color: e.target.value }))} />
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs text-gray-500">联系方式</Label>
                              <Input className="mt-0.5 h-8 text-sm" placeholder="微信/WhatsApp/邮箱" value={editTenantFields.contact_info}
                                onChange={e => setEditTenantFields(p => ({ ...p, contact_info: e.target.value }))} />
                            </div>
                            <div className="col-span-2">
                              <Label className="text-xs text-gray-500">Logo URL</Label>
                              <Input className="mt-0.5 h-8 text-sm" placeholder="https://..." value={editTenantFields.logo_url}
                                onChange={e => setEditTenantFields(p => ({ ...p, logo_url: e.target.value }))} />
                            </div>
                            <div className="col-span-2">
                              <Label className="text-xs text-gray-500">Favicon URL</Label>
                              <Input className="mt-0.5 h-8 text-sm" placeholder="https://..." value={editTenantFields.favicon_url}
                                onChange={e => setEditTenantFields(p => ({ ...p, favicon_url: e.target.value }))} />
                            </div>
                          </div>
                          {tenantMsg && editingTenant === t.id && (
                            <p className={`text-xs px-3 py-2 rounded border ${tenantMsg.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                              {tenantMsg.type === 'success' ? '✓ ' : '⚠ '}{tenantMsg.text}
                            </p>
                          )}
                          <Button size="sm" className="bg-gray-900 hover:bg-gray-800"
                            onClick={() => handleSaveTenant(t.id)} disabled={savingTenant}>
                            <Save className="w-3.5 h-3.5 mr-1" />{savingTenant ? "保存中..." : "保存品牌设置"}
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "theme" && (
        <Card className="border-gray-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Palette className="w-4 h-4 text-purple-500" />界面主题
            </CardTitle>
            <p className="text-xs text-gray-400 mt-1">选择网站整体视觉风格，设置仅对当前浏览器生效</p>
          </CardHeader>
          <CardContent>
            <ThemeSelector />
          </CardContent>
        </Card>
      )}

      {activeTab === "general" && loading && (
        <p className="text-gray-400 text-sm">加载中...</p>
      )}

      {activeTab === "general" && !loading && (
        <>
          {/* Fee Rate Settings - Unified Block */}
          {grouped.fee && (
            <Card className="border-yellow-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Badge className="text-xs bg-yellow-100 text-yellow-700">费率设置</Badge>
                  </CardTitle>
                  <Button size="sm" className="h-7 text-xs bg-yellow-600 hover:bg-yellow-700" onClick={() => handleSaveCategory("fee")} disabled={saving}>
                    <Save className="w-3 h-3 mr-1" />{saved ? "已保存 ✓" : saving ? "保存中..." : "保存"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Service & Prepay Rates */}
                <div className="grid grid-cols-2 gap-3">
                  {grouped.fee.filter(s => !s.key.includes("increment")).map(s => (
                    <div key={s.id}>
                      <Label className="text-xs text-gray-500 block mb-1">{s.description || s.key}</Label>
                      <div className="flex items-center gap-1">
                        <Input type="number" step="0.1" className="h-8 text-sm flex-1" value={s.value} onChange={e => updateSetting(s.id, "value", e.target.value)} />
                        <span className="text-xs text-gray-400 px-2">%</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Exchange Rate Increments with Live Rates */}
                {liveRates && (
                  <div className="border-t pt-3">
                    <p className="text-xs font-medium text-gray-600 mb-3">实时汇率增量设置 (JPY)</p>
                    <Alert className="mb-3 border-blue-200 bg-blue-50">
                      <TrendingUp className="h-3 w-3 text-blue-600" />
                      <AlertDescription className="text-xs text-blue-700 ml-1">
                        基础汇率自动获取，可在此设定增量（正数=上浮，负数=下浮）
                      </AlertDescription>
                    </Alert>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { key: "jpy_usd_increment", label: "USD", live: liveRates.jpy_usd },
                        { key: "jpy_cny_increment", label: "CNY", live: liveRates.jpy_cny }
                      ].map(curr => {
                        const setting = grouped.fee.find(s => s.key === curr.key);
                        return setting ? (
                          <div key={curr.key}>
                            <Label className="text-xs text-gray-500 block mb-1">
                              {curr.label}
                              <span className="text-gray-400 ml-1">({(curr.live || 0).toFixed(6)})</span>
                            </Label>
                            <div className="flex items-center gap-1">
                              <Input type="number" step="0.00001" className="h-8 text-sm flex-1" value={setting.value} onChange={e => updateSetting(setting.id, "value", e.target.value)} placeholder="0" />
                              <span className="text-xs text-gray-400 px-2">Δ</span>
                            </div>
                          </div>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Other Settings */}
          {Object.entries(grouped).filter(([cat]) => cat !== "fee").map(([cat, items]) => {
            const isPayment = cat === "payment";
            const isUnlocked = !isPayment || showPayment;
            return (
              <Card key={cat} className={`border-gray-200 ${isPayment ? "border-green-200" : ""}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <Badge className={`text-xs ${CAT_COLORS[cat]}`}>{CAT_LABELS[cat] || cat}</Badge>
                      {isPayment && <Lock className="w-3.5 h-3.5 text-green-600" />}
                    </CardTitle>
                    {isPayment && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-green-600" onClick={() => setShowPayment(p => !p)}>
                        {showPayment ? <><EyeOff className="w-3.5 h-3.5 mr-1" />隐藏</> : <><Eye className="w-3.5 h-3.5 mr-1" />显示</>}
                      </Button>
                    )}
                  </div>
                  {isPayment && !showPayment && (
                    <p className="text-xs text-green-600 mt-1">⚠ 支付网关配置仅限超级管理员操作，点击「显示」展开</p>
                  )}
                </CardHeader>
                {isUnlocked && (
                  <CardContent className="space-y-3">
                    {items.map(s => (
                      <div key={s.id} className="flex items-start gap-3">
                        <div className="flex-1">
                          <Label className="text-xs text-gray-500">{s.description || s.key}</Label>
                          {s.key === 'customs_dangerous_goods_text' ? (
                            <Textarea rows={4} className="mt-0.5 text-sm font-mono" value={s.value} onChange={e => updateSetting(s.id, "value", e.target.value)} placeholder="Supports Markdown" />
                          ) : (
                            <Input className="mt-0.5 h-8 text-sm" value={s.value} onChange={e => updateSetting(s.id, "value", e.target.value)} />
                          )}
                        </div>
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-red-400 mt-4" onClick={() => handleDelete(s.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                )}
              </Card>
            );
          })}

          {/* Addon Options */}
          <Card className="border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-500" />增值选项设置
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Order addons */}
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1.5">
                  <Badge className="text-xs bg-blue-100 text-blue-700">下单增值选项</Badge>
                  <span className="text-gray-400 font-normal">提交订单时展示</span>
                </p>
                {addons.filter(a => !a.addon_type || a.addon_type === "order").length === 0 && (
                  <p className="text-xs text-gray-400 py-1">暂无，在下方添加</p>
                )}
                {addons.filter(a => !a.addon_type || a.addon_type === "order").map(a => (
                  <div key={a.id} className={`flex items-center gap-3 p-2 rounded-lg border mb-1.5 ${a.is_active ? "border-gray-200" : "border-gray-100 opacity-50"}`}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-800">{a.name}</span>
                        <span className="text-sm text-red-600">+{a.fee_currency || "JPY"} {parseFloat(a.fee).toFixed(0)}</span>
                        {!a.is_active && <Badge className="text-xs bg-gray-100 text-gray-400">已禁用</Badge>}
                      </div>
                      {a.description && <p className="text-xs text-gray-400">{a.description}</p>}
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => toggleAddon(a)}>{a.is_active ? "禁用" : "启用"}</Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-red-400" onClick={() => handleDeleteAddon(a.id)}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                ))}
              </div>

              {/* Shipping addons */}
              <div className="border-t pt-3">
                <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1.5">
                  <Badge className="text-xs bg-orange-100 text-orange-700">发货增值选项</Badge>
                  <span className="text-gray-400 font-normal">提交发货申请时展示</span>
                </p>
                {addons.filter(a => a.addon_type === "shipping").length === 0 && (
                  <p className="text-xs text-gray-400 py-1">暂无，在下方添加</p>
                )}
                {addons.filter(a => a.addon_type === "shipping").map(a => (
                  <div key={a.id} className={`flex items-center gap-3 p-2 rounded-lg border mb-1.5 ${a.is_active ? "border-gray-200" : "border-gray-100 opacity-50"}`}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-800">{a.name}</span>
                        <span className="text-sm text-red-600">+{a.fee_currency || "JPY"} {parseFloat(a.fee).toFixed(0)}</span>
                        {!a.is_active && <Badge className="text-xs bg-gray-100 text-gray-400">已禁用</Badge>}
                      </div>
                      {a.description && <p className="text-xs text-gray-400">{a.description}</p>}
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => toggleAddon(a)}>{a.is_active ? "禁用" : "启用"}</Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-red-400" onClick={() => handleDeleteAddon(a.id)}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                ))}
              </div>

              {/* Add new */}
              <div className="pt-2 border-t border-dashed border-gray-200 space-y-2">
                <p className="text-xs text-gray-500 font-medium">新增增值选项</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-gray-400">名称 *</Label>
                    <Input className="mt-0.5 h-8 text-sm" placeholder="例：质检拍照" value={newAddon.name} onChange={e => setNewAddon(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-400">说明</Label>
                    <Input className="mt-0.5 h-8 text-sm" placeholder="可选" value={newAddon.description} onChange={e => setNewAddon(p => ({ ...p, description: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-400">费用 *</Label>
                    <Input type="number" step="1" className="mt-0.5 h-8 text-sm" placeholder="500" value={newAddon.fee} onChange={e => setNewAddon(p => ({ ...p, fee: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-400">费用货币</Label>
                    <Select value={newAddon.fee_currency} onValueChange={v => setNewAddon(p => ({ ...p, fee_currency: v }))}>
                      <SelectTrigger className="mt-0.5 h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["JPY","CNY","USD","TWD","HKD","EUR","SGD"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs text-gray-400">增值类型</Label>
                    <div className="flex gap-3 mt-1">
                      {[{ v: "order", l: "下单增值选项" }, { v: "shipping", l: "发货增值选项" }].map(opt => (
                        <label key={opt.v} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer text-xs ${newAddon.addon_type === opt.v ? "border-red-300 bg-red-50 text-red-700" : "border-gray-200 text-gray-600"}`}>
                          <input type="radio" className="hidden" checked={newAddon.addon_type === opt.v} onChange={() => setNewAddon(p => ({ ...p, addon_type: opt.v }))} />
                          {opt.l}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={handleAddAddon} disabled={!newAddon.name || newAddon.fee === ""}>
                  <Plus className="w-3.5 h-3.5 mr-1" />添加
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Add new setting */}
          <Card className="border-dashed border-gray-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-500 flex items-center gap-2">
                <Plus className="w-4 h-4" />新增设置项
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-500">键名 (key)</Label>
                  <Input className="mt-0.5 h-8 text-sm" value={newKey} onChange={e => setNewKey(e.target.value)} placeholder="my_setting_key" />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">值 (value)</Label>
                  <Input className="mt-0.5 h-8 text-sm" value={newVal} onChange={e => setNewVal(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-500">说明</Label>
                  <Input className="mt-0.5 h-8 text-sm" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">分类</Label>
                  <Select value={newCat} onValueChange={setNewCat}>
                    <SelectTrigger className="mt-0.5 h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(CAT_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={handleAdd} disabled={!newKey || !newVal}>
                <Plus className="w-3.5 h-3.5 mr-1" />新增
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}