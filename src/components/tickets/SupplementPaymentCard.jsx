import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CreditCard, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import PaymentMethodSelector from "@/components/common/PaymentMethodSelector";

/**
 * 票务订单补款支付组件
 * 当实际票数 > 预付票数时，用户需要补缴差额
 */
export default function SupplementPaymentCard({ order, onRefresh }) {
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [paymentUrl, setPaymentUrl] = useState(null);

  const supplementAmount = order.supplement_amount || 0;
  const isPaid = order.supplement_paid;
  const isAdmin = false; // 此组件仅用户端使用

  const handleRequestPayment = async () => {
    if (!paymentMethod) {
      toast.error("请选择支付方式");
      return;
    }

    setLoading(true);
    try {
      const res = await base44.functions.invoke("handleTicketSupplement", {
        action: 'request_payment',
        order_id: order.id,
        payment_method: paymentMethod.value,
      });

      if (res.data?.error) {
        throw new Error(res.data.error);
      }

      if (res.data.payment_url) {
        setPaymentUrl(res.data.payment_url);
        toast.success("支付链接已生成，即将跳转");
        setTimeout(() => {
          window.open(res.data.payment_url, "_blank");
        }, 500);
      } else {
        toast.success("补款申请已提交，请等待管理员确认");
      }

      onRefresh?.();
    } catch (error) {
      toast.error("申请失败：" + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!order.supplement_requested || supplementAmount <= 0) {
    return null;
  }

  return (
    <div className={`rounded-lg border p-4 ${
      isPaid ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isPaid ? (
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600" />
          )}
          <h3 className="font-semibold text-sm">
            {isPaid ? "补款已支付" : "待补款"}
          </h3>
        </div>
        <Badge className={isPaid ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
          {isPaid ? "已完成" : "待支付"}
        </Badge>
      </div>

      <div className="space-y-3 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-gray-600">补款金额</span>
          <span className="font-bold text-lg text-red-600">
            ¥{supplementAmount.toLocaleString()} JPY
          </span>
        </div>

        {isPaid ? (
          <div className="text-xs text-green-700 bg-green-100 rounded p-2">
            <p>补款已于 {new Date(order.supplement_paid_at).toLocaleString("zh-CN")} 确认</p>
            {order.supplement_paid_by && (
              <p className="mt-1">确认人：{order.supplement_paid_by}</p>
            )}
          </div>
        ) : (
          <>
            {!paymentUrl ? (
              <>
                <div className="bg-white rounded border border-red-200 p-3">
                  <p className="text-xs text-gray-600 mb-2">
                    由于实际购买的票数超过了预付票数，您需要补缴差额。
                  </p>
                  <p className="text-xs text-gray-500">
                    请选择支付方式并完成补款支付。
                  </p>
                </div>

                <PaymentMethodSelector
                  prefetched={[]}
                  value={paymentMethod?.value}
                  onChange={setPaymentMethod}
                  activeColor="border-red-500 bg-red-50 text-red-700 ring-2 ring-red-200"
                />

                <Button
                  className="w-full bg-red-600 hover:bg-red-700"
                  onClick={handleRequestPayment}
                  disabled={loading || !paymentMethod}
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />处理中...</>
                  ) : (
                    <><CreditCard className="w-4 h-4 mr-2" />申请补款支付</>
                  )}
                </Button>
              </>
            ) : (
              <div className="text-center space-y-2">
                <p className="text-xs text-gray-600">
                  支付链接已生成，如未自动跳转请点击下方按钮
                </p>
                <Button
                  className="w-full bg-red-600 hover:bg-red-700"
                  onClick={() => window.open(paymentUrl, "_blank")}
                >
                  <CreditCard className="w-4 h-4 mr-2" />前往支付
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}