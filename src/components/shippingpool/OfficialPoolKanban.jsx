/**
 * OfficialPoolKanban
 * Admin-created official consolidation pools displayed as kanban columns.
 * Supports drag-and-drop of order tasks between columns (including the staging column).
 * Multi-entry user groups are draggable as a whole.
 * Individual entries within groups are also draggable.
 * Shift+click enables multi-select; selected items can be dragged together.
 */
import { useState, useEffect, useCallback } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { base44 } from "@/api/base44Client";
import { shippingPoolApi, tenantEntity, fetchTenantConfig } from "@/lib/tenantApi";
import { EMPTY_ADDRESS_FORM } from "@/components/common/AddressForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users, Package, Scale, Plus, ChevronDown, ChevronRight,
  Settings2, Edit2, MapPin, Layers, Calendar, ArrowUpDown,
  Inbox, GripVertical, Clock, Warehouse, ArrowRight, X, CheckCircle2, Loader2, CheckSquare
} from "lucide-react";
import JoinOfficialPoolModal from "@/components/shippingpool/JoinOfficialPoolModal";
import OrderDetailDrawer from "@/components/orders/OrderDetailDrawer";
import OfficialPoolUserGroupModal from "@/components/shippingpool/OfficialPoolUserGroupModal";
import OfficialPoolOrderDetailModal from "@/components/shippingpool/OfficialPoolOrderDetailModal";
import CreateOfficialPoolModal from "@/components/shippingpool/CreateOfficialPoolModal";

const STATUS_COLORS = {
  pending: "bg-gray-100 text-gray-600",
  awaiting_payment: "bg-orange-100 text-orange-700",
  awaiting_payment_confirmation: "bg-blue-100 text-blue-700",
  ready_to_ship: "bg-teal-100 text-teal-700",
  shipped: "bg-green-100 text-green-700",
  delivered: "bg-emerald-100 text-emerald-700",
};

const STATUS_LABELS = {
  pending: "待处理",
  awaiting_payment: "待付款",
  awaiting_payment_confirmation: "待确认",
  ready_to_ship: "待发货",
  shipped: "已发货",
  delivered: "已签收",
};

const ORDER_STATUS_LABELS = {
  pending_confirmation: "待确认", payment_pending: "待付款", paid: "已付款",
  pending_purchase: "待购买", purchased: "已购买", in_warehouse: "已入库",
  notified_shipment: "待发货",
};

// draggableId formats:
// pool entry (single):  "pool-{poolId}-order-{orderId}"
// pool group (multi):   "pool-{poolId}-group-{userEmail}"
// staging:              "staging-{orderId}"

// ─── Draggable Task Card ──────────────────────────────────────────────────────
function DraggableTaskCard({ draggableId, index, entry, order, group, pool, currentUser, isAdmin, shippingAddons, savedAddresses, onRefresh, selected, onSelect }) {
  const [editOpen, setEditOpen] = useState(false);
  const isSelf = group?.user_email === currentUser?.email;
  const canEdit = isSelf || isAdmin;

  const handleClick = (e) => {
    if (e.shiftKey) { e.preventDefault(); onSelect?.(draggableId); return; }
    canEdit && !editOpen && setEditOpen(true);
  };

  return (
    <>
      <Draggable draggableId={draggableId} index={index}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            className={`border rounded-xl px-3 py-2.5 bg-white transition-all relative
              ${snapshot.isDragging ? "shadow-lg border-blue-300 rotate-1" : ""}
              ${selected ? "border-blue-400 bg-blue-50 ring-2 ring-blue-300" : canEdit ? "border-gray-200 hover:border-blue-300 hover:bg-blue-50/40 hover:shadow-sm" : "border-gray-200"}
              ${canEdit ? "cursor-pointer" : ""}`}
            onClick={handleClick}
          >
            {selected && <CheckSquare className="absolute top-2 right-2 w-3.5 h-3.5 text-blue-500" />}
            <div className="flex items-start gap-2">
              <div
                {...provided.dragHandleProps}
                className="flex-shrink-0 mt-0.5 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500"
                onClick={e => e.stopPropagation()}
              >
                <GripVertical className="w-3.5 h-3.5" />
              </div>
              <Package className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-800 truncate">{order?.product_name || entry.order_id.slice(-8)}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {group && <span className="text-xs text-gray-400">{group.user_name || group.user_email}</span>}
                  {order?.weight_g > 0 && <span className="text-xs text-gray-400">{order.weight_g}g</span>}
                </div>
                {entry.note && <p className="text-xs text-gray-400 mt-0.5 truncate">{entry.note}</p>}
              </div>
              {canEdit && !selected && <Edit2 className="w-3 h-3 text-gray-300 hover:text-gray-500 flex-shrink-0 mt-0.5" />}
            </div>
          </div>
        )}
      </Draggable>
      {editOpen && group && pool && (
        <OfficialPoolOrderDetailModal
          pool={pool}
          group={group}
          orderEntry={entry}
          order={order}
          shippingAddons={shippingAddons}
          savedAddresses={savedAddresses}
          onClose={() => setEditOpen(false)}
          onSuccess={() => { setEditOpen(false); onRefresh?.(); }}
        />
      )}
    </>
  );
}

