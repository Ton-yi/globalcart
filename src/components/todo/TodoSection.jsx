import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/**
 * A collapsible-style section card used in both user and admin todo boards.
 * Shows a colored header with count badge and children items inside.
 */
export default function TodoSection({ icon: Icon, title, count = 0, color = "gray", children, isEmpty, emptyText = "暂无待办" }) {
  const colorMap = {
    orange: { header: "bg-orange-50 border-orange-200", badge: "bg-orange-500", iconColor: "text-orange-500", border: "border-orange-200" },
    blue:   { header: "bg-blue-50 border-blue-200",   badge: "bg-blue-500",   iconColor: "text-blue-500",   border: "border-blue-200" },
    red:    { header: "bg-red-50 border-red-200",     badge: "bg-red-500",     iconColor: "text-red-500",     border: "border-red-200" },
    green:  { header: "bg-green-50 border-green-200", badge: "bg-green-500", iconColor: "text-green-500", border: "border-green-200" },
    purple: { header: "bg-purple-50 border-purple-200", badge: "bg-purple-500", iconColor: "text-purple-500", border: "border-purple-200" },
    teal:   { header: "bg-teal-50 border-teal-200",   badge: "bg-teal-500",   iconColor: "text-teal-500",   border: "border-teal-200" },
    gray:   { header: "bg-gray-50 border-gray-200",   badge: "bg-gray-400",   iconColor: "text-gray-500",   border: "border-gray-200" },
    yellow: { header: "bg-yellow-50 border-yellow-200", badge: "bg-yellow-500", iconColor: "text-yellow-600", border: "border-yellow-200" },
  };
  const c = colorMap[color] || colorMap.gray;

  return (
    <div className={`rounded-xl border ${c.border} overflow-hidden`}>
      <div className={`flex items-center gap-2 px-4 py-3 ${c.header}`}>
        {Icon && <Icon className={`w-4 h-4 ${c.iconColor}`} />}
        <span className="font-semibold text-gray-800 text-sm flex-1">{title}</span>
        {count > 0 && (
          <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold text-white ${c.badge}`}>
            {count > 99 ? "99+" : count}
          </span>
        )}
        {count === 0 && (
          <span className="text-xs text-gray-400 font-normal">已处理</span>
        )}
      </div>
      <div className="bg-white divide-y divide-gray-50">
        {isEmpty || count === 0 ? (
          <div className="px-4 py-4 text-sm text-gray-400 text-center">{emptyText}</div>
        ) : children}
      </div>
    </div>
  );
}