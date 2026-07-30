import { describe, expect, it } from 'vitest';
import { VIEW_MODES, WORKSPACE_TABS, normalizeViewMode } from './viewModes.js';

describe('view modes', () => {
  it('keeps settings and removes the duplicate profile view', () => {
    expect(VIEW_MODES).toContain('settings');
    expect(VIEW_MODES).not.toContain('profile');
  });

  it('uses the same view definitions for routing and navigation', () => {
    expect(WORKSPACE_TABS.map((tab) => tab.id)).toEqual(VIEW_MODES);
  });

  it('keeps a known view mode unchanged', () => {
    expect(normalizeViewMode('board')).toBe('board');
    expect(normalizeViewMode('settings')).toBe('settings');
  });

  it('migrates a saved profile view to settings', () => {
    expect(normalizeViewMode('profile')).toBe('settings');
  });

  it('falls back to flow for anything unknown', () => {
    expect(normalizeViewMode('nope')).toBe('flow');
    expect(normalizeViewMode(null)).toBe('flow');
    expect(normalizeViewMode(undefined)).toBe('flow');
  });
});
