import { afterEach, describe, expect, it, vi } from 'vitest';
import { isApplePlatform, isNewTaskShortcut, newTaskShortcutLabel } from './newTaskShortcut.js';

function stubNavigator(value) {
  vi.stubGlobal('navigator', value);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

function keydown(overrides = {}) {
  return {
    key: 'n',
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    repeat: false,
    isComposing: false,
    ...overrides,
  };
}

describe('isApplePlatform', () => {
  it('prefers the user-agent client hints platform', () => {
    stubNavigator({ userAgentData: { platform: 'macOS' }, platform: 'Linux x86_64' });
    expect(isApplePlatform()).toBe(true);
  });

  it('falls back to navigator.platform', () => {
    stubNavigator({ platform: 'MacIntel' });
    expect(isApplePlatform()).toBe(true);
    stubNavigator({ platform: 'Win32' });
    expect(isApplePlatform()).toBe(false);
  });

  it('is false without a navigator', () => {
    stubNavigator(undefined);
    expect(isApplePlatform()).toBe(false);
  });
});

describe('isNewTaskShortcut', () => {
  it('uses Cmd+N on Apple platforms and ignores Ctrl+N there', () => {
    stubNavigator({ platform: 'MacIntel' });
    expect(isNewTaskShortcut(keydown({ metaKey: true }))).toBe(true);
    expect(isNewTaskShortcut(keydown({ key: 'N', metaKey: true }))).toBe(true);
    // Ctrl+N moves the caret in macOS text fields; leave it alone.
    expect(isNewTaskShortcut(keydown({ ctrlKey: true }))).toBe(false);
  });

  it('uses Ctrl+N elsewhere and ignores Meta+N there', () => {
    stubNavigator({ platform: 'Win32' });
    expect(isNewTaskShortcut(keydown({ ctrlKey: true }))).toBe(true);
    expect(isNewTaskShortcut(keydown({ metaKey: true }))).toBe(false);
  });

  it('rejects other modifiers, held keys, and IME composition', () => {
    stubNavigator({ platform: 'Win32' });
    expect(isNewTaskShortcut(keydown({ ctrlKey: true, shiftKey: true }))).toBe(false);
    expect(isNewTaskShortcut(keydown({ ctrlKey: true, altKey: true }))).toBe(false);
    expect(isNewTaskShortcut(keydown({ ctrlKey: true, repeat: true }))).toBe(false);
    expect(isNewTaskShortcut(keydown({ ctrlKey: true, isComposing: true }))).toBe(false);
    expect(isNewTaskShortcut(keydown({ ctrlKey: true, key: 'm' }))).toBe(false);
  });
});

describe('newTaskShortcutLabel', () => {
  it('names the modifier for the platform', () => {
    stubNavigator({ platform: 'MacIntel' });
    expect(newTaskShortcutLabel()).toBe('Cmd N');
    stubNavigator({ platform: 'Win32' });
    expect(newTaskShortcutLabel()).toBe('Ctrl N');
  });
});
