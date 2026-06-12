/**
 * CustomerOrderDetailModal — 个人档案页订单详情弹窗
 * 展示 getCustomer360Data 返回的订单概要详情
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, ExternalLink, Package, CreditCard, Truck, Calendar } from "lucide-react";
import { ImageWithViewer } from "@/components/common/ImageViewer";

const PAYMENT_MODE_LABELS = {
  prepay: "预付款", deferred: "后付款", fullpay_once: "一次付全款", credit: "记账",
};

export default function CustomerOrderDetailModal({ order, onClose, formatCurrency, formatDate, OrderStatusBadge, PaymentStatusBadge }) {
  if (!order) return null;

  const InfoRow = ({ label, children }) => (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="text-xs text-gray-500 flex-shrink-0">{label}</span>
      <span className="text-sm text-gray-800 text-right">{children}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Package className="w-4 h-4 text-blue-500" />订单详情
          </h3>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
        </div>

        <div className="p-4 space-y-4">
          {/* 商品信息 */}
          <div className="flex gap-3">
            {order.product_image_url && (
              <div className="flex-shrink-0">
                <ImageWithViewer src={order.product_image_url} thumbClassName="w-20 h-20 rounded-lg object-cover border" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900">{order.product_name}</p>
              <p className="text-xs text-gray-500 mt-0.5">订单号：{order.order_number || "-"}</p>
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <OrderStatusBadge status={order.order_status} />
                <PaymentStatusBadge status={order.payment_status} />
                {order.payment_mode && (
                  <Badge className={order.payment_mode === 'credit' ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-600"}>
                    <CreditCard className="w-3 h-3 mr-1" />
                    {PAYMENT_MODE_LABELS[order.payment_mode] || order.payment_mode}
                  </Badge>
                )}
                {order.online_store_tag && (
                  <Badge variant="outline" className="text-xs">{order.online_store_tag}</Badge>
                )}
              </div>
            </div>
          </div>

          {/* 金额 */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-3 bg-gray-50 rounded-lg text-center">
              <p className="text-xs text-gray-500">货款</p>
              <p className="text-sm font-bold text-gray-900 mt-0.5">{formatCurrency(order.estimated_jpy || 0)}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg text-center">
              <p className="text-xs text-gray-500">服务费</p>
              <p className="text-sm font-bold text-gray-900 mt-0.5">{formatCurrency(order.service_fee_amount || 0)}</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg text-center">
              <p className="text-xs text-green-700">实付/记账</p>
              <p className="text-sm font-bold text-green-700 mt-0.5">{formatCurrency(order.paid_amount || 0)}</p>
            </div>
          </div>

          {/* 详细信息 */}
          <div className="border rounded-lg px-3 py-1 divide-y">
            <InfoRow label="下单日期"><Calendar className="w-3 h-3 inline mr-1 text-gray-400" />{formatDate(order.created_date)}</InfoRow>
            {order.shipping_method && <InfoRow label="运输方式"><Truck className="w-3 h-3 inline mr-1 text-gray-400" />{order.shipping_method}</InfoRow>}
            {order.destination_country && <InfoRow label="目的国家">{order.destination_country}</InfoRow>}
            {order.shipped_date && <InfoRow label="发货日期">{formatDate(order.shipped_date)}</InfoRow>}
            {order.tracking_number && <InfoRow label="运单号"><code className="text-xs">{order.tracking_number}</code></InfoRow>}
          </div>

          {/* 商品链接 */}
          {order.product_url && (
            <div className="space-y-1">
              <p className="text-xs text-gray-500">商品链接</p>
              {order.product_url.split("\n").filter(Boolean).slice(0, 5).map((url, idx) => (
                <a key={idx} href={url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-blue-600 hover:underline truncate">
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{url}</span>
                </a>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-2 border-t">
            <Button variant="outline" size="sm" onClick={onClose}>关闭</Button>
          </div>
        </div>
      </div>
    </div>
  );
}