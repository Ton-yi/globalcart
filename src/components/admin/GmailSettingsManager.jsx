import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Mail, Link as LinkIcon, CheckCircle, XCircle, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function GmailSettingsManager() {
  const { user } = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [connected, setConnected] = useState(false);
  const [settings, setSettings] = useState(null);
  const [senderName, setSenderName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");

  // 加载租户邮箱设置
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      
      // 获取租户邮箱设置
      const settingsList = await base44.entities.TenantEmailSettings.filter({
        tenant_id: user.tenant_id
      });
      
      const currentSettings = settingsList && settingsList.length > 0 ? settingsList[0] : null;
      setSettings(currentSettings);
      
      if (currentSettings) {
        setSenderName(currentSettings.sender_name || "");
        setSenderEmail(currentSettings.sender_email || "");
        setConnected(currentSettings.gmail_connection_enabled || false);
      }
      
      // 检查 Gmail 连接状态 - 使用后端函数
      try {
        console.log('[GmailSettings] 检查 Gmail 连接状态...');
        const result = await base44.functions.invoke('checkGmailConnection', {});
        console.log('[GmailSettings] 连接状态:', result);
        if (result.success && result.connected) {
          setConnected(true);
          console.log('[GmailSettings] Gmail 已授权');
        } else {
          // 如果检查失败但设置中已启用，保持启用状态
          setConnected(currentSettings?.gmail_connection_enabled || false);
          console.log('[GmailSettings] Gmail 检查失败，使用设置中的状态');
        }
      } catch (e) {
        console.log('[GmailSettings] Gmail 检查失败:', e.message);
        // 出错时使用设置中的状态
        setConnected(currentSettings?.gmail_connection_enabled || false);
      }
    } catch (error) {
      console.error('加载邮箱设置失败:', error);
      toast.error('加载设置失败：' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 启用 Gmail - 直接启用并发送测试邮件
  const handleConnectGmail = async () => {
    try {
      setConnecting(true);
      
      console.log('[GmailSettings] 启用 Gmail...');
      
      // 先更新设置启用 Gmail
      if (!settings) {
        await base44.entities.TenantEmailSettings.create({
          tenant_id: user.tenant_id,
          email_provider: 'gmail',
          gmail_connection_enabled: true,
          configured_by: user.email,
          configured_at: new Date().toISOString()
        });
      } else {
        await base44.entities.TenantEmailSettings.update(settings.id, {
          email_provider: 'gmail',
          gmail_connection_enabled: true,
          configured_by: user.email,
          configured_at: new Date().toISOString()
        });
      }
      
      // 发送测试邮件验证
      const testResult = await base44.functions.invoke('sendEmailViaGmail', {
        to: user.email,
        subject: 'Gmail 连接测试 - 同一物流',
        body: '<h2>测试邮件</h2><p>如果您收到这封邮件，说明 Gmail 连接配置成功！</p><p>发自：同一物流通知中心</p>',
        from_name: senderName || '同一物流通知中心',
        from_email: senderEmail || null
      });
      
      if (testResult.success || testResult.message_id) {
        console.log('[GmailSettings] Gmail 启用成功，邮件 ID:', testResult.message_id);
        toast.success('Gmail 已启用！已发送测试邮件到您的邮箱');
        setConnected(true);
        await loadSettings();
      } else {
        throw new Error('测试邮件发送失败：' + (testResult.error || '未知错误'));
      }
      
    } catch (error) {
      console.error('启用 Gmail 失败:', error);
      toast.error('启用失败：' + (error.message || '未知错误'));
    } finally {
      setConnecting(false);
    }
  };

  // 断开 Gmail 连接 - Shared 模式只需更新租户设置
  const handleDisconnectGmail = async () => {
    try {
      if (!confirm('确定要断开 Gmail 连接吗？断开后将使用平台默认邮件服务发送邮件。')) {
        return;
      }
      
      // 更新设置，禁用 Gmail
      if (settings) {
        await base44.entities.TenantEmailSettings.update(settings.id, {
          gmail_connection_enabled: false
        });
      }
      
      setConnected(false);
      toast.success('已断开 Gmail 连接');
      await loadSettings();
    } catch (error) {
      console.error('断开连接失败:', error);
      toast.error('断开连接失败：' + error.message);
    }
  };

  // 保存发件人设置
  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      
      if (!connected) {
        toast.error('请先连接 Gmail 账号');
        return;
      }
      
      const data = {
        tenant_id: user.tenant_id,
        email_provider: 'gmail',
        gmail_connection_enabled: true,
        sender_name: senderName,
        sender_email: senderEmail,
        configured_by: user.email,
        configured_at: new Date().toISOString()
      };
      
      if (settings) {
        await base44.entities.TenantEmailSettings.update(settings.id, data);
      } else {
        await base44.entities.TenantEmailSettings.create(data);
      }
      
      toast.success('设置已保存');
      await loadSettings();
    } catch (error) {
      console.error('保存设置失败:', error);
      toast.error('保存失败：' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-500">加载中...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Gmail 连接状态 */}
      <Card className={connected ? "border-green-200 bg-green-50" : "border-gray-200"}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Gmail 连接状态
            {connected && <CheckCircle className="w-4 h-4 text-green-600" />}
            {!connected && <XCircle className="w-4 h-4 text-gray-400" />}
          </CardTitle>
          <CardDescription className="text-xs">
            {connected 
              ? "已连接 Gmail，通知邮件将通过 Gmail 发送" 
              : "未连接 Gmail，通知邮件将通过平台默认邮件服务发送"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!connected ? (
            <div className="space-y-3">
              <Alert className="border-blue-200 bg-blue-50">
                <AlertDescription className="text-xs text-blue-700">
                  <strong>提示：</strong>Gmail 连接器已由平台授权（Shared 模式）。
                  <br />点击"启用 Gmail"后，通知邮件将通过平台的 Gmail 账号发送。
                  <br />Gmail scope: <code className="bg-blue-100 px-1 rounded text-xs">gmail.send</code>
                </AlertDescription>
              </Alert>
              
              <Button 
                onClick={handleConnectGmail} 
                disabled={connecting}
                className="w-full bg-red-600 hover:bg-red-700"
              >
                {connecting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    启用中...
                  </>
                ) : (
                  <>
                    <LinkIcon className="w-4 h-4 mr-2" />
                    启用 Gmail
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-green-200">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-green-700">Gmail 已连接</span>
                </div>
                <Badge variant="outline" className="text-xs bg-green-100 text-green-700 border-green-200">
                  已授权
                </Badge>
              </div>
              
              <Button 
                variant="outline" 
                onClick={handleDisconnectGmail}
                className="w-full border-red-200 text-red-600 hover:bg-red-50"
              >
                断开 Gmail 连接
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 发件人设置 */}
      <Card className="border-gray-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Mail className="w-4 h-4" />
            发件人设置
          </CardTitle>
          <CardDescription className="text-xs">
            配置发送邮件时显示的发件人信息
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs text-gray-500">发件人名称</Label>
            <Input
              className="mt-1 h-9 text-sm"
              placeholder="例如：同一物流通知中心"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              disabled={!connected}
            />
            <p className="text-xs text-gray-400 mt-1">
              显示在邮件中的发件人名称
            </p>
          </div>

          <div>
            <Label className="text-xs text-gray-500">发件人邮箱（可选）</Label>
            <Input
              className="mt-1 h-9 text-sm"
              placeholder="例如：noreply@yourcompany.com"
              value={senderEmail}
              onChange={(e) => setSenderEmail(e.target.value)}
              disabled={!connected}
            />
            <p className="text-xs text-gray-400 mt-1">
              留空则使用 Gmail 账号的默认邮箱
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button 
              onClick={handleSaveSettings} 
              disabled={saving || !connected}
              className="flex-1"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  保存设置
                </>
              )}
            </Button>
          </div>

          {!connected && (
            <Alert className="border-orange-200 bg-orange-50">
              <AlertDescription className="text-xs text-orange-700">
                ⚠ 请先连接 Gmail 账号后再配置发件人设置
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* 使用说明 */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-blue-800">
            使用说明
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-blue-700">
          <p>• 连接 Gmail 后，所有通知邮件将通过 Gmail 发送</p>
          <p>• Gmail 需要授权 <code className="bg-blue-100 px-1 rounded">gmail.send</code> 权限</p>
          <p>• 发件人名称会显示在邮件的 "From" 字段</p>
          <p>• 可以随时断开连接，切换回平台默认邮件服务</p>
          <p>• 建议设置专业的发件人名称，提升用户体验</p>
        </CardContent>
      </Card>
    </div>
  );
}