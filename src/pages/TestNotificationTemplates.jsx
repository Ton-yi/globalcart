/**
 * 测试通知模板显示和触发
 */
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Clock, Bell, Mail } from "lucide-react";
import { toast } from "sonner";

const expectedSubtypes = {
  payment: [
    "order_payment_required",
    "order_supplement_required",
    "shipping_fee_required",
    "shipping_fee_supplement_required",
  ],
  shipping_request: [
    "shipping_request_sent",
    "shipping_request_arrived",
    "transit_shipped",
  ],
  order_status: [
    "order_created",
    "order_payment_confirmed",
    "order_purchased",
    "order_in_warehouse",
    "order_added_to_pool",
  ],
  message: [
    "new_reply",
  ],
  other: [
    "store_template_pending_review",
    "store_template_reviewed",
  ],
};

export default function TestNotificationTemplates() {
  const [testing, setTesting] = useState(false);

  const { data: templates, refetch } = useQuery({
    queryKey: ['notification-templates'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getNotificationTemplates', {});
      return res.data.templates || [];
    },
  });

  const handleInitializeTemplates = async () => {
    setTesting(true);
    try {
      const res = await base44.functions.invoke('initializeDefaultNotificationTemplates', {});
      toast.success(`初始化完成：创建${res.data.created_count}个，更新${res.data.updated_count}个模板`);
      refetch();
    } catch (error) {
      toast.error('初始化失败：' + error.message);
    }
    setTesting(false);
  };

  // 检查模板完整性
  const templateStats = {
    total: templates?.length || 0,
    byType: {},
    missing: [],
  };

  templates?.forEach(template => {
    const type = template.notification_type;
    if (!templateStats.byType[type]) {
      templateStats.byType[type] = { count: 0, subtypes: [] };
    }
    templateStats.byType[type].count++;
    templateStats.byType[type].subtypes.push(template.notification_subtype);
  });

  // 检查缺失的子类型
  Object.entries(expectedSubtypes).forEach(([type, subtypes]) => {
    const existingSubtypes = templateStats.byType[type]?.subtypes || [];
    subtypes.forEach(subtype => {
      if (!existingSubtypes.includes(subtype)) {
        templateStats.missing.push(`${type}.${subtype}`);
      }
    });
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">通知模板测试</h1>
          <p className="text-sm text-gray-500 mt-1">验证通知模板完整性和触发逻辑</p>
        </div>
        <Button onClick={handleInitializeTemplates} disabled={testing}>
          <Bell className="w-4 h-4 mr-2" />
          {testing ? '初始化中...' : '初始化默认模板'}
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">模板总数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{templateStats.total}</div>
            <p className="text-xs text-gray-400 mt-1">
              期望：{Object.values(expectedSubtypes).flat().length} 个
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">缺失模板</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{templateStats.missing.length}</div>
            {templateStats.missing.length > 0 && (
              <p className="text-xs text-red-400 mt-1 truncate">
                {templateStats.missing.slice(0, 3).join(', ')}...
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">完整性</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {Math.round((templateStats.total / Object.values(expectedSubtypes).flat().length) * 100)}%
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {templateStats.missing.length === 0 ? '✓ 完整' : '⚠ 不完整'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 按类型统计 */}
      <div className="grid gap-4">
        {Object.entries(expectedSubtypes).map(([type, subtypes]) => {
          const stats = templateStats.byType[type];
          const existingCount = stats?.count || 0;
          const expectedCount = subtypes.length;
          const isComplete = existingCount === expectedCount;

          return (
            <Card key={type}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-gray-700">
                    {type === 'payment' && '付款通知'}
                    {type === 'shipping_request' && '发货通知'}
                    {type === 'order_status' && '订单状态'}
                    {type === 'message' && '留言回复'}
                    {type === 'other' && '其他通知'}
                  </CardTitle>
                  <Badge variant={isComplete ? "default" : "destructive"} className="text-xs">
                    {isComplete ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                    {existingCount}/{expectedCount}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {subtypes.map(subtype => {
                    const exists = stats?.subtypes?.includes(subtype);
                    return (
                      <div key={subtype} className="flex items-center gap-2 text-xs">
                        {exists ? (
                          <CheckCircle2 className="w-3 h-3 text-green-600 flex-shrink-0" />
                        ) : (
                          <XCircle className="w-3 h-3 text-red-600 flex-shrink-0" />
                        )}
                        <span className={exists ? 'text-gray-700' : 'text-red-600'}>
                          {subtype}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 模板列表 */}
      {templates && templates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>现有模板列表</CardTitle>
            <CardDescription>共 {templates.length} 个模板</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {templates.map(template => (
                <div key={template.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{template.notification_type}</span>
                      <Badge variant="outline" className="text-xs">
                        {template.notification_subtype}
                      </Badge>
                    </div>
                    <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                      {template.default_in_app && (
                        <span className="flex items-center gap-1">
                          <Bell className="w-3 h-3" /> 站内
                        </span>
                      )}
                      {template.default_email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" /> 邮件
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">
                    更新于：{new Date(template.updated_date).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 使用说明 */}
      <Card>
        <CardHeader>
          <CardTitle>验证步骤</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-gray-600">
          <p>• 点击"初始化默认模板"按钮创建所有 15 个默认模板</p>
          <p>• 检查每个类型的子类型是否完整</p>
          <p>• 在 Dashboard → Automations 中配置触发器</p>
          <p>• 测试实际触发（创建订单、更新状态等）</p>
          <p>• 验证用户是否收到通知</p>
        </CardContent>
      </Card>
    </div>
  );
}