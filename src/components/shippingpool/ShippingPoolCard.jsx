import { Calendar, Package, Scale, MapPin, Truck, DollarSign, User, Layers, ChevronRight, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getCountry } from "@/lib/countries";

const STATUS_CONFIG = {
  pending:    { label: "待处理", color: "bg-amber-100 text-amber-700" },
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
  const isConsolidation = pool.consolidation_type && pool.consolidation_type !== "";

  return (
    <div
      onClick={() => onClick?.(pool)}
      className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md hover:border-gray-300 cursor-pointer transition-all"
    >
      {/* Colored top bar based on type */}
      <div className={`h-1 w-full ${isConsolidation ? "bg-gradient-to-r from-blue-400 to-purple-400" : "bg-gradient-to-r from-gray-300 to-gray-400"}`} />

      <div className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge className={`text-xs ${status.color}`}>{status.label}</Badge>
              {isConsolidation && (
                <Badge className="text-xs bg-purple-100 text-purple-700 border-purple-200">
                  <Layers className="w-2.5 h-2.5 mr-1 inline" />拼邮
                </Badge>
              )}
              {pool.pool_code && (
                <span className="text-xs font-mono text-purple-700 bg-purple-50 border border-purple-100 px-1.5 py-0.5 rounded">{pool.pool_code}</span>
              )}
              {pool.status === "pending" && pool.asap && (
                <Badge className="text-xs bg-orange-100 text-orange-600 border-orange-200">⚡ 尽快</Badge>
              )}
              {pool.tracking_number && (
                <span className="text-xs font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                  {pool.tracking_number}
                </span>
              )}
            </div>

            {/* Title / transit location */}
            <p className="text-sm font-semibold text-gray-900 mt-1.5 truncate">
              {isConsolidation
                ? (pool.consolidation_type === "transit" ? `中转拼邮 → ${pool.transit_location_name || "中转地"}` : "自选地址拼邮")
                : (pool.title || `发货申请 ${pool.pool_code ? `#${pool.pool_code}` : `#${pool.id.slice(-6).toUpperCase()}`}`)}
            </p>
          </div>

          {/* Right: date */}
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
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-gray-600">
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
              <span>{getCountry(pool.destination_country)?.name || pool.destination_country}</span>
            </div>
          )}
          {(pool.actual_fee || pool.estimated_fee) && (
            <div className="flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <span>
                {pool.actual_fee
                  ? `JPY ${Math.round(pool.actual_fee).toLocaleString()}`
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

        {/* Footer */}
        <div className="flex items-center justify-between pt-1 border-t border-gray-50">
          <span className="text-xs text-gray-400">
            {new Date(pool.created_date).toLocaleDateString("zh-CN")}
          </span>
          <span className="text-xs text-gray-400 flex items-center gap-0.5 hover:text-gray-600">
            查看详情 <ChevronRight className="w-3 h-3" />
          </span>
        </div>
      </div>
    </div>
  );
}