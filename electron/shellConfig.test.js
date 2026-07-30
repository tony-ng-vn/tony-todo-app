import { describe, expect, it } from 'vitest';
import { isSafeExternalUrl, positionPopover, resolveMenubarUrl } from './shellConfig.js';

describe('menu bar shell configuration', () => {
  it('loads the deployed compact route by default', () => {
    expect(resolveMenubarUrl({})).toBe('https://tony-todo-app.vercel.app/menubar');
  });

  it('accepts a local development route override', () => {
    expect(
      resolveMenubarUrl({
        DONE_LOG_MENUBAR_URL: 'http://127.0.0.1:5176/menubar?local=1',
      }),
    ).toBe('http://127.0.0.1:5176/menubar?local=1');
  });

  it('rejects non-web route overrides and external targets', () => {
    expect(resolveMenubarUrl({ DONE_LOG_MENUBAR_URL: 'file:///tmp/menubar.html' })).toBe(
      'https://tony-todo-app.vercel.app/menubar',
    );
    expect(isSafeExternalUrl('https://example.com/task')).toBe(true);
    expect(isSafeExternalUrl('http://127.0.0.1:5176/')).toBe(true);
    expect(isSafeExternalUrl('file:///tmp/secret')).toBe(false);
    expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false);
  });

  it('centers the popover under the tray icon and keeps it on screen', () => {
    const workArea = { x: 0, y: 24, width: 1440, height: 876 };
    const windowBounds = { width: 420, height: 640 };

    expect(
      positionPopover(
        { x: 900, y: 0, width: 24, height: 24 },
        windowBounds,
        workArea,
      ),
    ).toEqual({ x: 702, y: 24 });

    expect(
      positionPopover(
        { x: 1400, y: 0, width: 24, height: 24 },
        windowBounds,
        workArea,
      ),
    ).toEqual({ x: 1020, y: 24 });
  });

  it('anchors at the work area origin when the display is smaller than the popover', () => {
    expect(
      positionPopover(
        { x: -50, y: 0, width: 24, height: 24 },
        { width: 420, height: 640 },
        { x: -300, y: 24, width: 300, height: 500 },
      ),
    ).toEqual({ x: -300, y: 24 });
  });
});
