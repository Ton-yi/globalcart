import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { User, Save, Upload, Camera, Plus, Trash2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

export default function UserPreferences() {
  const [user, setUser] = useState(null);
  const [pref, setPref] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [form, setForm] = useState({
    contact_info: "",
    preferred_currency: "JPY",
    preferred_language: "zh",
    preferred_shipping: "EMS",
    prefer_consolidation: false,
    default_country: "",
    default_address: "",
    notification_email: true
  });
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [newAddrLabel, setNewAddrLabel] = useState("");
  const [newAddrText, setNewAddrText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    base44.auth.me().then(async u => {
      setUser(u);
      setDisplayName(u.display_name || u.full_name || "");
      setAvatarUrl(u.avatar_url || "");
      const prefs = await base44.entities.UserPreference.filter({ user_email: u.email });
      if (prefs.length > 0) {
        const p = prefs[0];
        setPref(p);
        setForm({
          contact_info: p.contact_info || "",
          preferred_currency: p.preferred_currency || "JPY",
          preferred_language: p.preferred_language || "zh",
          preferred_shipping: p.preferred_shipping || "EMS",
          prefer_consolidation: p.prefer_consolidation || false,
          default_country: p.default_country || "",
          default_address: p.default_address || "",
          notification_email: p.notification_email !== false
        });
        setSavedAddresses(p.saved_addresses || []);
      }
    }).catch(() => base44.auth.redirectToLogin());
  }, []);

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
    // Update user display name and avatar
    await base44.auth.updateMe({ display_name: displayName, avatar_url: avatarUrl });
    // Update preferences
    const data = { ...form, user_email: user.email, saved_addresses: savedAddresses };
    if (pref) {
      await base44.entities.UserPreference.update(pref.id, data);
    } else {
      const created = await base44.entities.UserPreference.create(data);
      setPref(created);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

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
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="头像" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-8 h-8 text-gray-400" />
                  )}
                </div>
                <label className="absolute -bottom-1 -right-1 w-6 h-6 bg-red-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-red-700">
                  <Camera className="w-3 h-3 text-white" />
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
                </label>
              </div>
              <div className="flex-1">
                <Label className="text-sm">显示名称</Label>
                <Input
                  className="mt-1"
                  placeholder={user.full_name || "输入您的显示名称"}
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                />
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
        <CardContent>
          <Label className="text-sm">线上联系方式</Label>
          <Input
            className="mt-1"
            placeholder="如：微信 wxid_xxx / Line: xxx / WhatsApp: +81..."
            value={form.contact_info}
            onChange={e => f("contact_info", e.target.value)}
          />
          <p className="text-xs text-gray-400 mt-1.5">填写后将自动附在您的留言中，方便客服联系您</p>
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
                {["JPY","CNY","USD","EUR","TWD","HKD","SGD","AUD","GBP"].map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
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
                <SelectItem value="EMS">日本邮政 EMS</SelectItem>
                <SelectItem value="surface">日本邮政海运</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between py-1">
            <div>
              <Label className="text-sm">偏好拼邮</Label>
              <p className="text-xs text-gray-400 mt-0.5">与其他用户拼邮，可降低运费</p>
            </div>
            <Switch
              checked={form.prefer_consolidation}
              onCheckedChange={v => f("prefer_consolidation", v)}
            />
          </div>

          <div>
            <Label className="text-sm">默认收货国家</Label>
            <Input
              className="mt-1"
              placeholder="例：China"
              value={form.default_country}
              onChange={e => f("default_country", e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between py-1">
            <div>
              <Label className="text-sm">接收邮件通知</Label>
              <p className="text-xs text-gray-400 mt-0.5">订单状态变更时通知您</p>
            </div>
            <Switch
              checked={form.notification_email}
              onCheckedChange={v => f("notification_email", v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* 默认收货地址 */}
      <Card className="border-gray-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-700">默认收货地址</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            className="text-sm"
            rows={6}
            placeholder={"推荐格式：\n收件人名\n收件人联系方式\n省\n市，区\n详细地址"}
            value={form.default_address}
            onChange={e => f("default_address", e.target.value)}
          />
          <p className="text-xs text-gray-400 mt-1.5">提交发货需求时可快速填入</p>
        </CardContent>
      </Card>

      <Button className="w-full bg-red-600 hover:bg-red-700" onClick={handleSave} disabled={saving}>
        <Save className="w-4 h-4 mr-2" />
        {saved ? "已保存 ✓" : saving ? "保存中..." : "保存设置"}
      </Button>
    </div>
  );
}