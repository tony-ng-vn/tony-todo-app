import { describe, expect, it, vi } from 'vitest';
import {
  BOOTSTRAP_DOWNLOAD_URL,
  requestNativeUpdate,
  resolveUpdateAction,
} from './appUpdate.js';

describe('resolveUpdateAction', () => {
  it('gives a current native host the complete app updater', () => {
    expect(
      resolveUpdateAction({
        isNativeHost: true,
        isLegacyNativeHost: false,
        hasNativeUpdater: true,
        webUpdateAvailable: true,
      }),
    ).toMatchObject({ kind: 'native-check', label: 'Check for updates' });
  });

  it('sends a legacy native host to the bootstrap release', () => {
    expect(
      resolveUpdateAction({
        isNativeHost: false,
        isLegacyNativeHost: true,
        hasNativeUpdater: false,
        webUpdateAvailable: false,
      }),
    ).toMatchObject({ kind: 'legacy-bootstrap', label: 'Install desktop update' });
    expect(BOOTSTRAP_DOWNLOAD_URL).toMatch(/releases\/latest\/download\/Done-Log\.dmg$/);
  });

  it('bootstraps an older host that predates the updater bridge', () => {
    expect(
      resolveUpdateAction({
        isNativeHost: true,
        isLegacyNativeHost: false,
        hasNativeUpdater: false,
        webUpdateAvailable: true,
      }),
    ).toMatchObject({ kind: 'legacy-bootstrap', label: 'Install desktop update' });
  });

  it('keeps website reloads separate from desktop updates', () => {
    expect(
      resolveUpdateAction({
        isNativeHost: false,
        isLegacyNativeHost: false,
        hasNativeUpdater: false,
        webUpdateAvailable: true,
      }),
    ).toMatchObject({ kind: 'web-reload', label: 'Reload latest', isAvailable: true });
  });
});

describe('requestNativeUpdate', () => {
  it('posts only the narrow native update command', () => {
    const postMessage = vi.fn();
    const targetWindow = {
      __doneLogNativeUpdater: true,
      webkit: { messageHandlers: { doneLogUpdater: { postMessage } } },
    };

    expect(requestNativeUpdate(targetWindow)).toBe(true);
    expect(postMessage).toHaveBeenCalledWith({ command: 'check' });
  });

  it('does nothing when the native updater is unavailable', () => {
    expect(requestNativeUpdate({})).toBe(false);
  });
});
