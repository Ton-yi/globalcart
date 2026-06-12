/**
 * PrivacySettingsTab — 隐私设置（个人档案页 Tab / 独立隐私设置页共用）
 * 公开资料页开关 + Handle + 简介 + 各隐私项 + 公开显示订单信息（来自 UserPreference）
 */
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useUserPref } from "@/hooks/useUserPref";
import { Eye, Shield, Link as LinkIcon, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import ImageUploader from "@/components/common/ImageUploader";

export default function PrivacySettingsTab() {
  const { user } = useCurrentUser();
  const { pref, savePref } = useUserPref();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [handleValidating, setHandleValidating] = useState(false);
  const [handleStatus, setHandleStatus] = useState(null); // 'valid', 'invalid', null
  const [orderInfoPublic, setOrderInfoPublic] = useState(false);

  const [settings, setSettings] = useState({
    public_profile_enabled: false,
    handle: '',
    public_profile_bio: '',
    public_profile_bio_image_url: '',
    privacy_show_registered_date: true,
    privacy_show_role_badges: true,
    privacy_show_bio: true,
    privacy_show_stats: true,
    privacy_show_orders: false,
    privacy_show_country: false,
    privacy_show_last_login: false,
    public_profile_views_total: 0,
    public_profile_views_unique: 0
  });

  useEffect(() => {
    if (!user) return;
    setSettings(prev => ({
      ...prev,
      public_profile_enabled: user.public_profile_enabled || false,
      handle: user.handle || '',
      public_profile_bio: user.public_profile_bio || '',
      public_profile_bio_image_url: user.public_profile_bio_image_url || '',
      privacy_show_registered_date: user.privacy_show_registered_date ?? true,
      privacy_show_role_badges: user.privacy_show_role_badges ?? true,
      privacy_show_bio: user.privacy_show_bio ?? true,
      privacy_show_stats: user.privacy_show_stats ?? true,
      privacy_show_orders: user.privacy_show_orders ?? false,
      privacy_show_country: user.privacy_show_country ?? false,
      privacy_show_last_login: user.privacy_show_last_login ?? false,
      public_profile_views_total: user.public_profile_views_total || 0,
      public_profile_views_unique: user.public_profile_views_unique || 0
    }));
    setLoading(false);
  }, [user?.id]); // eslint-disable-line

  useEffect(() => {
    if (pref) setOrderInfoPublic(pref.order_info_public === true);
  }, [pref?.id]); // eslint-disable-line

  const validateHandle = async (handleValue) => {
    if (!handleValue || handleValue.length < 3) {
      setHandleStatus('invalid');
      return false;
    }
    setHandleValidating(true);
    try {
      const res = await base44.functions.invoke('validateHandle', { handle: handleValue });
      setHandleStatus(res.data?.valid ? 'valid' : 'invalid');
      return res.data?.valid || false;
    } catch {
      setHandleStatus('invalid');
      return false;
    } finally {
      setHandleValidating(false);
    }
  };

  const handleSave = async () => {
    if (settings.public_profile_enabled && !settings.handle) {
      toast.error('请先设置 Handle');
      return;
    }
    setSaving(true);
    try {
      // handle 与隐私设置统一通过后端函数保存（后端校验格式、保留词、唯一性）
      await base44.functions.invoke('updatePublicProfileSettings', {
        handle: settings.handle ? settings.handle.toLowerCase().trim() : undefined,
        public_profile_enabled: settings.public_profile_enabled,
        public_profile_bio: settings.public_profile_bio,
        public_profile_bio_image_url: settings.public_profile_bio_image_url,
        privacy_show_registered_date: settings.privacy_show_registered_date,
        privacy_show_role_badges: settings.privacy_show_role_badges,
        privacy_show_bio: settings.privacy_show_bio,
        privacy_show_stats: settings.privacy_show_stats,
        privacy_show_orders: settings.privacy_show_orders,
        privacy_show_country: settings.privacy_show_country,
        privacy_show_last_login: settings.privacy_show_last_login
      });
      // 站内订单信息公开开关（UserPreference）
      await savePref({ order_info_public: orderInfoPublic });
      toast.success('设置已保存');
    } catch (e) {
      toast.error(e.response?.data?.error || '保存失败，请重试');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  const currentLocale = window.location.pathname.split('/')[1] || 'ja';
  const publicProfileUrl = settings.handle ? `${window.location.origin}/${currentLocale}/u/${settings.handle}` : null;

  return (
    <div className="space-y-4">
      {/* 站内订单信息公开 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Package className="w-4 h-4 text-blue-500" />站内订单信息
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">公开显示我的订单信息</Label>
              <p className="text-xs text-gray-500 mt-1">开启后其他用户可在拼邮/发货申请中看到您的商品名称等订单详情</p>
            </div>
            <Switch checked={orderInfoPublic} onCheckedChange={setOrderInfoPublic} />
          </div>
        </CardContent>
      </Card>

      {/* Public Profile Toggle */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Eye className="w-4 h-4 text-blue-500" />
            公开资料页
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-semibold">开启公开资料页</Label>
              <p className="text-xs text-gray-500 mt-1">开启后，其他已登录用户可以通过 Handle 访问您的公开资料页</p>
            </div>
            <Switch
              checked={settings.public_profile_enabled}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, public_profile_enabled: checked }))}
            />
          </div>

          {settings.public_profile_enabled && (
            <>
              <div className="border-t pt-4">
                <Label>Handle（唯一标识符）</Label>
                <div className="flex gap-2 mt-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">/{currentLocale}/u/</span>
                    <Input
                      className="pl-16"
                      placeholder="nekoyume"
                      value={settings.handle}
                      onChange={(e) => {
                        setSettings(prev => ({ ...prev, handle: e.target.value }));
                        setHandleStatus(null);
                      }}
                      onBlur={() => settings.handle && validateHandle(settings.handle)}
                      disabled={handleValidating}
                    />
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => settings.handle && validateHandle(settings.handle)}
                    disabled={handleValidating || !settings.handle}
                  >
                    {handleValidating ? '验证中...' : '验证'}
                  </Button>
                </div>
                {handleStatus === 'valid' && <p className="text-sm text-green-600 mt-1">✓ Handle 可用</p>}
                {handleStatus === 'invalid' && <p className="text-sm text-red-600 mt-1">✗ Handle 不可用</p>}
                <p className="text-xs text-gray-500 mt-2">
                  规则：3-24 位小写字母 a-z 和数字 0-9，必须包含至少一个字母，不允许纯数字
                </p>
              </div>

              {publicProfileUrl && (
                <div className="border-t pt-4">
                  <Label>公开资料页链接</Label>
                  <div className="flex items-center gap-2 mt-2 p-3 bg-gray-50 rounded-lg border">
                    <LinkIcon className="w-4 h-4 text-gray-400" />
                    <code className="flex-1 text-sm text-gray-600 break-all">{publicProfileUrl}</code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(publicProfileUrl);
                        toast.success('链接已复制');
                      }}
                    >
                      复制
                    </Button>
                  </div>
                </div>
              )}

              <div className="border-t pt-4 grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">累计展示次数</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{settings.public_profile_views_total || 0}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">独立访客数</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{settings.public_profile_views_unique || 0}</p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Bio */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">个人简介</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-semibold">显示个人简介</Label>
              <p className="text-xs text-gray-500 mt-1">在公开资料页展示您的个人简介</p>
            </div>
            <Switch
              checked={settings.privacy_show_bio}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, privacy_show_bio: checked }))}
              disabled={!settings.public_profile_enabled}
            />
          </div>

          {settings.privacy_show_bio && (
            <>
              <div>
                <Label>简介内容（支持 Markdown）</Label>
                <Textarea
                  className="mt-2"
                  rows={4}
                  placeholder="介绍一下自己... 支持 Markdown 语法（**加粗**、列表、链接等）"
                  value={settings.public_profile_bio}
                  onChange={(e) => setSettings(prev => ({ ...prev, public_profile_bio: e.target.value }))}
                  disabled={!settings.public_profile_enabled}
                />
              </div>
              <ImageUploader
                label="简介图片（可选）"
                value={settings.public_profile_bio_image_url}
                onChange={(url) => setSettings(prev => ({ ...prev, public_profile_bio_image_url: url }))}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Privacy Toggles */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-500" />
            公开资料页隐私项设置
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: 'privacy_show_registered_date', label: '注册时间', desc: '显示您的账户注册日期' },
            { key: 'privacy_show_role_badges', label: '角色阶级与标签', desc: '显示您的角色和会员等级' },
            { key: 'privacy_show_stats', label: '订单简要', desc: '显示累计消费、订单数、货款总计、服务费、最近下单' },
            { key: 'privacy_show_orders', label: '订单记录', desc: '向资料页访问者显示最近 10 笔订单（默认关闭）' },
            { key: 'privacy_show_country', label: '所在国家/地区', desc: '显示您的默认地址国家（默认关闭）' },
            { key: 'privacy_show_last_login', label: '最近登录时间', desc: '显示您最后一次登录的时间（默认关闭）' }
          ].map(item => (
            <div key={item.key} className="flex items-center justify-between">
              <div>
                <Label className="text-sm">{item.label}</Label>
                <p className="text-xs text-gray-500 mt-1">{item.desc}</p>
              </div>
              <Switch
                checked={settings[item.key]}
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, [item.key]: checked }))}
                disabled={!settings.public_profile_enabled}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="bg-gray-900 hover:bg-gray-800">
          {saving ? '保存中...' : '保存设置'}
        </Button>
      </div>
    </div>
  );
}