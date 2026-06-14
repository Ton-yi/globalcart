import { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Package, Truck, Clock, CheckCircle, ArrowRight, AlertCircle, HelpCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getStatusLabel, getStatusColor } from "@/lib/orderStatus";
import ReactMarkdown from "react-markdown";

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
function FaqGroupItem({ item }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white rounded-lg border border-teal-100 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-2.5 py-2 text-left hover:bg-teal-50 transition-colors"
      >
        <span className="text-xs text-gray-700 font-medium flex-1 pr-2 line-clamp-2">{item.question}</span>
        {open ? <ChevronUp className="w-3 h-3 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-2.5 pb-2.5 pt-1 bg-teal-50 border-t border-teal-100">
          <ReactMarkdown className="prose prose-xs max-w-none text-gray-600 text-xs">
            {item.answer}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}

export default function LogisticsStatusBoard({ orders = [], boardConfig = {}, faqCategories = [] }) {
  if (orders.length === 0 && !boardConfig.faq_enabled) return null;

  const grouped = groupOrders(orders);
  const cfgGroups = boardConfig.groups || {};
  const boardTitle = boardConfig.title || "物流状态看板";

  // 过滤掉被隐藏的分组，且只展示有数据的分组
  const visibleGroups = DEFAULT_GROUPS.filter(g => {
    const cfg = cfgGroups[g.key] || {};
    if (cfg.hidden) return false;
    return (grouped[g.key] || []).length > 0;
  });

  // FAQ group
  const faqEnabled = !!boardConfig.faq_enabled;
  const faqItemIds = boardConfig.faq_item_ids || [];
  const allCatItems = faqCategories.flatMap(c => (c.items || []).map(it => ({ ...it, _catId: c.id })));
  const faqItems = faqItemIds.map(id => allCatItems.find(it => it._id === id)).filter(Boolean);

  if (visibleGroups.length === 0 && (!faqEnabled || faqItems.length === 0)) return null;

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

        {/* FAQ 常见问题分组 */}
        {faqEnabled && faqItems.length > 0 && (
          <div className="border border-teal-200 rounded-xl p-3 bg-teal-50">
            <div className="flex items-center gap-1.5 mb-2">
              <HelpCircle className="w-3.5 h-3.5 text-teal-500" />
              <span className="text-xs font-semibold text-teal-700">常见问题</span>
              <span className="ml-auto text-xs font-bold text-teal-700">{faqItems.length}</span>
            </div>
            <div className="space-y-1.5">
              {faqItems.map((item, i) => (
                <FaqGroupItem key={item._id || i} item={item} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}