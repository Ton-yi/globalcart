/**
 * AdminNotificationManager - 管理员通知管理页面
 * 用于创建和管理系统通知
 */
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Send, Users, User, AlertCircle, CheckCircle, Loader2, Mail, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const notificationTypes = [
  { value: "payment", label: "付款通知" },
  { value: "shipping_request", label: "发货通知" },
  { value: "order_status", label: "订单状态" },
  { value: "message", label: "留言回复" },
  { value: "other", label: "其他通知" },
  { value: "platform", label: "平台通知" },
];

const priorities = [
  { value: "low", label: "低" },
  { value: "normal", label: "普通" },
  { value: "high", label: "高" },
  { value: "urgent", label: "紧急" },
];

export default function AdminNotificationManager() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("create");
  const [formData, setFormData] = useState({
    user_email: "",
    notification_type: "order_status",
    notification_subtype: "",
    title: "",
    content: "",
    priority: "normal",
    related_url: "",
    send_to_all: false,
    send_email: false,
  });

  const { data: tenantUsers } = useQuery({
    queryKey: ['tenant-users'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getTenantUsers', {});
      return res.data.users || [];
    },
  });

  const { data: notifications } = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getUserNotifications', { limit: 50, skip: 0 });
      return res.data.notifications || [];
    },
    enabled: activeTab === 'history',
  });

  const createNotificationMutation = useMutation({
    mutationFn: async (data) => {
      const res = await base44.functions.invoke('createNotification', data);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.sent_count ? `成功发送 ${data.sent_count} 条通知` : '通知创建成功');
      setFormData({
        user_email: "",
        notification_type: "order_status",
        notification_subtype: "",
        title: "",
        content: "",
        priority: "normal",
        related_url: "",
        send_to_all: false,
      });
      queryClient.invalidateQueries({ queryKey: ['notification-unread-count'] });
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

    if (!formData.send_to_all && !formData.user_email) {
      toast.error('请选择接收用户或勾选发送给所有用户');
      return;
    }

    createNotificationMutation.mutate(formData);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">通知管理</h1>
          <p className="text-sm text-gray-500 mt-1">创建和管理系统通知</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={activeTab === "create" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("create")}
          >
            <Send className="w-4 h-4 mr-2" />
            创建通知
          </Button>
          <Button
            variant={activeTab === "history" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("history")}
          >
            <Bell className="w-4 h-4 mr-2" />
            通知历史
          </Button>
        </div>
      </div>

      {activeTab === "create" ? (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="w-5 h-5" />
            创建新通知
          </CardTitle>
          <CardDescription>
            发送通知给单个用户或所有用户
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Send To */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">接收用户</label>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="send_to_all"
                    checked={formData.send_to_all}
                    onChange={(e) => setFormData({ ...formData, send_to_all: e.target.checked, user_email: "" })}
                    className="h-4 w-4"
                  />
                  <label htmlFor="send_to_all" className="text-sm text-gray-700 flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    发送给所有用户
                  </label>
                </div>
              </div>
              {!formData.send_to_all && (
                <Select
                  value={formData.user_email}
                  onValueChange={(value) => setFormData({ ...formData, user_email: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择用户" />
                  </SelectTrigger>
                  <SelectContent>
                    {tenantUsers?.map((user) => (
                      <SelectItem key={user.id} value={user.email}>
                        {user.full_name || user.email} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
              <Input
                placeholder="例如：order_payment_required, shipping_request_arrived"
                value={formData.notification_subtype}
                onChange={(e) => setFormData({ ...formData, notification_subtype: e.target.value })}
              />
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
                placeholder="/Orders/123 或 /ShippingPool/456"
                value={formData.related_url}
                onChange={(e) => setFormData({ ...formData, related_url: e.target.value })}
              />
              <p className="text-xs text-gray-500">
                用户点击通知时跳转的页面（可选）
              </p>
            </div>

            {/* Send Email Option */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="send_email"
                checked={formData.send_email}
                onChange={(e) => setFormData({ ...formData, send_email: e.target.checked })}
                className="h-4 w-4"
              />
              <label htmlFor="send_email" className="text-sm text-gray-700 flex items-center gap-1">
                <Mail className="w-4 h-4" />
                同时发送邮件通知
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
                  发送通知
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>通知历史</CardTitle>
            <CardDescription>最近发送的通知记录</CardDescription>
          </CardHeader>
          <CardContent>
            {notifications && notifications.length > 0 ? (
              <div className="space-y-3">
                {notifications.map((notification) => (
                  <div key={notification.id} className="flex items-start justify-between p-3 border rounded-lg">
                    <div className="flex items-start gap-3 flex-1">
                      <Bell className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-sm">{notification.title}</h3>
                          <Badge variant="outline" className="text-xs">
                            {notification.notification_type}
                          </Badge>
                          {notification.is_read && (
                            <Badge variant="secondary" className="text-xs">已读</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{notification.content}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                          <span>{new Date(notification.created_date).toLocaleString('zh-CN')}</span>
                          <span>收件人：{notification.user_email}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                <Bell className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>暂无通知记录</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Usage Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            使用说明
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-gray-600">
          <p>• 选择"发送给所有用户"会将通知发送给租户内的所有用户</p>
          <p>• 不勾选则可以选择发送给单个特定用户</p>
          <p>• 通知类型用于分类管理，方便用户筛选</p>
          <p>• 关联 URL 可以让用户点击通知直接跳转到相关页面</p>
          <p>• 通知会自动记录发送者和发送时间</p>
        </CardContent>
      </Card>
    </div>
  );
}