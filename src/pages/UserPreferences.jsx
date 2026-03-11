import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { User, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function UserPreferences() {
  const [user, setUser] = useState(null);
  const [pref, setPref] = useState(null);
  const [form, setForm] = useState({ preferred_currency: "USD", preferred_language: "zh", preferred_shipping: "EMS", default_country: "", notification_email: true });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    base44.auth.me().then(async u => {
      setUser(u);
      const prefs = await base44.entities.UserPreference.filter({ user_email: u.email });
      if (prefs.length > 0) {
        setPref(prefs[0]);
        setForm({ preferred_currency: prefs[0].preferred_currency || "USD", preferred_language: prefs[0].preferred_language || "zh", preferred_shipping: prefs[0].preferred_shipping || "EMS", default_country: prefs[0].default_country || "", notification_email: prefs[0].notification_email !== false });
      }
    }).catch(() => base44.auth.redirectToLogin());
  }, []);

  const handleSave = async () => {
    setSaving(true);
    if (pref) {
      await base44.entities.UserPreference.update(pref.id, form);
    } else {
      await base44.entities.UserPreference.create({ ...form, user_email: user.email });
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

      {user && (
        <Card className="border-gray-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <User className="w-4 h-4" />账户信息
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">姓名</span>
              <span className="font-medium">{user.full_name || "-"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">邮箱</span>
              <span className="font-medium">{user.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">角色</span>
              <Badge className="text-xs">{user.role === "admin" ? "管理员" : "用户"}</Badge>
            </div>
          </CardContent>
        </Card>
      )}

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
                {["USD","CNY","JPY","EUR","TWD","HKD","SGD","AUD","GBP"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
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
                <SelectItem value="EMS">EMS 国际快递</SelectItem>
                <SelectItem value="DHL">DHL</SelectItem>
                <SelectItem value="FedEx">FedEx</SelectItem>
                <SelectItem value="SAL">SAL 经济航空</SelectItem>
                <SelectItem value="surface">海运</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm">默认收货国家</Label>
            <Input className="mt-1" placeholder="例：台湾" value={form.default_country} onChange={e => f("default_country", e.target.value)} />
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="notif" checked={form.notification_email} onChange={e => f("notification_email", e.target.checked)} className="w-4 h-4" />
            <Label htmlFor="notif" className="text-sm cursor-pointer">接收邮件通知</Label>
          </div>
        </CardContent>
      </Card>

      <Button className="w-full bg-red-600 hover:bg-red-700" onClick={handleSave} disabled={saving}>
        <Save className="w-4 h-4 mr-2" />
        {saved ? "已保存 ✓" : saving ? "保存中..." : "保存设置"}
      </Button>
    </div>
  );
}