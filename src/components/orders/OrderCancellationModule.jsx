/**
 * OrderCancellationModule
 * 统一的订单取消/退款模块，适用于实物订单和票务订单
 * 可嵌入订单详情操作区，支持双币种退款记录
 */
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { updateOrder } from "@/lib/tenantApi";
import { AlertTriangle, CheckCircle, Loader2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function OrderCancellationModule({ order, onSuccess, compact = false }) {
  const [cancelReason, setCancelReason] = useState("");
  const [refundAmountJpy, setRefundAmountJpy] = useState("");
  const [refundAmountCurrency, setRefundAmountCurrency] = useState("");
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        // 如果需要，可以添加 refund_amount_currency 字段（需在 Order 实体中扩展）
      }

      // 生成系统留言
      const refundInfo = (refundAmountJpy || refundAmountCurrency) ? 
        `退款金额：${refundAmountCurrency ? `${refundAmountCurrency} ${paymentCurrency}` : ''}${refundAmountCurrency && refundAmountJpy ? ' / ' : ''}${refundAmountJpy ? `¥${Math.round(refundAmountJpy).toLocaleString()} JPY` : ''}` :
        "无退款";

      const systemMessage = {
        id: `cancel_${Date.now()}`,
        from: "系统通知",
        from_email: "__system__",
        role: "admin",
        content: `订单取消通知\n\n取消理由：${cancelReason}\n${refundInfo}\n\n如有后续疑问，您可在此留言或联系管理员。`,
        timestamp: new Date().toISOString(),
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
      <Card className="border-red-100 bg-red-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-red-800 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            取消订单
          </CardTitle>
          <CardDescription className="text-xs text-red-600">
            取消后订单状态将变更为"已取消"
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">取消理由 <span className="text-red-500">*</span></Label>
            <Textarea
              rows={2}
              className="mt-1 text-xs bg-white"
              placeholder="例如：商品缺货、用户要求取消等"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>

          {hasRefund && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">退款金额（可选）</Label>
                {isPaid && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-xs text-red-600 hover:bg-red-100"
                    onClick={handleFullRefund}
                  >
                    全额退款
                  </Button>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-gray-500 flex items-center gap-1">
                    <span className="text-xs">¥</span>
                    日元退款额
                  </Label>
                  <Input
                    type="number"
                    className="h-7 text-xs mt-0.5"
                    placeholder="0"
                    value={refundAmountJpy}
                    onChange={(e) => handleSetRefundJpy(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-gray-500 flex items-center gap-1">
                  {paymentCurrency}
                  退款额
                </Label>
                  <Input
                    type="number"
                    className="h-7 text-xs mt-0.5"
                    placeholder="0"
                    value={refundAmountCurrency}
                    onChange={(e) => handleSetRefundCurrency(e.target.value)}
                    disabled={paymentCurrency === "JPY"}
                  />
                </div>
              </div>
              {exchangeRate && paymentCurrency !== "JPY" && (
                <p className="text-[10px] text-gray-400">
                  汇率参考：1 {paymentCurrency} ≈ {exchangeRate.toFixed(4)} JPY（订单创建时）
                </p>
              )}
            </div>
          )}

          <Button
            size="sm"
            className="w-full bg-red-600 hover:bg-red-700 text-xs"
            onClick={handleCancelOrder}
            disabled={isSubmitting || !cancelReason.trim()}
          >
            {isSubmitting ? (
              <><Loader2 className="w-3 h-3 animate-spin mr-1" />处理中...</>
            ) : (
              <><AlertTriangle className="w-3 h-3 mr-1" />确认取消</>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // 标准模式（非紧凑）
  return (
    <div className="space-y-3 border border-red-100 rounded-xl p-3 bg-red-50">
      <div className="flex items-center gap-1.5 text-sm font-medium text-red-800">
        <AlertTriangle className="w-4 h-4" />
        取消订单
      </div>

      <div>
        <Label className="text-sm">取消理由 <span className="text-red-500">*</span></Label>
        <Textarea
          rows={2}
          className="mt-1 bg-white"
          placeholder="请填写取消原因，这将作为系统留言发送给用户"
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
        />
      </div>

      {hasRefund && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm">退款金额（可选）</Label>
            {isPaid && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-red-600 hover:bg-red-100"
                onClick={handleFullRefund}
              >
                全额退款
              </Button>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-500 flex items-center gap-1">
                <span className="text-sm">¥</span>
                日元退款额 (JPY)
              </Label>
              <Input
                type="number"
                className="mt-1"
                placeholder="0"
                value={refundAmountJpy}
                onChange={(e) => handleSetRefundJpy(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500 flex items-center gap-1">
                {paymentCurrency}
                用户付款货币退款额
              </Label>
              <Input
                type="number"
                className="mt-1"
                placeholder="0"
                value={refundAmountCurrency}
                onChange={(e) => handleSetRefundCurrency(e.target.value)}
                disabled={paymentCurrency === "JPY"}
              />
            </div>
          </div>
          {exchangeRate && paymentCurrency !== "JPY" && (
            <p className="text-xs text-gray-400">
              💡 使用订单创建时的历史汇率：1 {paymentCurrency} ≈ {exchangeRate.toFixed(4)} JPY
            </p>
          )}
        </div>
      )}

      <Button
        size="sm"
        className="w-full bg-red-600 hover:bg-red-700"
        onClick={handleCancelOrder}
        disabled={isSubmitting || !cancelReason.trim()}
      >
        {isSubmitting ? (
          <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />处理中...</>
        ) : (
          <><MessageCircle className="w-3.5 h-3.5 mr-1" />取消并通知用户</>
        )}
      </Button>
    </div>
  );
}