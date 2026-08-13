import { describe, expect, it, vi } from 'vitest';
import {
  canShowNativeMenuBar,
  requestNativeMenuBar,
} from './nativeMenuBar.js';

describe('native menu bar bridge', () => {
  it('shows the return action only when the native host supports it', () => {
    const targetWindow = {
      __doneLogCanShowMenuBar: true,
      webkit: { messageHandlers: { doneLogMenuBar: { postMessage: vi.fn() } } },
    };

    expect(canShowNativeMenuBar(targetWindow)).toBe(true);
    expect(canShowNativeMenuBar({})).toBe(false);
  });

  it('requests the mini todo popover without closing the quick note', () => {
    const postMessage = vi.fn();
    const close = vi.fn();
    const targetWindow = {
      close,
      __doneLogCanShowMenuBar: true,
      webkit: { messageHandlers: { doneLogMenuBar: { postMessage } } },
    };

    expect(requestNativeMenuBar(targetWindow)).toBe(true);
    expect(postMessage).toHaveBeenCalledWith({ command: 'show' });
    expect(close).not.toHaveBeenCalled();
  });

  it('does nothing outside the supported native quick note', () => {
    expect(requestNativeMenuBar({})).toBe(false);
  });
});
