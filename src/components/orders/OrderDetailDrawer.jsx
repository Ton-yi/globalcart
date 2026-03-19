/**
 * OrderDetailDrawer
 * Full order detail view for users.
 * Shows status, messages, and action buttons based on current order state.
 */
import { useState, useEffect } from "react";
import { X, ExternalLink, MessageCircle, Truck, CheckCircle, CreditCard } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getStatusLabel, getStatusColor } from "@/lib/orderStatus";
import OrderMessageThread from "./OrderMessageThread";
import PaymentModal from "./PaymentModal";
import UserNotifyShipmentModal from "./UserNotifyShipmentModal";

export default function OrderDetailDrawer({ order, currentUser, onClose, onAction }) {
  const hasReplyStatus = order.reply_status && order.reply_status !== "no_reply";
  const [showMessages, setShowMessages] = useState(hasReplyStatus);
  const [confirmingDelivered, setConfirmingDelivered] = useState(false);
  const [contactInfo, setContactInfo] = useState("");
  const [showPayment, setShowPayment] = useState(false);
  const [showShipment, setShowShipment] = useState(false);

  useEffect(() => {
    // Load user's saved contact info from preferences
    base44.entities.UserPreference.filter({ user_email: currentUser.email })
      .then(prefs => {
        if (prefs.length > 0 && prefs[0].contact_info) {
          setContactInfo(prefs[0].contact_info);
        }
      })
      .catch(() => {});
  }, [currentUser.email]);

  const status = order.order_status;
  const statusLabel = getStatusLabel(status, "user");
  const statusColor = getStatusColor(status, "user");
  const hasMessages = (order.messages || []).length > 0;
  const unread = status === "admin_replied";

  const handleConfirmDelivered = async () => {
    setConfirmingDelivered(true);
    await base44.entities.Order.update(order.id, { order_status: "delivered" });
    onAction?.("delivered");
  };

  const handleMessageSent = () => {
    onAction?.("message_sent");
  };

  const urls = (order.product_url || "").split("\n").map(s => s.trim()).filter(Boolean);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b sticky top-0 bg-white z-10">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={`text-xs ${statusColor}`}>{statusLabel}</Badge>
              {unread && <Badge className="bg-orange-100 text-orange-700 text-xs animate-pulse">有新回复</Badge>}
            </div>
            <h2 className="font-semibold text-gray-900 mt-1 truncate">{order.product_name}</h2>
            <p className="text-xs text-gray-400">{order.order_number} · ×{order.quantity}</p>
          </div>
          <button onClick={onClose} className="ml-3 mt-0.5"><X className="w-4 h-4 text-gray-500" /></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Key info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {order.estimated_jpy > 0 && (
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-400">商品日元价格</div>
                <div className="font-medium text-gray-800">¥{order.estimated_jpy?.toLocaleString()}</div>
              </div>
            )}
            {order.prepayment_amount > 0 && (
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-400">预付款</div>
                <div className="font-medium text-gray-800">{order.prepayment_currency} {order.prepayment_amount?.toFixed(2)}</div>
              </div>
            )}
            {order.paid_amount > 0 && (
              <div className="bg-green-50 rounded-lg p-3">
                <div className="text-xs text-gray-400">已付金额</div>
                <div className="font-medium text-green-700">{order.prepayment_currency} {order.paid_amount?.toFixed(2)}</div>
              </div>
            )}
            {order.balance_credit > 0 && (
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="text-xs text-gray-400">余额（可抵运费）</div>
                <div className="font-medium text-blue-700">{order.prepayment_currency} {order.balance_credit?.toFixed(2)}</div>
              </div>
            )}
            {order.shipping_fee_amount > 0 && (
              <div className="bg-yellow-50 rounded-lg p-3">
                <div className="text-xs text-gray-400">运费</div>
                <div className="font-medium text-yellow-700">{order.shipping_fee_currency} {order.shipping_fee_amount?.toFixed(2)}</div>
              </div>
            )}
            {order.tracking_number && (
              <div className="bg-teal-50 rounded-lg p-3 col-span-2">
                <div className="text-xs text-gray-400">运单号</div>
                <div className="font-mono font-medium text-teal-700">{order.tracking_number}</div>
              </div>
            )}
          </div>

          {/* Notes */}
          {order.admin_note && (
            <div className="bg-yellow-50 border border-yellow-100 rounded-lg px-3 py-2.5">
              <div className="text-xs text-yellow-600 font-medium mb-0.5">客服备注</div>
              <p className="text-sm text-yellow-800 whitespace-pre-wrap">{order.admin_note}</p>
            </div>
          )}

          {/* Cancel info */}
          {status === "cancelled" && order.cancel_reason && (
            <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2.5">
              <div className="text-xs text-red-500 font-medium mb-0.5">取消理由</div>
              <p className="text-sm text-red-700">{order.cancel_reason}</p>
            </div>
          )}

          {/* Product links */}
          {urls.length > 0 && (
            <div>
              <div className="text-xs text-gray-400 mb-1.5">商品链接</div>
              <div className="space-y-1">
                {urls.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 truncate">
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />{url}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Images */}
          <div className="flex gap-2 flex-wrap">
            {order.product_image_url && (
              <a href={order.product_image_url} target="_blank" rel="noopener noreferrer">
                <img src={order.product_image_url} alt="商品图" className="h-20 rounded-lg border object-cover cursor-pointer" />
              </a>
            )}
            {order.arrival_photo_url && (
              <div>
                <div className="text-xs text-gray-400 mb-1">到货图片</div>
                <a href={order.arrival_photo_url} target="_blank" rel="noopener noreferrer">
                  <img src={order.arrival_photo_url} alt="到货图" className="h-20 rounded-lg border object-cover cursor-pointer" />
                </a>
              </div>
            )}
          </div>

          {/* Message thread */}
          <div>
            <button
              className="flex items-center gap-2 text-sm font-medium text-gray-700 w-full py-1"
              onClick={() => setShowMessages(!showMessages)}
            >
              <MessageCircle className="w-4 h-4" />
              {hasMessages ? `留言记录（${(order.messages || []).length}条）` : "发起留言"}
              {unread && <span className="ml-1 w-2 h-2 rounded-full bg-orange-400 inline-block animate-pulse" />}
              <span className="text-xs text-gray-400 ml-auto">{showMessages ? "收起" : "展开"}</span>
            </button>
            {showMessages && (
              <div className="mt-3">
                <OrderMessageThread
                  order={order}
                  currentUser={currentUser}
                  isAdmin={false}
                  contactInfo={contactInfo}
                  onMessageSent={handleMessageSent}
                />
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="space-y-2 pt-1">
            {status === "payment_pending" && (
              <>
                {order.payment_due_date && (
                  <div className="text-xs text-orange-600 text-center">
                    付款截止日期：{order.payment_due_date}
                  </div>
                )}
                <Button className="w-full bg-red-600 hover:bg-red-700 text-sm"
                  onClick={() => setShowPayment(true)}>
                  <CreditCard className="w-4 h-4 mr-2" />立即付款
                </Button>
              </>
            )}
            {status === "in_warehouse" && (
              <Button className="w-full bg-teal-600 hover:bg-teal-700 text-sm"
                onClick={() => setShowShipment(true)}>
                <Truck className="w-4 h-4 mr-2" />通知发货
              </Button>
            )}
            {status === "shipping_fee_pending" && order.shipping_fee_amount > 0 && (
              <Button className="w-full bg-red-600 hover:bg-red-700 text-sm"
                onClick={() => setShowPayment("shipping")}>
                <CreditCard className="w-4 h-4 mr-2" />
                付运费 {order.shipping_fee_currency} {order.shipping_fee_amount?.toFixed(2)}
              </Button>
            )}
            {status === "shipped" && (
              <Button
                className="w-full bg-green-600 hover:bg-green-700 text-sm"
                onClick={handleConfirmDelivered}
                disabled={confirmingDelivered}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                {confirmingDelivered ? "确认中..." : "确认已收货"}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPayment && (
        <PaymentModal
          order={order}
          mode={showPayment === "shipping" ? "shipping" : "prepay"}
          onClose={() => setShowPayment(false)}
          onSuccess={() => {
            setShowPayment(false);
            onAction?.("payment_done");
          }}
        />
      )}
    </div>
  );
}