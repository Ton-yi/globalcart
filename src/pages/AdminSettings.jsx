import { useState, useEffect, useCallback } from "react";
import { timePage } from "@/lib/timing";
import { base44 } from "@/api/base44Client";
import { tenantEntity } from "@/lib/tenantApi";
import { setTenantConfigCache } from "@/lib/configCache";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Settings, Save, Plus, Trash2, Star, Lock, Eye, EyeOff, Palette, Zap, Users, ExternalLink, Bell, Mail, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import ThemeSelector from "@/components/common/ThemeSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

import ShippingMethodManager from "@/components/admin/ShippingMethodManager";
import OnlineStoreTagManager from "@/components/admin/OnlineStoreTagManager";
import TransitShippingMethodManager from "@/components/admin/TransitShippingMethodManager";
import ItemSizeTemplateManager from "@/components/admin/ItemSizeTemplateManager";
import BoxTemplateManager from "@/components/admin/BoxTemplateManager";
import AddonManager from "@/components/admin/AddonManager";
import MemberTierManager from "@/components/admin/MemberTierManager";
import CreditApplicationManager from "@/components/admin/CreditApplicationManager";
import PaymentMethodManager from "@/components/admin/PaymentMethodManager";
import TenantRoleManagerForUsers from "@/components/admin/TenantRoleManagerForUsers";
import PermissionViewer from "@/components/admin/PermissionViewer";
import CountrySettingsManager from "@/components/admin/CountrySettingsManager";
import GmailSettingsManager from "@/components/admin/GmailSettingsManager";
import SMTPSettingsManager from "@/components/admin/SMTPSettingsManager";
import GoogleSheetsSettingsManager from "@/components/admin/GoogleSheetsSettingsManager";
import StorageSettingsManager from "@/components/admin/StorageSettingsManager";
import PaymentModeSettings from "@/components/admin/PaymentModeSettings";
import OrderSplitSettings from "@/components/admin/OrderSplitSettings";
import ShipWithoutPaymentSettings from "@/components/admin/ShipWithoutPaymentSettings";

// Standalone editor with its own local save button (textarea content is large, better kept isolated)
function CustomsHazmatTextEditor({ settings, onReload }) {
  const s = settings.find(s => s.key === 'customs_hazmat_text');
  const [localVal, setLocalVal] = useState(s?.value || "");
  const [saving, setSaving] = useState(false);
  useEffect(() => { setLocalVal(s?.value || ""); }, [s?.value]);
  return (
    <Card className="border-orange-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-gray-700">危险物品确认文本（报关单）</CardTitle>
        <p className="text-xs text-gray-400 mt-1">用户通知发货时，报关单中会显示此内容并要求用户勾选同意。支持 Markdown 格式。留空则不显示。</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea rows={5} placeholder={"例：\n## 危险物品确认\n本次邮件中**不含**以下物品：\n- 锂电池、液体、粉末"}
          value={localVal} onChange={e => setLocalVal(e.target.value)} className="text-sm font-mono" />
        <Button size="sm" className="h-7 text-xs bg-orange-600 hover:bg-orange-700" disabled={saving}
          onClick={async () => {
            setSaving(true);
            if (s) {
              await tenantEntity.update('SiteSettings', s.id, { value: localVal });
            } else {
              await tenantEntity.create('SiteSettings', { key: 'customs_hazmat_text', value: localVal, description: '报关单危险物确认文本（Markdown）', category: 'general' });
            }
            await onReload();
            setSaving(false);
          }}>
          <Save className="w-3 h-3 mr-1" />{saving ? "保存中..." : "保存"}
        </Button>
      </CardContent>
    </Card>
  );
}

