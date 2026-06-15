import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Ticket, ChevronDown, ChevronUp } from "lucide-react";
import { ImageWithViewer } from "@/components/common/ImageViewer";
import {
  ticketStatusLabel, TICKET_STATUS_COLORS,
  salesMethodLabel, ticketingMethodLabel,
} from "@/lib/ticketConfig";

/**
 * 用户端票务订单卡片（只读展示）
 * 展示票务需求详情、状态（用户端文案）、退差价信息。
 */
export default function UserTicketOrderCard({ order }) {
  const td = order.ticket_data || {};
  const seats = td.seats || [];
  const isLottery = td.sales_method === "lottery";
  const [open, setOpen] = useState(false);
  const images = order.ticket_image_urls || [];

  return (
    <Card className="border-gray-200">
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
                {order.payment_method ? ` · ${order.payment_method === 'credit' ? '记账' : order.payment_method === 'alipay' ? '支付宝' : order.payment_method === 'wechatpay' ? '微信支付' : '其它'}` : ''}
              </p>
            )}
          </div>
          <button onClick={() => setOpen(o => !o)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-gray-100 p-4 space-y-3 bg-gray-50">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs text-gray-600">
            {td.performance_name && <div><span className="text-gray-400">演出：</span>{td.performance_name}</div>}
            {td.prefecture && <div><span className="text-gray-400">都道府県：</span>{td.prefecture}</div>}
            {td.sales_method && <div><span className="text-gray-400">販売：</span>{salesMethodLabel(td.sales_method)}</div>}
            {td.ticketing_method && <div><span className="text-gray-400">発券：</span>{ticketingMethodLabel(td.ticketing_method)}</div>}
            <div><span className="text-gray-400">账户数/人数：</span>{td.account_count || 1}</div>
            {(td.additional_fee_jpy > 0) && <div><span className="text-gray-400">追加料金：</span>¥{(td.additional_fee_jpy || 0).toLocaleString()}</div>}
          </div>

          {seats.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-1">
              {seats.map((s, i) => (
                <div key={i} className="flex items-center justify-between text-xs text-gray-700">
                  <span>{s.seat_type} · ¥{(s.price_jpy || 0).toLocaleString()} × {s.quantity}</span>
                  {s.actual_quantity != null && (
                    <span className="text-gray-400">实际 {s.actual_quantity}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {images.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {images.map((url, i) => (
                <ImageWithViewer key={i} src={url} alt="票图">
                  <img src={url} alt="" className="w-16 h-16 rounded object-cover border border-gray-200 cursor-pointer" />
                </ImageWithViewer>
              ))}
            </div>
          )}

          {order.ticket_number_issued && (
            <div className="text-xs text-gray-700">
              <span className="text-gray-400">発券番号：</span>
              <span className="font-mono select-all">{order.ticket_number_issued}</span>
            </div>
          )}

          {td.purchase_link && (
            <a href={td.purchase_link} target="_blank" rel="noopener noreferrer"
              className="text-xs text-violet-600 hover:underline block truncate">购买/演出链接 ↗</a>
          )}
        </div>
      )}
    </Card>
  );
}