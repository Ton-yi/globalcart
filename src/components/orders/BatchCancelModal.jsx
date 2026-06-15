/**
 * BatchCancelModal
 * 批量取消订单组件，支持多订单同时取消
 */
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { updateOrder } from "@/lib/tenantApi";
import { X, AlertTriangle, Loader2, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import RichTextInput from "@/components/common/RichTextInput";

const CANCEL_REASON_CATEGORIES = [
  { value: "customer_request", label: "客户主动要求", color: "bg-blue-100 text-blue-700" },
  { value: "out_of_stock", label: "缺货/停产", color: "bg-orange-100 text-orange-700" },
  { value: "shipping_issue", label: "物流问题", color: "bg-yellow-100 text-yellow-700" },
  { value: "payment_issue", label: "付款问题", color: "bg-red-100 text-red-700" },
  { value: "product_issue", label: "商品问题", color: "bg-purple-100 text-purple-700" },
  { value: "other", label: "其他", color: "bg-gray-100 text-gray-700" },
];

export default function BatchCancelModal({ orders, onClose, onSuccess }) {
  const [cancelReason, setCancelReason] = useState("");
  const [cancelCategory, setCancelCategory] = useState("");
  const [cancelImages, setCancelImages] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: orders.length });

  const handleBatchCancel = async () => {
    if (!cancelReason.trim()) {
      toast.error("请填写取消理由");
      return;
    }

    if (!window.confirm(`确认批量取消 ${orders.length} 个订单？此操作不可撤销。`)) {
      return;
    }

    setIsSubmitting(true);
    setProgress({ current: 0, total: orders.length });

    try {
      let successCount = 0;
      let failedCount = 0;

      for (let i = 0; i < orders.length; i++) {
        const order = orders[i];
        try {
          const systemMessage = {
            id: `batch_cancel_${Date.now()}_${i}`,
            from: "系统通知",
            from_email: "system@system.local",
            role: "admin",
            content: `尊敬的用户，你的订单 ${order.product_name || order.order_number} 由于 ${cancelReason} 而被管理员取消了。如有后续疑问，您可在此留言或联系管理员。`,
            timestamp: new Date().toISOString(),
            image_urls: [],
            is_system_notification: true,
            meta: {
              type: "cancellation",
              cancel_reason: cancelReason,
              cancel_category: cancelCategory,
              batch_operation: true,
            }
          };

          await updateOrder(order.id, {
            order_status: "cancelled",
            cancel_reason: `${cancelReason} [${CANCEL_REASON_CATEGORIES.find(c => c.value === cancelCategory)?.label || '其他'}]`,
            cancel_category: cancelCategory || null,
            messages: [...(order.messages || []), systemMessage],
            unread_roles: [...new Set([...(order.unread_roles || []), "user"])],
          });

          // 创建通知
          await base44.functions.invoke('createNotification', {
            user_email: order.user_email,
            notification_type: 'cancellation',
            notification_subtype: 'order_cancelled_no_refund',
            title: '订单已取消',
            content: systemMessage.content,
            related_entity_type: 'order',
            related_entity_id: order.id,
            metadata: {
              cancel_reason: cancelReason,
              cancel_category: cancelCategory,
              batch_operation: true
            }
          });

          successCount++;
        } catch (error) {
          console.error(`取消订单 ${order.id} 失败:`, error);
          failedCount++;
        }
        setProgress({ current: i + 1, total: orders.length });
      }

      toast.success(`批量取消完成：成功 ${successCount} 个，失败 ${failedCount} 个`);
      onSuccess?.();
      onClose?.();
    } catch (error) {
      toast.error("批量取消失败：" + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onMouseDown={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg" onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-600" />
              批量取消订单
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">已选择 {orders.length} 个订单</p>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-500" /></button>
        </div>

        <div className="px-5 py-5 space-y-4">
          {/* 订单列表预览 */}
          <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
            {orders.map((order, idx) => (
              <div key={order.id} className="flex items-center justify-between text-xs">
                <span className="text-gray-700 truncate flex-1">
                  {idx + 1}. {order.product_name || order.order_number}
                </span>
                <span className="text-gray-400 font-mono">{order.user_email}</span>
              </div>
            ))}
          </div>

          {/* 取消原因分类 */}
          <div>
            <Label className="text-sm flex items-center gap-1.5">
              <Tags className="w-3.5 h-3.5" />
              取消原因分类
            </Label>
            <Select value={cancelCategory} onValueChange={setCancelCategory}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="选择取消原因分类" />
              </SelectTrigger>
              <SelectContent>
                {CANCEL_REASON_CATEGORIES.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {cancelCategory && (
              <Badge className={`mt-1.5 ${CANCEL_REASON_CATEGORIES.find(c => c.value === cancelCategory)?.color}`}>
                {CANCEL_REASON_CATEGORIES.find(c => c.value === cancelCategory)?.label}
              </Badge>
            )}
          </div>

          {/* 取消理由 */}
          <div>
            <Label className="text-sm">取消理由（所有订单通用）</Label>
            <RichTextInput
              value={cancelReason}
              onChange={setCancelReason}
              imageUrls={cancelImages}
              onImageUrls={setCancelImages}
              placeholder="请输入取消理由..."
              rows={3}
              className="mt-1"
            />
          </div>

          {/* 进度条 */}
          {isSubmitting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>处理进度</span>
                <span>{progress.current} / {progress.total}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 text-center">正在处理中，请稍候...</p>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            取消
          </Button>
          <Button 
            size="sm" 
            className="bg-red-600 hover:bg-red-700"
            onClick={handleBatchCancel}
            disabled={isSubmitting || !cancelReason.trim()}
          >
            {isSubmitting ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />处理中...</>
            ) : (
              <><AlertTriangle className="w-3.5 h-3.5 mr-1" />确认批量取消</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}