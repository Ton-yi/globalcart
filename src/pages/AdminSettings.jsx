import { useState, useEffect } from "react";
import { timePage } from "@/lib/timing";
import { base44 } from "@/api/base44Client";
import { tenantEntity } from "@/lib/tenantApi";
import { setTenantConfigCache } from "@/lib/configCache";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Settings, Save, Plus, Trash2, Star, Lock, Eye, EyeOff, Truck, Palette, TrendingUp, Zap, Building2, Users, CheckCircle2, ExternalLink } from "lucide-react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import OfficialPoolPreShipmentSettings from "@/components/admin/OfficialPoolPreShipmentSettings";

function CustomsHazmatTextEditor({ settings, onReload }) {
  const s = settings.find(s => s.key === 'customs_hazmat_text');
  const [localVal, setLocalVal] = useState(s?.value || "");
  const [saving, setSaving] = useState(false);

  // Sync when parent settings reload
  useEffect(() => { setLocalVal(s?.value || ""); }, [s?.value]);

  return (
    <Card className="border-orange-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-gray-700">危险物品确认文本（报关单）</CardTitle>
        <p className="text-xs text-gray-400 mt-1">
          用户通知发货时，报关单中会显示此内容并要求用户勾选同意。支持 Markdown 格式。留空则不显示危险物确认项。
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          rows={5}
          placeholder={"例：\n## 危险物品确认\n本次邮件中**不含**以下物品：\n- 锂电池、液体、粉末\n- 刀具等管制物品"}
          value={localVal}
          onChange={e => setLocalVal(e.target.value)}
          className="text-sm font-mono"
        />
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
  { key: "transit_location_fee_split_enabled", value: "false", description: "中转地手续费是否平分（开启=平分给拼邮客户，关闭=每人单独计算）", category: "fee" },
  { key: "allow_ship_without_payment", value: "false", description: "允许未付款时进入已发货状态（总开关）", category: "shipping" },
  { key: "allow_ship_without_payment_single", value: "false", description: "单独发货 - 允许未付款直接发货", category: "shipping" },
  { key: "allow_ship_without_payment_user_pool", value: "false", description: "用户拼邮发货 - 允许未付款直接发货", category: "shipping" },
  { key: "allow_ship_without_payment_official_pool", value: "false", description: "官方拼邮发货 - 允许未付款直接发货", category: "shipping" },
  { key: "official_pool_auto_create_pending", value: "true", description: "预出货选择官方拼邮时自动创建预拼邮列", category: "shipping" },
  { key: "official_pool_merge_same_user", value: "true", description: "自动合并同用户同预出货状态的订单", category: "shipping" },
  { key: "official_pool_separate_columns", value: "false", description: "分离多个预发货订单列", category: "shipping" },
  { key: "official_pool_separate_methods", value: "", description: "单独成列的运输方式（逗号分隔，留空=全分离）", category: "shipping" },
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

// 支付相关设置键名，仅超级管理员可见
const PAYMENT_RESTRICTED_KEYS = ["alipay_account", "alipay_account_name", "alipay_qr_url", "alipay_payment_note"];

const CAT_LABELS = { fee: "费率设置", payment: "支付设置", shipping: "运输设置", general: "基本信息" };
const CAT_COLORS = { fee: "bg-yellow-100 text-yellow-700", payment: "bg-green-100 text-green-700", shipping: "bg-blue-100 text-blue-700", general: "bg-gray-100 text-gray-600" };

const TABS = [
  { key: "general", label: "基本设置" },
  { key: "fee_rules", label: "服务费规则" },
  { key: "payment_methods", label: "支付方式" },
  { key: "member_tiers", label: "会员阶级" },
  { key: "shipping_methods", label: "运输方式" },
  { key: "transit_methods", label: "中转运输方式" },
  { key: "item_sizes", label: "物品尺寸" },
  { key: "box_templates", label: "外箱模板" },
  { key: "store_tags", label: "商城标签规则" },
  { key: "countries", label: "国家设置" },
  { key: "theme", label: "界面主题" },
  { key: "permissions", label: "权限一览" },
];

export default function AdminSettings() {
  const { user } = useCurrentUser();
  const [activeTab, setActiveTab] = useState("general");
  const [settings, setSettings] = useState([]);
  const [addons, setAddons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPayment, setShowPayment] = useState(false);
  const [liveRates, setLiveRates] = useState(null);
  const [newAddon, setNewAddon] = useState({ name: "", description: "", fee: "", fee_currency: "JPY", addon_type: "order", is_user_customizable: false, min_fee: 0, max_fee: 0 });
  const [editingAddon, setEditingAddon] = useState(null); // id of addon being edited
  const [editAddonFields, setEditAddonFields] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newVal, setNewVal] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCat, setNewCat] = useState("general");
  const [rewarehouseFeeInput, setRewarehouseFeeInput] = useState("");

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
      setMemberTiers(data.memberTiers || []);
      setPaymentMethods(data.paymentMethods || []);
      if (data.rates) setLiveRates(data.rates);
      setCountriesConfig(data.countriesConfig || null);
      // Find the SiteSettings record ID for the countries config
      const ccRecord = (data.settings || []).find(s => s.key === 'tenant_countries_config');
      setCountriesConfigId(ccRecord?.id || null);

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
          countriesConfig: data.countriesConfig || null,
        });
      }

      t.done('data ready');
    } catch (_) {
      // Degraded mode: no tenant assigned yet
    }
    setLoading(false);
  };

  const isTenantAdmin = user?.roles?.includes("tenant_admin");
  const isPlatformAdmin = user?.roles?.includes("platform_admin");

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (user && !isTenantAdmin && !isPlatformAdmin) {
    return <div className="text-center py-8 text-red-600">仅管理员可访问此页面</div>;
  }

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
      name: a.name, 
      description: a.description || "", 
      fee: String(a.fee), 
      fee_currency: a.fee_currency || "JPY", 
      addon_type: a.addon_type || "order",
      is_user_customizable: a.is_user_customizable || false,
      min_fee: a.min_fee || 0,
      max_fee: a.max_fee || 0
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

      {activeTab === "fee_rules" && (
        <Card className="border-yellow-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-500" />服务费规则引擎
            </CardTitle>
            <p className="text-xs text-gray-400 mt-1">
              设置灵活的服务费计算规则，支持固定比例、阶梯费率和高级公式。规则修改不影响历史订单。
            </p>
          </CardHeader>
          <CardContent>
            <Link to={createPageUrl("AdminFeeRules")}>
              <Button className="bg-yellow-600 hover:bg-yellow-700 w-full sm:w-auto">
                <ExternalLink className="w-4 h-4 mr-2" />进入服务费规则中心
              </Button>
            </Link>
            <p className="text-xs text-gray-400 mt-3">
              在规则中心可以创建多条规则、设置生效时间和优先级、使用高级公式（含沙箱安全计算），并在保存前进行实时测试预览。
            </p>
          </CardContent>
        </Card>
      )}

      {activeTab === "payment_methods" && (
        <Card className="border-gray-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700">支付方式管理</CardTitle>
            <p className="text-xs text-gray-400 mt-1">支付宝自动支付的密钥可在添加后点击「密钥」按钮配置。</p>
          </CardHeader>
          <CardContent>
            <PaymentMethodManager onReload={load} />
          </CardContent>
        </Card>
      )}

      {activeTab === "member_tiers" && (
        <div className="space-y-4">
          <Card className="border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                会员阶级管理
              </CardTitle>
              <p className="text-xs text-gray-400 mt-1">设置会员阶级，为不同等级用户配置记账功能和结帐规则。</p>
            </CardHeader>
            <CardContent>
              <MemberTierManager initialData={memberTiers} onReload={load} />
            </CardContent>
          </Card>

          {/* Credit application enable toggle */}
          <Card className="border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-700">记账申请设置</CardTitle>
              <p className="text-xs text-gray-400 mt-1">开启后，没有记账权限的普通用户可在个人设置中申请开启记账功能。</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {(() => {
                const setting = settings.find(s => s.key === 'credit_application_enabled');
                return (
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">允许用户申请记账功能</Label>
                      <p className="text-xs text-gray-400 mt-0.5">开启后用户可在个人设置中提交记账申请</p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        const newVal = setting?.value === 'true' ? 'false' : 'true';
                        if (setting) {
                          await tenantEntity.update('SiteSettings', setting.id, { value: newVal });
                        } else {
                          await tenantEntity.create('SiteSettings', {
                            key: 'credit_application_enabled',
                            value: newVal,
                            description: '允许用户申请记账功能',
                            category: 'general'
                          });
                        }
                        await load();
                      }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${setting?.value === 'true' ? 'bg-blue-600' : 'bg-gray-200'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${setting?.value === 'true' ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Pending credit applications */}
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
            <p className="text-xs text-gray-400 mt-1">
              控制哪些国家·地区出现在收货地址选框中，并设置显示顺序。置顶的国家在所有下拉框中优先显示。
            </p>
          </CardHeader>
          <CardContent>
            <CountrySettingsManager
              initialConfig={countriesConfig}
              settingId={countriesConfigId}
              onReload={load}
            />
          </CardContent>
        </Card>
      )}

          {/* Tenant Roles Management */}
          {isTenantAdmin && user?.tenant_id && (
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
          <CardContent>
            <PermissionViewer />
          </CardContent>
        </Card>
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
          {true && (
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
                {/* Prepay enabled toggle */}
                {(() => {
                  const s = grouped.fee?.find(s => s.key === 'prepay_enabled');
                  const enabled = s ? s.value !== 'false' : true;
                  return (
                    <div className="flex items-center justify-between pb-1 border-b border-gray-100">
                      <div>
                        <Label className="text-sm">开启预付款</Label>
                        <p className="text-xs text-gray-400 mt-0.5">关闭后，用户提交订单时不再显示预付款选项</p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          const newVal = enabled ? 'false' : 'true';
                          if (s) {
                            updateSetting(s.id, 'value', newVal);
                            await tenantEntity.update('SiteSettings', s.id, { value: newVal });
                          } else {
                            // Create the setting record
                            await tenantEntity.create('SiteSettings', { key: 'prepay_enabled', value: newVal, category: 'fee', description: '是否开启预付款' });
                            await load();
                          }
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${enabled ? 'bg-yellow-500' : 'bg-gray-200'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  );
                })()}
                {/* Allow shipped without payment */}
                {(() => {
                  const allSettings = Object.values(grouped).flat();
                  const s = allSettings.find(s => s.key === 'allow_ship_without_payment');
                  const enabled = s?.value === 'true';
                  return (
                    <>
                      <div className="flex items-center justify-between pb-1 border-b border-gray-100">
                        <div>
                          <Label className="text-sm">允许未付款时进入已发货状态</Label>
                          <p className="text-xs text-gray-400 mt-0.5">开启后，管理员可在用户未付款或未全员付款的情况下，直接将发货申请进入已发货状态</p>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            const newVal = enabled ? 'false' : 'true';
                            if (s) {
                              updateSetting(s.id, 'value', newVal);
                              await tenantEntity.update('SiteSettings', s.id, { value: newVal });
                            } else {
                              await tenantEntity.create('SiteSettings', { key: 'allow_ship_without_payment', value: newVal, category: 'shipping', description: '允许未付款时进入已发货状态' });
                              await load();
                            }
                          }}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${enabled ? 'bg-blue-600' : 'bg-gray-200'}`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                      </div>
                      {/* Sub-toggles for each shipment type */}
                      {enabled && (
                        <div className="pl-4 space-y-2 pb-2 border-b border-gray-100">
                          {(() => {
                            const sSingle = allSettings.find(s => s.key === 'allow_ship_without_payment_single');
                            const enabledSingle = sSingle?.value === 'true';
                            return (
                              <div className="flex items-center justify-between">
                                <div>
                                  <Label className="text-xs text-gray-600">单独发货</Label>
                                  <p className="text-xs text-gray-400 mt-0.5">允许单独发货未付款直接发货</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const newVal = enabledSingle ? 'false' : 'true';
                                    if (sSingle) {
                                      updateSetting(sSingle.id, 'value', newVal);
                                      await tenantEntity.update('SiteSettings', sSingle.id, { value: newVal });
                                    } else {
                                      await tenantEntity.create('SiteSettings', { key: 'allow_ship_without_payment_single', value: newVal, category: 'shipping', description: '单独发货 - 允许未付款直接发货' });
                                      await load();
                                    }
                                  }}
                                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${enabledSingle ? 'bg-blue-600' : 'bg-gray-200'}`}
                                >
                                  <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${enabledSingle ? 'translate-x-4' : 'translate-x-1'}`} />
                                </button>
                              </div>
                            );
                          })()}
                          {(() => {
                            const sUserPool = allSettings.find(s => s.key === 'allow_ship_without_payment_user_pool');
                            const enabledUserPool = sUserPool?.value === 'true';
                            return (
                              <div className="flex items-center justify-between">
                                <div>
                                  <Label className="text-xs text-gray-600">用户拼邮发货</Label>
                                  <p className="text-xs text-gray-400 mt-0.5">允许用户拼邮未付款直接发货</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const newVal = enabledUserPool ? 'false' : 'true';
                                    if (sUserPool) {
                                      updateSetting(sUserPool.id, 'value', newVal);
                                      await tenantEntity.update('SiteSettings', sUserPool.id, { value: newVal });
                                    } else {
                                      await tenantEntity.create('SiteSettings', { key: 'allow_ship_without_payment_user_pool', value: newVal, category: 'shipping', description: '用户拼邮发货 - 允许未付款直接发货' });
                                      await load();
                                    }
                                  }}
                                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${enabledUserPool ? 'bg-blue-600' : 'bg-gray-200'}`}
                                >
                                  <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${enabledUserPool ? 'translate-x-4' : 'translate-x-1'}`} />
                                </button>
                              </div>
                            );
                          })()}
                          {(() => {
                            const sOfficialPool = allSettings.find(s => s.key === 'allow_ship_without_payment_official_pool');
                            const enabledOfficialPool = sOfficialPool?.value === 'true';
                            return (
                              <div className="flex items-center justify-between">
                                <div>
                                  <Label className="text-xs text-gray-600">官方拼邮发货</Label>
                                  <p className="text-xs text-gray-400 mt-0.5">允许官方拼邮未付款直接发货</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const newVal = enabledOfficialPool ? 'false' : 'true';
                                    if (sOfficialPool) {
                                      updateSetting(sOfficialPool.id, 'value', newVal);
                                      await tenantEntity.update('SiteSettings', sOfficialPool.id, { value: newVal });
                                    } else {
                                      await tenantEntity.create('SiteSettings', { key: 'allow_ship_without_payment_official_pool', value: newVal, category: 'shipping', description: '官方拼邮发货 - 允许未付款直接发货' });
                                      await load();
                                    }
                                  }}
                                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${enabledOfficialPool ? 'bg-blue-600' : 'bg-gray-200'}`}
                                >
                                  <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${enabledOfficialPool ? 'translate-x-4' : 'translate-x-1'}`} />
                                </button>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </>
                  );
                })()}

                {/* Allow order split toggle */}
                {(() => {
                  const allSettings = Object.values(grouped).flat();
                  const s = allSettings.find(s => s.key === 'allow_order_split');
                  const enabled = s?.value === 'true';
                  return (
                    <div className="flex items-center justify-between pb-1 border-b border-gray-100">
                      <div>
                        <Label className="text-sm">允许用户拆单</Label>
                        <p className="text-xs text-gray-400 mt-0.5">开启后，用户在商品链接中用 <code className="bg-gray-100 px-1 rounded">---</code> 分隔多组链接，管理员下单后可自动拆分为多个子订单</p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          const newVal = enabled ? 'false' : 'true';
                          if (s) {
                            updateSetting(s.id, 'value', newVal);
                            await tenantEntity.update('SiteSettings', s.id, { value: newVal });
                          } else {
                            await tenantEntity.create('SiteSettings', { key: 'allow_order_split', value: newVal, category: 'general', description: '允许用户拆单（商品链接 --- 分割）' });
                            await load();
                          }
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${enabled ? 'bg-indigo-600' : 'bg-gray-200'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  );
                })()}

                {/* Allow order split after warehouse toggle */}
                {(() => {
                  const allSettings = Object.values(grouped).flat();
                  const splitEnabled = allSettings.find(s => s.key === 'allow_order_split')?.value === 'true';
                  if (!splitEnabled) return null;
                  const s = allSettings.find(s => s.key === 'allow_order_split_after_warehouse');
                  const enabled = s?.value === 'true';
                  return (
                    <div className="flex items-center justify-between pb-1 border-b border-gray-100 pl-4 border-l-2 border-l-indigo-200">
                      <div>
                        <Label className="text-sm text-indigo-700">允许入库后申请拆单</Label>
                        <p className="text-xs text-gray-400 mt-0.5">开启后，已入库订单的用户可申请拆单（需管理员审批）</p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          const newVal = enabled ? 'false' : 'true';
                          if (s) {
                            updateSetting(s.id, 'value', newVal);
                            await tenantEntity.update('SiteSettings', s.id, { value: newVal });
                          } else {
                            await tenantEntity.create('SiteSettings', { key: 'allow_order_split_after_warehouse', value: newVal, category: 'general', description: '允许入库后申请拆单' });
                            await load();
                          }
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${enabled ? 'bg-indigo-400' : 'bg-gray-200'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  );
                })()}

                {/* Pre-shipment feature enable toggle */}
                {(() => {
                  const s = Object.values(grouped).flat().find(s => s.key === 'pre_shipment_enabled');
                  const enabled = s?.value !== 'false';
                  return (
                    <div className="flex items-center justify-between pb-1 border-b border-gray-100">
                      <div>
                        <Label className="text-sm">开启预出货功能</Label>
                        <p className="text-xs text-gray-400 mt-0.5">开启后，用户提交订单后可预先填写发货信息，入库后自动生成发货申请</p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          const newVal = enabled ? 'false' : 'true';
                          if (s) {
                            updateSetting(s.id, 'value', newVal);
                            await tenantEntity.update('SiteSettings', s.id, { value: newVal });
                          } else {
                            await tenantEntity.create('SiteSettings', { key: 'pre_shipment_enabled', value: newVal, category: 'shipping', description: '是否开启预出货功能' });
                            await load();
                          }
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${enabled ? 'bg-purple-500' : 'bg-gray-200'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  );
                })()}

                {/* Allow user pool edit instantly toggle */}
                {(() => {
                  const s = grouped.fee?.find(s => s.key === 'allow_user_pool_edit_instant') ||
                            Object.values(grouped).flat().find(s => s.key === 'allow_user_pool_edit_instant');
                  const enabled = s?.value === 'true';
                  return (
                    <div className="flex items-center justify-between pb-1 border-b border-gray-100">
                      <div>
                        <Label className="text-sm">自动同意用户移动/添加包裹</Label>
                        <p className="text-xs text-gray-400 mt-0.5">开启后，用户在发货申请详情中移动包裹或添加包裹将立即生效，无需管理员审批</p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          const newVal = enabled ? 'false' : 'true';
                          if (s) {
                            updateSetting(s.id, 'value', newVal);
                            await tenantEntity.update('SiteSettings', s.id, { value: newVal });
                          } else {
                            await tenantEntity.create('SiteSettings', { key: 'allow_user_pool_edit_instant', value: newVal, category: 'shipping', description: '自动同意用户移动/添加包裹到发货申请' });
                            await load();
                          }
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${enabled ? 'bg-teal-500' : 'bg-gray-200'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  );
                })()}

                {/* Transit location service fee split toggle */}
                {(() => {
                  const allSettings = Object.values(grouped).flat();
                  const s = allSettings.find(s => s.key === 'transit_location_fee_split_enabled');
                  const enabled = s?.value === 'true';
                  return (
                    <div className="flex items-center justify-between pb-1 border-b border-gray-100">
                      <div>
                        <Label className="text-sm">中转地手续费平分</Label>
                        <p className="text-xs text-gray-400 mt-0.5">开启后，中转地的服务费将平分给参与拼邮的所有客户；关闭则每个客户单独计算一次中转地手续费</p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          const newVal = enabled ? 'false' : 'true';
                          if (s) {
                            updateSetting(s.id, 'value', newVal);
                            await tenantEntity.update('SiteSettings', s.id, { value: newVal });
                          } else {
                            await tenantEntity.create('SiteSettings', { key: 'transit_location_fee_split_enabled', value: newVal, category: 'fee', description: '中转地手续费是否平分（开启=平分给拼邮客户，关闭=每人单独计算）' });
                            await load();
                          }
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${enabled ? 'bg-blue-600' : 'bg-gray-200'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  );
                })()}

                {/* Pre-shipment feature toggle */}
                {(() => {
                  const allSettings = Object.values(grouped).flat();
                  const sToggle = allSettings.find(s => s.key === 'pre_shipment_enabled');
                  const enabled = sToggle?.value !== 'false';
                  return (
                    <div className="flex items-center justify-between pb-1 border-b border-gray-100">
                      <div>
                        <Label className="text-sm">开启预出货功能</Label>
                        <p className="text-xs text-gray-400 mt-0.5">开启后，用户可在提交订单后预先填写发货信息，入库后自动生成发货申请</p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          const newVal = enabled ? 'false' : 'true';
                          if (sToggle) {
                            updateSetting(sToggle.id, 'value', newVal);
                            await tenantEntity.update('SiteSettings', sToggle.id, { value: newVal });
                          } else {
                            await tenantEntity.create('SiteSettings', { key: 'pre_shipment_enabled', value: newVal, category: 'shipping', description: '是否开启预出货功能' });
                            await load();
                          }
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${enabled ? 'bg-purple-600' : 'bg-gray-200'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  );
                })()}

                {/* Pre-shipment allowed shipping methods */}
                {(() => {
                  const allSettings = Object.values(grouped).flat();
                  const preShipmentEnabled = allSettings.find(s => s.key === 'pre_shipment_enabled')?.value !== 'false';
                  if (!preShipmentEnabled) return null;
                  const sMethods = allSettings.find(s => s.key === 'pre_shipment_allowed_methods');
                  const allowedMethods = sMethods?.value || '';
                  return (
                    <div className="pb-1 border-b border-gray-100 pl-4 border-l-2 border-l-purple-200">
                      <Label className="text-sm text-purple-700">允许的预出货发货方式</Label>
                      <p className="text-xs text-gray-400 mt-0.5 mb-2">填写允许用户预出货的运输方式代码，用逗号分隔（如：EMS,SAL,DHL）。留空则允许所有运输方式</p>
                      <div className="flex items-center gap-2">
                        <Input
                          className="h-8 text-sm flex-1"
                          placeholder="EMS,SAL,DHL,FedEx"
                          value={allowedMethods}
                          onChange={async e => {
                            const val = e.target.value;
                            if (sMethods) {
                              updateSetting(sMethods.id, 'value', val);
                              await tenantEntity.update('SiteSettings', sMethods.id, { value: val });
                            } else {
                              await tenantEntity.create('SiteSettings', { key: 'pre_shipment_allowed_methods', value: val, category: 'shipping', description: '预出货允许的运输方式代码（逗号分隔）' });
                              await load();
                            }
                          }}
                        />
                      </div>
                      {allowedMethods && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {allowedMethods.split(',').map(m => m.trim()).filter(Boolean).map((m, i) => (
                            <Badge key={i} variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">{m}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Official Pool Pre-Shipment Settings */}
                {(() => {
                  const allSettings = Object.values(grouped).flat();
                  const sAutoCreate = allSettings.find(s => s.key === 'official_pool_auto_create_pending');
                  const sMerge = allSettings.find(s => s.key === 'official_pool_merge_same_user');
                  const sSeparate = allSettings.find(s => s.key === 'official_pool_separate_columns');
                  const sMethods = allSettings.find(s => s.key === 'official_pool_separate_methods');
                  const autoCreateEnabled = sAutoCreate?.value !== 'false';
                  const mergeEnabled = sMerge?.value === 'true';
                  const separateEnabled = sSeparate?.value === 'true';
                  const separateMethods = sMethods?.value || '';
                  
                  return (
                    <div className="space-y-3 pb-1 border-b border-gray-100">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-sm">预出货选择官方拼邮时自动创建预拼邮列</Label>
                          <p className="text-xs text-gray-400 mt-0.5">开启后，用户下单时选择官方拼邮会自动在官方拼邮看板最左侧生成预拼邮订单列</p>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            const newVal = autoCreateEnabled ? 'false' : 'true';
                            if (sAutoCreate) {
                              updateSetting(sAutoCreate.id, 'value', newVal);
                              await tenantEntity.update('SiteSettings', sAutoCreate.id, { value: newVal });
                            } else {
                              await tenantEntity.create('SiteSettings', { key: 'official_pool_auto_create_pending', value: newVal, category: 'shipping', description: '预出货选择官方拼邮时自动创建预拼邮列' });
                              await load();
                            }
                          }}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${autoCreateEnabled ? 'bg-purple-600' : 'bg-gray-200'}`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoCreateEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                      </div>
                      
                      {autoCreateEnabled && (
                        <>
                          <div className="flex items-center justify-between pl-4 border-l-2 border-l-purple-200">
                            <div>
                              <Label className="text-sm text-purple-700">自动合并同用户同预出货状态的订单</Label>
                              <p className="text-xs text-gray-400 mt-0.5">开启后，同一用户的相同预出货状态订单会自动合并到一个预拼邮列中</p>
                            </div>
                            <button
                              type="button"
                              onClick={async () => {
                                const newVal = mergeEnabled ? 'false' : 'true';
                                if (sMerge) {
                                  updateSetting(sMerge.id, 'value', newVal);
                                  await tenantEntity.update('SiteSettings', sMerge.id, { value: newVal });
                                } else {
                                  await tenantEntity.create('SiteSettings', { key: 'official_pool_merge_same_user', value: newVal, category: 'shipping', description: '自动合并同用户同预出货状态的订单' });
                                  await load();
                                }
                              }}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${mergeEnabled ? 'bg-purple-500' : 'bg-gray-200'}`}
                            >
                              <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${mergeEnabled ? 'translate-x-4' : 'translate-x-1'}`} />
                            </button>
                          </div>
                          
                          <div className="pl-4 border-l-2 border-l-purple-200 space-y-2">
                            <div className="flex items-center justify-between">
                              <div>
                                <Label className="text-sm text-purple-700">分离多个预发货订单列</Label>
                                <p className="text-xs text-gray-400 mt-0.5">开启后，每个预发货项会单独创建一列预发货订单列</p>
                              </div>
                              <button
                                type="button"
                                onClick={async () => {
                                  const newVal = separateEnabled ? 'false' : 'true';
                                  if (sSeparate) {
                                    updateSetting(sSeparate.id, 'value', newVal);
                                    await tenantEntity.update('SiteSettings', sSeparate.id, { value: newVal });
                                  } else {
                                    await tenantEntity.create('SiteSettings', { key: 'official_pool_separate_columns', value: newVal, category: 'shipping', description: '分离多个预发货订单列' });
                                    await load();
                                  }
                                }}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${separateEnabled ? 'bg-purple-500' : 'bg-gray-200'}`}
                              >
                                <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${separateEnabled ? 'translate-x-4' : 'translate-x-1'}`} />
                              </button>
                            </div>
                            
                            {separateEnabled && (
                              <div>
                                <Label className="text-xs text-gray-500">单独成列的运输方式（留空=全分离）</Label>
                                <div className="flex items-center gap-2 mt-1">
                                  <Input
                                    className="h-8 text-sm flex-1"
                                    placeholder="EMS,SAL,DHL"
                                    value={separateMethods}
                                    onChange={async e => {
                                      const val = e.target.value;
                                      if (sMethods) {
                                        updateSetting(sMethods.id, 'value', val);
                                        await tenantEntity.update('SiteSettings', sMethods.id, { value: val });
                                      } else {
                                        await tenantEntity.create('SiteSettings', { key: 'official_pool_separate_methods', value: val, category: 'shipping', description: '单独成列的运输方式（逗号分隔）' });
                                        await load();
                                      }
                                    }}
                                  />
                                  <Button size="sm" className="h-8 text-xs">保存</Button>
                                </div>
                                {separateMethods && (
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {separateMethods.split(',').map(m => m.trim()).filter(Boolean).map((m, i) => (
                                      <Badge key={i} variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">{m}</Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}

                {/* Allow user rewarehouse from fee-pending toggle + default fee */}
                {(() => {
                  const allSettings = Object.values(grouped).flat();
                  const sToggle = allSettings.find(s => s.key === 'allow_user_rewarehouse_from_fee_pending');
                  const sFee = allSettings.find(s => s.key === 'default_rewarehouse_fee_jpy');
                  const enabled = sToggle?.value === 'true';
                  // Sync local input from loaded setting (only when sFee changes)
                  if (sFee && rewarehouseFeeInput === "" && sFee.value) {
                    setTimeout(() => setRewarehouseFeeInput(sFee.value), 0);
                  }
                  return (
                    <div className="space-y-3 pb-1 border-b border-gray-100">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-sm">允许用户从待付运费状态申请再入库</Label>
                          <p className="text-xs text-gray-400 mt-0.5">开启后，待付运费订单的用户可申请取消发货并再入库，管理员审批后生效</p>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            const newVal = enabled ? 'false' : 'true';
                            if (sToggle) {
                              updateSetting(sToggle.id, 'value', newVal);
                              await tenantEntity.update('SiteSettings', sToggle.id, { value: newVal });
                            } else {
                              await tenantEntity.create('SiteSettings', { key: 'allow_user_rewarehouse_from_fee_pending', value: newVal, category: 'shipping', description: '允许用户从待付运费状态申请再入库' });
                              await load();
                            }
                          }}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${enabled ? 'bg-orange-500' : 'bg-gray-200'}`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                      </div>
                      {enabled && (
                        <div>
                          <Label className="text-xs text-gray-500">默认再处理费用 (JPY)（管理员审批时可覆盖）</Label>
                          <div className="flex items-center gap-2 mt-1">
                            <Input
                             type="text"
                             inputMode="decimal"
                             className="h-8 text-sm w-36"
                             placeholder="0"
                             value={rewarehouseFeeInput}
                             onChange={e => setRewarehouseFeeInput(e.target.value)}
                            />
                            <Button size="sm" className="h-8 text-xs" onClick={async () => {
                              const val = rewarehouseFeeInput || '0';
                              if (sFee) {
                                updateSetting(sFee.id, 'value', val);
                                await tenantEntity.update('SiteSettings', sFee.id, { value: val });
                              } else {
                                await tenantEntity.create('SiteSettings', { key: 'default_rewarehouse_fee_jpy', value: val, category: 'fee', description: '再入库默认再处理费用 (JPY)' });
                                await load();
                              }
                            }}>保存</Button>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">此费用将在管理员同意申请后预存于订单，下次提交发货时自动计入运费明细</p>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Service & Prepay Rates */}
                <div className="grid grid-cols-2 gap-3">
                  {(grouped.fee || []).filter(s => !s.key.includes("increment") && s.key !== 'prepay_enabled').map(s => (
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
                     <p className="text-xs font-medium text-gray-600 mb-3">实时汇率增量设置 (JPY) <span className="text-gray-400">仅平台级</span></p>
                     <Alert className="mb-3 border-blue-200 bg-blue-50">
                       <TrendingUp className="h-3 w-3 text-blue-600" />
                       <AlertDescription className="text-xs text-blue-700 ml-1">
                         此设置在平台管理页修改。基础汇率自动获取，可在平台设置中设定增量（正数=上浮，负数=下浮）
                       </AlertDescription>
                     </Alert>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { key: "jpy_usd_increment", label: "USD", live: liveRates.jpy_usd },
                        { key: "jpy_cny_increment", label: "CNY", live: liveRates.jpy_cny }
                      ].map(curr => {
                        const setting = (grouped.fee || []).find(s => s.key === curr.key);
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
          {Object.entries(grouped).filter(([cat]) => cat !== "fee" && cat !== "payment").map(([cat, items]) => {
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
                          <Input className="mt-0.5 h-8 text-sm" value={s.value} onChange={e => updateSetting(s.id, "value", e.target.value)} />
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

          {/* Allow user to fill customs declaration */}
          {(() => {
            const s = Object.values(grouped).flat().find(s => s.key === 'allow_user_customs_declaration');
            const enabled = s?.value === 'true';
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
                    <button
                      type="button"
                      onClick={async () => {
                        const newVal = enabled ? 'false' : 'true';
                        if (s) {
                          await tenantEntity.update('SiteSettings', s.id, { value: newVal });
                        } else {
                          await tenantEntity.create('SiteSettings', {
                            key: 'allow_user_customs_declaration',
                            value: newVal,
                            description: '允许用户自行填写报关单',
                            category: 'shipping'
                          });
                        }
                        await load();
                      }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${enabled ? 'bg-orange-600' : 'bg-gray-200'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* Customs Hazmat Text */}
          <CustomsHazmatTextEditor settings={Object.values(grouped).flat()} onReload={load} />

          {/* Addon Options */}
          <Card className="border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-500" />增值服务设置
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AddonManager
                addons={addons}
                editingAddon={editingAddon}
                editAddonFields={editAddonFields}
                newAddon={newAddon}
                setEditAddonFields={setEditAddonFields}
                setNewAddon={setNewAddon}
                onEdit={handleEditAddon}
                onCancelEdit={() => setEditingAddon(null)}
                onSave={handleSaveAddon}
                onToggle={toggleAddon}
                onDelete={handleDeleteAddon}
                onAdd={handleAddAddon}
              />
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