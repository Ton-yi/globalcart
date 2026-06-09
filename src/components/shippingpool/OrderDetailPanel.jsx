/**
 * OrderDetailPanel - Displays expandable order details for shipping pool
 * Shows: destination address, transit shipping method, addons, and notes
 */
import { useState } from "react";
import { ChevronDown, ChevronUp, Truck, Tag, FileText, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCountry } from "@/lib/countries";

export default function OrderDetailPanel({ order, pool }) {
  const [isExpanded, setIsExpanded] = useState(true);
  
  // Find the user group this order belongs to
  const userGroup = (pool.per_user_groups || []).find(g => g.user_email === order.user_email);
  
  // Extract order-level details from per_user_groups (group-level settings)
  const transitMethod = userGroup?.transit_shipping_method_name || order.pre_shipment?.transit_shipping_method_name;
  const orderAddons = userGroup?.selected_addons || order.selected_addons || [];
  const orderNote = userGroup?.note || order.pre_shipment?.user_note;
  
  // Get address from group_final_address or pre_shipment
  const addr = userGroup?.group_final_address || order.pre_shipment?.address || {};
  const destinationCountry = addr.country || order.destination_country;
  
  const hasDetails = addr.recipient_name || addr.addr1 || destinationCountry || transitMethod || orderAddons.length > 0 || orderNote;
  
  if (!hasDetails) return null;
  
  return (
    <div className="border-t px-3 pb-2">
      <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-3 py-2 flex items-center justify-between bg-gray-100 border-b border-gray-200">
          <div className="flex items-center gap-2 text-xs font-medium text-gray-700">
            <MapPin className="w-3.5 h-3.5" />
            <span>中转发货信息</span>
          </div>
          <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => setIsExpanded(!isExpanded)}>
            {isExpanded ? (
              <><ChevronUp className="w-3 h-3 mr-1" />收起</>
            ) : (
              <><ChevronDown className="w-3 h-3 mr-1" />查看</>
            )}
          </Button>
        </div>
        
        {isExpanded && (
          <div className="p-3 space-y-3 text-xs">
            {(addr.recipient_name || addr.addr1 || destinationCountry) && (
              <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 space-y-1">
                <div className="flex items-center gap-1.5 font-medium text-blue-700 mb-1">
                  <MapPin className="w-3.5 h-3.5" />
                  发货目的地
                </div>
                {addr.recipient_name && (
                  <div>
                    <span className="text-gray-500">收件人：</span>
                    <span className="font-medium">{addr.recipient_name}</span>
                    {addr.phone && <span className="ml-2 text-gray-600">{addr.phone}</span>}
                  </div>
                )}
                {destinationCountry && (
                  <div>
                    <span className="text-gray-500">国家：</span>
                    <span className="font-medium">{getCountry(destinationCountry)?.name || destinationCountry}</span>
                  </div>
                )}
                {addr.addr1 && (
                  <div className="whitespace-pre-wrap text-gray-700">
                    {addr.addr1}{addr.addr2 && ` ${addr.addr2}`}{addr.addr3 && ` ${addr.addr3}`}{addr.state && `, ${addr.state}`}
                  </div>
                )}
              </div>
            )}
            
            {transitMethod && (
              <div className="bg-purple-50 border border-purple-100 rounded-lg px-3 py-2">
                <div className="flex items-center gap-1.5 font-medium text-purple-700 mb-1">
                  <Truck className="w-3.5 h-3.5" />
                  中转运输方式
                </div>
                <div className="text-gray-700">{transitMethod}</div>
              </div>
            )}
            
            {orderAddons.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-100 rounded-lg px-3 py-2 space-y-1">
                <div className="flex items-center gap-1.5 font-medium text-yellow-700">
                  <Tag className="w-3.5 h-3.5" />
                  增值服务
                </div>
                {orderAddons.map((addon, idx) => (
                  <div key={idx} className="flex items-center justify-between text-gray-700">
                    <span>{addon.name || addon.id}</span>
                    {parseFloat(addon.fee) > 0 && (
                      <span className="font-medium text-yellow-700">+{addon.fee_currency || "JPY"} {Math.round(parseFloat(addon.fee))}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            {orderNote && (
              <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                <div className="flex items-center gap-1.5 font-medium text-gray-600 mb-1">
                  <FileText className="w-3.5 h-3.5" />
                  备注
                </div>
                <p className="text-gray-700 whitespace-pre-wrap">{orderNote}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}