const DEFAULT_SETTINGS = [
  { key: "service_fee_rate", value: "10", description: "服务费率 (%)", category: "fee" },
  { key: "prepay_rate", value: "80", description: "预付款比率 (%)", category: "fee" },
  { key: "prepay_enabled", value: "true", description: "是否开启预付款", category: "fee" },
  { key: "jpy_usd_increment", value: "0", description: "日元/美元汇率增量 (基于实时汇率)", category: "fee" },
  { key: "jpy_cny_increment", value: "0", description: "日元/人民币汇率增量 (基于实时汇率)", category: "fee" },
  { key: "default_packing_fee_single", value: "0", description: "默认单独发货捆包作业手续费 (JPY)", category: "fee" },
  { key: "default_packing_fee_consolidation", value: "0", description: "默认拼邮发货捆包手续费 (JPY)", category: "fee" },
  { key: "transit_location_fee_split_enabled", value: "false", description: "中转地手续费是否平分", category: "fee" },
  { key: "allow_ship_without_payment", value: "false", description: "允许未付款时进入已发货状态（总开关）", category: "shipping" },
  { key: "allow_ship_without_payment_single", value: "false", description: "单独发货 - 允许未付款直接发货", category: "shipping" },
  { key: "allow_ship_without_payment_user_pool", value: "false", description: "用户拼邮发货 - 允许未付款直接发货", category: "shipping" },
  { key: "allow_ship_without_payment_official_pool", value: "false", description: "官方拼邮发货 - 允许未付款直接发货", category: "shipping" },
  { key: "fullpay_once_enabled", value: "false", description: "开启一次付款功能", category: "shipping" },
  { key: "fullpay_once_tolerance_jpy", value: "500", description: "一次付款运费误差容忍值（JPY）", category: "shipping" },
  { key: "site_name", value: "同一物流", description: "网站名称", category: "general" },
  { key: "contact_email", value: "", description: "联系邮箱", category: "general" },
  { key: "whatsapp", value: "", description: "WhatsApp", category: "general" },
  { key: "line_id", value: "", description: "Line ID", category: "general" },
  { key: "wechat_id", value: "", description: "微信号", category: "general" },
  { key: "paid_order_reminder", value: "感谢付款！我们会尽快开始处理您的订单。", description: "已付款订单的提示消息", category: "general" },
  { key: "alipay_account", value: "", description: "支付宝账号", category: "payment" },
  { key: "alipay_account_name", value: "", description: "支付宝收款人姓名", category: "payment" },
  { key: "alipay_qr_url", value: "", description: "支付宝收款码图片URL", category: "payment" },
  { key: "alipay_payment_note", value: "请在付款备注中填写您的订单号", description: "支付宝付款备注提示", category: "payment" },
];

const CAT_LABELS = { fee: "费率设置", payment: "支付设置", shipping: "运输设置", general: "基本信息" };
const CAT_COLORS = { fee: "bg-yellow-100 text-yellow-700", payment: "bg-green-100 text-green-700", shipping: "bg-blue-100 text-blue-700", general: "bg-gray-100 text-gray-600" };

const TABS = [
  { key: "general", label: "基本设置" },
  { key: "order_management", label: "订单管理" },
  { key: "fee_rules", label: "服务费规则" },
  { key: "payment_methods", label: "支付方式" },
  { key: "member_tiers", label: "会员阶级" },
  { key: "shipping_methods", label: "运输方式" },
  { key: "shipping_settings", label: "发货设置" },
  { key: "transit_methods", label: "中转运输" },
  { key: "item_sizes", label: "物品尺寸" },
  { key: "box_templates", label: "外箱模板" },
  { key: "store_tags", label: "商城标签规则" },
  { key: "countries", label: "国家设置" },
  { key: "storage", label: "库存存放" },
  { key: "notifications", label: "通知设置" },
  { key: "theme", label: "界面主题" },
  { key: "permissions", label: "权限一览" },
];

// Reusable toggle component (purely local state, no API call)
function Toggle({ enabled, onToggle, color = "bg-blue-600", size = "md" }) {
  const sizes = size === "sm"
    ? { outer: "h-5 w-9", inner: "h-3 w-3", on: "translate-x-5", off: "translate-x-1" }
    : { outer: "h-6 w-11", inner: "h-4 w-4", on: "translate-x-6", off: "translate-x-1" };
  return (
    <button type="button" onClick={onToggle}
      className={`relative inline-flex ${sizes.outer} items-center rounded-full transition-colors focus:outline-none ${enabled ? color : 'bg-gray-200'}`}>
      <span className={`inline-block ${sizes.inner} transform rounded-full bg-white transition-transform ${enabled ? sizes.on : sizes.off}`} />
    </button>
  );
}

