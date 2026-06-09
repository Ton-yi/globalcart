import { 
  Package, CheckCircle, Clock, Truck, Calendar, 
  MapPin, Scale, Image as ImageIcon, AlertCircle,
  ChevronRight
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { getCountry } from "@/lib/countries";

const TRANSIT_STATUS_CONFIG = {
  pending: { label: "待处理", color: "bg-orange-100 text-orange-700", icon: Clock },
  in_transit: { label: "日本已发货", color: "bg-blue-100 text-blue-700", icon: Truck },
  arrived: { label: "中转地已收货", color: "bg-green-100 text-green-700", icon: CheckCircle },
  forwarded: { label: "中转地已转发", color: "bg-gray-100 text-gray-700", icon: Package },
};

export default function TransitPoolCard({ pool, transitStatus, isSelected, onToggleSelect, onClick }) {
  const orderCount = (pool.order_ids || []).length;
  const statusConfig = TRANSIT_STATUS_CONFIG[transitStatus || "in_transit"];
  const StatusIcon = statusConfig?.icon || Truck;
  
  // Debug: log pool data for troubleshooting
  console.log('[TransitPoolCard] Pool:', pool.pool_code, 'Order IDs:', pool.order_ids, 'Order names:', pool.order_names);

  return (
    <Card 
      className={`border border-gray-200 hover:shadow-md transition-shadow ${
        isSelected ? 'ring-2 ring-red-500' : ''
      } ${onClick ? 'cursor-pointer' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        if (onClick) onClick();
      }}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={`text-xs ${statusConfig?.color || "bg-blue-100 text-blue-700"}`}>
                <StatusIcon className="w-2.5 h-2.5 mr-1 inline" />
                {statusConfig?.label || "在途"}
              </Badge>
              {pool.pool_code && (
                <Badge variant="outline" className="text-xs font-mono">
                  {pool.pool_code}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 text-xs text-gray-500">
              <MapPin className="w-3 h-3" />
              <span className="truncate">
                {pool.transit_location_name || "中转地"}
              </span>
            </div>
          </div>
          
          {onToggleSelect && transitStatus === "in_transit" && (
            <div onClick={e => e.stopPropagation()}>
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onToggleSelect(pool.id)}
              />
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Package info */}
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <Package className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <span className="truncate">
            {orderCount} 件包裹
            {(pool.order_names || []).length > 0 && (
              <span className="text-gray-400">
                ({pool.order_names.slice(0, 2).join(", ")}
                {orderCount > 2 ? ` 等${orderCount}个` : ""})
              </span>
            )}
          </span>
        </div>

        {/* Weight */}
        {pool.total_weight_g > 0 && (
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <Scale className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <span>{pool.total_weight_g}g</span>
          </div>
        )}

        {/* Destination */}
        {pool.destination_country && (
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <span>{getCountry(pool.destination_country)?.name || pool.destination_country}</span>
          </div>
        )}

        {/* Tracking number */}
        {pool.tracking_number && (
          <div className="flex items-center gap-2 text-xs font-mono text-blue-600 bg-blue-50 px-2 py-1 rounded">
            <Truck className="w-3 h-3" />
            <span className="truncate">{pool.tracking_number}</span>
          </div>
        )}

        {/* Pending status info */}
        {transitStatus === "pending" && (
          <div className="border-t pt-2 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-orange-600">
              <Clock className="w-3 h-3" />
              <span>{pool.transit_shipped_date ? "等待中转地收货" : "等待日本发货"}</span>
            </div>
            {pool.consolidation_deadline && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Calendar className="w-3 h-3" />
                <span>凑单截止：{new Date(pool.consolidation_deadline).toLocaleDateString("zh-CN")}</span>
              </div>
            )}
          </div>
        )}

        {/* Transit arrival info */}
        {(transitStatus === "arrived" || pool.transit_arrival_confirmed_at) && (
          <div className="border-t pt-2 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-green-600">
              <CheckCircle className="w-3 h-3" />
              <span>
                已收货 {new Date(pool.transit_arrival_confirmed_at).toLocaleDateString("zh-CN")}
              </span>
            </div>
            {pool.transit_arrival_image_urls && pool.transit_arrival_image_urls.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <ImageIcon className="w-3 h-3" />
                <span>{pool.transit_arrival_image_urls.length} 张照片</span>
              </div>
            )}
            {pool.transit_arrival_note && (
              <p className="text-xs text-gray-400 line-clamp-2">{pool.transit_arrival_note}</p>
            )}
          </div>
        )}

        {/* Transit forward info */}
        {transitStatus === "forwarded" && (
          <div className="border-t pt-2 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <CheckCircle className="w-3 h-3" />
              <span>
                已转发 {pool.transit_shipped_date ? new Date(pool.transit_shipped_date).toLocaleDateString("zh-CN") : ''}
              </span>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="border-t pt-2 flex items-center justify-between text-xs text-gray-400">
          <span>
            创建 {new Date(pool.created_date).toLocaleDateString("zh-CN")}
          </span>
          <ChevronRight className="w-3 h-3" />
        </div>
      </CardContent>
    </Card>
  );
}