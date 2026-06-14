import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";

/**
 * 票务预付金额实时计算与说明
 * 应付预付 = Σ(席种数量 × 单价) × 账户数 + 追加料金（× 预付比例）
 * 向用户清楚说明：先按需求总票数全额收取，实际购买后退还差价。
 */
export default function TicketPrepaySummary({ ticketData, config }) {
  const seats = ticketData?.seats || [];
  const accountCount = parseFloat(ticketData?.account_count) || 1;
  const additional = parseFloat(ticketData?.additional_fee_jpy) || 0;
  const seatTotal = seats.reduce(
    (sum, s) => sum + (parseFloat(s.quantity) || 0) * (parseFloat(s.price_jpy) || 0), 0);
  const ticketsTotal = seatTotal * accountCount;
  const grossTotal = ticketsTotal + additional;

  const prepayEnabled = config?.prepay_enabled !== false;
  let prepayRate = parseFloat(config?.prepay_rate);
  if (isNaN(prepayRate) || prepayRate <= 0 || prepayRate > 100) prepayRate = 100;
  const prepayJpy = Math.round(grossTotal * (prepayEnabled ? prepayRate / 100 : 100) / 100 * 100) / 1;
  const finalPrepay = Math.round(grossTotal * (prepayEnabled ? prepayRate : 100) / 100);

  if (grossTotal <= 0) return null;

  return (
    <Alert className="border-violet-200 bg-violet-50">
      <Info className="w-4 h-4 text-violet-600" />
      <AlertDescription className="text-violet-900 text-sm space-y-1">
        <div className="flex justify-between"><span>票款小计（{seats.length} 种席 × {accountCount} 账户/人）</span><span>¥{Math.round(ticketsTotal).toLocaleString()}</span></div>
        {additional > 0 && <div className="flex justify-between"><span>追加料金</span><span>¥{Math.round(additional).toLocaleString()}</span></div>}
        <div className="flex justify-between font-semibold border-t border-violet-200 pt-1">
          <span>应付预付款{prepayEnabled && prepayRate < 100 ? `（${prepayRate}%）` : ""}</span>
          <span>¥{finalPrepay.toLocaleString()}</span>
        </div>
        <p className="text-xs text-violet-700 font-normal pt-1">
          说明：先按需求总票数（{accountCount} 个账户/人）全额预收。抽选/抢票结束后，管理员录入实际购票数量，
          多收的部分将按 <b>(预付票数 − 实际票数) × 单价 × 账户数</b> 退还给您。
        </p>
      </AlertDescription>
    </Alert>
  );
}