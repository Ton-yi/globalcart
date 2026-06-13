import { Save, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { tenantEntity } from "@/lib/tenantApi";

// 所有可自定义的提醒文案字段定义
export const NOTIFICATION_TEXT_FIELDS = [
  {
    key: "paid_order_reminder",
    label: "感谢付款提示",
    description: "用户完成付款后在支付页面显示的提示文字",
    placeholder: "感谢付款！我们会尽快开始处理您的订单。",
    type: "input",
    category: "general",
  },
  {
    key: "pre_shipment_submitted_reminder",
    label: "已提交发货申请提示",
    description: "用户提交发货申请成功后显示的提示文字",
    placeholder: "发货申请已提交，我们将尽快处理并通知您。",
    type: "input",
    category: "general",
  },
  {
    key: "order_submitted_reminder",
    label: "订单提交成功提示",
    description: "用户提交订单后在页面显示的提示文字",
    placeholder: "订单已提交，请按提示完成付款。",
    type: "input",
    category: "general",
  },
  {
    key: "payment_pending_reminder",
    label: "待付款提示",
    description: "订单进入待付款状态时的页面提示文字",
    placeholder: "请在付款截止日期前完成支付，以免订单被取消。",
    type: "input",
    category: "general",
  },
  {
    key: "shipped_reminder",
    label: "已发货提示",
    description: "订单发货后在用户订单页面显示的提示文字",
    placeholder: "您的包裹已发出，请耐心等待收货。",
    type: "input",
    category: "general",
  },
  {
    key: "contact_us_text",
    label: "联系我们提示文字",
    description: "页面底部或帮助区域显示的联系提示文字",
    placeholder: "如有疑问，请通过微信/Line/WhatsApp 联系我们。",
    type: "input",
    category: "general",
  },
  {
    key: "alipay_payment_note",
    label: "支付宝付款备注提示",
    description: "用户通过支付宝付款时显示的备注要求",
    placeholder: "请在付款备注中填写您的订单号",
    type: "input",
    category: "payment",
  },
];

export default function NotificationTextSettings({ settings, onReload }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Local state: key → value
  const [localValues, setLocalValues] = useState(() => {
    const map = {};
    for (const field of NOTIFICATION_TEXT_FIELDS) {
      const s = settings.find(s => s.key === field.key);
      map[field.key] = s?.value ?? "";
    }
    return map;
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all(
        NOTIFICATION_TEXT_FIELDS.map(field => {
          const existing = settings.find(s => s.key === field.key);
          const val = localValues[field.key] ?? "";
          if (existing?.id) {
            return tenantEntity.update('SiteSettings', existing.id, { value: val });
          } else {
            return tenantEntity.create('SiteSettings', {
              key: field.key,
              value: val,
              description: field.label,
              category: field.category || 'general',
            });
          }
        })
      );
      await onReload();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-orange-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-orange-500" />提醒文案自定义
          </CardTitle>
          <Button size="sm" className="h-7 text-xs bg-orange-600 hover:bg-orange-700" onClick={handleSave} disabled={saving}>
            <Save className="w-3 h-3 mr-1" />{saved ? "已保存 ✓" : saving ? "保存中..." : "保存"}
          </Button>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          自定义网站各环节向用户展示的提示文字，留空则使用系统默认文字。
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {NOTIFICATION_TEXT_FIELDS.map(field => (
          <div key={field.key}>
            <Label className="text-xs text-gray-600 font-medium">{field.label}</Label>
            <p className="text-xs text-gray-400 mb-1">{field.description}</p>
            {field.type === "textarea" ? (
              <Textarea
                rows={3}
                className="text-sm"
                placeholder={field.placeholder}
                value={localValues[field.key] ?? ""}
                onChange={e => setLocalValues(prev => ({ ...prev, [field.key]: e.target.value }))}
              />
            ) : (
              <Input
                className="h-8 text-sm"
                placeholder={field.placeholder}
                value={localValues[field.key] ?? ""}
                onChange={e => setLocalValues(prev => ({ ...prev, [field.key]: e.target.value }))}
              />
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}