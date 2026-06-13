import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Package, Truck, Clock, CheckCircle, ArrowRight, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getStatusLabel, getStatusColor } from "@/lib/orderStatus";

// 默认分组定义
const DEFAULT_GROUPS = [
  {
    key: "action_required",
    label: "需要操作",
    color: "text-red-600",
    bgColor: "bg-red-50 border-red-200",
    icon: AlertCircle,
    iconColor: "text-red-500",
    statuses: ["payment_pending", "awaiting_payment", "awaiting_confirmation", "notified_shipment_fee_pending", "shipping_fee_pending"],
  },
  {
    key: "in_progress",
    label: "处理中",
    color: "text-blue-600",
    bgColor: "bg-blue-50 border-blue-200",
    icon: Clock,
    iconColor: "text-blue-500",
    statuses: ["pending_confirmation", "paid", "pending_purchase", "purchased", "in_warehouse", "in_storage"],
  },
  {
    key: "shipping",
    label: "运输中",
    color: "text-indigo-600",
    bgColor: "bg-indigo-50 border-indigo-200",
    icon: Truck,
    iconColor: "text-indigo-500",
    statuses: ["notified_shipment", "notified_shipment_fee_paid", "ready_to_ship", "transit_shipped", "shipped"],
  },
  {
    key: "done",
    label: "已完成",
    color: "text-green-600",
    bgColor: "bg-green-50 border-green-200",
    icon: CheckCircle,
    iconColor: "text-green-500",
    statuses: ["delivered"],
  },
];

function groupOrders(orders) {
  const result = {};
  DEFAULT_GROUPS.forEach(g => { result[g.key] = []; });
  orders.forEach(order => {
    const group = DEFAULT_GROUPS.find(g => g.statuses.includes(order.order_status));
    if (group) result[group.key].push(order);
  });
  return result;
}

/**
 * boardConfig 结构（来自 SiteSettings home_status_board）:
 * {
 *   title: "物流状态看板",     // 看板整体标题
 *   groups: {
 *     action_required: { hidden: false, label: "需要操作", max_items: 3 },
 *     in_progress:     { hidden: false, label: "处理中",   max_items: 3 },
 *     shipping:        { hidden: false, label: "运输中",   max_items: 3 },
 *     done:            { hidden: true,  label: "已完成",   max_items: 3 },
 *   }
 * }
 */
export default function LogisticsStatusBoard({ orders = [], boardConfig = {} }) {
  if (orders.length === 0) return null;

  const grouped = groupOrders(orders);
  const cfgGroups = boardConfig.groups || {};
  const boardTitle = boardConfig.title || "物流状态看板";

  // 过滤掉被隐藏的分组，且只展示有数据的分组
  const visibleGroups = DEFAULT_GROUPS.filter(g => {
    const cfg = cfgGroups[g.key] || {};
    if (cfg.hidden) return false;
    return (grouped[g.key] || []).length > 0;
  });

  if (visibleGroups.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{boardTitle}</h2>
        <Link to={createPageUrl("MyOrders")} className="text-xs text-red-600 flex items-center gap-1 hover:underline">
          查看全部 <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {visibleGroups.map(group => {
          const cfg = cfgGroups[group.key] || {};
          const label = cfg.label || group.label;
          const maxItems = Number(cfg.max_items) || 3;
          const items = grouped[group.key] || [];
          const Icon = group.icon;

          return (
            <div key={group.key} className={`border rounded-xl p-3 ${group.bgColor}`}>
              <div className="flex items-center gap-1.5 mb-2">
                <Icon className={`w-3.5 h-3.5 ${group.iconColor}`} />
                <span className={`text-xs font-semibold ${group.color}`}>{label}</span>
                <span className={`ml-auto text-xs font-bold ${group.color}`}>{items.length}</span>
              </div>

              <div className="space-y-1.5">
                {items.slice(0, maxItems).map(order => (
                  <Link key={order.id} to={createPageUrl("MyOrders")}
                    className="block bg-white rounded-lg px-2.5 py-2 hover:shadow-sm transition-shadow border border-white hover:border-gray-200">
                    <div className="flex items-center gap-1.5">
                      <Package className="w-3 h-3 text-gray-400 flex-shrink-0" />
                      <span className="text-xs text-gray-800 font-medium truncate flex-1">{order.product_name}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-gray-400 font-mono">{order.order_number || order.id?.slice(0, 8)}</span>
                      <Badge className={`text-xs px-1.5 py-0 h-4 ${getStatusColor(order.order_status, "user")}`}>
                        {getStatusLabel(order.order_status, "user")}
                      </Badge>
                    </div>
                  </Link>
                ))}
                {items.length > maxItems && (
                  <Link to={createPageUrl("MyOrders")}
                    className="block text-center text-xs text-gray-400 hover:text-gray-600 py-1">
                    还有 {items.length - maxItems} 条 →
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}