/**
 * StagedOrderList - Displays temporarily staged orders before saving
 * Shows a list of orders that will be added to the pool when user clicks "Save"
 */
import { X, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageWithViewer } from "@/components/common/ImageViewer";

export default function StagedOrderList({ 
  stagedOrders, 
  onRemove, 
  onSave, 
  onCancel,
  isSaving,
  isAdmin 
}) {
  if (stagedOrders.length === 0) return null;

  const totalWeight = stagedOrders.reduce((sum, o) => sum + (o.weight_g || 0), 0);

  return (
    <div className="border border-blue-200 rounded-xl overflow-hidden bg-blue-50/50">
      <div className="flex items-center justify-between bg-blue-100 px-3 py-2 border-b border-blue-200">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-blue-800">
            待添加的包裹 ({stagedOrders.length})
          </span>
          <span className="text-xs text-blue-600">
            总重量：{totalWeight}g
          </span>
        </div>
        <button 
          onClick={onCancel} 
          className="text-gray-400 hover:text-gray-600 text-xs"
          title="清空暂存列表"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      
      <div className="p-3 space-y-2 max-h-40 overflow-y-auto">
        {stagedOrders.map(order => (
          <div 
            key={order.id} 
            className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg border border-blue-100 bg-white"
          >
            {(() => { 
              const img = order.product_image_url || order.purchase_screenshot_url || order.arrival_photo_url; 
              return img ? (
                <ImageWithViewer src={img} alt="包裹图片">
                  <img src={img} alt="" className="w-8 h-8 rounded object-cover border border-gray-200 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity" />
                </ImageWithViewer>
              ) : (
                <div className="w-8 h-8 rounded bg-gray-100 flex-shrink-0" />
              ); 
            })()}
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-800 truncate">{order.product_name}</p>
              <p className="text-xs text-gray-400">
                {order.order_number} · {order.weight_g || 0}g
              </p>
            </div>
            <button
              onClick={() => onRemove(order.id)}
              className="flex-shrink-0 p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
              title="移除"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-2 px-3 py-2 border-t border-blue-200 bg-blue-50">
        <Button 
          variant="outline" 
          size="sm" 
          className="flex-1 h-7 text-xs border-blue-300 text-blue-700 hover:bg-blue-100"
          onClick={onCancel}
          disabled={isSaving}
        >
          取消
        </Button>
        <Button 
          size="sm" 
          className="flex-1 h-7 text-xs bg-blue-600 hover:bg-blue-700"
          onClick={onSave}
          disabled={isSaving}
        >
          {isSaving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
          {isSaving ? '保存中...' : '确认添加'}
        </Button>
      </div>
    </div>
  );
}