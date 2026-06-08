import { MapPin, Package, Scale, Calendar, Clock, CheckCircle, Truck, Image as ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getCountry } from "@/lib/countries";

export default function PoolDetailHeader({ pool, location, orderCount }) {
  const hasArrived = !!pool.transit_arrival_confirmed_at;
  const hasShipped = !!pool.transit_shipped_date;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Pool Info */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Package className="w-4 h-4 text-gray-400" />
              <span>发货申请</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {pool.pool_code && (
                <Badge variant="outline" className="font-mono">
                  {pool.pool_code}
                </Badge>
              )}
              <Badge className={hasShipped ? "bg-gray-100 text-gray-700" : hasArrived ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}>
                {hasShipped ? "已发货" : hasArrived ? "已收货" : "待收货"}
              </Badge>
            </div>
            <div className="text-xs text-gray-500">
              {orderCount} 个订单
            </div>
          </div>

          {/* Transit Location */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin className="w-4 h-4 text-gray-400" />
              <span>中转地</span>
            </div>
            <p className="text-sm font-medium text-gray-800">
              {location?.name || pool.transit_location_name}
            </p>
            {location?.address && (
              <p className="text-xs text-gray-500 truncate">
                {location.address}
              </p>
            )}
          </div>

          {/* Weight */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Scale className="w-4 h-4 text-gray-400" />
              <span>重量</span>
            </div>
            <p className="text-sm font-medium text-gray-800">
              {pool.total_weight_g || pool.final_weight_g || 0}g
            </p>
            {pool.box_template_name && (
              <p className="text-xs text-gray-500">
                外箱：{pool.box_template_name}
              </p>
            )}
          </div>

          {/* Destination */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin className="w-4 h-4 text-gray-400" />
              <span>目的地</span>
            </div>
            <p className="text-sm font-medium text-gray-800">
              {getCountry(pool.destination_country)?.name || pool.destination_country}
            </p>
            {pool.recipient_name && (
              <p className="text-xs text-gray-500">
                {pool.recipient_name}
              </p>
            )}
          </div>
        </div>

        {/* Transit Info Footer */}
        {(hasArrived || hasShipped) && (
          <div className="mt-4 pt-4 border-t flex items-center gap-4 flex-wrap">
            {hasArrived && (
              <div className="flex items-center gap-2 text-xs text-green-600">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>
                  已收货 {new Date(pool.transit_arrival_confirmed_at).toLocaleDateString("zh-CN")}
                </span>
                {pool.transit_arrival_image_urls && pool.transit_arrival_image_urls.length > 0 && (
                  <span className="flex items-center gap-1 ml-2 text-gray-500">
                    <ImageIcon className="w-3 h-3" />
                    {pool.transit_arrival_image_urls.length} 张照片
                  </span>
                )}
              </div>
            )}
            
            {hasShipped && (
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <Truck className="w-3.5 h-3.5" />
                <span>
                  已发货 {new Date(pool.transit_shipped_date).toLocaleDateString("zh-CN")}
                </span>
                {pool.transit_tracking_number && (
                  <span className="font-mono ml-1">{pool.transit_tracking_number}</span>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}