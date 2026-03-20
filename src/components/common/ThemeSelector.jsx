/**
 * ThemeSelector - Reusable theme switcher component
 * compact: boolean - show only icons without labels (for header/home use)
 */
import { useState } from "react";
import { Palette } from "lucide-react";
import { THEMES, getTheme, setTheme } from "@/lib/theme";

export default function ThemeSelector({ compact = false }) {
  const [current, setCurrent] = useState(getTheme);

  const handleSelect = (id) => {
    setTheme(id);
    setCurrent(id);
  };

  if (compact) {
    // Simple cycle button for home / header
    const idx = THEMES.findIndex(t => t.id === current);
    const next = THEMES[(idx + 1) % THEMES.length];
    const theme = THEMES.find(t => t.id === current);

    return (
      <button
        onClick={() => handleSelect(next.id)}
        title={`当前：${theme?.name}，点击切换到 ${next.name}`}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent transition-colors text-xs"
      >
        <span className="flex gap-0.5">
          {(theme?.preview || []).map((c, i) => (
            <span key={i} className="w-2.5 h-2.5 rounded-full border border-black/10" style={{ backgroundColor: c }} />
          ))}
        </span>
        <span className="hidden sm:inline">{theme?.name}</span>
        <Palette className="w-3 h-3" />
      </button>
    );
  }

  // Full grid for settings pages
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {THEMES.map(t => (
        <button
          key={t.id}
          onClick={() => handleSelect(t.id)}
          className={`flex flex-col gap-2 p-3 rounded-xl border-2 text-left transition-all hover:shadow-md ${
            current === t.id
              ? "border-primary bg-accent"
              : "border-border bg-card hover:border-muted-foreground/40"
          }`}
        >
          {/* Color swatches */}
          <div className="flex gap-1.5">
            {t.preview.map((c, i) => (
              <span
                key={i}
                className="w-5 h-5 rounded-full border border-black/10 shadow-sm"
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-foreground">{t.name}</span>
              {current === t.id && (
                <span className="text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">当前</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
          </div>
        </button>
      ))}
    </div>
  );
}