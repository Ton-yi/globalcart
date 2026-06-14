import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { usePermissions } from "@/hooks/usePermissions";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Ticket, Lock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import TicketRequestFields from "@/components/tickets/TicketRequestFields";
import TicketPrepaySummary from "@/components/tickets/TicketPrepaySummary";
import PaymentMethodSelector from "@/components/common/PaymentMethodSelector";
import { calcTicketPrepaidTotal, TICKETING_METHODS } from "@/lib/ticketConfig";

export default function SubmitTicketOrder() {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const { can } = usePermissions();
  const canSubmit = can("order:submit_purchase_request");

  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ order_name: "", user_note: "" });
  const [ticketData, setTicketData] = useState({ account_count: 1, seats: [] });

  useEffect(() => {
    Promise.all([
      base44.functions.invoke("getSubmitOrderPageData", {}),
      base44.functions.invoke("managePaymentMethod", { action: "list" }),
    ]).then(([r, pm]) => {
      setConfig(r.data?.ticketConfig || null);
      setPaymentMethods(pm.data?.methods || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const setTd = (patch) => setTicketData(prev => ({ ...prev, ...patch }));

  const validate = () => {
    const vis = config?.field_visibility || {};
    if (!ticketData.seats?.length) { toast.error("请至少添加一个席种"); return false; }
    // 最低追加料金校验
    const method = ticketData.ticketing_method;
    const minFee = config?.min_additional_fee?.[method] ?? 0;
    if (method && (parseFloat(ticketData.additional_fee_jpy) || 0) < minFee) {
      toast.error(`${TICKETING_METHODS.find(m => m.value === method)?.label} 的追加料金不得低于 ¥${minFee}`);
      return false;
    }
    if (ticketData.sales_method === "lottery") {
      const minBonus = config?.min_lottery_win_bonus ?? 0;
      if ((parseFloat(ticketData.lottery_win_bonus_jpy) || 0) < minBonus) {
        toast.error(`抽中追加报酬不得低于 ¥${minBonus}`); return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke("createTenantOrder", {
        is_ticket_order: true,
        product_name: form.order_name || ticketData.performance_name || "票务需求",
        quantity: 1,
        user_email: user.email,
        user_name: user.full_name || user.email,
        user_note: form.user_note || "",
        ticket_data: {
          ...ticketData,
          account_count: parseFloat(ticketData.account_count) || 1,
          additional_fee_jpy: parseFloat(ticketData.additional_fee_jpy) || 0,
          lottery_win_bonus_jpy: parseFloat(ticketData.lottery_win_bonus_jpy) || 0,
          seats: (ticketData.seats || []).map(s => ({
            seat_type: s.seat_type,
            quantity: parseFloat(s.quantity) || 0,
            price_jpy: parseFloat(s.price_jpy) || 0,
          })),
        },
      });
      const order = res.data?.order;
      if (!order) throw new Error(res.data?.error || "提交失败");
      const selectedCurrency = paymentMethod?.payment_currency || "JPY";
      navigate(`${createPageUrl("Payment")}?order_id=${order.id}&method=${paymentMethod?.value || "other"}&pay_currency=${selectedCurrency}`);
    } catch (err) {
      toast.error(err.message);
      setSubmitting(false);
    }
  };

  if (loading) return <p className="text-gray-400 text-sm py-8 text-center">加载中...</p>;

  if (!config?.enabled) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <Alert className="border-gray-200">
          <AlertTriangle className="w-4 h-4 text-gray-500" />
          <AlertDescription className="text-gray-600 text-sm">票务购买需求功能未开启。</AlertDescription>
        </Alert>
      </div>
    );
  }

  const prepaid = calcTicketPrepaidTotal(ticketData);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Ticket className="w-5 h-5 text-violet-600" />票务购买需求
        </h1>
        <p className="text-sm text-gray-500 mt-1">填写演出票务代购需求，我们将为您抢票/抽票</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Card className="border-gray-200">
          <CardHeader className="pb-3 border-b border-gray-100">
            <CardTitle className="text-sm font-semibold text-gray-700">需求信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div>
              <Label className="text-sm font-medium">订单名（方便辨认）</Label>
              <Input className="mt-1 text-sm" placeholder="如 演唱会-S席x2"
                value={form.order_name} onChange={e => setForm(f => ({ ...f, order_name: e.target.value }))} />
            </div>
            <TicketRequestFields data={ticketData} onChange={setTd} config={config} />
            <div className="border-t border-gray-100 pt-3">
              <Label className="text-sm font-medium mb-2 block">备注（可选）</Label>
              <Textarea rows={2} className="text-sm" placeholder="其他特殊说明..."
                value={form.user_note} onChange={e => setForm(f => ({ ...f, user_note: e.target.value }))} />
            </div>
          </CardContent>
        </Card>

        <TicketPrepaySummary ticketData={ticketData} config={config} />

        <Card className="border-gray-200">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-gray-700">付款方式</CardTitle></CardHeader>
          <CardContent>
            <PaymentMethodSelector prefetched={paymentMethods} value={paymentMethod?.value} onChange={setPaymentMethod} activeColor="border-violet-500 bg-violet-50 text-violet-700 ring-2 ring-violet-200" />
          </CardContent>
        </Card>

        {canSubmit ? (
          <Button type="submit" disabled={submitting || prepaid <= 0}
            className="w-full bg-violet-600 hover:bg-violet-700">
            <Ticket className="w-4 h-4 mr-2" />
            {submitting ? "提交中..." : "提交并前往付款"}
          </Button>
        ) : (
          <Button type="button" disabled className="w-full bg-gray-400">
            <Lock className="w-4 h-4 mr-2" />您没有权限提交购买需求
          </Button>
        )}
      </form>
    </div>
  );
}