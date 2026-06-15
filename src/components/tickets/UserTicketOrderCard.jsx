import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Ticket } from "lucide-react";
import {
  ticketStatusLabel, TICKET_STATUS_COLORS,
} from "@/lib/ticketConfig";

/**
 * 用户端票务订单卡片（只读展示）- 用作列表项
 */
export default function UserTicketOrderCard({ order }) {
  const td = order.ticket_data || {};
  const isLottery = td.sales_method === "lottery";

  return (
    <Card className="border-gray-200 hover:border-violet-300 hover:bg-violet-50/50 transition-all">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Ticket className="w-4 h-4 text-violet-600 flex-shrink-0" />
              <span className="font-semibold text-gray-900 text-sm truncate">{order.product_name}</span>
              <Badge className={`${TICKET_STATUS_COLORS[order.ticket_status] || "bg-gray-100 text-gray-700"} text-xs`}>
                {ticketStatusLabel(order.ticket_status, "user", isLottery)}
              </Badge>
              {order.ticket_refund_settled && (order.ticket_refund_jpy || 0) > 0 && (
                <Badge className="bg-green-100 text-green-700 text-xs">已退差价 ¥{(order.ticket_refund_jpy || 0).toLocaleString()}</Badge>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {order.order_number} · 预付 ¥{(order.ticket_prepaid_total_jpy || 0).toLocaleString()}
            </p>
            {(order.order_stage_payment_jpy || order.payment_method) && (
              <p className="text-xs text-gray-500 mt-0.5">
                {order.order_stage_payment_jpy ? `下单实付 ¥${(order.order_stage_payment_jpy || 0).toLocaleString()}` : ''}
                {order.payment_method ? ` · ${{
                  credit: '记账',
                  alipay: '支付宝',
                  wechatpay: '微信支付'
                }[order.payment_method] || '其它'}` : ''}
              </p>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}