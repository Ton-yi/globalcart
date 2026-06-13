import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/**
 * A single row item inside a TodoSection.
 * Props:
 *  - label: main text
 *  - sub: secondary small text
 *  - badge: { text, className }
 *  - onClick: action handler
 *  - actionLabel: button text (default "处理")
 *  - selected: boolean for checkbox mode
 *  - onSelect: checkbox toggle handler
 *  - checkbox: boolean - show checkbox
 */
export default function TodoItem({ label, sub, badge, onClick, actionLabel = "去处理", selected, onSelect, checkbox }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors group ${selected ? "bg-blue-50" : ""}`}>
      {checkbox && (
        <input
          type="checkbox"
          checked={!!selected}
          onChange={e => onSelect && onSelect(e.target.checked)}
          className="w-4 h-4 rounded border-gray-300 accent-blue-600 flex-shrink-0"
          onClick={e => e.stopPropagation()}
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-800 truncate">{label}</div>
        {sub && <div className="text-xs text-gray-400 truncate mt-0.5">{sub}</div>}
      </div>
      {badge && (
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${badge.className || "bg-gray-100 text-gray-600"}`}>
          {badge.text}
        </span>
      )}
      {onClick && (
        <button
          onClick={onClick}
          className="flex-shrink-0 text-xs text-blue-600 hover:text-blue-800 font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5"
        >
          {actionLabel}<ChevronRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}