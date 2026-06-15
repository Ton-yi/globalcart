/**
 * OrderCancellationModule
 * 统一的订单取消/退款模块，适用于实物订单和票务订单
 * 可嵌入订单详情操作区，支持双币种退款记录
 * 支持使用通知模板发送取消通知（在 AdminNotificationTemplates 中配置）
 */
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { updateOrder } from "@/lib/tenantApi";
import { AlertTriangle, CheckCircle, Loader2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import RichTextInput from "@/components/common/RichTextInput";

export default function OrderCancellationModule({ order, onSuccess, compact = false }) {
  const [cancelReason, setCancelReason] = useState("");
  const [cancelImages, setCancelImages] = useState([]);
  const [refundAmountJpy, setRefundAmountJpy] = useState("");
  const [refundAmountCurrency, setRefundAmountCurrency] = useState("");
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cancellationTemplate, setCancellationTemplate] = useState(null);
  const [adminContact, setAdminContact] = useState("");

  // 获取取消通知模板和管理员联系方式
  useEffect(() => {
    const fetchTemplateAndContact = async () => {
      try {
        // 获取通知模板
        const templatesRes = await base44.functions.invoke('getNotificationTemplates', {});
        const templates = templatesRes.data.templates || [];
        
        // 根据是否有退款金额选择模板
        const hasRefundAmount = refundAmountJpy || refundAmountCurrency;
        const template = templates.find(t => 
          t.notification_type === 'cancellation' && 
          t.notification_subtype === (hasRefundAmount ? 'order_cancelled_with_refund' : 'order_cancelled_no_refund')
        );
        setCancellationTemplate(template || null);

        // 获取管理员联系方式（从 SiteSettings 或联系人）
        const configRes = await base44.functions.invoke('getTenantConfigData', {});
        const settings = configRes.data.settings || [];
        const contactSetting = settings.find(s => s.key === 'admin_contact_info');
        if (contactSetting?.value) {
          setAdminContact(contactSetting.value);
        } else {
          // 默认联系方式
          setAdminContact("管理员");
        }
      } catch (error) {
        console.error('获取模板失败:', error);
      }
    };
    fetchTemplateAndContact();
  }, [refundAmountJpy, refundAmountCurrency]);

  // 获取订单付款货币
  const paymentCurrency = order.prepayment_currency || "JPY";
  const originalAmount = order.prepayment_amount || 0;
  const originalAmountJpy = order.prepayment_amount_jpy || order.estimated_jpy || 0;

  // 计算汇率（使用订单创建时的历史汇率）
  const exchangeRate = originalAmountJpy && originalAmount ? originalAmountJpy / originalAmount : null;

  // 自动填充退款金额（按原始汇率）
  const handleSetRefundJpy = (jpyValue) => {
    setRefundAmountJpy(jpyValue);
    if (exchangeRate && paymentCurrency !== "JPY") {
      const currencyValue = parseFloat(jpyValue) / exchangeRate;
      setRefundAmountCurrency(currencyValue.toFixed(2));
    }
  };

  const handleSetRefundCurrency = (currencyValue) => {
    setRefundAmountCurrency(currencyValue);
    if (exchangeRate && paymentCurrency !== "JPY") {
      const jpyValue = parseFloat(currencyValue) * exchangeRate;
      setRefundAmountJpy(Math.round(jpyValue));
    }
  };

  // 快速填充全额退款
  const handleFullRefund = () => {
    if (originalAmountJpy) {
      handleSetRefundJpy(originalAmountJpy);
    }
    if (originalAmount && paymentCurrency !== "JPY") {
      setRefundAmountCurrency(originalAmount.toFixed(2));
    }
  };

  const handleCancelOrder = async () => {
    if (!cancelReason.trim()) {
      toast.error("请填写取消理由");
      return;
    }

    setIsSubmitting(true);

    try {
      // 构建更新数据
      const updates = {
        order_status: "cancelled",
        cancel_reason: cancelReason,
      };

      // 如果有退款金额，记录双币种
      if (refundAmountJpy || refundAmountCurrency) {
        updates.refund_amount_jpy = parseFloat(refundAmountJpy) || 0;
        updates.refund_amount_currency = parseFloat(refundAmountCurrency) || 0;
        updates.refund_currency = paymentCurrency;
      }

      // 生成系统留言（使用模板）
      const hasRefund = refundAmountJpy || refundAmountCurrency;
      const template = cancellationTemplate;
      
      let messageContent;
      if (template?.content_template) {
        // 使用模板变量替换
        messageContent = template.content_template
          .replace(/{{order_name}}/g, order.product_name || '未知订单')
          .replace(/{{order_number}}/g, order.order_number || order.id)
          .replace(/{{cancel_reason}}/g, cancelReason)
          .replace(/{{refund_amount}}/g, hasRefund 
            ? `${refundAmountCurrency ? `${refundAmountCurrency} ${paymentCurrency}` : ''}${refundAmountCurrency && refundAmountJpy ? ' / ' : ''}${refundAmountJpy ? `¥${Math.round(refundAmountJpy).toLocaleString()} JPY` : ''}`
            : '无退款')
          .replace(/{{admin_contact}}/g, adminContact || '管理员');
      } else {
        // 默认模板（无模板时）
        if (hasRefund) {
          messageContent = `尊敬的用户，你的订单 ${order.product_name || order.order_number}（${order.order_number || order.id}）由于 ${cancelReason} 而被管理员取消了，退款金额是 ${refundAmountCurrency ? `${refundAmountCurrency} ${paymentCurrency}` : ''}${refundAmountCurrency && refundAmountJpy ? ' / ' : ''}${refundAmountJpy ? `¥${Math.round(refundAmountJpy).toLocaleString()} JPY` : ''}。请在这里发送您的收款方式 稍后由管理员手动汇款`;
        } else {
          messageContent = `尊敬的用户，你的订单 ${order.product_name || order.order_number}（${order.order_number || order.id}）由于 ${cancelReason} 而被管理员取消了，如有后续疑问，您可在此留言或联系管理员 ${adminContact || '管理员'}，祝您有好的一天`;
        }
      }

      const systemMessage = {
        id: `cancel_${Date.now()}`,
        from: "系统通知",
        from_email: "__system__",
        role: "admin",
        content: messageContent,
        timestamp: new Date().toISOString(),
        image_urls: cancelImages, // 附加上传的图片
        meta: {
          type: "cancellation",
          cancel_reason: cancelReason,
          refund_amount_jpy: updates.refund_amount_jpy,
          refund_amount_currency: refundAmountCurrency,
          refund_currency: paymentCurrency,
        }
      };

      updates.messages = [...(order.messages || []), systemMessage];
      updates.unread_roles = [...new Set([...(order.unread_roles || []), "user"])];

      // 执行更新
      await updateOrder(order.id, updates);

      toast.success("订单已取消，通知已发送给用户");
      onSuccess?.();
    } catch (error) {
      toast.error("取消失败：" + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasRefund = originalAmount > 0 || originalAmountJpy > 0;
  const isPaid = order.payment_status === "paid" || order.paid_amount > 0;

  if (compact) {
    return (
      <div className="space-y-2">
        {/* 第一行：取消理由输入框（占两行） */}
        <RichTextInput
          value={cancelReason}
          onChange={setCancelReason}
          imageUrls={cancelImages}
          onImageUrls={setCancelImages}
          placeholder="取消理由..."
          rows={2}
          className="min-h-[60px]"
        />

        {/* 第二行：退款金额输入框 + 退款按钮 */}
        {hasRefund ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2">
              <Input
                type="number"
                className="h-9 text-sm flex-1"
                placeholder="退款金额 JPY"
                value={refundAmountJpy}
                onChange={(e) => handleSetRefundJpy(e.target.value)}
              />
              {paymentCurrency !== "JPY" && (
                <Input
                  type="number"
                  className="h-9 text-sm w-28"
                  placeholder={`${paymentCurrency}`}
                  value={refundAmountCurrency}
                  onChange={(e) => handleSetRefundCurrency(e.target.value)}
                />
              )}
              {isPaid && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 text-xs"
                  onClick={handleFullRefund}
                >
                  全额
                </Button>
              )}
            </div>
            <Button
              size="sm"
              className="h-9 text-xs bg-red-600 hover:bg-red-700"
              onClick={handleCancelOrder}
              disabled={isSubmitting || !cancelReason.trim()}
            >
              {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <AlertTriangle className="w-3 h-3" />}
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            className="h-9 text-xs bg-red-600 hover:bg-red-700 w-full"
            onClick={handleCancelOrder}
            disabled={isSubmitting || !cancelReason.trim()}
          >
            {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <AlertTriangle className="w-3 h-3" />}
          </Button>
        )}
      </div>
    );
  }

  return null;
}