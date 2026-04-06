/**
 * ShippingFeeBreakdown
 * Reusable component to display per-user fee breakdown for a ShippingPool.
 * Used in both AdminShippingInfoPanel and the user payment panel.
 */
import { Badge } from "@/components/ui/badge";

export default function ShippingFeeBreakdown({ breakdowns, isConsolidation, currentUserEmail = null }) {
  if (!breakdowns || breakdowns.length === 0) return null;

  // If currentUserEmail is set, only show that user's breakdown (user view)
  const displayBreakdowns = currentUserEmail
    ? breakdowns.filter(b => b.user_email === currentUserEmail)
    : breakdowns;

  if (displayBreakdowns.length === 0) return null;

  return (
    <div className="space-y-3">
      {displayBreakdowns.map(b => (
        <div key={b.user_email} className="bg-gray-50 rounded-lg overflow-hidden border border-gray-200">
          {/* Show user header only in admin view (multiple users) or consolidation */}
          {(!currentUserEmail || isConsolidation) && breakdowns.length > 1 && (
            <div className="px-3 py-1.5 bg-gray-100 border-b border-gray-200 flex items-center justify-between">
              <span className="text-xs font-medium text-gray-600">{b.user_email}</span>
              <span className="text-xs text-gray-400">{b.user_weight_g}g · {b.user_orders?.length || 0} 件</span>
            </div>
          )}
          <div className="px-3 py-2 space-y-1.5">
            {b.items.map((item, idx) => (
              <div key={idx} className={`flex justify-between items-start gap-2 text-xs ${item.is_shared ? "text-blue-700 bg-blue-50 -mx-3 px-3 py-1 rounded" : "text-gray-700"}`}>
                <span className="flex-1">{item.label}</span>
                <span className="font-medium flex-shrink-0">¥{Math.round(item.amount_jpy).toLocaleString()}</span>
              </div>
            ))}
            {b.items.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-1">暂无费用明细</p>
            )}
          </div>
          <div className="px-3 py-2 bg-orange-50 border-t border-orange-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-orange-700">
              {currentUserEmail ? "您需支付" : "应付合计"}
            </span>
            <span className="text-base font-bold text-orange-600">
              ¥{Math.round(b.total_jpy).toLocaleString()} <span className="text-xs font-normal">JPY</span>
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}