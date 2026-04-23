/**
 * AlipayKeysManager - Per-tenant Alipay credential configuration.
 * Keys are stored in SiteSettings with category "alipay_keys".
 * Falls back to platform env vars if not set.
 */
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Save, Eye, EyeOff, CheckCircle, AlertCircle } from "lucide-react";
import { tenantEntity } from "@/lib/tenantApi";

const KEY_FIELDS = [
  {
    key: "alipay_key_app_id",
    label: "App ID",
    placeholder: "2021xxxxxxxxxxxxx",
    hint: "支付宝开放平台应用 App ID",
    multiline: false,
    secret: false,
  },
  {
    key: "alipay_key_private_key",
    label: "应用私钥（RSA2 PKCS8）",
    placeholder: "MIIEvAIBADANBgkqhkiG9w0BAQEFAASC...",
    hint: "从支付宝密钥工具生成，格式为 PKCS8。请勿包含 -----BEGIN/END----- 行（系统自动处理）",
    multiline: true,
    secret: true,
  },
  {
    key: "alipay_key_public_key",
    label: "支付宝公钥",
    placeholder: "MIIBIjANBgkqhkiG9w0BAQEFAAOC...",
    hint: "从支付宝开放平台「应用公钥」处获取，用于验证回调签名",
    multiline: true,
    secret: false,
  },
  {
    key: "alipay_key_gateway_url",
    label: "网关地址",
    placeholder: "https://openapi.alipay.com/gateway.do",
    hint: "生产环境使用默认值，沙箱测试时改为 https://openapi-sandbox.dl.alipaydev.com/gateway.do",
    multiline: false,
    secret: false,
  },
];

export default function AlipayKeysManager() {
  const [settings, setSettings] = useState({});
  const [existingIds, setExistingIds] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSecrets, setShowSecrets] = useState({});

  const load = async () => {
    setLoading(true);
    const r = await base44.functions.invoke('getAdminSettingsPageData', {});
    const allSettings = r.data?.settings || [];
    const keySettings = allSettings.filter(s => s.key.startsWith('alipay_key_'));
    const vals = {};
    const ids = {};
    keySettings.forEach(s => {
      vals[s.key] = s.value;
      ids[s.key] = s.id;
    });
    setSettings(vals);
    setExistingIds(ids);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    setSaving(true);
    await Promise.all(KEY_FIELDS.map(async (field) => {
      const val = settings[field.key] ?? '';
      if (existingIds[field.key]) {
        await tenantEntity.update('SiteSettings', existingIds[field.key], { value: val });
      } else {
        const created = await tenantEntity.create('SiteSettings', {
          key: field.key,
          value: val,
          description: field.label,
          category: 'payment',
        });
        setExistingIds(prev => ({ ...prev, [field.key]: created.id }));
      }
    }));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const isConfigured = !!settings['alipay_key_app_id'] && !!settings['alipay_key_private_key'];

  if (loading) return <p className="text-xs text-gray-400 py-4 text-center">加载中...</p>;

  return (
    <div className="space-y-4">
      {/* Status badge */}
      <div className="flex items-center gap-2">
        {isConfigured ? (
          <Badge className="bg-green-100 text-green-700 border-green-200 gap-1">
            <CheckCircle className="w-3 h-3" />已配置租户密钥
          </Badge>
        ) : (
          <Badge className="bg-amber-100 text-amber-700 border-amber-200 gap-1">
            <AlertCircle className="w-3 h-3" />未配置，使用平台默认密钥
          </Badge>
        )}
        <span className="text-xs text-gray-400">留空则自动回落至平台环境变量（ALIPAY_*）</span>
      </div>

      {/* Key fields */}
      <div className="space-y-3">
        {KEY_FIELDS.map(field => (
          <div key={field.key}>
            <div className="flex items-center justify-between mb-0.5">
              <Label className="text-xs text-gray-600 font-medium">{field.label}</Label>
              {field.secret && (
                <button
                  type="button"
                  className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
                  onClick={() => setShowSecrets(p => ({ ...p, [field.key]: !p[field.key] }))}
                >
                  {showSecrets[field.key] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  {showSecrets[field.key] ? '隐藏' : '显示'}
                </button>
              )}
            </div>
            {field.multiline ? (
              <Textarea
                rows={3}
                className="text-xs font-mono"
                placeholder={field.placeholder}
                value={settings[field.key] || ''}
                onChange={e => setSettings(p => ({ ...p, [field.key]: e.target.value }))}
                style={field.secret && !showSecrets[field.key] ? { WebkitTextSecurity: 'disc', fontFamily: 'monospace' } : {}}
              />
            ) : (
              <Input
                className="h-8 text-sm font-mono"
                placeholder={field.placeholder}
                type={field.secret && !showSecrets[field.key] ? 'password' : 'text'}
                value={settings[field.key] || ''}
                onChange={e => setSettings(p => ({ ...p, [field.key]: e.target.value }))}
              />
            )}
            <p className="text-xs text-gray-400 mt-0.5">{field.hint}</p>
          </div>
        ))}
      </div>

      <Button
        size="sm"
        className="bg-blue-600 hover:bg-blue-700"
        onClick={handleSave}
        disabled={saving}
      >
        <Save className="w-3.5 h-3.5 mr-1" />
        {saving ? '保存中...' : saved ? '已保存 ✓' : '保存支付宝密钥'}
      </Button>
    </div>
  );
}