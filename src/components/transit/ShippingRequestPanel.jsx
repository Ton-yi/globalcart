import { X, Package, Truck, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function ShippingRequestPanel({ 
  arrivedRequests = [],
  inTransitRequests = [],
  currentPoolId,
  onClose,
  onNavigate 
}) {
  return (
    <div className="fixed inset-y-0 right-0 z-50 w-96 bg-white shadow-2xl border-l">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold">发货申请列表</h2>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
          <X className="w-5 h-5" />
        </button>
      </div>

      <ScrollArea className="h-[calc(100vh-80px)]">
        <div className="p-4 space-y-6">
          {/* Arrived Section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Truck className="w-4 h-4 text-green-600" />
              <h3 className="font-medium text-gray-800">中转地已收货 ({arrivedRequests.length})</h3>
            </div>
            
            {arrivedRequests.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">暂无已收货申请</p>
            ) : (
              <div className="space-y-2">
                {arrivedRequests.map(request => (
                  <div 
                    key={request.id}
                    className={`p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${
                      request.id === currentPoolId ? 'bg-red-50 border-red-200' : ''
                    }`}
                    onClick={() => onNavigate(request.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge className="text-xs bg-green-100 text-green-700">
                            已收货
                          </Badge>
                          <span className="text-sm font-medium truncate">
                            {request.pool_code || request.id.slice(-6)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {(request.order_ids || []).length} 个订单 · {request.creator_name || request.creator_email}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* In Transit Section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Package className="w-4 h-4 text-blue-600" />
              <h3 className="font-medium text-gray-800">日本已发往中转地 ({inTransitRequests.length})</h3>
            </div>
            
            {inTransitRequests.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">暂无在途申请</p>
            ) : (
              <div className="space-y-2">
                {inTransitRequests.map(request => (
                  <div 
                    key={request.id}
                    className={`p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${
                      request.id === currentPoolId ? 'bg-red-50 border-red-200' : ''
                    }`}
                    onClick={() => onNavigate(request.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge className="text-xs bg-blue-100 text-blue-700">
                            在途
                          </Badge>
                          <span className="text-sm font-medium truncate">
                            {request.pool_code || request.id.slice(-6)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {(request.order_ids || []).length} 个订单 · {request.creator_name || request.creator_email}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}