/**
 * OfficialPoolKanban
 * Admin-created official consolidation pools displayed as kanban columns.
 * Users can join a pool; ≥2 orders from same user → folded as task group card.
 * Todoist-style: parent task group (user-level) + sub-tasks (order-level).
 */
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { tenantEntity, fetchTenantConfig } from "@/lib/tenantApi";
import { EMPTY_ADDRESS_FORM } from "@/components/common/AddressForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Users, Package, Scale, Plus, ChevronDown, ChevronRight, 
  Settings2, Edit2, MapPin, Layers, Calendar, ArrowUpDown 
} from "lucide-react";
import JoinOfficialPoolModal from "@/components/shippingpool/JoinOfficialPoolModal";
import OfficialPoolUserGroupModal from "@/components/shippingpool/OfficialPoolUserGroupModal";
import OfficialPoolOrderDetailModal from "@/components/shippingpool/OfficialPoolOrderDetailModal";

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

function UserGroupCard({ group, allOrders, pool, currentUser, isAdmin, shippingAddons, savedAddresses, onRefresh }) {
  const [expanded, setExpanded] = useState(false);
  const [editGroupOpen, setEditGroupOpen] = useState(false);
  const [editOrderEntry, setEditOrderEntry] = useState(null); // { entry, order }

  const orderEntries = group.order_entries || [];
  const isSelf = group.user_email === currentUser?.email;
  const canEdit = isSelf || isAdmin;

  // Resolve full order objects
  const resolvedOrders = orderEntries.map(entry => ({
    entry,
    order: allOrders.find(o => o.id === entry.order_id) || null,
  }));

  const totalWeight = resolvedOrders.reduce((s, { order }) => s + (order?.weight_g || 0), 0);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      {/* Group header */}
      <div
        className="flex items-center justify-between px-3 py-2.5 bg-blue-50/60 border-b border-blue-100 cursor-pointer hover:bg-blue-50"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-2 min-w-0">
          {expanded ? <ChevronDown className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />}
          <Users className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
          <span className="text-sm font-medium text-gray-800 truncate">{group.group_label || group.user_name || group.user_email}</span>
          <Badge variant="outline" className="text-xs flex-shrink-0">{orderEntries.length}件</Badge>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-xs text-gray-400">{totalWeight}g</span>
          {canEdit && (
            <button
              onClick={e => { e.stopPropagation(); setEditGroupOpen(true); }}
              className="p-1 rounded hover:bg-blue-100 text-gray-400 hover:text-blue-600 transition-colors"
            >
              <Edit2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Group address indicator */}
      {group.group_final_address?.recipient_name && (
        <div className="px-3 py-1.5 flex items-center gap-1.5 text-xs text-gray-400 border-b border-gray-100">
          <MapPin className="w-3 h-3" />
          <span className="truncate">{group.group_final_address.recipient_name}{group.group_final_address.state ? ` · ${group.group_final_address.state}` : ""}</span>
        </div>
      )}

      {/* Order entries (sub-tasks) */}
      {expanded && (
        <div className="divide-y divide-gray-50">
          {resolvedOrders.map(({ entry, order }) => (
            <div
              key={entry.order_id}
              className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-gray-50 cursor-pointer transition-colors"
              onClick={() => canEdit && setEditOrderEntry({ entry, order })}
            >
              <Package className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-700 truncate">{order?.product_name || entry.order_id.slice(-8)}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {order?.order_number && <span className="text-xs text-gray-400">{order.order_number}</span>}
                  {order?.weight_g > 0 && <span className="text-xs text-gray-400">{order.weight_g}g</span>}
                  {!entry.use_group_address && (
                    <Badge className="text-xs bg-orange-100 text-orange-600 px-1 py-0">独立地址</Badge>
                  )}
                </div>
                {entry.note && <p className="text-xs text-gray-400 mt-0.5 truncate">{entry.note}</p>}
              </div>
              {canEdit && <Edit2 className="w-3 h-3 text-gray-300 hover:text-gray-500 flex-shrink-0 mt-0.5" />}
            </div>
          ))}
        </div>
      )}

      {editGroupOpen && (
        <OfficialPoolUserGroupModal
          pool={pool}
          group={group}
          shippingAddons={shippingAddons}
          savedAddresses={savedAddresses}
          onClose={() => setEditGroupOpen(false)}
          onSuccess={() => { setEditGroupOpen(false); onRefresh?.(); }}
        />
      )}

      {editOrderEntry && (
        <OfficialPoolOrderDetailModal
          pool={pool}
          group={group}
          orderEntry={editOrderEntry.entry}
          order={editOrderEntry.order}
          shippingAddons={shippingAddons}
          savedAddresses={savedAddresses}
          onClose={() => setEditOrderEntry(null)}
          onSuccess={() => { setEditOrderEntry(null); onRefresh?.(); }}
        />
      )}
    </div>
  );
}

