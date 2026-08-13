import { describe, expect, it } from 'vitest';
import {
  NATIVE_WINDOW_DRAG_SELECTOR,
  NATIVE_WINDOW_NO_DRAG_SELECTOR,
  installNativeWindowChrome,
  isNativeWindowDragTarget,
} from './nativeWindowChrome.js';

function element(hits) {
  return {
    closest(selector) {
      return hits[selector] ? {} : null;
    },
  };
}

describe('native window chrome', () => {
  it('treats empty header rows as drag and zoom targets', () => {
    expect(
      isNativeWindowDragTarget(
        element({
          [NATIVE_WINDOW_DRAG_SELECTOR]: true,
          [NATIVE_WINDOW_NO_DRAG_SELECTOR]: false,
        }),
      ),
    ).toBe(true);
  });

  it('keeps buttons and header actions clickable', () => {
    expect(
      isNativeWindowDragTarget(
        element({
          [NATIVE_WINDOW_DRAG_SELECTOR]: true,
          [NATIVE_WINDOW_NO_DRAG_SELECTOR]: true,
        }),
      ),
    ).toBe(false);
    expect(isNativeWindowDragTarget(null)).toBe(false);
    expect(isNativeWindowDragTarget({})).toBe(false);
  });

  it('asks the native shell to zoom on a header double-click', () => {
    const listeners = new Map();
    const posted = [];
    const targetWindow = {
      document: {
        addEventListener(type, handler) {
          listeners.set(type, handler);
        },
      },
      webkit: {
        messageHandlers: {
          doneLogWindow: {
            postMessage(payload) {
              posted.push(payload);
            },
          },
        },
      },
    };

    installNativeWindowChrome(targetWindow);
    installNativeWindowChrome(targetWindow);
    listeners.get('dblclick')({
      target: element({
        [NATIVE_WINDOW_DRAG_SELECTOR]: true,
        [NATIVE_WINDOW_NO_DRAG_SELECTOR]: false,
      }),
    });
    listeners.get('dblclick')({
      target: element({
        [NATIVE_WINDOW_DRAG_SELECTOR]: true,
        [NATIVE_WINDOW_NO_DRAG_SELECTOR]: true,
      }),
    });

    expect(posted).toEqual([{ command: 'zoom' }]);
  });
});
