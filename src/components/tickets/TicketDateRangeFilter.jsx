import { useState, useRef, useEffect } from "react";
import { Calendar, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * 通用日期字段选项
 */
const TICKET_DATE_FIELDS = [
  { key: "ticket_data.performance_datetime", label: "開演日", type: "datetime" },
  { key: "ticket_data.sales_start_time", label: "販売開始日", type: "datetime" },
  { key: "ticket_data.sales_end_time", label: "販売終了日", type: "datetime" },
  { key: "submit_date", label: "订单提交日", type: "date" },
  { key: "ticket_data.lottery_result_time", label: "結果発表日", type: "datetime" },
];

/**
 * TicketDateRangeFilter - 票务订单通用日期筛选器
 * Props:
 *   value: { field: string, from: string, to: string } | null
 *   onChange: (value | null) => void
 */
export default function TicketDateRangeFilter({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [field, setField] = useState(value?.field || "submit_date");
  const [from, setFrom] = useState(value?.from || "");
  const [to, setTo] = useState(value?.to || "");
  const ref = useRef(null);

  // 点击外部关闭
  useEffect(() => {
    const handler = (e) => { 
      if (ref.current && !ref.current.contains(e.target)) setOpen(false); 
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const hasValue = value && (value.from || value.to);
  const currentField = TICKET_DATE_FIELDS.find(f => f.key === (value?.field || field));

  const handleApply = () => {
    if (!from && !to) { 
      onChange(null); 
      setOpen(false); 
      return; 
    }
    onChange({ field, from, to });
    setOpen(false);
  };

  const handleClear = () => {
    setFrom(""); 
    setTo("");
    onChange(null);
    setOpen(false);
  };

  const displayLabel = currentField?.label || "日期";

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
        <span>
          {hasValue 
            ? `${displayLabel}: ${value.from || "∼"} ~ ${value.to || "∼"}` 
            : "日期筛选"
          }
        </span>
        {hasValue
          ? (
            <X 
              className="w-3 h-3 ml-0.5 hover:text-blue-900 cursor-pointer" 
              onClick={(e) => { 
                e.stopPropagation(); 
                handleClear(); 
              }} 
            />
          ) : (
            <ChevronDown className="w-3 h-3 ml-0.5 opacity-50" />
          )
        }
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-72">
          {/* 字段选择 */}
          <div className="mb-3">
            <div className="text-xs text-gray-500 mb-1.5 font-medium">选择日期字段</div>
            <div className="flex flex-wrap gap-1">
              {TICKET_DATE_FIELDS.map(f => (
                <button
                  key={f.key}
                  onClick={() => setField(f.key)}
                  className={`px-2 py-1 rounded text-xs transition-colors ${
                    field === f.key
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* 日期范围 */}
          <div className="mb-3 space-y-2">
            <div>
              <div className="text-xs text-gray-500 mb-1">开始日期</div>
              <input
                type={currentField?.type === "datetime" ? "datetime-local" : "date"}
                value={from}
                onChange={e => setFrom(e.target.value)}
                className="w-full h-8 text-sm border border-gray-200 rounded px-2 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">结束日期</div>
              <input
                type={currentField?.type === "datetime" ? "datetime-local" : "date"}
                value={to}
                onChange={e => setTo(e.target.value)}
                className="w-full h-8 text-sm border border-gray-200 rounded px-2 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant="outline" 
              className="flex-1 h-7 text-xs" 
              onClick={handleClear}
            >
              清除
            </Button>
            <Button 
              size="sm" 
              className="flex-1 h-7 text-xs bg-blue-600 hover:bg-blue-700" 
              onClick={handleApply}
            >
              应用
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}