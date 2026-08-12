import { describe, expect, it } from 'vitest';
import { nextThemeMode, resolveThemeMode } from './theme.js';

describe('theme mode', () => {
  it('keeps a saved light or dark choice', () => {
    expect(resolveThemeMode('light', true)).toBe('light');
    expect(resolveThemeMode('dark', false)).toBe('dark');
  });

  it('falls back to the system preference', () => {
    expect(resolveThemeMode(null, true)).toBe('dark');
    expect(resolveThemeMode('unknown', false)).toBe('light');
  });

  it('switches between light and dark', () => {
    expect(nextThemeMode('light')).toBe('dark');
    expect(nextThemeMode('dark')).toBe('light');
  });
});
