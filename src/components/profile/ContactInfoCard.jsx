/**
 * ContactInfoCard — 联系方式设置（新旧个人档案页共用）
 */
import { useState, useEffect } from "react";
import { useUserPref } from "@/hooks/useUserPref";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Phone, Save } from "lucide-react";
import { toast } from "sonner";

export default function ContactInfoCard() {
  const { pref, savePref } = useUserPref();
  const [contactInfo, setContactInfo] = useState("");
  const [contactPublic, setContactPublic] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!pref) return;
    setContactInfo(pref.contact_info || "");
    setContactPublic(pref.contact_public !== false);
  }, [pref?.id]); // eslint-disable-line

  const handleSave = async () => {
    setSaving(true);
    await savePref({ contact_info: contactInfo, contact_public: contactPublic });
    toast.success("联系方式已保存");
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Phone className="w-4 h-4 text-blue-500" />联系方式
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label className="text-sm">线上联系方式</Label>
          <Input
            className="mt-1"
            placeholder="如：微信 wxid_xxx / Line: xxx / WhatsApp: +81..."
            value={contactInfo}
            onChange={e => setContactInfo(e.target.value)}
          />
          <p className="text-xs text-gray-400 mt-1.5">填写后将自动附在您的留言中，方便客服联系您</p>
        </div>
        <div className="flex items-center justify-between py-1 border-t border-gray-100 pt-3">
          <div>
            <Label className="text-sm">公开联系方式</Label>
            <p className="text-xs text-gray-400 mt-0.5">
              {contactPublic
                ? "所有用户可在发货申请参与者处悬浮查看您的联系方式"
                : "仅管理员可查看您的联系方式"}
            </p>
          </div>
          <Switch checked={contactPublic} onCheckedChange={setContactPublic} />
        </div>
        <div className="flex justify-end pt-1">
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Save className="w-3.5 h-3.5 mr-1.5" />{saving ? "保存中..." : "保存"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}