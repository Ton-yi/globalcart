import { Calendar, Package, Scale, MapPin, Truck, DollarSign, User, Layers, ChevronRight, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getCountry } from "@/lib/countries";

function truncateName(name, maxLen = 10) {
  if (!name) return "";
  return name.length > maxLen ? name.slice(0, maxLen) + "…" : name;
}

function PackagesSummary({ orderIds, orderNames }) {
  const count = (orderIds || []).length;
  if (!orderNames || orderNames.length === 0) {
    return <span>{count} 件包裹</span>;
  }
  const MAX_SHOW = 2;
  const shown = orderNames.slice(0, MAX_SHOW);
  const remaining = count - shown.length;
  return (
    <span>
      {shown.map((n, i) =>
      <span key={i}>{i > 0 && <span className="text-gray-300 mx-0.5">·</span>}{truncateName(n)}</span>
      )}
      {remaining > 0 && <span className="text-gray-400 ml-1">…等{count}个包裹</span>}
    </span>);

}

const STATUS_CONFIG = {
  pending: { label: "待处理", color: "bg-amber-100 text-amber-700" },
  processing: { label: "处理中", color: "bg-blue-100 text-blue-700" },
  shipped: { label: "已发货", color: "bg-green-100 text-green-700" },
  delivered: { label: "已签收", color: "bg-emerald-100 text-emerald-700" },
  cancelled: { label: "已取消", color: "bg-red-100 text-red-600" }
};

const METHOD_LABELS = {
  EMS: "EMS", DHL: "DHL", FedEx: "FedEx", SAL: "SAL",
  surface: "海运", small_packet_air: "小包空运", other: "其他"
};

export default function ShippingPoolCard({ pool, onClick }) {
  const status = STATUS_CONFIG[pool.status] || STATUS_CONFIG.pending;
  const isConsolidation = pool.consolidation_type && pool.consolidation_type !== "";

  return (
    <div
      onClick={() => onClick?.(pool)}
      className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md hover:border-gray-300 cursor-pointer transition-all">
      
      {/* Colored top bar based on type */}
      <div className={`h-1 w-full ${isConsolidation ? "bg-gradient-to-r from-blue-400 to-purple-400" : "bg-gradient-to-r from-gray-300 to-gray-400"}`} />

      <div className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge className={`text-xs ${status.color}`}>{status.label}</Badge>
              {isConsolidation &&
              <Badge className="text-xs bg-purple-100 text-purple-700 border-purple-200">
                  <Layers className="w-2.5 h-2.5 mr-1 inline" />拼邮
                </Badge>
              }
              

              
              {pool.status === "pending" && pool.asap &&
              <Badge className="text-xs bg-orange-100 text-orange-600 border-orange-200">⚡ 尽快</Badge>
              }
              {pool.tracking_number &&
              <span className="text-xs font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                  {pool.tracking_number}
                </span>
              }
            </div>


            {/* Title / transit location */}
            <p className="text-sm font-semibold text-gray-900 mt-1 truncate">
              {isConsolidation ?
              pool.consolidation_type === "transit" ? `中转拼邮 → ${pool.transit_location_name || "中转地"}` : "自选地址拼邮" :
              `单独发货 ${pool.pool_code || ""}`}
            </p>
            {pool.pool_code && isConsolidation &&
            <p className="text-xs text-gray-400 mt-0.5 font-mono">编号：{pool.pool_code}</p>
            }
            {pool.is_private &&
            <span className="inline-flex items-center gap-1 text-xs text-gray-500 mt-0.5">🔒 不公开</span>
            }
          </div>

          {/* Right: date */}
          {pool.scheduled_ship_date &&
          <div className="flex-shrink-0 text-right">
              <p className="text-xs text-gray-400">计划发货</p>
              <p className="text-xs font-medium text-gray-700 flex items-center gap-1 mt-0.5">
                <Calendar className="w-3 h-3" />{pool.scheduled_ship_date}
              </p>
            </div>
          }
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-gray-600">
          <div className="flex items-center gap-1.5 col-span-2">
            <Package className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <PackagesSummary orderIds={pool.order_ids} orderNames={pool.order_names} />
          </div>
          {pool.total_weight_g > 0 &&
          <div className="flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <span>{pool.total_weight_g}g</span>
            </div>
          }
          {pool.shipping_method &&
          <div className="flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <span>{METHOD_LABELS[pool.shipping_method] || pool.shipping_method}</span>
            </div>
          }
          {pool.destination_country &&
          <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <span>{getCountry(pool.destination_country)?.name || pool.destination_country}</span>
            </div>
          }
          {(pool.actual_fee || pool.estimated_fee) &&
          <div className="flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <span>
                {pool.actual_fee ?
              `JPY ${Math.round(pool.actual_fee).toLocaleString()}` :
              `≈ ${pool.fee_currency || "CNY"} ${pool.estimated_fee?.toFixed(2)}`}
              </span>
            </div>
          }
          {pool.creator_name &&
          <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <span className="truncate">{pool.creator_name}</span>
            </div>
          }
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
    </div>);

}