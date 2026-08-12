export const THEME_STORAGE_KEY = 'done-log-theme';

export function resolveThemeMode(storedTheme, prefersDark) {
  if (storedTheme === 'light' || storedTheme === 'dark') {
    return storedTheme;
  }
  return prefersDark ? 'dark' : 'light';
}

export function nextThemeMode(themeMode) {
  return themeMode === 'dark' ? 'light' : 'dark';
}

export function loadThemeMode() {
  return resolveThemeMode(
    localStorage.getItem(THEME_STORAGE_KEY),
    window.matchMedia('(prefers-color-scheme: dark)').matches,
  );
}

export function applyThemeMode(themeMode) {
  document.documentElement.dataset.theme = themeMode;
  localStorage.setItem(THEME_STORAGE_KEY, themeMode);
}
