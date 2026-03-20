import { Calendar, Package, Scale, MapPin, Truck, DollarSign, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const STATUS_CONFIG = {
  pending:    { label: "待处理", color: "bg-gray-100 text-gray-600" },
  processing: { label: "处理中", color: "bg-blue-100 text-blue-700" },
  shipped:    { label: "已发货", color: "bg-green-100 text-green-700" },
  delivered:  { label: "已签收", color: "bg-emerald-100 text-emerald-700" },
  cancelled:  { label: "已取消", color: "bg-red-100 text-red-600" },
};

const METHOD_LABELS = {
  EMS: "EMS", DHL: "DHL", FedEx: "FedEx", SAL: "SAL",
  surface: "海运", small_packet_air: "小包空运", other: "其他",
};

export default function ShippingPoolCard({ pool, onClick }) {
  const status = STATUS_CONFIG[pool.status] || STATUS_CONFIG.pending;

  return (
    <div
      onClick={() => onClick?.(pool)}
      className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md hover:border-gray-300 cursor-pointer transition-all space-y-3"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={`text-xs ${status.color}`}>{status.label}</Badge>
            {pool.tracking_number && (
              <span className="text-xs font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                {pool.tracking_number}
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-gray-900 mt-1 truncate">
            {pool.title || `发货申请 #${pool.id.slice(-6).toUpperCase()}`}
          </p>
        </div>
        {pool.scheduled_ship_date && (
          <div className="flex-shrink-0 text-right">
            <p className="text-xs text-gray-400">计划发货</p>
            <p className="text-xs font-medium text-gray-700 flex items-center gap-1 mt-0.5">
              <Calendar className="w-3 h-3" />{pool.scheduled_ship_date}
            </p>
          </div>
        )}
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
        <div className="flex items-center gap-1.5">
          <Package className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <span>{(pool.order_ids || []).length} 件包裹</span>
        </div>
        {pool.total_weight_g > 0 && (
          <div className="flex items-center gap-1.5">
            <Scale className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <span>{pool.total_weight_g}g</span>
          </div>
        )}
        {pool.shipping_method && (
          <div className="flex items-center gap-1.5">
            <Truck className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <span>{METHOD_LABELS[pool.shipping_method] || pool.shipping_method}</span>
          </div>
        )}
        {pool.destination_country && (
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <span>{pool.destination_country}</span>
          </div>
        )}
        {(pool.actual_fee || pool.estimated_fee) && (
          <div className="flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <span>
              {pool.actual_fee
                ? `${pool.fee_currency || "CNY"} ${pool.actual_fee.toFixed(2)}`
                : `≈ ${pool.fee_currency || "CNY"} ${pool.estimated_fee?.toFixed(2)}`}
            </span>
          </div>
        )}
        {pool.creator_name && (
          <div className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <span className="truncate">{pool.creator_name}</span>
          </div>
        )}
      </div>

      {pool.transit_location_name && (
        <p className="text-xs text-gray-400">中转地：{pool.transit_location_name}</p>
      )}
    </div>
  );
}