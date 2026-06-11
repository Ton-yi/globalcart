import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Mail, Save, TestTube, Eye, EyeOff, Loader2, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

export default function SMTPSettingsManager() {
  const { user } = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [settings, setSettings] = useState(null);
  const [testResult, setTestResult] = useState(null);
  
  const [formData, setFormData] = useState({
    smtp_enabled: false,
    smtp_host: "",
    smtp_port: "587",
    smtp_username: "",
    smtp_password: "",
    smtp_from_name: "",
    smtp_from_email: "",
    sender_name: "",
    sender_email: ""
  });

  const loadSettings = async () => {
    try {
      const settingsList = await base44.entities.TenantEmailSettings.filter({
        tenant_id: user.tenant_id
      });
      
      const currentSettings = settingsList && settingsList.length > 0 ? settingsList[0] : null;
      setSettings(currentSettings);
      
      if (currentSettings) {
        setFormData({
          smtp_enabled: currentSettings.smtp_enabled || false,
          smtp_host: currentSettings.smtp_host || "",
          smtp_port: currentSettings.smtp_port || "587",
          smtp_username: currentSettings.smtp_username || "",
          // 安全：不加载密码，保持空白
          smtp_password: "",
          smtp_from_name: currentSettings.smtp_from_name || "",
          smtp_from_email: currentSettings.smtp_from_email || "",
          sender_name: currentSettings.sender_name || "",
          sender_email: currentSettings.sender_email || ""
        });
      }
    } catch (error) {
      console.error('加载 SMTP 设置失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSettings(); }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      // 权限验证
      if (user.role !== 'admin' && user.role !== 'tenant_admin') {
        toast.error('仅管理员可配置 SMTP 设置');
        setSaving(false);
        return;
      }

      // 验证必填字段
      if (formData.smtp_enabled) {
        if (!formData.smtp_host || !formData.smtp_username) {
          toast.error('SMTP 服务器和用户名为必填项');
          setSaving(false);
          return;
        }
        // 密码验证：新建时必须，更新时可选
        if (!settings && !formData.smtp_password) {
          toast.error('首次配置必须提供 SMTP 密码');
          setSaving(false);
          return;
        }
      }

      const saveData = {
        tenant_id: user.tenant_id,
        email_provider: formData.smtp_enabled ? 'smtp' : 'platform',
        smtp_enabled: formData.smtp_enabled,
        smtp_host: formData.smtp_host,
        smtp_port: formData.smtp_port,
        smtp_username: formData.smtp_username,
        smtp_from_name: formData.smtp_from_name,
        smtp_from_email: formData.smtp_from_email,
        sender_name: formData.sender_name,
        sender_email: formData.sender_email,
        configured_by: user.email,
        configured_at: new Date().toISOString()
      };

      // 仅当密码非空时才保存（更新场景）
      if (formData.smtp_password) {
        saveData.smtp_password = formData.smtp_password;
      }

      if (!settings) {
        await base44.entities.TenantEmailSettings.create(saveData);
      } else {
        await base44.entities.TenantEmailSettings.update(settings.id, saveData);
      }
      
      toast.success('SMTP 设置已保存');
      setFormData(prev => ({ ...prev, smtp_password: '' }));
      await loadSettings();
    } catch (error) {
      toast.error('保存失败：' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await base44.functions.invoke('sendEmailViaSMTP', {
        to: user.email,
        subject: 'SMTP 连接测试 - 同一物流',
        body: '<h2>测试邮件</h2><p>如果您收到这封邮件，说明 SMTP 配置成功！</p>',
        from_name: formData.smtp_from_name || '同一物流通知中心',
        from_email: formData.smtp_from_email || formData.smtp_username
      });
      
      setTestResult(result);
      if (result.success) {
        toast.success('测试邮件发送成功！');
      } else {
        toast.error('测试失败：' + (result.error || '未知错误'));
      }
    } catch (error) {
      setTestResult({ success: false, error: error.message });
      toast.error('测试失败：' + error.message);
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-gray-400">加载中...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-3 border-b">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-blue-500" />
          <div>
            <Label className="text-sm font-medium">启用 SMTP 发信</Label>
            <p className="text-xs text-gray-400">使用自定义 SMTP 服务器发送通知邮件</p>
          </div>
        </div>
        <input
          type="checkbox"
          checked={formData.smtp_enabled}
          onChange={(e) => setFormData({ ...formData, smtp_enabled: e.target.checked })}
          className="h-4 w-4"
        />
      </div>

      {formData.smtp_enabled && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-500">SMTP 服务器 <span className="text-red-500">*</span></Label>
              <Input
                className="h-8 text-sm"
                placeholder="smtp.gmail.com"
                value={formData.smtp_host}
                onChange={(e) => setFormData({ ...formData, smtp_host: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500">端口 <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                className="h-8 text-sm"
                placeholder="587"
                value={formData.smtp_port}
                onChange={(e) => setFormData({ ...formData, smtp_port: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label className="text-xs text-gray-500">SMTP 用户名 <span className="text-red-500">*</span></Label>
            <Input
              className="h-8 text-sm"
              placeholder="your@email.com"
              value={formData.smtp_username}
              onChange={(e) => setFormData({ ...formData, smtp_username: e.target.value })}
            />
          </div>

          <div>
            <Label className="text-xs text-gray-500">SMTP 密码/授权码 <span className="text-red-500">*</span></Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                className="h-8 text-sm pr-10"
                placeholder="••••••••"
                value={formData.smtp_password}
                onChange={(e) => setFormData({ ...formData, smtp_password: e.target.value })}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-500">发件人名称</Label>
              <Input
                className="h-8 text-sm"
                placeholder="同一物流通知中心"
                value={formData.smtp_from_name}
                onChange={(e) => setFormData({ ...formData, smtp_from_name: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500">发件人邮箱</Label>
              <Input
                className="h-8 text-sm"
                placeholder="通知邮箱地址"
                value={formData.smtp_from_email}
                onChange={(e) => setFormData({ ...formData, smtp_from_email: e.target.value })}
              />
            </div>
          </div>
        </>
      )}

      <div className="border-t pt-3">
        <Label className="text-xs text-gray-500 mb-2 block">通用设置</Label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-gray-500">默认发件人名称</Label>
            <Input
              className="h-8 text-sm"
              placeholder="同一物流通知中心"
              value={formData.sender_name}
              onChange={(e) => setFormData({ ...formData, sender_name: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs text-gray-500">默认发件人邮箱</Label>
            <Input
              className="h-8 text-sm"
              placeholder="通知邮箱地址"
              value={formData.sender_email}
              onChange={(e) => setFormData({ ...formData, sender_email: e.target.value })}
            />
          </div>
        </div>
      </div>

      {testResult && (
        <Alert className={testResult.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
          {testResult.success ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <XCircle className="h-4 w-4 text-red-600" />
          )}
          <AlertDescription className="text-sm ml-2 text-gray-700">
            {testResult.message || (testResult.error || '测试完成')}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2 pt-3 border-t">
        <Button 
          size="sm" 
          className="flex-1 bg-blue-600 hover:bg-blue-700"
          onClick={handleSave}
          disabled={saving || !formData.smtp_enabled}
        >
          <Save className="w-4 h-4 mr-1.5" />
          {saving ? "保存中..." : "保存设置"}
        </Button>
        <Button 
          size="sm" 
          variant="outline"
          className="flex-1"
          onClick={handleTest}
          disabled={testing || !formData.smtp_enabled || !formData.smtp_host || !formData.smtp_username || !formData.smtp_password}
        >
          {testing ? (
            <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
          ) : (
            <TestTube className="w-4 h-4 mr-1.5" />
          )}
          {testing ? "测试中..." : "发送测试邮件"}
        </Button>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded p-3">
        <p className="text-xs text-amber-800 font-semibold mb-1">🔒 安全提示</p>
        <ul className="text-xs text-amber-700 space-y-1">
          <li>• 密码仅在保存时传输，不会回显到前端</li>
          <li>• 建议使用应用专用密码而非登录密码</li>
          <li>• 定期更换 SMTP 密码以保安全</li>
        </ul>
      </div>

      <Alert className="border-amber-200 bg-amber-50">
        <AlertCircle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-xs text-amber-700 ml-2">
          <strong>⚠ 安全提示：</strong>密码以加密形式存储，仅用于邮件发送。建议使用邮箱服务商提供的授权码而非登录密码。
        </AlertDescription>
      </Alert>

      <div className="bg-gray-50 border border-gray-200 rounded p-3">
        <p className="text-xs text-gray-600 font-semibold mb-2">📧 常见邮箱 SMTP 设置：</p>
        <ul className="text-xs text-gray-500 space-y-1">
          <li><strong>Gmail：</strong>smtp.gmail.com | 端口 587 | 需应用专用密码</li>
          <li><strong>QQ 邮箱：</strong>smtp.qq.com | 端口 587 | 需 SMTP 授权码</li>
          <li><strong>163 邮箱：</strong>smtp.163.com | 端口 587 | 需 SMTP 授权码</li>
          <li><strong>Outlook：</strong>smtp-mail.outlook.com | 端口 587</li>
        </ul>
      </div>
    </div>
  );
}