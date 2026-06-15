import { useState, useRef, useEffect } from "react";
import { Calendar, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const DATE_FIELDS = [
  { key: "created_date", label: "订单提交日" },
  { key: "purchased_date", label: "下单日" },
  { key: "in_warehouse_date", label: "入库日" },
  { key: "shipped_date", label: "发货日" },
  { key: "payment_due_date", label: "付款截止日" },
];

/**
 * DateRangeFilter
 * Props:
 *   value: { from: string, to: string } | null  (简化版，不需要 field)
 *   onChange: (value | null) => void
 *   placeholder: string (可选，按钮显示的文字，如"開演日")
 */
export default function DateRangeFilter({ value, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(value?.from || "");
  const [to, setTo] = useState(value?.to || "");
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const hasValue = value && (value.from || value.to);

  const handleApply = () => {
    if (!from && !to) { onChange(null); setOpen(false); return; }
    onChange({ from, to });
    setOpen(false);
  };

  const handleClear = () => {
    setFrom(""); setTo("");
    onChange(null);
    setOpen(false);
  };

  const displayLabel = placeholder || "日期";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1.5 h-8 px-2.5 text-sm rounded-md border transition-colors whitespace-nowrap
          ${hasValue
            ? "bg-blue-50 border-blue-300 text-blue-700"
            : "bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
          }`}
      >
        <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
        <span>{hasValue ? `${displayLabel}: ${value.from || "∼"} ~ ${value.to || "∼"}` : displayLabel}</span>
        {hasValue
          ? <X className="w-3 h-3 ml-0.5 hover:text-blue-900" onClick={(e) => { e.stopPropagation(); handleClear(); }} />
          : <ChevronDown className="w-3 h-3 ml-0.5 opacity-50" />
        }
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-64">
          {/* 日期范围 */}
          <div className="space-y-2">
            <div>
              <div className="text-xs text-gray-500 mb-1">开始日期</div>
              <input
                type="date"
                value={from}
                onChange={e => setFrom(e.target.value)}
                className="w-full h-8 text-sm border border-gray-200 rounded px-2 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">结束日期</div>
              <input
                type="date"
                value={to}
                onChange={e => setTo(e.target.value)}
                className="w-full h-8 text-sm border border-gray-200 rounded px-2 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={handleClear}>清除</Button>
            <Button size="sm" className="flex-1 h-7 text-xs bg-blue-600 hover:bg-blue-700" onClick={handleApply}>应用</Button>
          </div>
        </div>
      )}
    </div>
  );
}