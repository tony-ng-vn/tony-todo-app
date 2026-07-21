// Single source of truth for the workspace views. Kept out of +page.svelte so
// the fallback logic (loadViewMode, setViewMode) is unit-testable.
export const VIEW_MODES = [
  'flow',
  'board',
  'calendar',
  'inbox',
  'waiting',
  'history',
  'meetings',
  'profile',
  'settings',
];

export function normalizeViewMode(value) {
  return VIEW_MODES.includes(value) ? value : 'flow';
}
