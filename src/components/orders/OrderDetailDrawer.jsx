/**
 * OrderDetailDrawer
 * Full order detail view for users.
 * Shows status, messages, and action buttons based on current order state.
 */
import { useState, useEffect } from "react";
import { X, ExternalLink, MessageCircle, Truck, CheckCircle, CreditCard, Upload, Edit2, Package } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { updateOrder, fetchShippingPools, tenantEntity } from "@/lib/tenantApi";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getStatusLabel, getStatusColor, USER_CAN_RESUBMIT_PROOF_STATUSES } from "@/lib/orderStatus";
import OrderMessageThread from "./OrderMessageThread";
import PaymentModal from "./PaymentModal";
import UserNotifyShipmentModal from "./UserNotifyShipmentModal";
import ShippingEditModal from "@/components/shippingpool/ShippingEditModal";

export default function OrderDetailDrawer({ order, currentUser, onClose, onAction }) {
  const hasReplyStatus = order.reply_status && order.reply_status !== "no_reply";
  const [showMessages, setShowMessages] = useState(hasReplyStatus);
  const [confirmingDelivered, setConfirmingDelivered] = useState(false);
  const [contactInfo, setContactInfo] = useState("");
  const [showPayment, setShowPayment] = useState(false);
  const [showShipment, setShowShipment] = useState(false);
  const [paidReminder, setPaidReminder] = useState("");
  const [editPool, setEditPool] = useState(null);
  const [loadingPool, setLoadingPool] = useState(false);

  useEffect(() => {
    tenantEntity.list('UserPreference', { user_email: currentUser.email })
      .then(prefs => {
        if (prefs.length > 0 && prefs[0].contact_info) setContactInfo(prefs[0].contact_info);
      })
      .catch(() => {});

    if (order.order_status === "paid") {
      tenantEntity.list('SiteSettings', { key: "paid_order_reminder" })
        .then(settings => {
          if (settings.length > 0) setPaidReminder(settings[0].value);
        })
        .catch(() => {});
    }
  }, [currentUser.email, order.order_status]);

  const status = order.order_status;
  const statusLabel = getStatusLabel(status, "user");
  const statusColor = getStatusColor(status, "user");
  const hasMessages = (order.messages || []).length > 0;
  const unread = status === "admin_replied";

  const handleConfirmDelivered = async () => {
    setConfirmingDelivered(true);
    await updateOrder(order.id, { order_status: "delivered" });
    onAction?.("delivered");
  };

  const handleMessageSent = () => {
    onAction?.("message_sent");
  };

  const urls = (order.product_url || "").split("\n").map(s => s.trim()).filter(Boolean);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
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
            {order.payment_method && (
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-400">付款方式</div>
                <div className="font-medium text-gray-800">{{ alipay: "支付宝", wechatpay: "微信支付", paypay: "PayPay", paypal: "PayPal", credit_card: "信用卡", bank_transfer: "银行转账", other: "其他" }[order.payment_method] || order.payment_method}</div>
              </div>
            )}
            {order.estimated_jpy > 0 && (
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-400">商品日元价格</div>
                <div className="font-medium text-gray-800">{Math.round(order.estimated_jpy).toLocaleString()} yen</div>
              </div>
            )}
            {order.prepayment_amount > 0 && (
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-400">预付款</div>
                <div className="font-medium text-gray-800">
                  {order.prepayment_currency === "JPY"
                    ? `${Math.round(order.prepayment_amount).toLocaleString()} yen`
                    : `${order.prepayment_currency} ${order.prepayment_amount?.toFixed(2)}`}
                </div>
              </div>
            )}
            {order.paid_amount > 0 && (
              <div className="bg-green-50 rounded-lg p-3">
                <div className="text-xs text-gray-400">已付金额</div>
                <div className="font-medium text-green-700">
                  {order.prepayment_currency === "JPY"
                    ? `${Math.round(order.paid_amount).toLocaleString()} yen`
                    : `${order.prepayment_currency} ${order.paid_amount?.toFixed(2)}`}
                </div>
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
            {order.item_size_extra_fee > 0 && (
              <div className="bg-purple-50 rounded-lg p-3">
                <div className="text-xs text-gray-400 flex items-center gap-1">
                  <Package className="w-3.5 h-3.5" />物品尺寸费
                </div>
                <div className="font-medium text-purple-700">{order.item_size_fee_currency} {order.item_size_extra_fee}</div>
                {order.item_size_title && <div className="text-xs text-gray-500 mt-1">{order.item_size_title}</div>}
              </div>
            )}
            {order.tracking_number && (
              <div className="bg-teal-50 rounded-lg p-3 col-span-2">
                <div className="text-xs text-gray-400">运单号</div>
                <div className="font-mono font-medium text-teal-700">{order.tracking_number}</div>
              </div>
            )}
            {status === "notified_shipment" && editPool && (
              <div className="bg-purple-50 rounded-lg p-3 col-span-2">
                <div className="text-xs text-gray-400">发货申请单号</div>
                <div className="font-mono font-medium text-purple-700">{editPool.pool_code || editPool.id.slice(-6).toUpperCase()}</div>
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

          {/* Paid order reminder */}
          {status === "paid" && paidReminder && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
              <div className="text-xs text-blue-600 font-medium mb-0.5">提示</div>
              <p className="text-sm text-blue-800">{paidReminder}</p>
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

          {/* Action buttons */}
          <div className="space-y-2 pt-1">
            {status === "payment_pending" && order.payment_status !== "awaiting_confirmation" && (
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
            {USER_CAN_RESUBMIT_PROOF_STATUSES.includes(status) && (
              <Button className="w-full bg-orange-600 hover:bg-orange-700 text-sm"
                onClick={() => setShowPayment(true)}>
                <Upload className="w-4 h-4 mr-2" />重新提交付款凭证
              </Button>
            )}
            {status === "in_warehouse" && (
              <Button className="w-full bg-teal-600 hover:bg-teal-700 text-sm"
                onClick={() => setShowShipment(true)}>
                <Truck className="w-4 h-4 mr-2" />通知发货
              </Button>
            )}
            {status === "notified_shipment" && (
              <Button variant="outline" className="w-full text-sm"
                disabled={loadingPool}
                onClick={async () => {
                  setLoadingPool(true);
                  const pools = await fetchShippingPools();
                  const found = pools.find(p => (p.order_ids || []).includes(order.id));
                  setEditPool(found || null);
                  setLoadingPool(false);
                }}>
                <Edit2 className="w-4 h-4 mr-2" />
                {loadingPool ? "加载中..." : "编辑出货参数"}
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

          {/* Message thread - always visible at bottom */}
          <div id="message-section" className="border-t pt-4">
            {hasMessages && (
              <button
                className="flex items-center gap-2 text-sm font-medium text-gray-700 w-full py-1 mb-3"
                onClick={() => setShowMessages(!showMessages)}
              >
                <MessageCircle className="w-4 h-4" />
                {`留言记录（${(order.messages || []).length}条）`}
                {unread && <span className="ml-1 w-2 h-2 rounded-full bg-orange-400 inline-block animate-pulse" />}
                <span className="text-xs text-gray-400 ml-auto">{showMessages ? "收起" : "展开"}</span>
              </button>
            )}
            <OrderMessageThread
              order={order}
              currentUser={currentUser}
              isAdmin={false}
              contactInfo={contactInfo}
              onMessageSent={handleMessageSent}
              hideHistory={hasMessages && !showMessages}
            />
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

      {showShipment && (
        <UserNotifyShipmentModal
          order={order}
          onClose={() => setShowShipment(false)}
          onSuccess={() => {
            setShowShipment(false);
            onClose(); // close the order detail drawer too
            onAction?.("notify_ship");
          }}
        />
      )}

      {editPool && (
        <ShippingEditModal
          order={order}
          currentPool={editPool}
          currentUser={currentUser}
          onClose={() => setEditPool(null)}
          onSuccess={() => {
            setEditPool(null);
            onClose();
            onAction?.("edit_ship");
          }}
        />
      )}
    </div>
  );
}