export const NATIVE_UPDATE_MESSAGE = 'doneLogUpdater';
export const BOOTSTRAP_DOWNLOAD_URL =
  'https://github.com/tony-ng-vn/tony-todo-app/releases/latest/download/Done-Log.dmg';

export function resolveUpdateAction({
  isNativeHost,
  isLegacyNativeHost,
  hasNativeUpdater,
  webUpdateAvailable,
}) {
  if (isNativeHost && hasNativeUpdater) {
    return {
      kind: 'native-check',
      label: 'Check for updates',
      title: 'Check for and install a complete Done Log update',
      isAvailable: false,
    };
  }

  if (isLegacyNativeHost || (isNativeHost && !hasNativeUpdater)) {
    return {
      kind: 'legacy-bootstrap',
      label: 'Install desktop update',
      title: 'Download the first Done Log release with complete app updates',
      isAvailable: true,
    };
  }

  return {
    kind: 'web-reload',
    label: webUpdateAvailable ? 'Reload latest' : 'Reload',
    title: webUpdateAvailable ? 'Reload the latest Done Log website' : 'Reload Done Log',
    isAvailable: webUpdateAvailable,
  };
}

export function requestNativeUpdate(targetWindow) {
  const handler = targetWindow?.webkit?.messageHandlers?.[NATIVE_UPDATE_MESSAGE];
  if (!targetWindow?.__doneLogNativeUpdater || !handler?.postMessage) {
    return false;
  }

  handler.postMessage({ command: 'check' });
  return true;
}
