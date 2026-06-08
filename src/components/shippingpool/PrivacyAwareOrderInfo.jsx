/**
 * PrivacyAwareOrderInfo
 * Displays order information based on privacy settings
 */
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Package } from "lucide-react";

export default function PrivacyAwareOrderInfo({ order, entry, canSeeOrderInfo, showWeight = true }) {
  // Always show weight regardless of privacy settings
  const displayProductName = canSeeOrderInfo 
    ? (order?.product_name || entry.order_id.slice(-8))
    : `订单 ${order?.order_number?.slice(-6) || entry.order_id.slice(-6)}`;

  return (
    <div className="flex-1 min-w-0">
      <p className="text-xs font-medium text-gray-700 truncate">{displayProductName}</p>
      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
        {canSeeOrderInfo && order?.order_number && (
          <span className="text-xs text-gray-400">{order.order_number}</span>
        )}
        {showWeight && order?.weight_g > 0 && (
          <span className="text-xs text-gray-400">{order.weight_g}g</span>
        )}
        {!entry.use_group_address && (
          <Badge className="text-xs bg-orange-100 text-orange-600 px-1 py-0">独立地址</Badge>
        )}
        {(canSeeOrderInfo && order?.messages?.length > 0) || entry.note ? (
          <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-200 px-1 py-0">
            <MessageSquare className="w-2.5 h-2.5 mr-0.5" />
            {canSeeOrderInfo ? (order.messages?.length || 0) : '有'}
          </Badge>
        ) : null}
      </div>
      {canSeeOrderInfo && entry.note && (
        <p className="text-xs text-gray-400 mt-0.5 truncate">{entry.note}</p>
      )}
    </div>
  );
}