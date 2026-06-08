import { useState } from "react";
import { ChevronDown, ChevronRight, Package, MapPin, FileText, Image as ImageIcon } from "lucide-react";
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
  const { user_email, user_name, order_entries, group_final_address, note: groupNote } = userEntry;
  const orderCount = order_entries?.length || 0;

  const effectiveAddress = group_final_address;

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
            </div>
          </div>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t space-y-4">
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
                      className="flex items-center justify-between p-2 bg-gray-50 rounded hover:bg-gray-100 cursor-pointer transition-colors"
                      onClick={() => onOrderClick(entry.order_id)}
                    >
                      <div className="flex items-center gap-2">
                        <Package className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-sm text-gray-700 truncate max-w-[200px]">
                          {entry.note || `订单 ${entry.order_id?.slice(-6) || idx + 1}`}
                        </span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
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