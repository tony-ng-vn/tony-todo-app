import { describe, expect, it } from 'vitest';
import { VIEW_MODES, normalizeViewMode } from './viewModes.js';

describe('view modes', () => {
  it('includes profile as a first-class view', () => {
    expect(VIEW_MODES).toContain('profile');
  });

  it('keeps a known view mode unchanged', () => {
    expect(normalizeViewMode('board')).toBe('board');
    expect(normalizeViewMode('profile')).toBe('profile');
  });

  it('falls back to flow for anything unknown', () => {
    expect(normalizeViewMode('nope')).toBe('flow');
    expect(normalizeViewMode(null)).toBe('flow');
    expect(normalizeViewMode(undefined)).toBe('flow');
  });
});
