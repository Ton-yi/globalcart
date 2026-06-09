/**
 * OrderCard - Renders a single order card in the shipping pool detail modal
 * Includes order info, actions, and detail panel
 */
import { Edit2, Save, MoreVertical, Package, RotateCcw, MoveRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ImageWithViewer } from "@/components/common/ImageViewer";
import OrderDetailPanel from "./OrderDetailPanel";

export default function OrderCard({ 
  order, 
  pool, 
  isAdmin, 
  currentUser, 
  canEditPackage, 
  canRequestRewarehouse,
  allowUserRewarehouse,
  pendingEdits,
  editingOrderData,
  setEditingOrderData,
  savingOrder,
  handleAdminOrderSave,
  setShowOrderActions,
  showOrderActions,
  loadOtherPools,
  rewarehouseSelectedIds,
  setRewarehouseSelectedIds,
  openUserAction,
  userActionOrder,
  userActionMode,
  tenantUserMap,
  renderOrderActions,
}) {
  const isEditingThis = editingOrderData?.id === order.id;
  const canSeeDetail = isAdmin || order.user_email === currentUser?.email;
  const isMyOrder = order.user_email === currentUser?.email;
  const isRWSel = rewarehouseSelectedIds.includes(order.id);
  const hasPendingRW = pendingEdits.some(r => r.order_id === order.id && r.is_rewarehouse_request);
  const isRewarehousePool = canRequestRewarehouse && allowUserRewarehouse && (pool.status === "awaiting_payment" || pool.status === "awaiting_payment_confirmation");

  return (
    <div key={order.id} className={`rounded-lg border transition-colors ${isEditingThis ? "border-blue-200 bg-blue-50" : isRWSel ? "border-orange-300 bg-orange-50" : "border-transparent bg-gray-50"}`}>
      {isEditingThis ? (
        <div className="px-3 py-2.5 space-y-2">
          <div>
            <Label className="text-xs text-gray-500">管理员备注</Label>
            <Input className="h-7 text-xs mt-0.5" value={editingOrderData.admin_note || ""}
              onChange={(e) => setEditingOrderData((d) => ({ ...d, admin_note: e.target.value }))} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => setEditingOrderData(null)}>取消</Button>
            <Button size="sm" className="h-6 text-xs px-2 bg-blue-600 hover:bg-blue-700" onClick={handleAdminOrderSave} disabled={savingOrder}>
              <Save className="w-3 h-3 mr-1" />{savingOrder ? "保存中..." : "保存"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2 px-3 py-2">
          <div className="flex items-start gap-3">
            <div className="flex gap-2 flex-shrink-0">
              {canSeeDetail && order.product_image_url && (
                <ImageWithViewer src={order.product_image_url} alt="产品图片">
                  <img src={order.product_image_url} alt="" className="w-12 h-12 rounded object-cover border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity" />
                </ImageWithViewer>
              )}
              {canSeeDetail && order.arrival_photo_url && (
                <ImageWithViewer src={order.arrival_photo_url} alt="入库图片">
                  <img src={order.arrival_photo_url} alt="" className="w-12 h-12 rounded object-cover border border-blue-200 cursor-pointer hover:opacity-80 transition-opacity" title="入库图片" />
                </ImageWithViewer>
              )}
              {!canSeeDetail && (
                <div className="w-12 h-12 rounded bg-gray-100 border border-gray-200 flex items-center justify-center flex-shrink-0">
                  <Package className="w-5 h-5 text-gray-300" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-800 truncate">
                {canSeeDetail ? order.product_name : "他人包裹"}
              </p>
              <p className="text-xs text-gray-400">
                {canSeeDetail ? order.order_number : "—"} · {order.weight_g || 0}g
                {isAdmin && order.user_email ? ` · ${tenantUserMap[order.user_email]?.display_name || tenantUserMap[order.user_email]?.full_name || order.user_name || ""}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {/* Admin can edit any order */}
              {canEditPackage && pool.status !== "shipped" && pool.status !== "delivered" && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditingOrderData({ ...order })}
                    className="flex-shrink-0 p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
                    title="编辑包裹信息">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {setShowOrderActions(showOrderActions === order.id ? null : order.id);if (showOrderActions !== order.id) loadOtherPools(order);}}
                    className="flex-shrink-0 p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
                    title="更多操作">
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              {isRewarehousePool && isMyOrder && !hasPendingRW && (
                <Checkbox checked={isRWSel} onCheckedChange={v => setRewarehouseSelectedIds(prev => v ? [...prev, order.id] : prev.filter(id => id !== order.id))} className="flex-shrink-0" />
              )}
              {isRewarehousePool && isMyOrder && hasPendingRW && (
                <span className="text-xs text-orange-500 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded">审批中</span>
              )}
              {/* User can edit/move their own orders */}
              {!isAdmin && order.user_email === currentUser?.email && pool.status !== "shipped" && pool.status !== "delivered" && pool.status !== "awaiting_payment" && pool.status !== "awaiting_payment_confirmation" && pool.status !== "ready_to_ship" && (
                <button
                  onClick={() => openUserAction(order, userActionOrder?.id === order.id && userActionMode ? null : 'menu')}
                  className="flex-shrink-0 p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
                  title="移动/取消出货">
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
          
          {/* Render order actions panel if active */}
          {renderOrderActions && renderOrderActions(order)}
        </div>
      )}
      
      {/* Order detail panel - shows destination, transit method, addons, notes */}
      <OrderDetailPanel order={order} pool={pool} />
    </div>
  );
}