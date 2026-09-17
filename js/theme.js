export const THEME_KEY = "flipbook-theme";
export const THEME_COLOR_DARK = "#161614";
export const THEME_COLOR_LIGHT = "#f7f7f5";

export function getTheme() {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function applyTheme(theme) {
  const next = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  document.documentElement.style.colorScheme = next;
  localStorage.setItem(THEME_KEY, next);

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", next === "dark" ? THEME_COLOR_DARK : THEME_COLOR_LIGHT);
  }

  return next;
}

export function toggleTheme() {
  return applyTheme(getTheme() === "dark" ? "light" : "dark");
}

export function initThemeToggle(button, getLabels) {
  const sync = () => {
    const theme = getTheme();
    const labels = getLabels();
    const label = theme === "dark" ? labels.light : labels.dark;
    button.textContent = theme === "dark" ? "☀" : "☾";
    button.setAttribute("aria-label", label);
    button.title = label;
  };

  button.addEventListener("click", () => {
    toggleTheme();
    sync();
  });

  applyTheme(getTheme());
  sync();
  return sync;
}
