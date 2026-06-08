/**
 * OfficialPoolStagingColumn
 * A virtual "staging" column in the Official Pool Kanban.
 * Shows all orders with pre_shipment.consType === "official_pool" that haven't
 * been merged into a real pool yet, grouped by warehouse status.
 *
 * - 已入库 orders → can be added to a real pool immediately
 * - 未入库 orders → shown as pending, with the target pool name as a hint
 *
 * Admins can also manually add any order (any status) to staging here.
 */
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { shippingPoolApi, tenantEntity } from "@/lib/tenantApi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Inbox, Package, Plus, ChevronDown, ChevronRight,
  Loader2, ArrowRight, X, CheckCircle2, Clock, Warehouse
} from "lucide-react";

const ORDER_STATUS_LABELS = {
  pending_confirmation: "待确认",
  payment_pending: "待付款",
  paid: "已付款",
  pending_purchase: "待购买",
  purchased: "已购买",
  in_warehouse: "已入库",
  notified_shipment: "待发货",
};

// ─── Add Order to Staging Modal ─────────────────────────────────────────────
function AddToStagingModal({ allOrders, officialPools, currentUser, onClose, onSuccess }) {
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  const [selectedPoolId, setSelectedPoolId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // All orders that are not already in a real pool and not already staged for official pool
  const eligibleOrders = allOrders.filter(o => {
    if (o.order_status === "shipped" || o.order_status === "delivered" || o.order_status === "cancelled") return false;
    // Don't show orders already in an official pool
    const alreadyInPool = officialPools.some(p => (p.order_ids || []).includes(o.id));
    if (alreadyInPool) return false;
    return true;
  });

  const handleSubmit = async () => {
    if (selectedOrderIds.length === 0) return;
    setSubmitting(true);

    await Promise.all(selectedOrderIds.map(orderId => {
      const order = allOrders.find(o => o.id === orderId);
      if (!order) return Promise.resolve();
      const targetPool = officialPools.find(p => p.id === selectedPoolId);
      const existingPre = order.pre_shipment || {};
      const newPre = {
        ...existingPre,
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
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900 text-sm">添加任务到待发货暂存区</h2>
            <p className="text-xs text-gray-400 mt-0.5">选择要纳入官方拼邮计划的订单</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Target pool (optional) */}
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

          {/* Order list */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">选择订单（{eligibleOrders.length} 个可选）</p>
            {eligibleOrders.length === 0 ? (
              <div className="text-center py-8 text-gray-300 text-xs">
                <Package className="w-6 h-6 mx-auto mb-1 opacity-40" />
                暂无可添加的订单
              </div>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {eligibleOrders.map(o => (
                  <label key={o.id} className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${selectedOrderIds.includes(o.id) ? "border-blue-300 bg-blue-50" : "border-gray-200 hover:bg-gray-50"}`}>
                    <Checkbox checked={selectedOrderIds.includes(o.id)}
                      onCheckedChange={() => setSelectedOrderIds(prev => prev.includes(o.id) ? prev.filter(x => x !== o.id) : [...prev, o.id])} />
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
            disabled={submitting || selectedOrderIds.length === 0}
            onClick={handleSubmit}>
            {submitting ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />处理中...</> : `添加 ${selectedOrderIds.length} 个任务`}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function OfficialPoolStagingColumn({ allOrders, officialPools, currentUser, isAdmin, onRefresh }) {
  const [inWarehouseExpanded, setInWarehouseExpanded] = useState(true);
  const [pendingExpanded, setPendingExpanded] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [joining, setJoining] = useState(null); // order id being joined

  // Collect all staged orders:
  // 1. Orders with pre_shipment.consType === "official_pool" and pool_created !== true
  // 2. These are not yet in any official pool's order_ids
  const allOfficialPoolOrderIds = new Set(officialPools.flatMap(p => p.order_ids || []));

  const stagedOrders = allOrders.filter(o => {
    if (allOfficialPoolOrderIds.has(o.id)) return false; // already merged
    const pre = o.pre_shipment;
    if (!pre) return false;
    if (pre.consType !== "official_pool") return false;
    if (pre.pool_created === true) return false;
    return true;
  });

  const inWarehouseOrders = stagedOrders.filter(o => o.order_status === "in_warehouse");
  const pendingOrders = stagedOrders.filter(o => o.order_status !== "in_warehouse");

  // Join an in-warehouse order into its target pool (or pick a pool)
  const handleJoinPool = async (order) => {
    const pre = order.pre_shipment;
    const targetPoolId = pre?.target_pool_id;
    const pool = officialPools.find(p => p.id === targetPoolId) || officialPools[0];
    if (!pool) return;

    setJoining(order.id);
    // Add to pool's order_ids + per_user_groups
    const existingGroups = pool.per_user_groups || [];
    const existingGroupIdx = existingGroups.findIndex(g => g.user_email === order.user_email);
    const newEntry = {
      order_id: order.id,
      note: pre?.user_note || "",
      image_urls: [],
      selected_addon_ids: pre?.selected_addon_ids || [],
      selected_addons: pre?.selected_addons || [],
      use_group_address: true,
      override_final_address: null,
    };
    let newGroups;
    if (existingGroupIdx >= 0) {
      newGroups = existingGroups.map((g, i) => {
        if (i !== existingGroupIdx) return g;
        const existing = new Set((g.order_entries || []).map(e => e.order_id));
        if (existing.has(order.id)) return g;
        return { ...g, order_entries: [...(g.order_entries || []), newEntry] };
      });
    } else {
      newGroups = [...existingGroups, {
        user_email: order.user_email,
        user_name: order.user_name || order.user_email,
        group_label: order.user_name || order.user_email,
        note: "",
        image_urls: [],
        selected_addon_ids: [],
        selected_addons: [],
        group_final_address: null,
        order_entries: [newEntry],
      }];
    }

    const newOrderIds = [...new Set([...(pool.order_ids || []), order.id])];
    await shippingPoolApi.update(pool.id, {
      order_ids: newOrderIds,
      order_names: [...(pool.order_names || []), order.product_name].filter(Boolean),
      total_weight_g: (pool.total_weight_g || 0) + (order.weight_g || 0),
      per_user_groups: newGroups,
    });

    // Mark pre_shipment as pool_created
    await base44.functions.invoke('updateTenantOrder', {
      order_id: order.id,
      order_status: "notified_shipment",
      consolidation_pool_id: pool.id,
      pre_shipment: { ...pre, pool_created: true, pool_id: pool.id },
    });

    setJoining(null);
    onRefresh?.();
  };

  // Remove an order from staging
  const handleRemoveFromStaging = async (order) => {
    const pre = order.pre_shipment || {};
    await base44.functions.invoke('updateTenantOrder', {
      order_id: order.id,
      pre_shipment: { ...pre, consType: "", target_pool_id: "", target_pool_code: "" },
    });
    onRefresh?.();
  };

  const getTargetPoolLabel = (order) => {
    const pre = order.pre_shipment;
    if (!pre?.target_pool_id) return "待匹配";
    const pool = officialPools.find(p => p.id === pre.target_pool_id);
    return pool ? (pool.title || pool.pool_code) : (pre.target_pool_code || "待匹配");
  };

  return (
    <div className="flex-shrink-0 w-72 flex flex-col">
      {/* Column header */}
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
          <button
            onClick={() => setAddModalOpen(true)}
            className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors flex-shrink-0"
            title="手动添加任务">
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto min-h-[60px]">
        {/* In-warehouse group */}
        {inWarehouseOrders.length > 0 && (
          <div className="border border-green-200 rounded-xl overflow-hidden bg-white">
            <div
              className="flex items-center justify-between px-3 py-2 bg-green-50 border-b border-green-100 cursor-pointer hover:bg-green-100 transition-colors"
              onClick={() => setInWarehouseExpanded(v => !v)}>
              <div className="flex items-center gap-2">
                {inWarehouseExpanded ? <ChevronDown className="w-3.5 h-3.5 text-green-500" /> : <ChevronRight className="w-3.5 h-3.5 text-green-500" />}
                <Warehouse className="w-3.5 h-3.5 text-green-600" />
                <span className="text-xs font-medium text-green-800">已入库，可加入拼邮</span>
              </div>
              <Badge className="text-xs bg-green-100 text-green-700">{inWarehouseOrders.length}</Badge>
            </div>
            {inWarehouseExpanded && (
              <div className="divide-y divide-gray-50">
                {inWarehouseOrders.map(order => {
                  const targetLabel = getTargetPoolLabel(order);
                  const targetPoolId = order.pre_shipment?.target_pool_id;
                  const targetPool = officialPools.find(p => p.id === targetPoolId) || officialPools[0];
                  const isJoining = joining === order.id;
                  return (
                    <div key={order.id} className="px-3 py-2.5 hover:bg-gray-50">
                      <div className="flex items-start gap-2">
                        <Package className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-800 truncate">{order.product_name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{order.order_number || order.id.slice(-6)}{order.weight_g > 0 ? ` · ${order.weight_g}g` : ""}</p>
                          <div className="flex items-center gap-1 mt-1">
                            <ArrowRight className="w-3 h-3 text-blue-400 flex-shrink-0" />
                            <span className="text-xs text-blue-600 truncate">{targetLabel}</span>
                          </div>
                        </div>
                        {isAdmin && (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={() => handleRemoveFromStaging(order)}
                              className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors"
                              title="从暂存区移除">
                              <X className="w-3 h-3" />
                            </button>
                            {targetPool && (
                              <button
                                onClick={() => handleJoinPool(order)}
                                disabled={isJoining}
                                className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-green-600 hover:bg-green-700 text-white text-xs transition-colors disabled:opacity-50"
                                title={`加入 ${targetPool.title || targetPool.pool_code}`}>
                                {isJoining ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                                加入
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Pending (not yet in warehouse) group */}
        {pendingOrders.length > 0 && (
          <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
            <div
              className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => setPendingExpanded(v => !v)}>
              <div className="flex items-center gap-2">
                {pendingExpanded ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs font-medium text-gray-600">未入库，等待入库</span>
              </div>
              <Badge className="text-xs bg-gray-100 text-gray-500">{pendingOrders.length}</Badge>
            </div>
            {pendingExpanded && (
              <div className="divide-y divide-gray-50">
                {pendingOrders.map(order => {
                  const targetLabel = getTargetPoolLabel(order);
                  return (
                    <div key={order.id} className="px-3 py-2.5 hover:bg-gray-50">
                      <div className="flex items-start gap-2">
                        <Package className="w-3.5 h-3.5 text-gray-300 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-600 truncate">{order.product_name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {order.order_number && <span className="text-xs text-gray-400">{order.order_number}</span>}
                            <Badge className="text-xs bg-amber-50 text-amber-600 px-1 py-0">
                              {ORDER_STATUS_LABELS[order.order_status] || order.order_status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1 mt-1">
                            <ArrowRight className="w-3 h-3 text-gray-300 flex-shrink-0" />
                            <span className="text-xs text-gray-400 truncate">入库后→ {targetLabel}</span>
                          </div>
                        </div>
                        {isAdmin && (
                          <button
                            onClick={() => handleRemoveFromStaging(order)}
                            className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors flex-shrink-0"
                            title="从暂存区移除">
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {stagedOrders.length === 0 && (
          <div className="text-center py-6 text-gray-300 text-xs">
            <Inbox className="w-6 h-6 mx-auto mb-1 opacity-30" />
            暂无待发货任务
          </div>
        )}
      </div>

      {/* Add button for regular users too (for their own orders) */}
      <button
        onClick={() => setAddModalOpen(true)}
        className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border-2 border-dashed border-gray-200 text-xs text-gray-400 hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50 transition-colors">
        <Plus className="w-3.5 h-3.5" />添加待发货任务
      </button>

      {addModalOpen && (
        <AddToStagingModal
          allOrders={allOrders}
          officialPools={officialPools}
          currentUser={currentUser}
          onClose={() => setAddModalOpen(false)}
          onSuccess={() => { setAddModalOpen(false); onRefresh?.(); }}
        />
      )}
    </div>
  );
}