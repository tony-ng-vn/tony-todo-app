// Single source of truth for workspace routing and navigation.
export const WORKSPACE_TABS = [
  { id: 'flow', label: 'Tasks' },
  { id: 'projects', label: 'Projects' },
  { id: 'agenda', label: 'Agenda' },
  { id: 'board', label: 'Board' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'inbox', label: 'Inbox' },
  { id: 'waiting', label: 'Waiting' },
  { id: 'history', label: 'History' },
  { id: 'meetings', label: 'Meetings' },
  { id: 'settings', label: 'Settings' },
];

export const VIEW_MODES = WORKSPACE_TABS.map((tab) => tab.id);

export function normalizeViewMode(value) {
  if (value === 'profile') {
    return 'settings';
  }

  return VIEW_MODES.includes(value) ? value : 'flow';
}
