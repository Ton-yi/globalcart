import { useState, useEffect, useRef } from "react";
import { Megaphone, X, ChevronLeft, ChevronRight } from "lucide-react";

const TYPE_STYLES = {
  urgent:  { bar: "bg-red-600 text-white",    dot: "bg-red-300",    badge: "bg-red-700" },
  warning: { bar: "bg-amber-500 text-white",  dot: "bg-amber-300",  badge: "bg-amber-600" },
  success: { bar: "bg-green-600 text-white",  dot: "bg-green-300",  badge: "bg-green-700" },
  info:    { bar: "bg-blue-600 text-white",   dot: "bg-blue-300",   badge: "bg-blue-700" },
};

const TYPE_LABELS = {
  urgent: "紧急", warning: "注意", success: "通知", info: "公告",
};

export default function AnnouncementTicker({ announcements = [] }) {
  const [current, setCurrent] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef(null);

  const active = announcements.filter(a => a.is_active !== false);

  // Auto-rotate every 5s when multiple - must be before any early return
  useEffect(() => {
    if (active.length <= 1 || paused || dismissed) return;
    timerRef.current = setInterval(() => {
      setCurrent(c => (c + 1) % active.length);
    }, 5000);
    return () => clearInterval(timerRef.current);
  }, [active.length, paused, dismissed]);

  if (active.length === 0 || dismissed) return null;

  const ann = active[current] || active[0];
  const style = TYPE_STYLES[ann.type] || TYPE_STYLES.info;
  const label = TYPE_LABELS[ann.type] || "公告";

  const prev = () => { setCurrent(c => (c - 1 + active.length) % active.length); };
  const next = () => { setCurrent(c => (c + 1) % active.length); };

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm select-none ${style.bar}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Icon + badge */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <Megaphone className="w-3.5 h-3.5 opacity-90" />
        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${style.badge} opacity-90`}>{label}</span>
      </div>

      {/* Text - scrolling when long */}
      <div className="flex-1 overflow-hidden">
        <div className="flex items-center gap-2 min-w-0">
          {ann.title && (
            <span className="font-semibold whitespace-nowrap flex-shrink-0">{ann.title}：</span>
          )}
          <span className="truncate opacity-90">{ann.content}</span>
        </div>
      </div>

      {/* Multi-announcement navigation */}
      {active.length > 1 && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={prev} className="p-0.5 rounded hover:opacity-70 transition-opacity">
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs opacity-70 tabular-nums">{current + 1}/{active.length}</span>
          <button onClick={next} className="p-0.5 rounded hover:opacity-70 transition-opacity">
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          {/* Dot indicators */}
          <div className="flex gap-1 ml-1">
            {active.map((_, i) => (
              <button key={i} onClick={() => setCurrent(i)}
                className={`w-1.5 h-1.5 rounded-full transition-opacity ${style.dot} ${i === current ? "opacity-100" : "opacity-40"}`} />
            ))}
          </div>
        </div>
      )}

      {/* Dismiss */}
      <button onClick={() => setDismissed(true)} className="p-0.5 rounded hover:opacity-70 flex-shrink-0 transition-opacity">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}