// ─── Draggable Staging Task Card ──────────────────────────────────────────────
function DraggableStagingCard({ draggableId, index, order, officialPools, isAdmin, currentUser, onRemove, selected, onSelect }) {
  const [detailOpen, setDetailOpen] = useState(false);
  const pre = order?.pre_shipment;
  const targetPoolId = pre?.target_pool_id;
  const targetPool = officialPools.find(p => p.id === targetPoolId);
  const targetLabel = targetPool ? (targetPool.title || targetPool.pool_code) : "待匹配";
  const isInWarehouse = order?.order_status === "in_warehouse";

  const handleClick = (e) => {
    if (e.shiftKey) { e.preventDefault(); onSelect?.(draggableId); return; }
    !detailOpen && setDetailOpen(true);
  };

  return (
    <>
      <Draggable draggableId={draggableId} index={index}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            className={`border rounded-xl px-3 py-2.5 bg-white transition-all relative
              ${snapshot.isDragging ? "shadow-lg border-blue-300 rotate-1" : ""}
              ${selected ? "border-blue-400 bg-blue-50 ring-2 ring-blue-300" : isInWarehouse ? "border-green-200 hover:border-green-300 hover:bg-green-50/40" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"}
              cursor-pointer`}
            onClick={handleClick}
          >
            {selected && <CheckSquare className="absolute top-2 right-8 w-3.5 h-3.5 text-blue-500" />}
            <div className="flex items-start gap-2">
              <div
                {...provided.dragHandleProps}
                className="flex-shrink-0 mt-0.5 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500"
                onClick={e => e.stopPropagation()}
              >
                <GripVertical className="w-3.5 h-3.5" />
              </div>
              <Package className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${isInWarehouse ? "text-green-400" : "text-gray-300"}`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-800 truncate">{order?.product_name || draggableId.slice(-8)}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {order?.order_number && <span className="text-xs text-gray-400">{order.order_number}</span>}
                  <Badge className={`text-xs px-1 py-0 ${isInWarehouse ? "bg-green-100 text-green-700" : "bg-amber-50 text-amber-600"}`}>
                    {ORDER_STATUS_LABELS[order?.order_status] || order?.order_status}
                  </Badge>
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <ArrowRight className="w-3 h-3 text-gray-300 flex-shrink-0" />
                  <span className="text-xs text-gray-400 truncate">→ {targetLabel}</span>
                </div>
              </div>
              {isAdmin && (
                <button
                  onClick={e => { e.stopPropagation(); onRemove?.(order); }}
                  className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors flex-shrink-0"
                  title="从暂存区移除"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}
      </Draggable>
      {detailOpen && order && currentUser && (
        <OrderDetailDrawer
          order={order}
          currentUser={currentUser}
          onClose={() => setDetailOpen(false)}
          onAction={() => {}}
          onUpdated={() => setDetailOpen(false)}
        />
      )}
    </>
  );
}

// ─── Draggable Group Card ─────────────────────────────────────────────────────
function DraggableGroupCard({ draggableId, index, group, allOrders, pool, currentUser, isAdmin, shippingAddons, savedAddresses, onRefresh, selected, onSelect, selectedIds, onSelectEntry }) {
  const [expanded, setExpanded] = useState(false);
  const [editGroupOpen, setEditGroupOpen] = useState(false);
  const [editOrderEntry, setEditOrderEntry] = useState(null);

  const orderEntries = group.order_entries || [];
  const isSelf = group.user_email === currentUser?.email;
  const canEdit = isSelf || isAdmin;
  const resolvedOrders = orderEntries.map(entry => ({
    entry,
    order: allOrders.find(o => o.id === entry.order_id) || null,
  }));
  const totalWeight = resolvedOrders.reduce((s, { order }) => s + (order?.weight_g || 0), 0);

  const handleHeaderClick = (e) => {
    if (e.shiftKey) { e.preventDefault(); onSelect?.(draggableId); return; }
    setExpanded(v => !v);
  };

  return (
    <>
      <Draggable draggableId={draggableId} index={index}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            className={`border rounded-xl overflow-hidden bg-white transition-colors
              ${snapshot.isDragging ? "shadow-lg opacity-90" : ""}
              ${selected ? "border-blue-400 ring-2 ring-blue-300" : "border-gray-200 hover:border-blue-200"}`}
          >
            <div
              className={`flex items-center justify-between px-3 py-2.5 border-b cursor-pointer transition-colors
                ${selected ? "bg-blue-100/70 border-blue-200" : "bg-blue-50/60 border-blue-100 hover:bg-blue-100/60"}`}
              onClick={handleHeaderClick}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div
                  {...provided.dragHandleProps}
                  className="flex-shrink-0 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500"
                  onClick={e => e.stopPropagation()}
                >
                  <GripVertical className="w-3.5 h-3.5" />
                </div>
                {expanded ? <ChevronDown className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />}
                <Users className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                <span className="text-sm font-medium text-gray-800 truncate">{group.group_label || group.user_name || group.user_email}</span>
                <Badge variant="outline" className="text-xs flex-shrink-0">{orderEntries.length}件</Badge>
                {selected && <CheckSquare className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="text-xs text-gray-400">{totalWeight}g</span>
                {canEdit && (
                  <button onClick={e => { e.stopPropagation(); setEditGroupOpen(true); }} className="p-1 rounded hover:bg-blue-100 text-gray-400 hover:text-blue-600 transition-colors">
                    <Edit2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
            {group.group_final_address?.recipient_name && (
              <div className="px-3 py-1.5 flex items-center gap-1.5 text-xs text-gray-400 border-b border-gray-100">
                <MapPin className="w-3 h-3" />
                <span className="truncate">{group.group_final_address.recipient_name}{group.group_final_address.state ? ` · ${group.group_final_address.state}` : ""}</span>
              </div>
            )}
            {expanded && (
              <div className="divide-y divide-gray-50">
                {resolvedOrders.map(({ entry, order }, entryIdx) => {
                  const entryDraggableId = `pool-${pool.id}-order-${entry.order_id}`;
                  const isEntrySelected = selectedIds?.has(entryDraggableId);
                  return (
                    <div
                      key={entry.order_id}
                      className={`flex items-start gap-2.5 px-3 py-2.5 cursor-pointer transition-colors
                        ${isEntrySelected ? "bg-blue-50" : "hover:bg-gray-50"}`}
                      onClick={(e) => {
                        if (e.shiftKey) { e.preventDefault(); onSelectEntry?.(entryDraggableId); return; }
                        canEdit && setEditOrderEntry({ entry, order });
                      }}
                    >
                      <Package className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-700 truncate">{order?.product_name || entry.order_id.slice(-8)}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {order?.order_number && <span className="text-xs text-gray-400">{order.order_number}</span>}
                          {order?.weight_g > 0 && <span className="text-xs text-gray-400">{order.weight_g}g</span>}
                          {!entry.use_group_address && <Badge className="text-xs bg-orange-100 text-orange-600 px-1 py-0">独立地址</Badge>}
                        </div>
                        {entry.note && <p className="text-xs text-gray-400 mt-0.5 truncate">{entry.note}</p>}
                      </div>
                      {isEntrySelected ? <CheckSquare className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" /> : canEdit && <Edit2 className="w-3 h-3 text-gray-300 hover:text-gray-500 flex-shrink-0 mt-0.5" />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </Draggable>
      {editGroupOpen && (
        <OfficialPoolUserGroupModal pool={pool} group={group} shippingAddons={shippingAddons} savedAddresses={savedAddresses}
          onClose={() => setEditGroupOpen(false)} onSuccess={() => { setEditGroupOpen(false); onRefresh?.(); }} />
      )}
      {editOrderEntry && (
        <OfficialPoolOrderDetailModal pool={pool} group={group} orderEntry={editOrderEntry.entry} order={editOrderEntry.order}
          shippingAddons={shippingAddons} savedAddresses={savedAddresses}
          onClose={() => setEditOrderEntry(null)} onSuccess={() => { setEditOrderEntry(null); onRefresh?.(); }} />
      )}
    </>
  );
}

// ─── Add-to-Staging Modal ─────────────────────────────────────────────────────
function AddToStagingModal({ allOrders, officialPools, currentUser, stagedOrderIds, onClose, onSuccess }) {
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  const [selectedPoolId, setSelectedPoolId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const eligibleOrders = allOrders.filter(o => {
    if (["shipped", "delivered", "cancelled"].includes(o.order_status)) return false;
    const alreadyInPool = officialPools.some(p => (p.order_ids || []).includes(o.id));
    if (alreadyInPool) return false;
    if (stagedOrderIds.has(o.id)) return false;
    return true;
  });

  const handleSubmit = async () => {
    if (selectedOrderIds.length === 0) return;
    setSubmitting(true);
    const targetPool = officialPools.find(p => p.id === selectedPoolId);
    await Promise.all(selectedOrderIds.map(orderId => {
      const order = allOrders.find(o => o.id === orderId);
      if (!order) return Promise.resolve();
      const newPre = {
        ...(order.pre_shipment || {}),
        consType: "official_pool",
        target_pool_id: selectedPoolId || "",
        target_pool_code: targetPool?.pool_code || "",
        target_pool_title: targetPool ? (targetPool.title || targetPool.pool_code) : "",
        pool_created: false,
        _manually_staged: true,
        _staged_by: currentUser?.email,
        _staged_at: new Date().toISOString(),
      };
      return base44.functions.invoke('updateTenantOrder', { order_id: orderId, pre_shipment: newPre });
    }));
    setSubmitting(false);
    onSuccess?.();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onMouseDown={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col" onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900 text-sm">添加任务到待发货暂存区</h2>
            <p className="text-xs text-gray-400 mt-0.5">选择要纳入官方拼邮计划的订单</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">预计加入的拼邮需求（可选）</p>
            <div className="space-y-1.5">
              <label className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${!selectedPoolId ? "border-blue-300 bg-blue-50" : "border-gray-200 hover:bg-gray-50"}`}>
                <input type="radio" checked={!selectedPoolId} onChange={() => setSelectedPoolId("")} className="accent-blue-600" />
                <span className="text-sm text-gray-600">未指定（入库后由系统自动匹配）</span>
              </label>
              {officialPools.map(pool => (
                <label key={pool.id} className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${selectedPoolId === pool.id ? "border-blue-300 bg-blue-50" : "border-gray-200 hover:bg-gray-50"}`}>
                  <input type="radio" checked={selectedPoolId === pool.id} onChange={() => setSelectedPoolId(pool.id)} className="accent-blue-600" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{pool.title || pool.pool_code}</p>
                    <p className="text-xs text-gray-400">{pool.pool_code} · {pool.order_ids?.length || 0}单 已参团</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">选择订单（{eligibleOrders.length} 个可选）</p>
            {eligibleOrders.length === 0 ? (
              <div className="text-center py-8 text-gray-300 text-xs">
                <Package className="w-6 h-6 mx-auto mb-1 opacity-40" />暂无可添加的订单
              </div>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {eligibleOrders.map(o => (
                  <label key={o.id} className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${selectedOrderIds.includes(o.id) ? "border-blue-300 bg-blue-50" : "border-gray-200 hover:bg-gray-50"}`}>
                    <input type="checkbox" checked={selectedOrderIds.includes(o.id)}
                      onChange={() => setSelectedOrderIds(prev => prev.includes(o.id) ? prev.filter(x => x !== o.id) : [...prev, o.id])}
                      className="accent-blue-600" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">{o.product_name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {o.order_number && <span className="text-xs text-gray-400">{o.order_number}</span>}
                        <Badge className={`text-xs px-1 py-0 ${o.order_status === "in_warehouse" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          {ORDER_STATUS_LABELS[o.order_status] || o.order_status}
                        </Badge>
                        {o.weight_g > 0 && <span className="text-xs text-gray-400">{o.weight_g}g</span>}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="px-5 py-3.5 border-t border-gray-100 flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700"
            disabled={submitting || selectedOrderIds.length === 0} onClick={handleSubmit}>
            {submitting ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />处理中...</> : `添加 ${selectedOrderIds.length} 个任务`}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Pool Column (Droppable) ──────────────────────────────────────────────────
function PoolColumn({ pool, allOrders, currentUser, isAdmin, shippingAddons, savedAddresses, onPoolClick, onRefresh, columnDragHandleProps, selectedIds, onSelectItem }) {
  const [joinOpen, setJoinOpen] = useState(false);

  const perUserGroups = pool.per_user_groups || [];
  const totalWeight = pool.total_weight_g || 0;
  const minWeight = pool.consolidation_min_weight_g || 0;
  const progressPct = minWeight > 0 ? Math.min(100, (totalWeight / minWeight) * 100) : 0;
  const isReady = minWeight > 0 && totalWeight >= minWeight;

  const myGroup = perUserGroups.find(g => g.user_email === currentUser?.email);
  const myOrderIds = new Set((myGroup?.order_entries || []).map(e => e.order_id));
  const hasInWarehouse = allOrders.some(o => o.order_status === "in_warehouse" && !myOrderIds.has(o.id));

  // Build draggable items list (groups with 1+ entries are all draggable; groups with 2+ also expose individual entries when expanded)
  const draggableItems = [];
  perUserGroups.forEach(group => {
    const entries = group.order_entries || [];
    if (entries.length >= 2) {
      draggableItems.push({ type: "group", group });
    } else if (entries.length === 1) {
      draggableItems.push({ type: "entry", group, entry: entries[0] });
    }
  });

  return (
    <div className="flex-shrink-0 w-72 flex flex-col">
      <div
        className="flex items-center justify-between px-3 py-3 bg-white border border-gray-200 rounded-xl cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-colors mb-2"
        onClick={() => onPoolClick?.(pool)}
        {...(columnDragHandleProps || {})}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-800 truncate">{pool.title || pool.pool_code}</span>
            {pool.pool_code && pool.title && <span className="text-xs font-mono text-gray-400">{pool.pool_code}</span>}
            <Badge className={`text-xs ${STATUS_COLORS[pool.status] || "bg-gray-100 text-gray-600"}`}>
              {STATUS_LABELS[pool.status] || pool.status}
            </Badge>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
            <span className="flex items-center gap-1"><Users className="w-3 h-3" />{perUserGroups.length}人</span>
            <span className="flex items-center gap-1"><Scale className="w-3 h-3" />{totalWeight}g</span>
            {pool.consolidation_deadline && (
              <span className="flex items-center gap-1 text-orange-500"><Calendar className="w-3 h-3" />截止 {pool.consolidation_deadline}</span>
            )}
          </div>
        </div>
      </div>

      {minWeight > 0 && (
        <div className="px-1 mb-2">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-400">凑单进度</span>
            <span className={isReady ? "text-green-600 font-medium" : "text-gray-500"}>{totalWeight}g / {minWeight}g</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${isReady ? "bg-green-500" : "bg-blue-400"}`} style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      )}

      <Droppable droppableId={`pool-${pool.id}`}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 space-y-2 min-h-[60px] rounded-xl transition-colors p-1 ${snapshot.isDraggingOver ? "bg-blue-50 ring-2 ring-blue-200" : ""}`}
          >
            {draggableItems.map(({ type, group, entry }, idx) => {
              if (type === "group") {
                const groupDraggableId = `pool-${pool.id}-group-${group.user_email}`;
                return (
                  <DraggableGroupCard
                    key={group.user_email}
                    draggableId={groupDraggableId}
                    index={idx}
                    group={group}
                    allOrders={allOrders}
                    pool={pool}
                    currentUser={currentUser}
                    isAdmin={isAdmin}
                    shippingAddons={shippingAddons}
                    savedAddresses={savedAddresses}
                    onRefresh={onRefresh}
                    selected={selectedIds?.has(groupDraggableId)}
                    onSelect={onSelectItem}
                    selectedIds={selectedIds}
                    onSelectEntry={onSelectItem}
                  />
                );
              } else {
                const entryDraggableId = `pool-${pool.id}-order-${entry.order_id}`;
                const order = allOrders.find(o => o.id === entry.order_id) || null;
                return (
                  <DraggableTaskCard
                    key={entry.order_id}
                    draggableId={entryDraggableId}
                    index={idx}
                    entry={entry}
                    order={order}
                    group={group}
                    pool={pool}
                    currentUser={currentUser}
                    isAdmin={isAdmin}
                    shippingAddons={shippingAddons}
                    savedAddresses={savedAddresses}
                    onRefresh={onRefresh}
                    selected={selectedIds?.has(entryDraggableId)}
                    onSelect={onSelectItem}
                  />
                );
              }
            })}

            {perUserGroups.length === 0 && !snapshot.isDraggingOver && (
              <div className="text-center py-6 text-gray-300 text-xs">
                <Layers className="w-6 h-6 mx-auto mb-1 opacity-30" />暂无参与者
              </div>
            )}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      {hasInWarehouse && (
        <button
          onClick={() => setJoinOpen(true)}
          className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border-2 border-dashed border-gray-200 text-xs text-gray-400 hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />加入此拼邮
        </button>
      )}

      {joinOpen && (
        <JoinOfficialPoolModal
          pool={pool}
          currentUser={currentUser}
          onClose={() => setJoinOpen(false)}
          onSuccess={() => { setJoinOpen(false); onRefresh?.(); }}
        />
      )}
    </div>
  );
}

// ─── Staging Column (Droppable) ───────────────────────────────────────────────
function StagingColumn({ allOrders, officialPools, currentUser, isAdmin, onRefresh, selectedIds, onSelectItem }) {
  const [addModalOpen, setAddModalOpen] = useState(false);

  const allOfficialPoolOrderIds = new Set(officialPools.flatMap(p => p.order_ids || []));
  const stagedOrders = allOrders.filter(o => {
    if (allOfficialPoolOrderIds.has(o.id)) return false;
    const pre = o.pre_shipment;
    if (!pre || pre.consType !== "official_pool" || pre.pool_created === true) return false;
    return true;
  });

  const inWarehouseOrders = stagedOrders.filter(o => o.order_status === "in_warehouse");
  const pendingOrders = stagedOrders.filter(o => o.order_status !== "in_warehouse");
  const stagedOrderIds = new Set(stagedOrders.map(o => o.id));

  const handleRemove = async (order) => {
    const pre = order.pre_shipment || {};
    await base44.functions.invoke('updateTenantOrder', {
      order_id: order.id,
      pre_shipment: { ...pre, consType: "", target_pool_id: "", target_pool_code: "" },
    });
    onRefresh?.();
  };

  return (
    <div className="flex-shrink-0 w-72 flex flex-col">
      <div className="flex items-center justify-between px-3 py-3 bg-white border border-dashed border-gray-300 rounded-xl mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Inbox className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="text-sm font-semibold text-gray-700">待发货暂存区</span>
            <Badge className="text-xs bg-gray-100 text-gray-500">{stagedOrders.length}</Badge>
          </div>
          <p className="text-xs text-gray-400 mt-0.5 ml-6">预计加入官方拼邮的订单</p>
        </div>
        {isAdmin && (
          <button onClick={() => setAddModalOpen(true)} className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors flex-shrink-0" title="手动添加任务">
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <Droppable droppableId="staging">
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 min-h-[60px] rounded-xl transition-colors p-1 ${snapshot.isDraggingOver ? "bg-blue-50 ring-2 ring-blue-200" : ""}`}
          >
            <div className="space-y-2">
              {inWarehouseOrders.length > 0 && (
                <div className="flex items-center gap-1.5 px-2 py-1">
                  <Warehouse className="w-3 h-3 text-green-500" />
                  <span className="text-xs font-medium text-green-700">已入库</span>
                  <Badge className="text-xs bg-green-100 text-green-700 ml-auto">{inWarehouseOrders.length}</Badge>
                </div>
              )}
              {inWarehouseOrders.map((order, idx) => (
                <DraggableStagingCard
                  key={order.id}
                  draggableId={`staging-${order.id}`}
                  index={idx}
                  order={order}
                  officialPools={officialPools}
                  isAdmin={isAdmin}
                  currentUser={currentUser}
                  onRemove={handleRemove}
                  selected={selectedIds?.has(`staging-${order.id}`)}
                  onSelect={onSelectItem}
                />
              ))}

              {pendingOrders.length > 0 && (
                <div className="flex items-center gap-1.5 px-2 py-1 mt-1">
                  <Clock className="w-3 h-3 text-gray-400" />
                  <span className="text-xs font-medium text-gray-500">未入库</span>
                  <Badge className="text-xs bg-gray-100 text-gray-500 ml-auto">{pendingOrders.length}</Badge>
                </div>
              )}
              {pendingOrders.map((order, idx) => (
                <DraggableStagingCard
                  key={order.id}
                  draggableId={`staging-${order.id}`}
                  index={inWarehouseOrders.length + idx}
                  order={order}
                  officialPools={officialPools}
                  isAdmin={isAdmin}
                  currentUser={currentUser}
                  onRemove={handleRemove}
                  selected={selectedIds?.has(`staging-${order.id}`)}
                  onSelect={onSelectItem}
                />
              ))}

              {stagedOrders.length === 0 && !snapshot.isDraggingOver && (
                <div className="text-center py-6 text-gray-300 text-xs">
                  <Inbox className="w-6 h-6 mx-auto mb-1 opacity-30" />暂无待发货任务
                </div>
              )}
              {provided.placeholder}
            </div>
          </div>
        )}
      </Droppable>

      <button
        onClick={() => setAddModalOpen(true)}
        className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border-2 border-dashed border-gray-200 text-xs text-gray-400 hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />添加待发货任务
      </button>

      {addModalOpen && (
        <AddToStagingModal
          allOrders={allOrders}
          officialPools={officialPools}
          currentUser={currentUser}
          stagedOrderIds={stagedOrderIds}
          onClose={() => setAddModalOpen(false)}
          onSuccess={() => { setAddModalOpen(false); onRefresh?.(); }}
        />
      )}
    </div>
  );
}

