import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { tenantEntity, userPrefApi } from "@/lib/tenantApi";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { User, Save, Camera, Plus, Trash2, MapPin, Edit2, Check, Star, Palette } from "lucide-react";
import ThemeSelector from "@/components/common/ThemeSelector";
import { getCountry } from "@/lib/countries";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import AddressForm, { EMPTY_ADDRESS_FORM, serializeAddressToText, isAddressFormValid } from "@/components/common/AddressForm";

export default function UserPreferences() {
  const { user } = useCurrentUser();
  const [pref, setPref] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [form, setForm] = useState({
    contact_info: "",
    contact_public: true,
    preferred_currency: "JPY",
    preferred_language: "zh",
    preferred_shipping: "EMS",
    preferred_transit_shipping_id: "",
    prefer_consolidation: false,
    notification_email: true,
    default_address_id: "",
  });
  const [transitMethods, setTransitMethods] = useState([]);
  // Unified address list: each has { id, label, country, full_text }
  const [addresses, setAddresses] = useState([]);
  const [editingAddr, setEditingAddr] = useState(null); // null = not editing, "new" = new form, id = editing existing
  const [addrForm, setAddrForm] = useState({ label: "", ...EMPTY_ADDRESS_FORM });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.display_name || user.full_name || "");
    setAvatarUrl(user.avatar_url || "");
    Promise.all([
      userPrefApi.list({ user_email: user.email }),
      tenantEntity.list('TransitShippingMethod', { is_active: true }),
    ]).then(([prefs, tMethods]) => {
      if (prefs.length > 0) {
        // Use the most recently updated record as the primary pref record
        const sorted = [...prefs].sort((a, b) => new Date(b.updated_date || 0) - new Date(a.updated_date || 0));
        const p = sorted[0];
        setPref(p);
        setForm({
          contact_info: p.contact_info || "",
          contact_public: p.contact_public !== false,
          preferred_currency: p.preferred_currency || "JPY",
          preferred_language: p.preferred_language || "zh",
          preferred_shipping: p.preferred_shipping || "EMS",
          preferred_transit_shipping_id: p.preferred_transit_shipping_id || "",
          prefer_consolidation: p.prefer_consolidation || false,
          notification_email: p.notification_email !== false,
          default_address_id: p.default_address_id || "",
        });
        // Merge saved_addresses from ALL pref records (deduplicate by id)
        const allAddrs = sorted.flatMap(r => r.saved_addresses || []);
        const seenIds = new Set();
        const mergedAddrs = allAddrs
          .filter(a => { if (!a.id || seenIds.has(a.id)) return false; seenIds.add(a.id); return true; })
          .map(a => ({ country: "", ...a }));
        setAddresses(mergedAddrs);
      }
      setTransitMethods(tMethods || []);
    }).catch(() => {});
  }, [user?.email]);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingAvatar(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setAvatarUrl(file_url);
    setUploadingAvatar(false);
  };

  const handleSave = async () => {
    setSaving(true);
    await base44.auth.updateMe({ display_name: displayName, avatar_url: avatarUrl });
    const data = { ...form, contact_public: form.contact_public !== false, user_email: user.email, saved_addresses: addresses };
    if (pref) {
      await userPrefApi.update(pref.id, data);
      // Clean up any duplicate UserPreference records (merge into primary)
      const allPrefs = await userPrefApi.list({ user_email: user.email });
      const duplicates = allPrefs.filter(p => p.id !== pref.id);
      await Promise.all(duplicates.map(p => userPrefApi.delete(p.id)));
    } else {
      const created = await userPrefApi.create(data);
      setPref(created);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const af = (k, v) => setAddrForm(p => ({ ...p, [k]: v }));

  const handleOpenNew = () => {
    setAddrForm({ label: "", ...EMPTY_ADDRESS_FORM });
    setEditingAddr("new");
  };

  const handleOpenEdit = (addr) => {
    setAddrForm({
      label: addr.label || "",
      recipient_name: addr.recipient_name || "",
      country: addr.country || "",
      addr1: addr.addr1 || "",
      addr2: addr.addr2 || "",
      addr3: addr.addr3 || "",
      state: addr.state || "",
      phone: addr.phone || "",
    });
    setEditingAddr(addr.id);
  };

  const handleSaveAddr = () => {
    if (!addrForm.label.trim() || !isAddressFormValid(addrForm)) return;
    const { label, ...fields } = addrForm;
    const full_text = serializeAddressToText(fields);
    if (editingAddr === "new") {
      const newAddr = { id: Date.now().toString(), label, full_text, ...fields };
      setAddresses(prev => [...prev, newAddr]);
      if (addresses.length === 0) setForm(p => ({ ...p, default_address_id: newAddr.id }));
    } else {
      setAddresses(prev => prev.map(a => a.id === editingAddr ? { ...a, label, full_text, ...fields } : a));
    }
    setEditingAddr(null);
  };

  const handleDeleteAddr = (id) => {
    setAddresses(prev => prev.filter(a => a.id !== id));
    if (form.default_address_id === id) setForm(p => ({ ...p, default_address_id: "" }));
  };

  const setDefaultAddr = (id) => setForm(p => ({ ...p, default_address_id: id }));

  const isEditing = editingAddr !== null;

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">个人偏好设定</h1>
        <p className="text-sm text-gray-500 mt-0.5">设置您的偏好，提升代购体验</p>
      </div>

      {/* 账户信息 */}
      {user && (
        <Card className="border-gray-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <User className="w-4 h-4" />账户信息
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center">
                  {avatarUrl ? <img src={avatarUrl} alt="头像" className="w-full h-full object-cover" /> : <User className="w-8 h-8 text-gray-400" />}
                </div>
                <label className="absolute -bottom-1 -right-1 w-6 h-6 bg-red-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-red-700">
                  <Camera className="w-3 h-3 text-white" />
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
                </label>
              </div>
              <div className="flex-1">
                <Label className="text-sm">显示名称</Label>
                <Input className="mt-1" placeholder={user.full_name || "输入显示名称"} value={displayName} onChange={e => setDisplayName(e.target.value)} />
                {uploadingAvatar && <p className="text-xs text-gray-400 mt-1">上传中...</p>}
              </div>
            </div>
            <div className="space-y-2 text-sm pt-1 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">邮箱</span>
                <span className="font-medium text-gray-700">{user.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">角色</span>
                <Badge className="text-xs">{user.role === "admin" ? "管理员" : "用户"}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 联系方式 */}
      <Card className="border-gray-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-700">联系方式</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-sm">线上联系方式</Label>
            <Input className="mt-1" placeholder="如：微信 wxid_xxx / Line: xxx / WhatsApp: +81..." value={form.contact_info} onChange={e => f("contact_info", e.target.value)} />
            <p className="text-xs text-gray-400 mt-1.5">填写后将自动附在您的留言中，方便客服联系您</p>
          </div>
          <div className="flex items-center justify-between py-1 border-t border-gray-100 pt-3">
            <div>
              <Label className="text-sm">公开联系方式</Label>
              <p className="text-xs text-gray-400 mt-0.5">
                {form.contact_public
                  ? "所有用户可在发货申请参与者处悬浮查看您的联系方式"
                  : "仅管理员可查看您的联系方式"}
              </p>
            </div>
            <Switch checked={form.contact_public} onCheckedChange={v => f("contact_public", v)} />
          </div>
        </CardContent>
      </Card>

      {/* 偏好设置 */}
      <Card className="border-gray-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-700">偏好设置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm">偏好货币</Label>
            <Select value={form.preferred_currency} onValueChange={v => f("preferred_currency", v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["JPY","CNY","USD","EUR","TWD","HKD","SGD","AUD","GBP"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm">界面语言</Label>
            <Select value={form.preferred_language} onValueChange={v => f("preferred_language", v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="zh">中文（简体）</SelectItem>
                <SelectItem value="en">English（即将上线）</SelectItem>
                <SelectItem value="ja">日本語（即将上線）</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm">偏好运输方式</Label>
            <Select value={form.preferred_shipping} onValueChange={v => f("preferred_shipping", v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="EMS">EMS空运</SelectItem>
                <SelectItem value="surface">海运</SelectItem>
                <SelectItem value="small_packet_air">小型包装物空运</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {transitMethods.length > 0 && (
            <div>
              <Label className="text-sm">默认中转运输方式</Label>
              <p className="text-xs text-gray-400 mt-0.5">拼邮发货时的中转段默认运输方式</p>
              <Select value={form.preferred_transit_shipping_id || "auto"} onValueChange={v => f("preferred_transit_shipping_id", v === "auto" ? "" : v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">由管理员安排</SelectItem>
                  {transitMethods.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name} · {m.fee_currency || "JPY"} {Number(m.fee || 0).toLocaleString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center justify-between py-1">
            <div>
              <Label className="text-sm">偏好拼邮</Label>
              <p className="text-xs text-gray-400 mt-0.5">与其他用户拼邮，可降低运费</p>
            </div>
            <Switch checked={form.prefer_consolidation} onCheckedChange={v => f("prefer_consolidation", v)} />
          </div>
          <div className="flex items-center justify-between py-1">
            <div>
              <Label className="text-sm">接收邮件通知</Label>
              <p className="text-xs text-gray-400 mt-0.5">订单状态变更时通知您</p>
            </div>
            <Switch checked={form.notification_email} onCheckedChange={v => f("notification_email", v)} />
          </div>

        </CardContent>
      </Card>

      {/* 界面主题 */}
      <Card className="border-gray-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Palette className="w-4 h-4" />界面主题
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ThemeSelector />
        </CardContent>
      </Card>

      {/* 收货地址管理（合并版） */}
      <Card className="border-gray-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <MapPin className="w-4 h-4" />收货地址管理
            </CardTitle>
            {!isEditing && (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleOpenNew}>
                <Plus className="w-3.5 h-3.5 mr-1" />添加地址
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Inline add/edit form */}
          {isEditing && (
            <div className="border border-red-100 rounded-xl p-4 bg-red-50/30 space-y-3">
              <p className="text-xs font-medium text-gray-600">{editingAddr === "new" ? "添加新地址" : "编辑地址"}</p>
              <div>
                <Label className="text-xs text-gray-500">地址标签 *</Label>
                <Input className="mt-1 h-8 text-sm" placeholder="如：家、公司" value={addrForm.label} onChange={e => af("label", e.target.value)} />
              </div>
              <AddressForm
                value={addrForm}
                onChange={v => setAddrForm(prev => ({ ...prev, ...v }))}
              />
              <div className="flex gap-2 justify-end pt-1">
                <Button variant="outline" size="sm" onClick={() => setEditingAddr(null)}>取消</Button>
                <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={handleSaveAddr} disabled={!addrForm.label.trim() || !isAddressFormValid(addrForm)}>
                  <Check className="w-3.5 h-3.5 mr-1" />保存
                </Button>
              </div>
            </div>
          )}

          {/* Address list */}
          {addresses.length === 0 && !isEditing && (
            <p className="text-xs text-gray-400 text-center py-4">暂无收货地址，点击"添加地址"</p>
          )}
          {addresses.map(addr => {
            const isDefault = form.default_address_id === addr.id;
            return (
              <div key={addr.id} className={`rounded-xl border p-3 ${isDefault ? "border-red-200 bg-red-50/30" : "border-gray-100 bg-gray-50"}`}>
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-800">{addr.label}</span>
                    {addr.country && <Badge variant="outline" className="text-xs">{getCountry(addr.country)?.name || addr.country}</Badge>}
                    {isDefault && (
                      <Badge className="text-xs bg-red-100 text-red-700 flex items-center gap-1">
                        <Star className="w-2.5 h-2.5" />默认
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!isDefault && (
                      <button onClick={() => setDefaultAddr(addr.id)} className="text-xs text-gray-400 hover:text-red-600 px-1.5 py-0.5 rounded hover:bg-red-50 whitespace-nowrap">
                        设为默认
                      </button>
                    )}
                    <button onClick={() => handleOpenEdit(addr)} className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-700">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDeleteAddr(addr.id)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-500 whitespace-pre-wrap leading-relaxed">{addr.full_text}</p>
              </div>
            );
          })}

          <p className="text-xs text-gray-400">默认收货地址将在发货申请时自动填入</p>
        </CardContent>
      </Card>

      <Button className="w-full bg-red-600 hover:bg-red-700" onClick={handleSave} disabled={saving}>
        <Save className="w-4 h-4 mr-2" />
        {saved ? "已保存 ✓" : saving ? "保存中..." : "保存设置"}
      </Button>
    </div>
  );
}