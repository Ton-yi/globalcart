/**
 * Theme manager - supports multiple themes
 * Themes: "default", "midnight", "rose", "forest", "ocean"
 */

const THEME_KEY = "app_theme";

export const THEMES = [
  {
    id: "default",
    name: "默认",
    nameEn: "Default",
    description: "简洁白色主题",
    preview: ["#ffffff", "#f3f4f6", "#dc2626"],
  },
  {
    id: "midnight",
    name: "午夜",
    nameEn: "Midnight",
    description: "深邃蓝黑配色",
    preview: ["#0d1117", "#161b22", "#3b82f6"],
  },
  {
    id: "rose",
    name: "玫瑰",
    nameEn: "Rose",
    description: "温柔粉红调",
    preview: ["#fff1f2", "#ffe4e6", "#e11d48"],
  },
  {
    id: "forest",
    name: "森林",
    nameEn: "Forest",
    description: "沉稳绿色系",
    preview: ["#f0fdf4", "#dcfce7", "#16a34a"],
  },
  {
    id: "ocean",
    name: "海洋",
    nameEn: "Ocean",
    description: "清爽蓝绿调",
    preview: ["#f0f9ff", "#e0f2fe", "#0284c7"],
  },
];

export function getTheme() {
  return localStorage.getItem(THEME_KEY) || "default";
}

export function setTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
}

export function applyTheme(theme) {
  // Remove all theme classes
  THEMES.forEach(t => {
    if (t.id !== "default") {
      document.documentElement.classList.remove(t.id);
    }
  });
  // Apply new theme
  if (theme !== "default") {
    document.documentElement.classList.add(theme);
  }
}

export function initTheme() {
  applyTheme(getTheme());
}