import { useState } from "react";
import { ChevronDown, ChevronRight, Package, MapPin, FileText, Image as ImageIcon, Truck, Clock, Box, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getCountry } from "@/lib/countries";

export default function UserGroupCard({ 
  userEntry, 
  pool, 
  onExpand,
  isExpanded,
  onOrderClick 
}) {
  const { user_email, user_name, order_entries, group_final_address, note: groupNote, selected_addons = [], selected_addon_ids = [] } = userEntry;
  const orderCount = order_entries?.length || 0;

  const effectiveAddress = group_final_address;
  
  // Check for pickup/storage preferences from pool
  const isPickup = pool?.transit_pickup_enabled && pool.transit_pickup_user_confirmed;
  const isStorage = pool?.transit_storage_enabled;
  const shippingMethod = pool?.shipping_method || pool?.transit_shipping_method;

  return (
    <Card className="border border-gray-200">
      <CardContent className="p-4">
        {/* Header - Clickable to expand */}
        <div 
          className="flex items-start justify-between cursor-pointer"
          onClick={() => onExpand(!isExpanded)}
        >
          <div className="flex items-start gap-3 flex-1">
            <div className="mt-0.5">
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              )}
            </div>
            
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-gray-800">{user_name || user_email}</span>
                <Badge variant="outline" className="text-xs">
                  <Package className="w-3 h-3 mr-1" />
                  {orderCount} 个订单
                </Badge>
              </div>
              
              {groupNote && (
                <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                  <FileText className="w-3 h-3" />
                  <span className="truncate max-w-md">{groupNote}</span>
                </div>
              )}
              
              {/* Shipping method */}
              {shippingMethod && (
                <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                  <Truck className="w-3 h-3" />
                  <span>{shippingMethod}</span>
                </div>
              )}
              
              {/* Pickup/Storage badges */}
              <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                {isPickup && (
                  <Badge className="bg-blue-100 text-blue-700 text-xs h-5">
                    <Clock className="w-2.5 h-2.5 mr-1" />
                    自取
                  </Badge>
                )}
                {isStorage && (
                  <Badge className="bg-purple-100 text-purple-700 text-xs h-5">
                    <Box className="w-2.5 h-2.5 mr-1" />
                    暂存
                  </Badge>
                )}
                {selected_addons?.length > 0 && (
                  <Badge className="bg-green-100 text-green-700 text-xs h-5">
                    <Tag className="w-2.5 h-2.5 mr-1" />
                    {selected_addons.length} 增值服务
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t space-y-4">
            {/* Addons/Services */}
            {selected_addons?.length > 0 && (
              <div className="flex items-start gap-2">
                <Tag className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-gray-700 mb-1">增值服务</p>
                  <div className="flex flex-wrap gap-1">
                    {selected_addons.map((addon, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                        {addon.name || `服务 ${idx + 1}`}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {/* Address */}
            {effectiveAddress && (
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-gray-700 mb-1">最终收货地址</p>
                  <div className="text-gray-600 space-y-0.5">
                    {effectiveAddress.recipient_name && (
                      <p>收件人：{effectiveAddress.recipient_name}</p>
                    )}
                    {effectiveAddress.country && (
                      <p>{getCountry(effectiveAddress.country)?.name || effectiveAddress.country}</p>
                    )}
                    {[effectiveAddress.addr1, effectiveAddress.addr2, effectiveAddress.addr3].filter(Boolean).join(' ') && (
                      <p>{[effectiveAddress.addr1, effectiveAddress.addr2, effectiveAddress.addr3].filter(Boolean).join(' ')}</p>
                    )}
                    {effectiveAddress.state && <p>{effectiveAddress.state}</p>}
                    {effectiveAddress.phone && <p>电话：{effectiveAddress.phone}</p>}
                  </div>
                </div>
              </div>
            )}

            {/* Order List */}
            {order_entries && order_entries.length > 0 && (
              <div>
                <p className="font-medium text-gray-700 mb-2 text-sm">订单列表</p>
                <div className="space-y-2">
                  {order_entries.map((entry, idx) => (
                    <div 
                      key={entry.order_id || idx}
                      className="p-3 bg-gray-50 rounded border border-gray-100"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 flex-1">
                          <Package className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-sm text-gray-700 font-medium">
                              {entry.note || `订单 ${entry.order_id?.slice(-6) || idx + 1}`}
                            </p>
                            {/* Order-level addons */}
                            {entry.selected_addons?.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {entry.selected_addons.map((addon, aidx) => (
                                  <Badge key={aidx} variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 h-4.5">
                                    {addon.name}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        {entry.image_urls?.length > 0 && (
                          <div className="flex items-center gap-1">
                            <ImageIcon className="w-3.5 h-3.5 text-gray-400" />
                            <span className="text-xs text-gray-500">{entry.image_urls.length}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}