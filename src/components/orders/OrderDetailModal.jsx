import { X, ExternalLink, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const STATUS_LABELS = {
  draft: "草稿", submitted: "已提交", price_confirmed: "已报价",
  payment_pending: "待付款", payment_confirmed: "已付款",
  purchasing: "采购中", purchased: "已购买",
  awaiting_shipment: "等待发货", shipped: "已发货", delivered: "已签收", cancelled: "已取消"
};
const PAYMENT_LABELS = {
  alipay: "支付宝", wechatpay: "微信支付", paypay: "PayPay",
  paypal: "PayPal", credit_card: "信用卡", bank_transfer: "银行转账", other: "其他"
};

export default function OrderDetailModal({ order, onClose, onRefresh }) {
  const rows = [
    ["订单号", order.order_number || order.id],
    ["商品名称", order.product_name],
    ["数量", order.quantity],
    ["订单状态", <Badge key="s" className="text-xs">{STATUS_LABELS[order.order_status] || order.order_status}</Badge>],
    ["日元估价", order.estimated_jpy ? `¥ ${order.estimated_jpy.toLocaleString()}` : "-"],
    ["预付款", order.prepayment_amount ? `${order.prepayment_currency} ${order.prepayment_amount.toFixed(2)}` : "-"],
    ["已付金额", order.paid_amount ? `${order.prepayment_currency} ${order.paid_amount.toFixed(2)}` : "-"],
    ["余额抵扣", order.balance_credit > 0 ? `${order.prepayment_currency} ${order.balance_credit.toFixed(2)}` : "-"],
    ["支付方式", PAYMENT_LABELS[order.payment_method] || order.payment_method || "-"],
    ["管理员备注", order.admin_note || "-"],
    ["用户备注", order.user_note || "-"],
    ["提交时间", new Date(order.created_date).toLocaleString("zh-CN")],
  ];

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-gray-900">订单详情</h2>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-500" /></button>
        </div>

        {order.product_image_url && (
          <div className="px-5 pt-4">
            <img src={order.product_image_url} alt={order.product_name} className="w-full h-40 object-contain rounded border bg-gray-50" />
          </div>
        )}

        <div className="px-5 py-4">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              {rows.map(([label, value]) => (
                <tr key={label}>
                  <td className="py-2 text-gray-500 w-28">{label}</td>
                  <td className="py-2 text-gray-900">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {order.product_url && (
            <a href={order.product_url} target="_blank" rel="noopener noreferrer"
              className="mt-3 flex items-center gap-1.5 text-blue-600 text-sm hover:underline">
              <ExternalLink className="w-3.5 h-3.5" />查看商品链接
            </a>
          )}

          {order.payment_proof_url && (
            <div className="mt-3">
              <p className="text-xs text-gray-500 mb-1">付款凭证</p>
              <img src={order.payment_proof_url} alt="付款凭证" className="max-h-40 rounded border" />
            </div>
          )}

            {order.group_buy_request_id && (
            <div className="mt-3 p-3 bg-indigo-50 border border-indigo-200 rounded text-sm text-indigo-800">
              <div className="flex items-center gap-1.5 font-medium mb-1.5">
                <Users className="w-3.5 h-3.5" />
                拼单来源
              </div>
              <div className="space-y-0.5 text-indigo-700">
                {order.group_buy_request_title && (
                  <div>拼单标题：{order.group_buy_request_title}</div>
                )}
                <div>
                  分摊运费：
                  <span className="font-semibold">
                    {order.group_buy_allocated_shipping_fee_jpy != null
                      ? `¥ ${Number(order.group_buy_allocated_shipping_fee_jpy).toLocaleString()}`
                      : '-'}
                  </span>
                  {order.group_buy_allocated_shipping_fee_jpy > 0 && (
                    <span className="text-indigo-500 text-xs ml-1">（已含入预付款）</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {order.supplement_requested && (
            <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded text-sm text-orange-800">
              ⚠️ 管理员请求补款：{order.prepayment_currency} {order.supplement_amount}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t">
          <Button variant="outline" size="sm" onClick={onClose}>关闭</Button>
        </div>
      </div>
    </div>
  );
}