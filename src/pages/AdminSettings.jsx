import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Settings, Save, Plus, Trash2, Star, Lock, Eye, EyeOff, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import ShippingMethodManager from "@/components/admin/ShippingMethodManager";

const DEFAULT_SETTINGS = [
  { key: "service_fee_rate", value: "10", description: "服务费率 (%)", category: "fee" },
  { key: "prepay_rate", value: "80", description: "预付款比率 (%)", category: "fee" },
  { key: "jpy_usd_rate", value: "0.0067", description: "日元/美元汇率", category: "fee" },
  { key: "jpy_cny_rate", value: "0.048", description: "日元/人民币汇率", category: "fee" },
  { key: "jpy_twd_rate", value: "0.22", description: "日元/台币汇率", category: "fee" },
  { key: "site_name", value: "同一物流", description: "网站名称", category: "general" },
  { key: "contact_email", value: "", description: "联系邮箱", category: "general" },
  { key: "whatsapp", value: "", description: "WhatsApp", category: "general" },
  { key: "line_id", value: "", description: "Line ID", category: "general" },
  { key: "wechat_id", value: "", description: "微信号", category: "general" },
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
];

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState("general");
  const [settings, setSettings] = useState([]);
  const [addons, setAddons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const [newAddon, setNewAddon] = useState({ name: "", description: "", fee: "", fee_currency: "JPY" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newVal, setNewVal] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCat, setNewCat] = useState("general");

  const load = async () => {
    let [data, addonData] = await Promise.all([
      base44.entities.SiteSettings.list(),
      base44.entities.AddonOption.list()
    ]);
    if (data.length === 0) {
      await base44.entities.SiteSettings.bulkCreate(DEFAULT_SETTINGS);
      data = await base44.entities.SiteSettings.list();
    }
    setSettings(data);
    setAddons(addonData);
    setLoading(false);
  };

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    load();
  }, []);

  const updateSetting = (id, field, value) => {
    setSettings(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const handleSaveAll = async () => {
    setSaving(true);
    await Promise.all(settings.map(s => base44.entities.SiteSettings.update(s.id, { value: s.value, description: s.description })));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleAdd = async () => {
    if (!newKey || !newVal) return;
    await base44.entities.SiteSettings.create({ key: newKey, value: newVal, description: newDesc, category: newCat });
    setNewKey(""); setNewVal(""); setNewDesc(""); setNewCat("general");
    await load();
  };

  const handleDelete = async (id) => {
    await base44.entities.SiteSettings.delete(id);
    await load();
  };

  const handleAddAddon = async () => {
    if (!newAddon.name || newAddon.fee === "") return;
    await base44.entities.AddonOption.create({ ...newAddon, fee: parseFloat(newAddon.fee) || 0, is_active: true });
    setNewAddon({ name: "", description: "", fee: "", fee_currency: "JPY" });
    await load();
  };

  const handleDeleteAddon = async (id) => {
    await base44.entities.AddonOption.delete(id);
    await load();
  };

  const toggleAddon = async (a) => {
    await base44.entities.AddonOption.update(a.id, { is_active: !a.is_active });
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
            <ShippingMethodManager />
          </CardContent>
        </Card>
      )}

      {activeTab === "general" && loading ? (
        <p className="text-gray-400 text-sm">加载中...</p>
      ) : (
        Object.entries(grouped).map(([cat, items]) => {
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
        })
      )}

      {/* Addon Options */}
      <Card className="border-gray-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-500" />增值选项设置
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {addons.length === 0 && <p className="text-xs text-gray-400">暂无增值选项，在下方添加</p>}
          {addons.map(a => (
            <div key={a.id} className={`flex items-center gap-3 p-2 rounded-lg border ${a.is_active ? "border-gray-200" : "border-gray-100 opacity-50"}`}>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-800">{a.name}</span>
                  <span className="text-sm text-red-600">+{a.fee_currency || "JPY"} {parseFloat(a.fee).toFixed(2)}</span>
                  {!a.is_active && <Badge className="text-xs bg-gray-100 text-gray-400">已禁用</Badge>}
                </div>
                {a.description && <p className="text-xs text-gray-400">{a.description}</p>}
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => toggleAddon(a)}>{a.is_active ? "禁用" : "启用"}</Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-red-400" onClick={() => handleDeleteAddon(a.id)}><Trash2 className="w-3 h-3" /></Button>
            </div>
          ))}
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
              <Input type="number" step="0.01" className="mt-0.5 h-8 text-sm" placeholder="500" value={newAddon.fee} onChange={e => setNewAddon(p => ({ ...p, fee: e.target.value }))} />
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
    </div>
  );
}