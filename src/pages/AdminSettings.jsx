import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Settings, Save, Plus, Trash2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const DEFAULT_SETTINGS = [
  { key: "service_fee_rate", value: "10", description: "服务费率 (%)", category: "fee" },
  { key: "prepay_rate", value: "80", description: "预付款比率 (%)", category: "fee" },
  { key: "jpy_usd_rate", value: "0.0067", description: "日元/美元汇率", category: "fee" },
  { key: "jpy_cny_rate", value: "0.048", description: "日元/人民币汇率", category: "fee" },
  { key: "jpy_twd_rate", value: "0.22", description: "日元/台币汇率", category: "fee" },
  { key: "site_name", value: "JapanBuy", description: "网站名称", category: "general" },
  { key: "contact_email", value: "", description: "联系邮箱", category: "general" },
  { key: "whatsapp", value: "", description: "WhatsApp", category: "general" },
  { key: "line_id", value: "", description: "Line ID", category: "general" },
  { key: "wechat_id", value: "", description: "微信号", category: "general" },
];

const CAT_LABELS = { fee: "费率设置", payment: "支付设置", shipping: "运输设置", general: "基本信息" };
const CAT_COLORS = { fee: "bg-yellow-100 text-yellow-700", payment: "bg-green-100 text-green-700", shipping: "bg-blue-100 text-blue-700", general: "bg-gray-100 text-gray-600" };

export default function AdminSettings() {
  const [settings, setSettings] = useState([]);
  const [addons, setAddons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newAddon, setNewAddon] = useState({ name: "", description: "", fee: "" });
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

  useEffect(() => { load(); }, []);

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
    setNewAddon({ name: "", description: "", fee: "" });
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
        <Button className="bg-gray-900 hover:bg-gray-800" size="sm" onClick={handleSaveAll} disabled={saving}>
          <Save className="w-4 h-4 mr-1.5" />{saved ? "已保存 ✓" : saving ? "保存中..." : "保存全部"}
        </Button>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">加载中...</p>
      ) : (
        Object.entries(grouped).map(([cat, items]) => (
          <Card key={cat} className="border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Badge className={`text-xs ${CAT_COLORS[cat]}`}>{CAT_LABELS[cat] || cat}</Badge>
              </CardTitle>
            </CardHeader>
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
          </Card>
        ))
      )}

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