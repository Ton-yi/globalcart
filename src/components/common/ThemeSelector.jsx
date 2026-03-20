/**
 * ThemeSelector - Reusable theme switcher component
 * compact: boolean - show only icons without labels (for header/home use)
 */
import { useState } from "react";
import { Moon, Sun, Palette } from "lucide-react";
import { THEMES, getTheme, setTheme } from "@/lib/theme";

// Two-theme toggle: only switches between "default" and "midnight"
export function MidnightToggle() {
  const [current, setCurrent] = useState(getTheme);
  const isMidnight = current === "midnight";

  const toggle = () => {
    const next = isMidnight ? "default" : "midnight";
    setTheme(next);
    setCurrent(next);
  };

  return (
    <button
      onClick={toggle}
      title={isMidnight ? "切换到默认主题" : "切换到午夜主题"}
      className="p-1.5 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
    >
      {isMidnight
        ? <Sun className="w-4 h-4" />
        : <Moon className="w-4 h-4" />
      }
    </button>
  );
}

export default function ThemeSelector({ compact = false }) {
  const [current, setCurrent] = useState(getTheme);

  const handleSelect = (id) => {
    setTheme(id);
    setCurrent(id);
  };

  if (compact) {
    return <MidnightToggle />;
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