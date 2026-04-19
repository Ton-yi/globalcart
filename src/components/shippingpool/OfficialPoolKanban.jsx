/**
 * OfficialPoolKanban
 * Kanban board showing admin-created consolidation pools.
 * Each column = one pool. Each card = one order in that pool.
 * Admin can drag orders between columns (pools).
 * Regular users can only drag their own orders.
 * First column = "待拼邮订单" task column (not a pool, just a staging area).
 */
import { useState, useRef } from "react";
import { Package, GripVertical, Users, Loader2, Scale, ChevronRight, Edit2, Save, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { shippingPoolApi, updateOrder } from "@/lib/tenantApi";

const STATUS_CONFIG = {
  pending: { label: "待处理", color: "bg-amber-100 text-amber-700" },
  awaiting_payment: { label: "待付款", color: "bg-orange-100 text-orange-700" },
  awaiting_payment_confirmation: { label: "待确认付款", color: "bg-blue-100 text-blue-700" },
  ready_to_ship: { label: "待发货", color: "bg-lime-100 text-lime-700" },
  shipped: { label: "已发货", color: "bg-green-100 text-green-700" },
  delivered: { label: "已签收", color: "bg-emerald-100 text-emerald-700" },
  cancelled: { label: "已取消", color: "bg-red-100 text-red-600" }
};

export default function OfficialPoolKanban({ pools, allOrders, currentUser, isAdmin, onPoolClick, onRefresh }) {
  const [draggingOrderId, setDraggingOrderId] = useState(null);
  const [draggingFromPoolId, setDraggingFromPoolId] = useState(null);
  const [dragOverPoolId, setDragOverPoolId] = useState(null);
  const [moving, setMoving] = useState(false);
  const dragCounter = useRef({});
  const [editingTaskColumn, setEditingTaskColumn] = useState(false);
  const [taskColumnName, setTaskColumnName] = useState("待拼邮订单");
  const [savingTaskColumn, setSavingTaskColumn] = useState(false);

  // Build a map: orderId -> order data
  const orderMap = {};
  (allOrders || []).forEach((o) => {orderMap[o.id] = o;});

  // Find orders that are not in any pool (consolidation_pool_id is empty or not in pools)
  const poolOrderIds = new Set(pools.flatMap((p) => p.order_ids || []));
  const pendingOrders = (allOrders || []).filter((o) =>
  !poolOrderIds.has(o.id) &&
  o.consolidation_requested !== false && (
  o.order_status === "in_warehouse" || o.order_status === "ready_to_ship")
  );

  const handleDragStart = (e, orderId, poolId) => {
    setDraggingOrderId(orderId);
    setDraggingFromPoolId(poolId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggingOrderId(null);
    setDraggingFromPoolId(null);
    setDragOverPoolId(null);
    dragCounter.current = {};
  };

  const handleDragEnter = (e, poolId) => {
    e.preventDefault();
    dragCounter.current[poolId] = (dragCounter.current[poolId] || 0) + 1;
    setDragOverPoolId(poolId);
  };

  const handleDragLeave = (e, poolId) => {
    dragCounter.current[poolId] = (dragCounter.current[poolId] || 0) - 1;
    if (dragCounter.current[poolId] <= 0) {
      dragCounter.current[poolId] = 0;
      if (dragOverPoolId === poolId) setDragOverPoolId(null);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e, targetPoolId) => {
    e.preventDefault();
    setDragOverPoolId(null);
    dragCounter.current = {};

    // Special case: dropping to task column (pending) - just clear consolidation_pool_id
    if (targetPoolId === "pending") {
      if (!draggingOrderId) {
        setDraggingOrderId(null);
        setDraggingFromPoolId(null);
        return;
      }
      const order = orderMap[draggingOrderId];
      if (!order) return;
      if (!isAdmin && order.user_email !== currentUser?.email) return;

      setMoving(true);
      let updates = [];

      // If dragging from a pool, update the pool
      if (draggingFromPoolId && draggingFromPoolId !== "pending") {
        const fromPool = pools.find((p) => p.id === draggingFromPoolId);
        if (fromPool) {
          const orderWeight = order.weight_g || 0;
          const newFromIds = (fromPool.order_ids || []).filter((id) => id !== draggingOrderId);
          updates.push(
            shippingPoolApi.update(draggingFromPoolId, {
              order_ids: newFromIds,
              total_weight_g: Math.max(0, (fromPool.total_weight_g || 0) - orderWeight)
            })
          );
        }
      }

      updates.push(updateOrder(draggingOrderId, { consolidation_pool_id: "" }));
      await Promise.all(updates);
      setMoving(false);
      setDraggingOrderId(null);
      setDraggingFromPoolId(null);
      onRefresh?.();
      return;
    }

    // Normal case: dropping to a pool
    if (!draggingOrderId || !draggingFromPoolId || targetPoolId === draggingFromPoolId) {
      setDraggingOrderId(null);
      setDraggingFromPoolId(null);
      return;
    }

    const order = orderMap[draggingOrderId];
    if (!order) return;

    // Permission: regular users can only drag their own orders
    if (!isAdmin && order.user_email !== currentUser?.email) return;

    setMoving(true);

    const fromPool = pools.find((p) => p.id === draggingFromPoolId);
    const toPool = pools.find((p) => p.id === targetPoolId);
    if (!fromPool || !toPool) {setMoving(false);return;}

    const orderWeight = order.weight_g || 0;
    const newFromIds = (fromPool.order_ids || []).filter((id) => id !== draggingOrderId);
    const newToIds = [...new Set([...(toPool.order_ids || []), draggingOrderId])];

    await Promise.all([
    shippingPoolApi.update(draggingFromPoolId, {
      order_ids: newFromIds,
      total_weight_g: Math.max(0, (fromPool.total_weight_g || 0) - orderWeight)
    }),
    shippingPoolApi.update(targetPoolId, {
      order_ids: newToIds,
      total_weight_g: (toPool.total_weight_g || 0) + orderWeight
    }),
    updateOrder(draggingOrderId, { consolidation_pool_id: targetPoolId })]
    );

    setMoving(false);
    setDraggingOrderId(null);
    setDraggingFromPoolId(null);
    onRefresh?.();
  };

  const handleSaveTaskColumnName = async () => {
    if (!taskColumnName.trim()) return;
    setSavingTaskColumn(true);
    // In future, could save to SiteSettings for persistence
    setSavingTaskColumn(false);
    setEditingTaskColumn(false);
  };

  const totalWeight = pendingOrders.reduce((s, o) => s + (o.weight_g || 0), 0);
  const userGroups = {};
  pendingOrders.forEach((o) => {
    const email = o.user_email || "unknown";
    if (!userGroups[email]) userGroups[email] = [];
    userGroups[email].push(o);
  });

  return (
    <div className="relative">
      {moving &&
      <div className="absolute inset-0 bg-white/60 z-10 flex items-center justify-center rounded-xl">
          <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
        </div>
      }
      <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: 400 }}>
        {/* Task Column - Pending Orders */}
        <div
          key="pending" className="bg-gray-50 px-5 opacity-90 rounded-none flex-shrink-0 w-72 flex flex-col border-2 transition-all border-gray-200"

          onDragEnter={(e) => handleDragEnter(e, "pending")}
          onDragLeave={(e) => handleDragLeave(e, "pending")}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, "pending")}>
          
          {/* Column header - clickable to edit */}
          <div
            className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-blue-100 rounded-t-xl cursor-pointer hover:from-blue-100 hover:to-blue-200 transition-colors"
            onClick={() => isAdmin && setEditingTaskColumn(true)}>
            
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {editingTaskColumn && isAdmin ?
                <div className="flex items-center gap-1 flex-1" onClick={(e) => e.stopPropagation()}>
                    <Input
                    className="h-7 text-xs flex-1"
                    value={taskColumnName}
                    onChange={(e) => setTaskColumnName(e.target.value)}
                    autoFocus />
                  
                    <button
                    onClick={handleSaveTaskColumnName}
                    className="p-1 rounded hover:bg-blue-200 text-blue-600"
                    disabled={savingTaskColumn}>
                    
                      <Save className="w-3.5 h-3.5" />
                    </button>
                    <button
                    onClick={() => {setEditingTaskColumn(false);setTaskColumnName("待拼邮订单");}}
                    className="p-1 rounded hover:bg-blue-200 text-blue-600">
                    
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div> :

                <>
                    <span className="font-semibold text-gray-800 text-sm truncate">
                      {taskColumnName}
                    </span>
                    {isAdmin && <Edit2 className="w-3 h-3 text-gray-400 flex-shrink-0" />}
                  </>
                }
              </div>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
              <span className="flex items-center gap-1"><Package className="w-3 h-3" />{pendingOrders.length}件</span>
              <span className="flex items-center gap-1"><Scale className="w-3 h-3" />{totalWeight}g</span>
              <span className="flex items-center gap-1"><Users className="w-3 h-3" />{Object.keys(userGroups).length}人</span>
            </div>
          </div>

          {/* Order cards */}
          <div className="flex-1 p-2 space-y-2 overflow-y-auto" style={{ maxHeight: 520 }}>
            {pendingOrders.length === 0 ?
            <div className={`flex items-center justify-center h-20 rounded-lg border-2 border-dashed text-xs text-gray-400 ${dragOverPoolId === "pending" ? "border-blue-300 text-blue-400" : "border-gray-200"}`}>
                {dragOverPoolId === "pending" ? "松开以移入" : "暂无待拼邮订单"}
              </div> :

            pendingOrders.map((order) => {
              const canDrag = isAdmin || order.user_email === currentUser?.email;
              const isDragging = draggingOrderId === order.id;
              return (
                <div
                  key={order.id}
                  draggable={canDrag}
                  onDragStart={(e) => canDrag && handleDragStart(e, order.id, "pending")}
                  onDragEnd={handleDragEnd}
                  className={`bg-white border rounded-lg px-3 py-2.5 transition-all select-none ${
                  isDragging ? "opacity-40 border-blue-300" : "border-gray-200 hover:border-gray-300 hover:shadow-sm"} ${
                  canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-default"}`}>
                  
                    <div className="flex items-start gap-2">
                      {canDrag && <GripVertical className="w-3.5 h-3.5 text-gray-300 flex-shrink-0 mt-0.5" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">{order.product_name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{order.order_number || order.id.slice(-6)} · {order.weight_g || 0}g</p>
                        {order.user_name &&
                      <p className="text-xs text-gray-400 mt-0.5 truncate">👤 {order.user_name}</p>
                      }
                      </div>
                    </div>
                  </div>);

            })
            }
            {dragOverPoolId === "pending" && pendingOrders.length > 0 &&
            <div className="flex items-center justify-center h-10 rounded-lg border-2 border-dashed border-blue-300 text-xs text-blue-400">
                松开以移入此列
              </div>
            }
          </div>

          {/* Column footer */}
          <div className="px-4 py-2 border-t border-gray-200 bg-white rounded-b-xl text-xs text-gray-400 flex justify-between">
            <span>{pendingOrders.length} 件包裹</span>
            <span>{totalWeight}g</span>
          </div>
        </div>

        {/* Pool columns */}
        {pools.map((pool) => {
          const poolOrders = (pool.order_ids || []).
          map((id) => orderMap[id]).
          filter(Boolean);
          const status = STATUS_CONFIG[pool.status] || STATUS_CONFIG.pending;
          const isDragTarget = dragOverPoolId === pool.id && draggingFromPoolId !== pool.id && draggingFromPoolId !== "pending";
          const poolTotalWeight = poolOrders.reduce((s, o) => s + (o.weight_g || 0), 0);
          // Group orders by user for display
          const poolUserGroups = {};
          poolOrders.forEach((o) => {
            const email = o.user_email || "unknown";
            if (!poolUserGroups[email]) poolUserGroups[email] = [];
            poolUserGroups[email].push(o);
          });

          return (
            <div
              key={pool.id}
              className={`flex-shrink-0 w-72 flex flex-col rounded-xl border-2 transition-all ${isDragTarget ? "border-blue-400 bg-blue-50/50 shadow-lg" : "border-gray-200 bg-gray-50"}`}
              onDragEnter={(e) => handleDragEnter(e, pool.id)}
              onDragLeave={(e) => handleDragLeave(e, pool.id)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, pool.id)}>
              
              {/* Column header - clickable */}
              <div
                className="px-4 py-3 border-b border-gray-200 bg-white rounded-t-xl cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => onPoolClick?.(pool)}>
                
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-semibold text-gray-800 text-sm truncate">
                      {pool.title || pool.pool_code || `拼邮 #${pool.id.slice(-4).toUpperCase()}`}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  </div>
                  <Badge className={`text-xs flex-shrink-0 ${status.color}`}>{status.label}</Badge>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  <span className="font-mono text-purple-600">{pool.pool_code}</span>
                  <span className="flex items-center gap-1"><Scale className="w-3 h-3" />{poolTotalWeight}g</span>
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" />{Object.keys(poolUserGroups).length}人</span>
                </div>
                {pool.transit_location_name &&
                <p className="text-xs text-blue-600 mt-0.5">→ {pool.transit_location_name}</p>
                }
              </div>

              {/* Order cards */}
              <div className="flex-1 p-2 space-y-2 overflow-y-auto" style={{ maxHeight: 520 }}>
                {poolOrders.length === 0 ?
                <div className={`flex items-center justify-center h-20 rounded-lg border-2 border-dashed text-xs text-gray-400 ${isDragTarget ? "border-blue-300 text-blue-400" : "border-gray-200"}`}>
                    {isDragTarget ? "松开以移入" : "暂无包裹"}
                  </div> :

                poolOrders.map((order) => {
                  const canDrag = isAdmin || order.user_email === currentUser?.email;
                  const isDragging = draggingOrderId === order.id;
                  return (
                    <div
                      key={order.id}
                      draggable={canDrag}
                      onDragStart={(e) => canDrag && handleDragStart(e, order.id, pool.id)}
                      onDragEnd={handleDragEnd}
                      className={`bg-white border rounded-lg px-3 py-2.5 transition-all select-none ${
                      isDragging ? "opacity-40 border-blue-300" : "border-gray-200 hover:border-gray-300 hover:shadow-sm"} ${
                      canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-default"}`}>
                      
                        <div className="flex items-start gap-2">
                          {canDrag && <GripVertical className="w-3.5 h-3.5 text-gray-300 flex-shrink-0 mt-0.5" />}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-800 truncate">{order.product_name}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{order.order_number || order.id.slice(-6)} · {order.weight_g || 0}g</p>
                            {order.user_name &&
                          <p className="text-xs text-gray-400 mt-0.5 truncate">👤 {order.user_name}</p>
                          }
                          </div>
                        </div>
                      </div>);

                })
                }
                {isDragTarget && poolOrders.length > 0 &&
                <div className="flex items-center justify-center h-10 rounded-lg border-2 border-dashed border-blue-300 text-xs text-blue-400">
                    松开以移入此列
                  </div>
                }
              </div>

              {/* Column footer */}
              <div className="px-4 py-2 border-t border-gray-200 bg-white rounded-b-xl text-xs text-gray-400 flex justify-between">
                <span>{poolOrders.length} 件包裹</span>
                <span>{poolTotalWeight}g</span>
              </div>
            </div>);

        })}
      </div>
    </div>);

}