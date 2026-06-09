import { ChevronDown, ChevronRight, Package, MapPin, FileText, Image as ImageIcon, Truck, Clock, Box, Tag, Phone, User, Home, ClipboardList, Send } from "lucide-react";
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
  onOrderSelect
}) {
  const { user_email, user_name, order_entries, group_final_address, note: groupNote, selected_addons = [], selected_addon_ids = [] } = userEntry;
  const orderCount = order_entries?.length || 0;

  // Create click handler that passes email to onExpand
  const handleClick = onExpand ? onExpand(user_email) : null;

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
              
              {/* Shipping method */}
              {shippingMethod && (
                <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                  <Truck className="w-3 h-3" />
                  <span>{shippingMethod}</span>
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

            {/* Address Groups */}
            {addressGroupList.map((group, groupIdx) => (
              <div key={groupIdx} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="w-4 h-4 text-gray-500" />
                  <span className="font-medium text-gray-700 text-sm">
                    地址 {groupIdx + 1}：{group.addressLabel}
                  </span>
                </div>

                {/* Address Details */}
                {group.address && (
                  <div className="mb-3 text-xs space-y-1">
                    <div className="flex items-start gap-2">
                      <User className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
                      <span>收件人：{group.address.recipient_name || '未填写'}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Phone className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
                      <span>电话：{group.address.phone || '未填写'}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Home className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="font-medium text-gray-700">国家/地区：{getCountry(group.address.country)?.name || group.address.country || '未填写'}</p>
                        <p>地址行 1：{group.address.addr1 || '未填写'}</p>
                        <p>地址行 2：{group.address.addr2 || '未填写'}</p>
                        <p>地址行 3：{group.address.addr3 || '未填写'}</p>
                        <p>州/省：{group.address.state || '未填写'}</p>
                        {group.address.postal_code && <p>邮编：{group.address.postal_code}</p>}
                      </div>
                    </div>
                  </div>
                )}

                {/* Order List for this address */}
                {group.orders.length > 0 && (
                  <div className="mb-3">
                    <p className="font-medium text-gray-700 mb-2 text-xs flex items-center gap-1">
                      <ClipboardList className="w-3 h-3" />
                      订单列表（{group.orders.length}个）
                    </p>
                    <div className="space-y-1.5">
                      {group.orders.map((entry, idx) => (
                        <div 
                          key={entry.order_id || idx}
                          className="p-2 rounded border text-xs cursor-pointer transition-colors bg-white border-gray-100 hover:bg-gray-50"
                          onClick={() => onOrderSelect?.(entry.order_id, entry, group.address)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2 flex-1">
                              <Package className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
                              <div className="flex-1">
                                <p className="text-gray-700">
                                  {entry.note || `订单 ${entry.order_id?.slice(-6) || idx + 1}`}
                                </p>
                                {entry.selected_addons?.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {entry.selected_addons.map((addon, aidx) => (
                                      <Badge key={aidx} variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 h-4">
                                        {addon.name}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            {entry.image_urls?.length > 0 && (
                              <div className="flex items-center gap-1">
                                <ImageIcon className="w-3 h-3 text-gray-400" />
                                <span className="text-gray-500">{entry.image_urls.length}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
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