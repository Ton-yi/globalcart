import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Package, Truck, Clock, CheckCircle, ArrowRight, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getStatusLabel, getStatusColor } from "@/lib/orderStatus";

// 物流状态的分组与优先级展示
const STATUS_GROUPS = [
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
  STATUS_GROUPS.forEach(g => { result[g.key] = []; });
  orders.forEach(order => {
    const group = STATUS_GROUPS.find(g => g.statuses.includes(order.order_status));
    if (group) result[group.key].push(order);
  });
  return result;
}

export default function LogisticsStatusBoard({ orders = [] }) {
  if (orders.length === 0) return null;

  const grouped = groupOrders(orders);

  // 只展示有内容的分组
  const activeGroups = STATUS_GROUPS.filter(g => grouped[g.key]?.length > 0);
  if (activeGroups.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">物流状态看板</h2>
        <Link to={createPageUrl("MyOrders")} className="text-xs text-red-600 flex items-center gap-1 hover:underline">
          查看全部 <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {STATUS_GROUPS.map(group => {
          const items = grouped[group.key] || [];
          const Icon = group.icon;
          return (
            <div key={group.key} className={`border rounded-xl p-3 ${group.bgColor}`}>
              <div className="flex items-center gap-1.5 mb-2">
                <Icon className={`w-3.5 h-3.5 ${group.iconColor}`} />
                <span className={`text-xs font-semibold ${group.color}`}>{group.label}</span>
                <span className={`ml-auto text-xs font-bold ${group.color}`}>{items.length}</span>
              </div>

              {items.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-2">暂无</p>
              ) : (
                <div className="space-y-1.5">
                  {items.slice(0, 3).map(order => (
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
                  {items.length > 3 && (
                    <Link to={createPageUrl("MyOrders")}
                      className="block text-center text-xs text-gray-400 hover:text-gray-600 py-1">
                      还有 {items.length - 3} 条 →
                    </Link>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}