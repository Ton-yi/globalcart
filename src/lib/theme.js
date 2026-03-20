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
    id: "darkmoss",
    name: "暗苔",
    nameEn: "Dark Moss",
    description: "墨黑底·翠绿辉光",
    preview: ["#0d1117", "#161b22", "#15df6b"],
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