export default function AdminSettings() {
  const { user } = useCurrentUser();
  const [activeTab, setActiveTab] = useState("general");
  const [settings, setSettings] = useState([]);
  const [addons, setAddons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [showPayment, setShowPayment] = useState(false);

  const [newAddon, setNewAddon] = useState({ name: "", description: "", fee: "", fee_currency: "JPY", addon_type: "order", is_user_customizable: false, min_fee: 0, max_fee: 0 });
  const [editingAddon, setEditingAddon] = useState(null);
  const [editAddonFields, setEditAddonFields] = useState({});
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
  const [memberTiers, setMemberTiers] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [countriesConfig, setCountriesConfig] = useState(null);
  const [countriesConfigId, setCountriesConfigId] = useState(null);

  const load = useCallback(async () => {
    const t = timePage('AdminSettings');
    setLoadError(null);
    try {
      const r = await t.timeCall('getAdminSettingsPageData', () => base44.functions.invoke('getAdminSettingsPageData', {}));
      const data = r.data || {};
      if (data.error) throw new Error(data.error);
      let settingsData = data.settings || [];

      // Only seed defaults if the backend explicitly returned an empty array AND we got a valid response
      // (not a silent error). Seed one by one to avoid duplicate key conflicts.
      if (settingsData.length === 0 && data.settings !== undefined) {
        const existingKeys = new Set(settingsData.map(s => s.key));
        const toCreate = DEFAULT_SETTINGS.filter(s => !existingKeys.has(s.key));
        if (toCreate.length > 0) {
          await Promise.all(toCreate.map(s => tenantEntity.create('SiteSettings', s)));
          const refreshed = await base44.functions.invoke('getAdminSettingsPageData', {});
          settingsData = refreshed.data?.settings || [];
        }
      }

      setSettings(settingsData);
      setAddons(data.addons || []);
      setShippingMethods(data.shippingMethods || []);
      setTransitMethods(data.transitMethods || []);
      setItemSizeTemplates(data.itemSizeTemplates || []);
      setStoreTagRules(data.storeTagRules || []);
      setBoxTemplates(data.boxTemplates || []);
      setMemberTiers(data.memberTiers || []);
      setPaymentMethods(data.paymentMethods || []);

      setCountriesConfig(data.countriesConfig || null);
      const ccRecord = (data.settings || []).find(s => s.key === 'tenant_countries_config');
      setCountriesConfigId(ccRecord?.id || null);

      if (data.announcements !== undefined) {
        setTenantConfigCache({
          announcements: data.announcements || [],
          shippingMethods: data.shippingMethods || [],
          transitMethods: data.transitMethods || [],
          transitLocations: [],
          itemSizeTemplates: data.itemSizeTemplates || [],
          storeTagRules: data.storeTagRules || [],
          addons: data.addons || [],
          countriesConfig: data.countriesConfig || null,
        });
      }
      t.done('data ready');
    } catch (err) {
      console.error('AdminSettings load error:', err);
      setLoadError(err.message || '加载失败');
    }
    setLoading(false);
  }, []);

  const isTenantAdmin = user?.role === "admin" || user?.role === "tenant_admin";
  const isPlatformAdmin = user?.role === "platform_admin";

  useEffect(() => { load(); }, [load]);

  if (user && !isTenantAdmin && !isPlatformAdmin) {
    return <div className="text-center py-8 text-red-600">仅管理员可访问此页面</div>;
  }

  // Update a setting value in local state only (no API call)
  const updateSetting = (id, value) => {
    setSettings(prev => prev.map(s => s.id === id ? { ...s, value } : s));
  };

  // Metadata lookup for creating missing settings when toggled
  const settingMeta = (key) => DEFAULT_SETTINGS.find(d => d.key === key);

  // Update (or locally create) a setting by key — for text settings that may not exist yet
  const updateSettingByKey = (key, value, description = '', category = 'general') => {
    setSettings(prev => {
      if (!prev.some(s => s.key === key)) {
        return [...prev, { key, value, description, category }];
      }
      return prev.map(s => s.key === key ? { ...s, value } : s);
    });
  };

  // Toggle a boolean setting in local state; if the record doesn't exist yet,
  // add it locally so it gets created on save (fixes silent no-op for missing keys)
  const toggleSetting = (key) => {
    setSettings(prev => {
      if (!prev.some(s => s.key === key)) {
        const meta = settingMeta(key);
        return [...prev, { key, value: 'true', description: meta?.description || '', category: meta?.category || 'general' }];
      }
      return prev.map(s => s.key !== key ? s : { ...s, value: s.value === 'true' ? 'false' : 'true' });
    });
  };

  // For boolean settings that default to 'true' when missing (value !== 'false')
  const toggleSettingDefaultTrue = (key) => {
    setSettings(prev => {
      if (!prev.some(s => s.key === key)) {
        // Missing means currently "true" — toggling creates it as "false"
        const meta = settingMeta(key);
        return [...prev, { key, value: 'false', description: meta?.description || '', category: meta?.category || 'general' }];
      }
      return prev.map(s => s.key !== key ? s : { ...s, value: s.value === 'false' ? 'true' : 'false' });
    });
  };

  // Save all settings to backend
  const handleSaveAll = async () => {
    setSaving(true);
    try {
      await Promise.all(
        settings.map(s =>
          s.id
            ? tenantEntity.update('SiteSettings', s.id, { value: s.value, description: s.description })
            : tenantEntity.create('SiteSettings', { key: s.key, value: s.value, description: s.description || '', category: s.category || 'general' })
        )
      );
      // Reload so newly created settings get ids (prevents duplicate creation on next save)
      if (settings.some(s => !s.id)) await load();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
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
    await tenantEntity.create('AddonOption', {
      ...newAddon,
      fee: parseFloat(newAddon.fee) || 0,
      min_fee: parseFloat(newAddon.min_fee) || 0,
      max_fee: parseFloat(newAddon.max_fee) || 0,
      is_user_customizable: newAddon.is_user_customizable || false,
      is_active: true
    });
    setNewAddon({ name: "", description: "", fee: "", fee_currency: "JPY", addon_type: "order", is_user_customizable: false, min_fee: 0, max_fee: 0 });
    await load();
  };

  const handleDeleteAddon = async (id) => {
    await tenantEntity.delete('AddonOption', id);
    await load();
  };

  const handleEditAddon = (a) => {
    setEditingAddon(a.id);
    setEditAddonFields({
      name: a.name, description: a.description || "", fee: String(a.fee),
      fee_currency: a.fee_currency || "JPY", addon_type: a.addon_type || "order",
      is_user_customizable: a.is_user_customizable || false,
      min_fee: a.min_fee || 0, max_fee: a.max_fee || 0
    });
  };

  const handleSaveAddon = async (id) => {
    await tenantEntity.update('AddonOption', id, {
      ...editAddonFields,
      fee: parseFloat(editAddonFields.fee) || 0,
      min_fee: parseFloat(editAddonFields.min_fee) || 0,
      max_fee: parseFloat(editAddonFields.max_fee) || 0
    });
    setEditingAddon(null);
    await load();
  };

  const toggleAddon = async (a) => {
    await tenantEntity.update('AddonOption', a.id, { is_active: !a.is_active });
    await load();
  };

  // Instant-save for credit_application_enabled (lives outside the main save flow)
  const handleCreditApplicationToggle = async (setting) => {
    const newVal = setting?.value === 'true' ? 'false' : 'true';
    if (setting) {
      await tenantEntity.update('SiteSettings', setting.id, { value: newVal });
    } else {
      await tenantEntity.create('SiteSettings', { key: 'credit_application_enabled', value: newVal, description: '允许用户申请记账功能', category: 'general' });
    }
    await load();
  };

  // Instant-save for public_profile_count_self_views
  const handleSelfViewCountToggle = async (s) => {
    const newVal = s?.value === 'true' ? 'false' : 'true';
    if (s) {
      await tenantEntity.update('SiteSettings', s.id, { value: newVal });
    } else {
      await tenantEntity.create('SiteSettings', { key: 'public_profile_count_self_views', value: newVal, description: '本人访问自己的公开资料页是否计入展示次数', category: 'general' });
    }
    await load();
  };

  // Instant-save for allow_user_customs_declaration
  const handleCustomsDeclarationToggle = async (s) => {
    const newVal = s?.value === 'true' ? 'false' : 'true';
    if (s) {
      await tenantEntity.update('SiteSettings', s.id, { value: newVal });
    } else {
      await tenantEntity.create('SiteSettings', { key: 'allow_user_customs_declaration', value: newVal, description: '允许用户自行填写报关单', category: 'shipping' });
    }
    await load();
  };

  const flat = settings; // flat alias for clarity
  const getSetting = (key) => flat.find(s => s.key === key);
  const getVal = (key) => getSetting(key)?.value;
  const getBool = (key) => getVal(key) === 'true';
  const getBoolDefaultTrue = (key) => getVal(key) !== 'false';

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
      <div className="w-full border-b border-gray-200">
        <div className="flex gap-1">
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex-1 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${activeTab === tab.key ? "border-red-600 text-red-600" : "border-transparent text-gray-500 hover:text-gray-800"}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "order_management" && !loading && (
        <OrderSplitSettings settings={settings} onReload={load} />
      )}
      {activeTab === "order_management" && loading && <p className="text-gray-400 text-sm">加载中...</p>}

      {activeTab === "fee_rules" && (
        <div className="space-y-4">
          {/* 兜底服务费设置（轻量用户简单配置） */}
          <Card className="border-gray-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-gray-700">默认服务费设置</CardTitle>
                <Button size="sm" className="h-7 text-xs bg-gray-800 hover:bg-gray-700" onClick={handleSaveAll} disabled={saving}>
                  <Save className="w-3 h-3 mr-1" />{saved ? "已保存 ✓" : saving ? "保存中..." : "保存"}
                </Button>
              </div>
              <p className="text-xs text-gray-400 mt-1">作为兜底规则：当订单未命中任何服务费规则时使用此处设置。也适合不需要复杂规则的轻量场景。</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {(() => {
                const rateSetting = getSetting('service_fee_rate');
                const fixedSetting = getSetting('default_order_fixed_fee_jpy');
                return (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-gray-500 block mb-1">下单服务费率（%）</Label>
                      <div className="flex items-center gap-1">
                        <Input type="number" step="0.1" min="0" className="h-8 text-sm flex-1"
                          value={rateSetting?.value || '10'}
                          onChange={e => updateSetting(rateSetting?.id, e.target.value)} />
                        <span className="text-xs text-gray-400 px-2">%</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">基于商品货款金额的百分比</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500 block mb-1">下单固定手续费（JPY）</Label>
                      <div className="flex items-center gap-1">
                        <Input type="number" step="1" min="0" className="h-8 text-sm flex-1"
                          value={fixedSetting?.value || '0'}
                          onChange={e => updateSettingByKey('default_order_fixed_fee_jpy', e.target.value, '下单固定手续费（JPY）', 'fee')} />
                        <span className="text-xs text-gray-400 px-2">JPY</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">每笔订单额外收取的固定费用</p>
                    </div>
                  </div>
                );
              })()}
              <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-xs text-gray-500">
                最终服务费 = 货款 × 费率% + 固定手续费，再应用最低/封顶限制（如在规则中心配置）
              </div>
            </CardContent>
          </Card>

          {/* 高级规则引擎 */}
          <Card className="border-yellow-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-500" />服务费规则引擎（高级）
              </CardTitle>
              <p className="text-xs text-gray-400 mt-1">支持按客户等级、下单网站、金额阶梯及自定义公式设置差异化服务费，优先级高于上方默认设置。</p>
            </CardHeader>
            <CardContent>
              <Link to={createPageUrl("AdminFeeRules")}>
                <Button className="bg-yellow-600 hover:bg-yellow-700 w-full sm:w-auto">
                  <ExternalLink className="w-4 h-4 mr-2" />进入服务费规则中心
                </Button>
              </Link>
              <p className="text-xs text-gray-400 mt-3">在规则中心可以创建多条规则、设置生效时间和优先级、使用高级公式，并在保存前进行实时测试预览。</p>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "payment_methods" && (
        <div className="space-y-4">
          {!loading && <PaymentModeSettings settings={settings} onReload={load} />}
          <Card className="border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-700">支付方式管理</CardTitle>
              <p className="text-xs text-gray-400 mt-1">支付宝自动支付的密钥可在添加后点击「密钥」按钮配置。</p>
            </CardHeader>
            <CardContent>
              <PaymentMethodManager onReload={load} />
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "member_tiers" && (
        <div className="space-y-4">
          <Card className="border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-700">会员阶级管理</CardTitle>
              <p className="text-xs text-gray-400 mt-1">设置会员阶级，为不同等级用户配置记账功能和结帐规则。</p>
            </CardHeader>
            <CardContent>
              <MemberTierManager initialData={memberTiers} onReload={load} />
            </CardContent>
          </Card>

          <Card className="border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-700">记账申请设置</CardTitle>
              <p className="text-xs text-gray-400 mt-1">开启后，没有记账权限的普通用户可在个人设置中申请开启记账功能。</p>
            </CardHeader>
            <CardContent>
              {(() => {
                const setting = getSetting('credit_application_enabled');
                return (
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">允许用户申请记账功能</Label>
                      <p className="text-xs text-gray-400 mt-0.5">开启后用户可在个人设置中提交记账申请</p>
                    </div>
                    <Toggle enabled={setting?.value === 'true'} onToggle={() => handleCreditApplicationToggle(setting)} color="bg-blue-600" />
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          <CreditApplicationManager />
        </div>
      )}

      {activeTab === "shipping_methods" && (
        <Card className="border-gray-200">
          <CardContent className="pt-5">
            <ShippingMethodManager initialData={shippingMethods} itemSizeTemplates={itemSizeTemplates || []} />
          </CardContent>
        </Card>
      )}

      {activeTab === "shipping_settings" && !loading && (
        <ShipWithoutPaymentSettings settings={settings} onReload={load} />
      )}

      {activeTab === "transit_methods" && (
        <div className="space-y-4">
          <Card className="border-blue-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-gray-700">中转地手续费平分</CardTitle>
                <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700" onClick={handleSaveAll} disabled={saving}>
                  <Save className="w-3 h-3 mr-1" />{saved ? "已保存 ✓" : saving ? "保存中..." : "保存"}
                </Button>
              </div>
              <p className="text-xs text-gray-400 mt-1">控制中转地手续费的计算方式</p>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">中转地手续费平分</Label>
                  <p className="text-xs text-gray-400 mt-0.5">开启后，中转地的手续费将按重量比例平摊给参与拼邮的所有客户；关闭则每个客户单独计算一次中转地手续费</p>
                </div>
                <Toggle enabled={getBool('transit_location_fee_split_enabled')} onToggle={() => toggleSetting('transit_location_fee_split_enabled')} color="bg-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-gray-200">
            <CardContent className="pt-5">
              <TransitShippingMethodManager initialData={transitMethods} />
            </CardContent>
          </Card>
        </div>
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
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700">外箱模板管理</CardTitle>
            <p className="text-xs text-gray-400 mt-1">管理员填写发货信息时可选取外箱，外箱自重和费用将计入发货记录。</p>
          </CardHeader>
          <CardContent>
            <BoxTemplateManager initialData={boxTemplates || []} onReload={load} />
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

      {activeTab === "countries" && (
        <Card className="border-gray-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700">国家·地区设置</CardTitle>
            <p className="text-xs text-gray-400 mt-1">控制哪些国家·地区出现在收货地址选框中，并设置显示顺序。置顶的国家在所有下拉框中优先显示。</p>
          </CardHeader>
          <CardContent>
            <CountrySettingsManager initialConfig={countriesConfig} settingId={countriesConfigId} onReload={load} />
          </CardContent>
        </Card>
      )}

      {activeTab === "storage" && (
        <div className="space-y-4">
          <StorageSettingsManager onReload={load} />
          
          <Card className="border-blue-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-700">
                功能说明
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-gray-600">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5" />
                <div>
                  <strong>模块化功能：</strong>
                  <p className="text-gray-500 text-xs mt-0.5">
                    管理员可选择开启或关闭库存管理功能。关闭后，相关设置和功能不再显示，不影响其他功能正常使用。
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5" />
                <div>
                  <strong>存放期限：</strong>
                  <p className="text-gray-500 text-xs mt-0.5">
                    从订单入库日开始计算，管理员可设置默认存放天数（默认 90 天）。
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5" />
                <div>
                  <strong>到期行为：</strong>
                  <p className="text-gray-500 text-xs mt-0.5">
                    管理员可设置到期后自动执行的操作：发送提醒、追加仓储费用、更新订单状态为「已超时」。
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5" />
                <div>
                  <strong>仓储管理费：</strong>
                  <p className="text-gray-500 text-xs mt-0.5">
                    可设置每日仓储费用，支持按外箱模板单独设置（优先级高于默认设置）。费用累计至运费结算时一并收取。
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5" />
                <div>
                  <strong>通知模板：</strong>
                  <p className="text-gray-500 text-xs mt-0.5">
                    系统自动创建 3 个通知模板：即将到期通知、已到期通知、需要支付逾期费用通知。可在通知模板管理中自定义内容。
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5" />
                <div>
                  <strong>自动化检查：</strong>
                  <p className="text-gray-500 text-xs mt-0.5">
                    系统每日自动检查超期订单，执行管理员设置的操作（提醒、收费、变更状态）。
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "general" && isTenantAdmin && user?.tenant_id && (
        <Card className="border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500" />租户内角色管理
            </CardTitle>
            <p className="text-xs text-gray-400 mt-1">为当前租户创建和管理角色，分配相应权限给用户</p>
          </CardHeader>
          <CardContent>
            <TenantRoleManagerForUsers tenantId={user.tenant_id} tenantName={user.tenant_name || ""} />
          </CardContent>
        </Card>
      )}

      {activeTab === "permissions" && (
        <Card className="border-gray-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700">权限一览</CardTitle>
            <p className="text-xs text-gray-400 mt-1">系统支持的所有权限项，可用于角色配置与用户权限覆写。</p>
          </CardHeader>
          <CardContent><PermissionViewer /></CardContent>
        </Card>
      )}

      {activeTab === "notifications" && (
        <div className="space-y-4">
          <Card className="border-blue-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Bell className="w-4 h-4 text-blue-500" />通知模板管理
              </CardTitle>
              <p className="text-xs text-gray-400 mt-1">管理当前租户的通知模板，包括标题、内容模板和默认发送方式</p>
            </CardHeader>
            <CardContent>
              <Link to={createPageUrl("AdminNotificationTemplates")}>
                <Button className="bg-blue-600 hover:bg-blue-700 w-full">
                  <ExternalLink className="w-4 h-4 mr-2" />进入通知模板管理
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="border-green-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Settings className="w-4 h-4 text-green-500" />通知默认设置
              </CardTitle>
              <p className="text-xs text-gray-400 mt-1">设置新用户的默认通知偏好，包括站内通知和邮件通知的开关</p>
            </CardHeader>
            <CardContent>
              <Link to={createPageUrl("AdminNotificationDefaults")}>
                <Button className="bg-green-600 hover:bg-green-700 w-full">
                  <ExternalLink className="w-4 h-4 mr-2" />进入默认设置管理
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="border-purple-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Mail className="w-4 h-4 text-purple-500" />Gmail 邮箱设置
              </CardTitle>
              <p className="text-xs text-gray-400 mt-1">配置租户 Gmail 邮箱，用于发送通知邮件</p>
            </CardHeader>
            <CardContent>
              <GmailSettingsManager />
            </CardContent>
          </Card>

          <GoogleSheetsSettingsManager onReload={load} />

          <Card className="border-cyan-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Mail className="w-4 h-4 text-cyan-500" />SMTP 邮箱设置
              </CardTitle>
              <p className="text-xs text-gray-400 mt-1">配置自定义 SMTP 服务器发送通知邮件，支持所有主流邮箱服务商</p>
            </CardHeader>
            <CardContent>
              <SMTPSettingsManager />
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
          <CardContent><ThemeSelector /></CardContent>
        </Card>
      )}

      {activeTab === "general" && loading && <p className="text-gray-400 text-sm">加载中...</p>}
      {activeTab === "general" && !loading && loadError && (
        <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded p-3">{loadError}</div>
      )}

      {activeTab === "general" && !loading && (
        <>
          {/* ─── Fee Rate Settings ─── */}
          <Card className="border-yellow-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  <Badge className="text-xs bg-yellow-100 text-yellow-700">费率设置</Badge>
                </CardTitle>
                <Button size="sm" className="h-7 text-xs bg-yellow-600 hover:bg-yellow-700" onClick={handleSaveAll} disabled={saving}>
                  <Save className="w-3 h-3 mr-1" />{saved ? "已保存 ✓" : saving ? "保存中..." : "保存"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* 预付款/后付款设置已移至「支付方式」tab 的付款模式设置区块 */}

              {/* 允许未付款发货设置已移至「发货设置」tab */}

              {/* 拆单设置已移至「订单管理」tab 的拆单区块 */}

              {/* Packing fees and other numeric fee settings (excluding service_fee_rate which is now in fee_rules tab) */}
              <div className="grid grid-cols-2 gap-3">
                {(grouped.fee || [])
                  .filter(s => !s.key.includes("increment")
                    && !['service_fee_rate', 'default_order_fixed_fee_jpy', 'default_rewarehouse_fee_jpy', 'prepay_enabled', 'prepay_rate', 'pre_shipment_balance_surcharge_rate', 'deferred_payment_enabled', 'deferred_payment_surcharge_rate', 'transit_location_fee_split_enabled'].includes(s.key))
                  .map(s => (
                    <div key={s.id || s.key}>
                      <Label className="text-xs text-gray-500 block mb-1">{s.description || s.key}</Label>
                      <div className="flex items-center gap-1">
                        <Input type="number" step="0.1" className="h-8 text-sm flex-1" value={s.value}
                          onChange={e => updateSetting(s.id, e.target.value)} />
                        <span className="text-xs text-gray-400 px-2">JPY</span>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>

          {/* ─── Other Settings (general / shipping / payment) ─── */}
          {/* shipping category keys managed by dedicated settings components are excluded here */}
          {(() => {
            const EXCLUDED_SHIPPING_KEYS = new Set([
              'allow_ship_without_payment', 'allow_ship_without_payment_single',
              'allow_ship_without_payment_user_pool', 'allow_ship_without_payment_official_pool',
              'pre_shipment_enabled', 'fullpay_once_enabled', 'fullpay_once_tolerance_jpy',
              'allow_user_pool_edit_instant',
              'allow_user_rewarehouse_from_fee_pending', 'default_rewarehouse_fee_jpy',
            ]);
            const filteredGrouped = Object.fromEntries(
              Object.entries(grouped)
                .filter(([cat]) => cat !== "fee")
                .map(([cat, items]) => [cat, cat === 'shipping' ? items.filter(s => !EXCLUDED_SHIPPING_KEYS.has(s.key)) : items])
                .filter(([, items]) => items.length > 0)
            );
            return Object.entries(filteredGrouped).map(([cat, items]) => {
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
                      <div key={s.id} className="flex items-center gap-3">
                        <div className="flex-1">
                          <Label className="text-xs text-gray-500">{s.description || s.key}</Label>
                          <Input className="mt-0.5 h-8 text-sm" value={s.value}
                            onChange={e => updateSetting(s.id, e.target.value)} />
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
            });
          })()}

          {/* ─── Customs Declaration Toggle (instant-save, separate card) ─── */}
          {(() => {
            const s = getSetting('allow_user_customs_declaration');
            return (
              <Card className="border-orange-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-gray-700">报关单设置</CardTitle>
                  <p className="text-xs text-gray-400 mt-1">配置用户是否可自行填写报关单信息。</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between pb-1 border-b border-gray-100">
                    <div>
                      <Label className="text-sm">允许用户自行填写报关单</Label>
                      <p className="text-xs text-gray-400 mt-0.5">开启后，用户在通知发货时可选择填写报关单信息；关闭后，仅管理员可填写</p>
                    </div>
                    <Toggle enabled={s?.value === 'true'} onToggle={() => handleCustomsDeclarationToggle(s)} color="bg-orange-600" />
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* ─── Customs Hazmat Text ─── */}
          <CustomsHazmatTextEditor settings={flat} onReload={load} />

          {/* ─── Public Profile Settings ─── */}
          {(() => {
            const s = getSetting('public_profile_count_self_views');
            return (
              <Card className="border-indigo-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-gray-700">公开资料页设置</CardTitle>
                  <p className="text-xs text-gray-400 mt-1">配置用户公开资料页的展示次数统计规则。</p>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">本人访问计入展示次数</Label>
                      <p className="text-xs text-gray-400 mt-0.5">开启后，用户访问自己的公开资料页也计入展示次数（默认不计入；管理员访问始终不计入）</p>
                    </div>
                    <Toggle enabled={s?.value === 'true'} onToggle={() => handleSelfViewCountToggle(s)} color="bg-indigo-600" />
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* ─── Addon Options ─── */}
          <Card className="border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-500" />增值服务设置
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AddonManager
                addons={addons} editingAddon={editingAddon} editAddonFields={editAddonFields}
                newAddon={newAddon} setEditAddonFields={setEditAddonFields} setNewAddon={setNewAddon}
                onEdit={handleEditAddon} onCancelEdit={() => setEditingAddon(null)}
                onSave={handleSaveAddon} onToggle={toggleAddon} onDelete={handleDeleteAddon} onAdd={handleAddAddon}
              />
            </CardContent>
          </Card>

          {/* ─── Add New Setting ─── */}
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