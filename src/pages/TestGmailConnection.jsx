import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Mail, CheckCircle, XCircle, Loader2, Send, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function TestGmailConnection() {
  const { user } = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [settings, setSettings] = useState(null);
  const [testEmail, setTestEmail] = useState(user?.email || "");

  // 检查 Gmail 连接状态
  const checkConnection = async () => {
    try {
      setLoading(true);
      
      // 1. 检查 Gmail 连接器连接状态
      try {
        const connection = await base44.asServiceRole.connectors.getConnection('gmail');
        setConnectionStatus({
          connected: !!connection?.accessToken,
          email: connection?.connectionConfig?.email || null,
        });
      } catch (e) {
        setConnectionStatus({ connected: false, email: null });
      }

      // 2. 检查租户邮箱设置
      const settingsList = await base44.entities.TenantEmailSettings.filter({
        tenant_id: user.tenant_id
      });
      
      const currentSettings = settingsList && settingsList.length > 0 ? settingsList[0] : null;
      setSettings(currentSettings);

    } catch (error) {
      console.error('检查连接状态失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.tenant_id) {
      checkConnection();
    }
  }, [user?.tenant_id]);

  // 发送测试邮件
  const handleSendTestEmail = async () => {
    if (!connectionStatus?.connected) {
      toast.error('Gmail 未连接');
      return;
    }

    if (!testEmail) {
      toast.error('请输入测试邮箱');
      return;
    }

    try {
      setTesting(true);
      
      await base44.functions.invoke('sendEmailViaGmail', {
        to: testEmail,
        subject: '【测试邮件】Gmail 集成验证',
        body: `
          <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6;">
              <h2 style="color: #333;">Gmail 集成测试成功 ✓</h2>
              <p>这是一封测试邮件，用于验证 Gmail 集成功能。</p>
              
              <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #666;">测试详情</h3>
                <p><strong>发送时间：</strong>${new Date().toLocaleString('ja-JP')}</p>
                <p><strong>接收邮箱：</strong>${testEmail}</p>
                <p><strong>租户：</strong>${user.tenant_name || user.tenant_id}</p>
                <p><strong>用户：</strong>${user.full_name || user.email}</p>
              </div>
              
              <p style="color: #666; font-size: 14px;">
                如果收到此邮件，说明 Gmail 集成工作正常。邮件是通过租户配置的 Gmail 账号发送的。
              </p>
              
              <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
              <p style="color: #999; font-size: 12px;">
                此邮件由同一物流通知系统自动发送 · Gmail Integration Test
              </p>
            </body>
          </html>
        `,
        from_name: settings?.sender_name || '同一物流测试',
        from_email: settings?.sender_email || null,
      });

      toast.success(`测试邮件已发送至 ${testEmail}`);
    } catch (error) {
      console.error('发送测试邮件失败:', error);
      toast.error('发送失败：' + error.message);
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-500">检查连接状态中...</span>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-6 space-y-4">
      <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
        <Mail className="w-5 h-5" />
        Gmail 连接测试
      </h1>

      {/* 连接状态卡片 */}
      <Card className={connectionStatus?.connected ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            {connectionStatus?.connected ? (
              <>
                <CheckCircle className="w-4 h-4 text-green-600" />
                Gmail 已连接
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4 text-red-600" />
                Gmail 未连接
              </>
            )}
          </CardTitle>
          <CardDescription className="text-xs">
            {connectionStatus?.connected 
              ? "Gmail 连接器已授权，可以发送邮件" 
              : "Gmail 连接器未授权，无法发送邮件"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {connectionStatus?.connected && connectionStatus?.email && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-white text-green-700 border-green-200">
                {connectionStatus.email}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 租户设置卡片 */}
      {settings && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-blue-800">
              租户邮箱设置
            </CardTitle>
            <CardDescription className="text-xs text-blue-700">
              当前租户已配置 Gmail 发件箱
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-blue-700">
            <div className="flex justify-between">
              <span>发件人名称:</span>
              <span className="font-medium">{settings.sender_name || '未设置'}</span>
            </div>
            <div className="flex justify-between">
              <span>发件人邮箱:</span>
              <span className="font-medium">{settings.sender_email || '使用 Gmail 默认'}</span>
            </div>
            <div className="flex justify-between">
              <span>配置者:</span>
              <span className="font-medium">{settings.configured_by || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span>配置时间:</span>
              <span className="font-medium">
                {settings.configured_at ? new Date(settings.configured_at).toLocaleString('ja-JP') : '-'}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 测试邮件卡片 */}
      <Card className="border-gray-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Send className="w-4 h-4" />
            发送测试邮件
          </CardTitle>
          <CardDescription className="text-xs">
            向指定邮箱发送测试邮件，验证 Gmail 集成是否正常工作
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!connectionStatus?.connected ? (
            <Alert className="border-orange-200 bg-orange-50">
              <AlertCircle className="w-4 h-4 text-orange-600" />
              <AlertDescription className="text-xs text-orange-700">
                Gmail 未连接，无法发送测试邮件。请先在「网站设置 → 通知设置」中连接 Gmail。
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div>
                <Label className="text-xs text-gray-500">测试邮箱</Label>
                <Input
                  className="mt-1 h-9 text-sm"
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="test@example.com"
                />
                <p className="text-xs text-gray-400 mt-1">
                  默认为当前用户邮箱：{user?.email}
                </p>
              </div>

              <Button 
                onClick={handleSendTestEmail} 
                disabled={testing}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {testing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    发送中...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    发送测试邮件
                  </>
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* 使用说明 */}
      <Card className="border-gray-200 bg-gray-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-700">
            使用说明
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-gray-600">
          <p>• Gmail 连接器已授权，租户管理员可配置自己的 Gmail 账号</p>
          <p>• 配置路径：网站设置 → 通知设置 → Gmail 邮箱设置</p>
          <p>• 发送邮件时会优先使用租户配置的 Gmail，未配置则使用平台默认服务</p>
          <p>• 测试邮件会发送 HTML 格式的验证内容，包含发送时间等信息</p>
        </CardContent>
      </Card>
    </div>
  );
}