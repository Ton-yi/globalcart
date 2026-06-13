import { useState, useEffect, useRef, useCallback } from "react";
import { Megaphone, X, ChevronLeft, ChevronRight, Check } from "lucide-react";

const TYPE_STYLES = {
  urgent:  { bar: "bg-red-600 text-white",    dot: "bg-red-300",    badge: "bg-red-700" },
  warning: { bar: "bg-amber-500 text-white",  dot: "bg-amber-300",  badge: "bg-amber-600" },
  success: { bar: "bg-green-600 text-white",  dot: "bg-green-300",  badge: "bg-green-700" },
  info:    { bar: "bg-blue-600 text-white",   dot: "bg-blue-300",   badge: "bg-blue-700" },
};

const TYPE_LABELS = {
  urgent: "紧急", warning: "注意", success: "通知", info: "公告",
};

// LocalStorage key for tracking dismissed announcements
const DISMISSED_KEY = "announcement_dismissed";

function getDismissed() {
  try { return JSON.parse(localStorage.getItem(DISMISSED_KEY) || "{}"); } catch { return {}; }
}

function setDismissed(id, version) {
  const d = getDismissed();
  d[id] = version || "1";
  localStorage.setItem(DISMISSED_KEY, JSON.stringify(d));
}

function isDismissed(ann) {
  if (!ann.dismissible) return false;
  const d = getDismissed();
  const key = d[ann.id];
  if (!key) return false;
  // If admin updated dismissed_version, user needs to see it again
  const currentVersion = ann.dismissed_version || "1";
  return key === currentVersion;
}

/**
 * AnnouncementTicker - renders a horizontal ticker bar for a list of announcements
 * Supports: auto-rotate with configurable interval, dismissible confirm, prev/next navigation
 */
export default function AnnouncementTicker({ announcements = [] }) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [localDismissed, setLocalDismissed] = useState({});
  const timerRef = useRef(null);

  // Re-check dismissed state on mount
  useEffect(() => {
    setLocalDismissed(getDismissed());
  }, []);

  const active = announcements.filter(a =>
    a.is_active !== false && !isDismissed({ ...a, dismissible: a.dismissible })
  ).filter(a => {
    // Re-filter using localDismissed state for reactivity
    if (!a.dismissible) return true;
    const version = a.dismissed_version || "1";
    return localDismissed[a.id] !== version;
  });

  // Get interval from first announcement (all same-position anns share interval setting)
  const intervalSec = Math.max(2, Number(active[0]?.ticker_interval) || 5);

  // Auto-rotate
  useEffect(() => {
    if (active.length <= 1 || paused) {
      clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setCurrent(c => (c + 1) % active.length);
    }, intervalSec * 1000);
    return () => clearInterval(timerRef.current);
  }, [active.length, paused, intervalSec]);

  // Reset current index when active list shrinks
  useEffect(() => {
    if (current >= active.length && active.length > 0) {
      setCurrent(0);
    }
  }, [active.length, current]);

  if (active.length === 0) return null;

  const ann = active[Math.min(current, active.length - 1)];
  const style = TYPE_STYLES[ann.type] || TYPE_STYLES.info;
  const label = TYPE_LABELS[ann.type] || "公告";

  const prev = () => setCurrent(c => (c - 1 + active.length) % active.length);
  const next = () => setCurrent(c => (c + 1) % active.length);

  const handleDismiss = () => {
    setDismissed(ann.id, ann.dismissed_version || "1");
    setLocalDismissed(getDismissed());
  };

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 text-sm select-none ${style.bar}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Icon + type badge */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <Megaphone className="w-3.5 h-3.5 opacity-90" />
        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${style.badge} opacity-90`}>{label}</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          {ann.title && (
            <span className="font-semibold whitespace-nowrap flex-shrink-0">{ann.title}：</span>
          )}
          <span className="truncate opacity-90">{ann.content}</span>
        </div>
      </div>

      {/* Multi-item navigation */}
      {active.length > 1 && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={prev} className="p-0.5 rounded hover:opacity-70 transition-opacity">
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs opacity-70 tabular-nums">{current + 1}/{active.length}</span>
          <button onClick={next} className="p-0.5 rounded hover:opacity-70 transition-opacity">
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <div className="flex gap-1 ml-1">
            {active.map((_, i) => (
              <button key={i} onClick={() => setCurrent(i)}
                className={`w-1.5 h-1.5 rounded-full transition-opacity ${style.dot} ${i === current ? "opacity-100" : "opacity-40"}`} />
            ))}
          </div>
        </div>
      )}

      {/* Dismissible confirm button */}
      {ann.dismissible && (
        <button onClick={handleDismiss}
          className="flex items-center gap-1 text-xs px-2 py-0.5 rounded border border-white/40 hover:bg-white/20 transition-colors flex-shrink-0">
          <Check className="w-3 h-3" />已知晓
        </button>
      )}

      {/* Close (non-persistent, session only) */}
      {!ann.dismissible && (
        <button onClick={() => setCurrent(c => c)} className="hidden" />
      )}
    </div>
  );
}