import { ChevronDown, ChevronRight, Package, MapPin, FileText, Image as ImageIcon, Truck, Clock, Box, Tag, Phone, User, Home, ClipboardList, Send, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getCountry } from "@/lib/countries";

export default function UserGroupCard({ 
  userEntry, 
  pool, 
  onExpand,
  isExpanded,
  onOrderClick,
  onOrderSelect,
  onShowAddress
}) {
  const { user_email, user_name, order_entries, group_final_address, note: groupNote, selected_addons = [], selected_addon_ids = [], transit_shipping_method_id, transit_shipping_method_name } = userEntry;
  const orderCount = order_entries?.length || 0;

  // Create unique group identifier (user_email + transit_method_id)
  const groupKey = `${user_email}__${transit_shipping_method_id || 'none'}`;
  
  // Create click handler that passes the unique group key to onExpand
  const handleClick = onExpand ? onExpand(groupKey) : null;

  const effectiveAddress = group_final_address;
  
  // Check for pickup/storage preferences from pool
  const isPickup = pool?.transit_pickup_enabled && pool.transit_pickup_user_confirmed;
  const isStorage = pool?.transit_storage_enabled;
  const shippingMethod = pool?.shipping_method || pool?.transit_shipping_method || pool?.transit_shipping_method_name;
  const transitMethodId = pool?.transit_shipping_method_id;
  // Check if transit method is special storage/pickup
  const isSpecialStorage = transitMethodId === '__storage__';
  const isSpecialPickup = transitMethodId === '__pickup__';

  // Group orders by address (using override_final_address or group_final_address)
  const addressGroups = order_entries?.reduce((acc, entry) => {
    const addr = entry.override_final_address || effectiveAddress;
    const addrKey = addr ? JSON.stringify(addr) : 'no_address';
    if (!acc[addrKey]) {
      acc[addrKey] = {
        address: addr,
        orders: [],
        addressLabel: addr ? `${addr.recipient_name || '收件人'} - ${addr.country || '国家'}` : '未填写地址'
      };
    }
    acc[addrKey].orders.push(entry);
    return acc;
  }, {}) || {};

  const addressGroupList = Object.values(addressGroups);

  return (
    <Card className="border border-gray-200">
      <CardContent className="p-4">
        {/* Header - Clickable to expand */}
        <div 
          className="flex items-start justify-between cursor-pointer"
          onClick={handleClick}
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
                {transit_shipping_method_name && (
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                    <Truck className="w-3 h-3 mr-1" />
                    {transit_shipping_method_name}
                  </Badge>
                )}
                {addressGroupList.length > 1 && (
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                    <MapPin className="w-3 h-3 mr-1" />
                    {addressGroupList.length} 个地址
                  </Badge>
                )}
              </div>
              
              {groupNote && (
                <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                  <FileText className="w-3 h-3" />
                  <span className="truncate max-w-md">{groupNote}</span>
                </div>
              )}
              
              {/* Pickup/Storage badges */}
              <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                {(isPickup || isSpecialPickup) && (
                  <Badge className="bg-blue-100 text-blue-700 text-xs h-5">
                    <Clock className="w-2.5 h-2.5 mr-1" />
                    自取
                  </Badge>
                )}
                {(isStorage || isSpecialStorage) && (
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
            {/* Addons/Services with custom fee display */}
            {selected_addons?.length > 0 && (
              <div className="flex items-start gap-2">
                <Tag className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-gray-700 mb-1">增值服务</p>
                  <div className="flex flex-wrap gap-1">
                    {selected_addons.map((addon, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                        {addon.name || `服务 ${idx + 1}`}
                        {addon.fee !== undefined && addon.fee !== null && (
                          <span className="ml-1 font-medium">¥{addon.fee}</span>
                        )}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Address Groups - Show address label but not details */}
            {addressGroupList.map((group, groupIdx) => (
              <div key={groupIdx} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-500" />
                    <span className="font-medium text-gray-700 text-sm">
                      地址 {groupIdx + 1}：{group.addressLabel}
                    </span>
                  </div>
                  {/* Button to show address in right panel */}
                  {group.address && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        onShowAddress?.(group.address, group.orders);
                      }}
                    >
                      <Info className="w-3 h-3 mr-1" />
                      查看地址
                    </Button>
                  )}
                </div>

                {/* Order List for this address with detailed info */}
                {group.orders.length > 0 && (
                  <div className="space-y-2">
                    {group.orders.map((entry, orderIdx) => (
                      <div 
                        key={entry.order_id || orderIdx}
                        className="p-3 rounded-lg border text-xs cursor-pointer transition-colors bg-white border-gray-100 hover:bg-gray-50 hover:border-blue-200"
                        onClick={() => onOrderSelect?.(entry.order_id, entry, group.address)}
                      >
                        <div className="space-y-2">
                          {/* Order header with product name */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2 flex-1">
                              <Package className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
                              <div className="flex-1">
                                <p className="font-medium text-gray-800">
                                  {entry.product_name || `订单 ${entry.order_id?.slice(-6) || orderIdx + 1}`}
                                </p>
                                {entry.product_description && (
                                  <p className="text-gray-500 mt-0.5 truncate">{entry.product_description}</p>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {/* Order images */}
                          {entry.image_urls && entry.image_urls.length > 0 && (
                            <div className="flex items-center gap-2 overflow-x-auto">
                              {entry.image_urls.map((imgUrl, imgIdx) => (
                                <div 
                                  key={imgIdx}
                                  className="w-16 h-16 rounded border border-gray-200 bg-gray-50 flex items-center justify-center flex-shrink-0 cursor-pointer hover:border-blue-300 transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(imgUrl, '_blank');
                                  }}
                                >
                                  <img 
                                    src={imgUrl} 
                                    alt={`包裹图片 ${imgIdx + 1}`}
                                    className="w-full h-full object-cover rounded"
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                      e.target.parentElement.innerHTML = '<ImageIcon class="w-6 h-6 text-gray-300" />';
                                    }}
                                  />
                                </div>
                              ))}
                              <div className="flex items-center gap-1 text-gray-500">
                                <ImageIcon className="w-3 h-3" />
                                <span>{entry.image_urls.length} 张图片</span>
                              </div>
                            </div>
                          )}
                          
                          {/* Order addons with custom fees */}
                          {(entry.selected_addons && entry.selected_addons.length > 0) && (
                            <div className="flex flex-wrap gap-1">
                              {entry.selected_addons.map((addon, aidx) => (
                                <Badge key={aidx} variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 h-5">
                                  {addon.name}
                                  {addon.fee !== undefined && addon.fee !== null && (
                                    <span className="ml-1 font-medium">¥{addon.fee}</span>
                                  )}
                                </Badge>
                              ))}
                            </div>
                          )}
                          
                          {/* Order note */}
                          {entry.note && (
                            <div className="flex items-center gap-1 text-gray-500">
                              <FileText className="w-3 h-3" />
                              <span className="truncate">{entry.note}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}