import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Ticket, ChevronDown, ChevronUp, Save, XCircle, Coins } from "lucide-react";
import { toast } from "sonner";
import {
  TICKET_STATUSES, ticketStatusLabel, TICKET_STATUS_COLORS,
  salesMethodLabel, ticketingMethodLabel, TICKET_CANCEL_REASONS, calcTicketRefund,
} from "@/lib/ticketConfig";

export default function AdminTicketOrderCard({ order, onUpdated }) {
  const td = order.ticket_data || {};
  const seats = td.seats || [];
  const isLottery = td.sales_method === "lottery";
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actuals, setActuals] = useState(() =>
    Object.fromEntries(seats.map((s, i) => [i, s.actual_quantity ?? s.quantity ?? 0]))
  );

  const call = async (payload) => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke("manageTicketOrder", { order_id: order.id, ...payload });
      if (res.data?.error) throw new Error(res.data.error);
      toast.success("已更新");
      onUpdated?.(res.data.order);
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const setStatus = (ticket_status) => call({ action: "set_status", ticket_status });
  const recordActual = () => call({ action: "record_actual", actual_quantities: actuals });
  const settleRefund = () => call({ action: "settle_refund" });
  const cancel = (reason) => call({ action: "cancel", cancel_reason: reason });

  // 预览退差价（前端展示用，最终以服务端为准）
  const previewRefund = calcTicketRefund({
    ...td,
    seats: seats.map((s, i) => ({ ...s, actual_quantity: actuals[i] })),
  });

  return (
    <Card className="border-gray-200">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Ticket className="w-4 h-4 text-violet-600 flex-shrink-0" />
              <span className="font-semibold text-gray-900 text-sm truncate">{order.product_name}</span>
              <Badge className={`${TICKET_STATUS_COLORS[order.ticket_status] || "bg-gray-100 text-gray-700"} text-xs`}>
                {ticketStatusLabel(order.ticket_status, "admin", isLottery)}
              </Badge>
              {order.ticket_refund_settled && (
                <Badge className="bg-green-100 text-green-700 text-xs">已退差价</Badge>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {order.order_number} · {order.user_name || order.user_email}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              预付 ¥{(order.ticket_prepaid_total_jpy || 0).toLocaleString()}
              {order.order_stage_payment_jpy ? ` · 下单实付 ¥${(order.order_stage_payment_jpy || 0).toLocaleString()}` : ''}
              {order.paid_amount && order.paid_amount !== order.order_stage_payment_jpy ? ` · 已付 ¥${(order.paid_amount || 0).toLocaleString()}` : ''}
              {order.payment_method ? ` · ${order.payment_method === 'credit' ? '记账' : order.payment_method === 'alipay' ? '支付宝' : order.payment_method === 'wechatpay' ? '微信支付' : '其它'}` : ''}
            </p>
          </div>
          <button onClick={() => setOpen(o => !o)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* 状态快速切换 */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <Select value={order.ticket_status || ""} onValueChange={setStatus} disabled={busy}>
            <SelectTrigger className="h-8 text-xs w-44"><SelectValue placeholder="选择状态" /></SelectTrigger>
            <SelectContent>
              {TICKET_STATUSES.map(s => (
                <SelectItem key={s} value={s} className="text-xs">{ticketStatusLabel(s, "admin", isLottery)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {order.ticket_status !== "cancelled" && (
            <Select onValueChange={cancel} disabled={busy}>
              <SelectTrigger className="h-8 text-xs w-28 text-red-600 border-red-200">
                <SelectValue placeholder="取消" />
              </SelectTrigger>
              <SelectContent>
                {TICKET_CANCEL_REASONS.map(r => (
                  <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {open && (
        <div className="border-t border-gray-100 p-4 space-y-4 bg-gray-50">
          {/* 需求概要 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs text-gray-600">
            {td.performance_name && <div><span className="text-gray-400">演出：</span>{td.performance_name}</div>}
            {td.prefecture && <div><span className="text-gray-400">都道府県：</span>{td.prefecture}</div>}
            {td.sales_method && <div><span className="text-gray-400">販売：</span>{salesMethodLabel(td.sales_method)}</div>}
            {td.ticketing_method && <div><span className="text-gray-400">発券：</span>{ticketingMethodLabel(td.ticketing_method)}</div>}
            <div><span className="text-gray-400">账户数：</span>{td.account_count || 1}</div>
            {(td.additional_fee_jpy > 0) && <div><span className="text-gray-400">追加料金：</span>¥{(td.additional_fee_jpy || 0).toLocaleString()}</div>}
          </div>

          {/* 实际票数录入 + 退差价 */}
          <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-700 flex items-center gap-1">
              <Coins className="w-3.5 h-3.5 text-violet-600" />录入实际购买票数 → 退差价
            </p>
            <div className="space-y-1.5">
              {seats.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="flex-1 text-gray-700">{s.seat_type} · ¥{(s.price_jpy || 0).toLocaleString()} × 预付{s.quantity}</span>
                  <span className="text-gray-400">实际</span>
                  <Input type="number" min="0" max={s.quantity}
                    className="h-7 w-16 text-xs"
                    value={actuals[i] ?? ""}
                    onChange={e => setActuals(a => ({ ...a, [i]: e.target.value }))} />
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-gray-100">
              <span className="text-xs text-gray-500">预计退差价（× 账户数{accountFromTd(td)}）</span>
              <span className="text-sm font-bold text-red-600">¥{previewRefund.toLocaleString()}</span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={recordActual} disabled={busy}>
                <Save className="w-3 h-3 mr-1" />保存实际票数
              </Button>
              <Button size="sm" className="h-7 text-xs flex-1 bg-red-600 hover:bg-red-700"
                onClick={settleRefund} disabled={busy || order.ticket_refund_settled}>
                <XCircle className="w-3 h-3 mr-1" />
                {order.ticket_refund_settled ? "已退差价" : `确认退差价 ¥${(order.ticket_refund_jpy || 0).toLocaleString()}`}
              </Button>
            </div>
          </div>

          {td.purchase_link && (
            <a href={td.purchase_link} target="_blank" rel="noopener noreferrer"
              className="text-xs text-violet-600 hover:underline block truncate">购买/演出链接 ↗</a>
          )}
        </div>
      )}
    </Card>
  );
}

function accountFromTd(td) {
  const c = parseFloat(td?.account_count) || 1;
  return c > 1 ? ` ${c}` : "";
}