function SingleOrderCard({ entry, order, group, pool, currentUser, isAdmin, shippingAddons, savedAddresses, onRefresh }) {
  const [editOpen, setEditOpen] = useState(false);
  const isSelf = group?.user_email === currentUser?.email;
  const canEdit = isSelf || isAdmin;

  return (
    <>
      <div
        className={`border border-gray-200 rounded-xl px-3 py-2.5 bg-white hover:shadow-sm transition-all ${canEdit ? "cursor-pointer hover:border-blue-200" : ""}`}
        onClick={() => canEdit && setEditOpen(true)}
      >
        <div className="flex items-start gap-2">
          <Package className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-800 truncate">{order?.product_name || entry.order_id.slice(-8)}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {group && <span className="text-xs text-gray-400">{group.user_name || group.user_email}</span>}
              {order?.weight_g > 0 && <span className="text-xs text-gray-400">{order.weight_g}g</span>}
            </div>
            {entry.note && <p className="text-xs text-gray-400 mt-0.5 truncate">{entry.note}</p>}
          </div>
          {canEdit && <Edit2 className="w-3 h-3 text-gray-300 hover:text-gray-500 flex-shrink-0 mt-0.5" />}
        </div>
      </div>

      {editOpen && group && (
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

function PoolColumn({ pool, allOrders, currentUser, isAdmin, shippingAddons, savedAddresses, onPoolClick, onRefresh }) {
  const [joinOpen, setJoinOpen] = useState(false);

  const perUserGroups = pool.per_user_groups || [];
  const totalWeight = pool.total_weight_g || 0;
  const minWeight = pool.consolidation_min_weight_g || 0;
  const progressPct = minWeight > 0 ? Math.min(100, (totalWeight / minWeight) * 100) : 0;
  const isReady = minWeight > 0 && totalWeight >= minWeight;

  // Current user's orders already in this pool
  const myGroup = perUserGroups.find(g => g.user_email === currentUser?.email);
  const myOrderIds = new Set((myGroup?.order_entries || []).map(e => e.order_id));
  const hasInWarehouse = allOrders.some(o => o.order_status === "in_warehouse" && !myOrderIds.has(o.id));

  // Build display items: group users with ≥2 orders as task group card; 1 order = single card
  const displayItems = perUserGroups.map(group => {
    const entries = group.order_entries || [];
    return { group, entries, isGroup: entries.length >= 2 };
  });

  return (
    <div className="flex-shrink-0 w-72 flex flex-col">
      {/* Column header */}
      <div
        className="flex items-center justify-between px-3 py-3 bg-white border border-gray-200 rounded-xl cursor-pointer hover:border-gray-300 transition-colors mb-2"
        onClick={() => onPoolClick?.(pool)}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-800 truncate">{pool.title || pool.pool_code}</span>
            {pool.pool_code && pool.title && (
              <span className="text-xs font-mono text-gray-400">{pool.pool_code}</span>
            )}
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

      {/* Progress bar */}
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

      {/* User/order cards */}
      <div className="flex-1 space-y-2 overflow-y-auto min-h-[60px]">
        {displayItems.map(({ group, entries, isGroup }) => {
          if (isGroup) {
            return (
              <UserGroupCard
                key={group.user_email}
                group={group}
                allOrders={allOrders}
                pool={pool}
                currentUser={currentUser}
                isAdmin={isAdmin}
                shippingAddons={shippingAddons}
                savedAddresses={savedAddresses}
                onRefresh={onRefresh}
              />
            );
          }
          // Single order card
          const entry = entries[0];
          if (!entry) return null;
          const order = allOrders.find(o => o.id === entry.order_id) || null;
          return (
            <SingleOrderCard
              key={entry.order_id}
              entry={entry}
              order={order}
              group={group}
              pool={pool}
              currentUser={currentUser}
              isAdmin={isAdmin}
              shippingAddons={shippingAddons}
              savedAddresses={savedAddresses}
              onRefresh={onRefresh}
            />
          );
        })}

        {displayItems.length === 0 && (
          <div className="text-center py-6 text-gray-300 text-xs">
            <Layers className="w-6 h-6 mx-auto mb-1 opacity-30" />
            暂无参与者
          </div>
        )}
      </div>

      {/* Join button */}
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

export default function OfficialPoolKanban({ pools, allOrders, currentUser, isAdmin, showPoolSorter, setShowPoolSorter, onPoolClick, onRefresh }) {
  const [shippingAddons, setShippingAddons] = useState([]);
  const [savedAddresses, setSavedAddresses] = useState([]);

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

  if (pools.length === 0) {
    return (
      <div className="flex flex-col items-center py-20 text-gray-400">
        <Layers className="w-12 h-12 mb-3 opacity-20" />
        <p className="text-sm">暂无官方拼邮需求</p>
        {isAdmin && <p className="text-xs mt-1">点击"创建发货申请"并选择拼邮类型即可创建</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Sort toggle (admin only) */}
      {isAdmin && showPoolSorter && (
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-600">
          <ArrowUpDown className="w-4 h-4 text-gray-400" />
          <span>拖拽排序功能即将推出</span>
          <Button variant="ghost" size="sm" className="ml-auto h-6 text-xs" onClick={() => setShowPoolSorter?.(false)}>关闭</Button>
        </div>
      )}

      {/* Kanban columns */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {pools.map(pool => (
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
          />
        ))}
      </div>
    </div>
  );
}