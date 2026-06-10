/**
 * PlatformNotificationManager - 平台管理员跨租户通知管理
 */
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Send, Globe, Users, Loader2, Mail, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

const notificationTypes = [
  { value: "payment", label: "付款通知" },
  { value: "shipping_request", label: "发货通知" },
  { value: "order_status", label: "订单状态" },
  { value: "message", label: "留言回复" },
  { value: "other", label: "其他通知" },
  { value: "platform", label: "平台通知" },
];

const commonSubtypes = {
  payment: [
    { value: "order_payment_required", label: "订单需付款" },
    { value: "order_supplement_required", label: "订单需补款" },
    { value: "shipping_fee_required", label: "需付运费" },
    { value: "shipping_fee_supplement_required", label: "需补运费" },
  ],
  shipping_request: [
    { value: "shipping_request_sent", label: "发货申请已发出" },
    { value: "shipping_request_arrived", label: "发货申请已送达中转地" },
    { value: "transit_shipped", label: "中转地已发货" },
  ],
  order_status: [
    { value: "order_created", label: "订单创建" },
    { value: "order_payment_confirmed", label: "订单付款已被确认" },
    { value: "order_purchased", label: "订单已下单" },
    { value: "order_in_warehouse", label: "订单已入库" },
    { value: "order_added_to_pool", label: "订单已添加至发货申请" },
  ],
  message: [
    { value: "new_reply", label: "订单/发货申请有新回复" },
  ],
  other: [
    { value: "store_template_pending_review", label: "店铺模板提交待审核（管理员）" },
    { value: "store_template_reviewed", label: "店铺模板审核结果通知（用户）" },
  ],
  platform: [
    { value: "system_maintenance", label: "系统维护" },
    { value: "new_feature_announcement", label: "新功能公告" },
    { value: "policy_update", label: "政策更新" },
  ],
};

const priorities = [
  { value: "low", label: "低" },
  { value: "normal", label: "普通" },
  { value: "high", label: "高" },
  { value: "urgent", label: "紧急" },
];

export default function PlatformNotificationManager() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    notification_type: "platform",
    notification_subtype: "",
    title: "",
    content: "",
    priority: "normal",
    related_url: "",
    send_to_all_tenants: true,
    target_tenant_ids: [],
    send_email: false,
  });

  const { data: tenants } = useQuery({
    queryKey: ['all-tenants'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getTenantContext', {});
      return res.data?.tenants || [];
    },
  });

  const createNotificationMutation = useMutation({
    mutationFn: async (data) => {
      const res = await base44.functions.invoke('createPlatformNotification', data);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`成功发送 ${data.sent_count} 条通知到 ${data.tenant_count} 个租户`);
      setFormData({
        notification_type: "platform",
        notification_subtype: "",
        title: "",
        content: "",
        priority: "normal",
        related_url: "",
        send_to_all_tenants: true,
        target_tenant_ids: [],
        send_email: false,
      });
    },
    onError: (error) => {
      toast.error('创建失败：' + error.message);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.title || !formData.content) {
      toast.error('请填写标题和内容');
      return;
    }

    if (!formData.send_to_all_tenants && formData.target_tenant_ids.length === 0) {
      toast.error('请选择目标租户或勾选发送给所有租户');
      return;
    }

    createNotificationMutation.mutate(formData);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">平台通知管理</h1>
        <p className="text-sm text-gray-500 mt-1">创建跨租户的系统通知</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            创建平台通知
          </CardTitle>
          <CardDescription>
            发送通知给一个或多个租户的所有用户
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Target Tenants */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">目标租户</label>
              <div className="flex items-center gap-4 mb-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="send_to_all_tenants"
                    checked={formData.send_to_all_tenants}
                    onCheckedChange={(checked) => setFormData({ 
                      ...formData, 
                      send_to_all_tenants: checked,
                      target_tenant_ids: checked ? [] : formData.target_tenant_ids 
                    })}
                  />
                  <label htmlFor="send_to_all_tenants" className="text-sm text-gray-700 flex items-center gap-1">
                    <Globe className="w-4 h-4" />
                    发送给所有租户
                  </label>
                </div>
              </div>

              {!formData.send_to_all_tenants && (
                <div className="border rounded-md p-3 max-h-60 overflow-y-auto">
                  {tenants?.map((tenant) => (
                    <div key={tenant.id} className="flex items-center gap-2 py-2">
                      <Checkbox
                        id={`tenant-${tenant.id}`}
                        checked={formData.target_tenant_ids.includes(tenant.id)}
                        onCheckedChange={(checked) => {
                          setFormData({
                            ...formData,
                            target_tenant_ids: checked
                              ? [...formData.target_tenant_ids, tenant.id]
                              : formData.target_tenant_ids.filter(id => id !== tenant.id)
                          });
                        }}
                      />
                      <label htmlFor={`tenant-${tenant.id}`} className="text-sm text-gray-700">
                        {tenant.name || tenant.subdomain}
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Notification Type */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">通知类型</label>
              <Select
                value={formData.notification_type}
                onValueChange={(value) => setFormData({ ...formData, notification_type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择通知类型" />
                </SelectTrigger>
                <SelectContent>
                  {notificationTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Notification Subtype */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">通知子类型（可选）</label>
              <Select
                value={formData.notification_subtype}
                onValueChange={(value) => setFormData({ ...formData, notification_subtype: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择通知子类型" />
                </SelectTrigger>
                <SelectContent>
                  {commonSubtypes[formData.notification_type]?.map((subtype) => (
                    <SelectItem key={subtype.value} value={subtype.value}>
                      {subtype.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">优先级</label>
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData({ ...formData, priority: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择优先级" />
                </SelectTrigger>
                <SelectContent>
                  {priorities.map((priority) => (
                    <SelectItem key={priority.value} value={priority.value}>
                      {priority.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">标题</label>
              <Input
                placeholder="通知标题"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            {/* Content */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">内容</label>
              <Textarea
                placeholder="通知内容（支持 HTML/Markdown）"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                className="min-h-[120px]"
              />
            </div>

            {/* Related URL */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">关联 URL（可选）</label>
              <Input
                placeholder="/Announcements 或 /Platform/News"
                value={formData.related_url}
                onChange={(e) => setFormData({ ...formData, related_url: e.target.value })}
              />
            </div>

            {/* Send Email Option */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="send_email"
                checked={formData.send_email}
                onCheckedChange={(checked) => setFormData({ ...formData, send_email: checked })}
              />
              <label htmlFor="send_email" className="text-sm text-gray-700 flex items-center gap-1">
                <Mail className="w-4 h-4" />
                同时发送邮件通知（根据用户偏好）
              </label>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={createNotificationMutation.isPending}
              className="w-full"
            >
              {createNotificationMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  发送中...
                </>
              ) : (
                <>
                  <Bell className="w-4 h-4 mr-2" />
                  发送平台通知
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Usage Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            使用说明
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-gray-600">
          <p>• 平台通知会发送给所有租户的所有用户</p>
          <p>• 可选择发送给特定租户</p>
          <p>• 通知类型用于分类管理，方便用户筛选</p>
          <p>• 关联 URL 可以让用户点击通知直接跳转到相关页面</p>
          <p>• 邮件发送会尊重用户的个人通知偏好设置</p>
          <p>• 通知会自动记录发送者和发送时间</p>
        </CardContent>
      </Card>
    </div>
  );
}