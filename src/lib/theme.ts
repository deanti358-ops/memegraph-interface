export type Theme = "dark" | "light";

const KEY = "mg-theme";

export function initTheme(): Theme {
  const saved = (localStorage.getItem(KEY) as Theme | null) ?? "dark";
  document.documentElement.dataset.theme = saved;
  return saved;
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(KEY, theme);
}
