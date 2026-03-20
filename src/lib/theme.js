/**
 * Theme manager - supports "default" and "midnight" themes
 */

const THEME_KEY = "app_theme";

export function getTheme() {
  return localStorage.getItem(THEME_KEY) || "default";
}

export function setTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
}

export function applyTheme(theme) {
  if (theme === "midnight") {
    document.documentElement.classList.add("midnight");
  } else {
    document.documentElement.classList.remove("midnight");
  }
}

export function initTheme() {
  applyTheme(getTheme());
}