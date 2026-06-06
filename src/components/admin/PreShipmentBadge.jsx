import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Zap, X } from "lucide-react";

/**
 * Shows a "预出货" badge on orders with pre_shipment data.
 * On click, shows a small popover with a brief summary.
 */
export default function PreShipmentBadge({ preShipment }) {
  const [open, setOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef(null);

  if (!preShipment) return null;

  const ps = preShipment;

  // Determine shipping mode label
  let modeLabel = "";
  let modeColor = "text-gray-700";
  if (ps.consType === "transit" && ps.transit_location_name) {
    modeLabel = `中转拼邮 → ${ps.transit_location_name}`;
    modeColor = "text-purple-700";
  } else if (ps.consType === "official_pool" || ps.pool_id) {
    modeLabel = "官方拼邮看板";
    modeColor = "text-indigo-700";
  } else {
    modeLabel = "直接发货";
    modeColor = "text-green-700";
  }

  const lines = [];
  if (ps.shipping_method) lines.push({ label: "运输方式", value: ps.shipping_method });
  if (ps.scheduled_ship_date) lines.push({ label: "计划发货", value: ps.scheduled_ship_date });
  if ((ps.selected_addons || []).length > 0)
    lines.push({ label: "增值服务", value: (ps.selected_addons || []).map(a => a.name || a.id).join("、") });
  else if ((ps.selected_addon_ids || []).length > 0)
    lines.push({ label: "增值服务", value: `${ps.selected_addon_ids.length} 项` });
  if (ps.user_note) lines.push({ label: "备注", value: ps.user_note });

  return (
    <div className="relative inline-block">
      <button
        ref={buttonRef}
        onClick={e => { 
          e.stopPropagation(); 
          if (buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setPopoverPos({ 
              top: rect.bottom + 6,
              left: rect.left 
            });
          }
          setOpen(v => !v); 
        }}
        className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-full font-medium hover:bg-blue-200 transition-colors"
      >
        <Zap className="w-2.5 h-2.5" />预出货
      </button>

      {open && createPortal(
        <>
          {/* backdrop to close */}
          <div className="fixed inset-0 z-40" onClick={e => { e.stopPropagation(); setOpen(false); }} />
          <div
            className="fixed bg-white border border-blue-200 rounded-lg shadow-xl p-3 min-w-[200px] max-w-[280px] z-50"
            style={{ top: `${popoverPos.top}px`, left: `${popoverPos.left}px` }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-blue-700 flex items-center gap-1">
                <Zap className="w-3 h-3" />预出货信息摘要
              </span>
              <button onClick={e => { e.stopPropagation(); setOpen(false); }}>
                <X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            {/* Shipping mode highlight */}
            <div className={`text-xs font-semibold mb-2 px-2 py-1 rounded ${
              modeColor === "text-purple-700" ? "bg-purple-50 border border-purple-200 text-purple-700" :
              modeColor === "text-indigo-700" ? "bg-indigo-50 border border-indigo-200 text-indigo-700" :
              "bg-green-50 border border-green-200 text-green-700"
            }`}>
              {modeLabel}
            </div>
            {lines.length === 0 ? (
              <p className="text-xs text-gray-400">无其他详细信息。</p>
            ) : (
              <div className="space-y-1">
                {lines.map((l, i) => (
                  <div key={i} className="flex gap-1.5 text-xs">
                    <span className="text-gray-400 shrink-0">{l.label}：</span>
                    <span className="text-gray-700 break-all">{l.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}