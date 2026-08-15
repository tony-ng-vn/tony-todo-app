import { describe, expect, it, vi } from 'vitest';
import {
  canShowNativeMenuBar,
  requestNativeMenuBar,
  returnToNativeMenuBar,
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

  it('requests the mini todo popover and then closes the current quick note', () => {
    const postMessage = vi.fn();
    const closeNote = vi.fn();
    const targetWindow = {
      __doneLogCanShowMenuBar: true,
      webkit: { messageHandlers: { doneLogMenuBar: { postMessage } } },
    };

    expect(returnToNativeMenuBar(targetWindow, closeNote)).toBe(true);
    expect(postMessage).toHaveBeenCalledWith({ command: 'show' });
    expect(closeNote).toHaveBeenCalledTimes(1);
    expect(postMessage.mock.invocationCallOrder[0]).toBeLessThan(
      closeNote.mock.invocationCallOrder[0],
    );
  });

  it('does not close the note when native mini todos are unavailable', () => {
    const closeNote = vi.fn();

    expect(returnToNativeMenuBar({}, closeNote)).toBe(false);
    expect(closeNote).not.toHaveBeenCalled();
  });

  it('does nothing outside the supported native quick note', () => {
    expect(requestNativeMenuBar({})).toBe(false);
  });
});