// ─── Main Kanban ──────────────────────────────────────────────────────────────
export default function OfficialPoolKanban({ pools, allOrders, currentUser, isAdmin, showPoolSorter, setShowPoolSorter, onPoolClick, onRefresh }) {
  const [shippingAddons, setShippingAddons] = useState([]);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [createPoolOpen, setCreatePoolOpen] = useState(false);
  const [columnOrder, setColumnOrder] = useState(() => pools.map(p => p.id));
  // Multi-select: Set of draggableIds
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Keep columnOrder in sync when pools change from outside
  useEffect(() => {
    setColumnOrder(prev => {
      const poolIds = pools.map(p => p.id);
      const next = prev.filter(id => poolIds.includes(id));
      poolIds.forEach(id => { if (!next.includes(id)) next.push(id); });
      return next;
    });
  }, [pools.map(p => p.id).join(",")]);

  useEffect(() => {
    if (!currentUser) return;
    Promise.all([
      fetchTenantConfig(),
      tenantEntity.list('UserPreference', { user_email: currentUser.email }).catch(() => []),
    ]).then(([cfg, prefs]) => {
      setShippingAddons((cfg.addons || []).filter(a => a.addon_type === "shipping" && a.is_active !== false));
      const addrs = (prefs[0]?.saved_addresses || []).map(a => ({ ...EMPTY_ADDRESS_FORM, ...a }));
      setSavedAddresses(addrs);
    }).catch(() => {});
  }, [currentUser?.email]);

  // Clear selection on click outside (non-shift)
  useEffect(() => {
    const handler = (e) => { if (!e.shiftKey) setSelectedIds(new Set()); };
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, []);

  const handleSelectItem = useCallback((draggableId) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(draggableId)) next.delete(draggableId);
      else next.add(draggableId);
      return next;
    });
  }, []);

  const orderedPools = columnOrder.map(id => pools.find(p => p.id === id)).filter(Boolean);

  // Parse a draggableId into { type, orderId, srcPoolId, userEmail }
  const parseDraggableId = (draggableId) => {
    if (draggableId.startsWith("staging-")) {
      return { type: "staging", orderId: draggableId.slice("staging-".length) };
    }
    const orderMatch = draggableId.match(/^pool-(.+)-order-(.+)$/);
    if (orderMatch) return { type: "pool-order", srcPoolId: orderMatch[1], orderId: orderMatch[2] };
    const groupMatch = draggableId.match(/^pool-(.+)-group-(.+)$/);
    if (groupMatch) return { type: "pool-group", srcPoolId: groupMatch[1], userEmail: groupMatch[2] };
    return null;
  };

  // Move a single order entry from srcPool to destPool
  const moveOrderToPool = async (orderId, srcPool, destPool) => {
    const order = allOrders.find(o => o.id === orderId);
    if (!order) return;

    let entryToMove = null;
    const newSrcGroups = srcPool ? (srcPool.per_user_groups || []).map(g => {
      const entry = (g.order_entries || []).find(e => e.order_id === orderId);
      if (entry) entryToMove = entry;
      return { ...g, order_entries: (g.order_entries || []).filter(e => e.order_id !== orderId) };
    }).filter(g => (g.order_entries || []).length > 0) : null;

    if (srcPool) {
      await shippingPoolApi.update(srcPool.id, {
        order_ids: (srcPool.order_ids || []).filter(id => id !== orderId),
        total_weight_g: Math.max(0, (srcPool.total_weight_g || 0) - (order.weight_g || 0)),
        per_user_groups: newSrcGroups,
      });
    }

    if (destPool) {
      const newEntry = entryToMove || {
        order_id: orderId, note: order.pre_shipment?.user_note || "", image_urls: [],
        selected_addon_ids: order.pre_shipment?.selected_addon_ids || [],
        selected_addons: order.pre_shipment?.selected_addons || [],
        use_group_address: true, override_final_address: null,
      };
      const existingGroups = destPool.per_user_groups || [];
      const existingIdx = existingGroups.findIndex(g => g.user_email === order.user_email);
      let newDestGroups;
      if (existingIdx >= 0) {
        newDestGroups = existingGroups.map((g, i) => {
          if (i !== existingIdx) return g;
          const exists = (g.order_entries || []).some(e => e.order_id === orderId);
          if (exists) return g;
          return { ...g, order_entries: [...(g.order_entries || []), newEntry] };
        });
      } else {
        newDestGroups = [...existingGroups, {
          user_email: order.user_email, user_name: order.user_name || order.user_email,
          group_label: order.user_name || order.user_email,
          note: "", image_urls: [], selected_addon_ids: [], selected_addons: [],
          group_final_address: null, order_entries: [newEntry],
        }];
      }
      await shippingPoolApi.update(destPool.id, {
        order_ids: [...new Set([...(destPool.order_ids || []), orderId])],
        order_names: [...(destPool.order_names || []), order.product_name].filter(Boolean),
        total_weight_g: (destPool.total_weight_g || 0) + (order.weight_g || 0),
        per_user_groups: newDestGroups,
      });
      await base44.functions.invoke('updateTenantOrder', {
        order_id: orderId,
        order_status: (!srcPool && order.order_status === "in_warehouse") ? "notified_shipment" : order.order_status,
        consolidation_pool_id: destPool.id,
        pre_shipment: { ...(order.pre_shipment || {}), pool_created: true, pool_id: destPool.id, consType: "official_pool", target_pool_id: destPool.id },
      });
    } else {
      // Moving to staging
      const sPool = srcPool || pools.find(p => (p.order_ids || []).includes(orderId));
      await base44.functions.invoke('updateTenantOrder', {
        order_id: orderId,
        consolidation_pool_id: "",
        pre_shipment: {
          ...(order.pre_shipment || {}),
          consType: "official_pool", pool_created: false, pool_id: "",
          target_pool_id: sPool?.id || "", target_pool_code: sPool?.pool_code || "",
          target_pool_title: sPool?.title || sPool?.pool_code || "",
        },
      });
    }
  };

  // ─── Drag end handler ───────────────────────────────────────────────────────
  const handleDragEnd = async (result) => {
    const { source, destination, draggableId, type } = result;
    if (!destination) return;

    // ── Column reorder (admin only) ──
    if (type === "COLUMN") {
      if (source.index === destination.index) return;
      setColumnOrder(prev => {
        const next = [...prev];
        const [moved] = next.splice(source.index, 1);
        next.splice(destination.index, 0, moved);
        return next;
      });
      return;
    }

    if (source.droppableId === destination.droppableId) return;

    const srcId = source.droppableId;
    const dstId = destination.droppableId;
    const destPool = dstId.startsWith("pool-") ? pools.find(p => p.id === dstId.slice("pool-".length)) : null;

    // Collect all draggableIds to move (the dragged one + any other selected ones)
    const idsToMove = selectedIds.has(draggableId)
      ? [...selectedIds]
      : [draggableId];

    // Process each draggableId
    for (const did of idsToMove) {
      const parsed = parseDraggableId(did);
      if (!parsed) continue;

      if (parsed.type === "staging") {
        // staging → pool
        if (destPool) {
          await moveOrderToPool(parsed.orderId, null, destPool);
        }
      } else if (parsed.type === "pool-order") {
        const srcPool = pools.find(p => p.id === parsed.srcPoolId);
        if (dstId === "staging") {
          await moveOrderToPool(parsed.orderId, srcPool, null);
        } else if (destPool && parsed.srcPoolId !== destPool.id) {
          await moveOrderToPool(parsed.orderId, srcPool, destPool);
        }
      } else if (parsed.type === "pool-group") {
        // Move all entries of the group
        const srcPool = pools.find(p => p.id === parsed.srcPoolId);
        const group = srcPool?.per_user_groups?.find(g => g.user_email === parsed.userEmail);
        if (!group) continue;
        const orderIds = (group.order_entries || []).map(e => e.order_id);
        for (const oid of orderIds) {
          // Need up-to-date srcPool after each move; re-fetch from current pools state is tricky,
          // so do sequential moves. Refresh once at end.
          if (dstId === "staging") {
            await moveOrderToPool(oid, srcPool, null);
          } else if (destPool && parsed.srcPoolId !== destPool.id) {
            await moveOrderToPool(oid, srcPool, destPool);
          }
        }
      }
    }

    setSelectedIds(new Set());
    onRefresh?.();
  };

  if (pools.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center py-20 text-gray-400">
          <Layers className="w-12 h-12 mb-3 opacity-20" />
          <p className="text-sm">暂无官方拼邮需求</p>
          {isAdmin && <p className="text-xs mt-1">点击"创建发货申请"并选择拼邮类型即可创建</p>}
        </div>
        {createPoolOpen && (
          <CreateOfficialPoolModal
            onClose={() => setCreatePoolOpen(false)}
            onSuccess={() => { setCreatePoolOpen(false); onRefresh?.(); }}
          />
        )}
      </>
    );
  }

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="space-y-3">
          {isAdmin && showPoolSorter && (
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-600">
              <ArrowUpDown className="w-4 h-4 text-gray-400" />
              <span>拖拽任务卡片可在列之间移动；Shift+点击多选后可批量拖动；管理员可拖拽列头调整顺序</span>
              <Button variant="ghost" size="sm" className="ml-auto h-6 text-xs" onClick={() => setShowPoolSorter?.(false)}>关闭</Button>
            </div>
          )}

          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 text-sm text-blue-700">
              <CheckSquare className="w-4 h-4" />
              <span>已选中 {selectedIds.size} 项，拖拽任意选中项可批量移动</span>
              <Button variant="ghost" size="sm" className="ml-auto h-6 text-xs text-blue-500 hover:text-blue-700" onClick={() => setSelectedIds(new Set())}>取消选择</Button>
            </div>
          )}

          <div className="flex gap-4 overflow-x-auto pb-4">
            {/* Staging column — always fixed at the left, not draggable */}
            <StagingColumn
              allOrders={allOrders}
              officialPools={pools}
              currentUser={currentUser}
              isAdmin={isAdmin}
              onRefresh={onRefresh}
              selectedIds={selectedIds}
              onSelectItem={handleSelectItem}
            />

            {/* Add section button */}
            {isAdmin && (
              <div className="flex-shrink-0 flex items-stretch group/addbtn">
                <button
                  onClick={() => setCreatePoolOpen(true)}
                  title="创建新官方拼邮需求"
                  className="flex flex-col items-center justify-center w-6 relative"
                >
                  <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-transparent group-hover/addbtn:bg-blue-400 transition-colors duration-200" />
                  <span
                    className="relative z-10 bg-white border border-transparent group-hover/addbtn:border-blue-400 group-hover/addbtn:text-blue-500 text-transparent transition-colors duration-200 rounded-full px-1.5 py-0.5 whitespace-nowrap select-none"
                    style={{ writingMode: "vertical-lr", fontSize: "10px", letterSpacing: "0.05em" }}
                  >
                    + 新增列
                  </span>
                </button>
              </div>
            )}

            {/* Pool columns — draggable by admins */}
            <Droppable droppableId="column-order" direction="horizontal" type="COLUMN">
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="flex gap-4"
                >
                  {orderedPools.map((pool, idx) => (
                    isAdmin ? (
                      <Draggable key={pool.id} draggableId={`col-${pool.id}`} index={idx}>
                        {(colProvided, colSnapshot) => (
                          <div
                            ref={colProvided.innerRef}
                            {...colProvided.draggableProps}
                            className={colSnapshot.isDragging ? "opacity-80" : ""}
                          >
                            <PoolColumn
                              pool={pool}
                              allOrders={allOrders}
                              currentUser={currentUser}
                              isAdmin={isAdmin}
                              shippingAddons={shippingAddons}
                              savedAddresses={savedAddresses}
                              onPoolClick={onPoolClick}
                              onRefresh={onRefresh}
                              columnDragHandleProps={colProvided.dragHandleProps}
                              selectedIds={selectedIds}
                              onSelectItem={handleSelectItem}
                            />
                          </div>
                        )}
                      </Draggable>
                    ) : (
                      <PoolColumn
                        key={pool.id}
                        pool={pool}
                        allOrders={allOrders}
                        currentUser={currentUser}
                        isAdmin={isAdmin}
                        shippingAddons={shippingAddons}
                        savedAddresses={savedAddresses}
                        onPoolClick={onPoolClick}
                        onRefresh={onRefresh}
                        selectedIds={selectedIds}
                        onSelectItem={handleSelectItem}
                      />
                    )
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        </div>
      </DragDropContext>

      {createPoolOpen && (
        <CreateOfficialPoolModal
          onClose={() => setCreatePoolOpen(false)}
          onSuccess={() => { setCreatePoolOpen(false); onRefresh?.(); }}
        />
      )}
    </>
  );
}