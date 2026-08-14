export const NATIVE_UPDATE_MESSAGE = 'doneLogUpdater';
export const BOOTSTRAP_DOWNLOAD_URL =
  'https://github.com/tony-ng-vn/tony-todo-app/releases/latest/download/Done-Log.dmg';

export function resolveUpdateAction({
  isNativeHost,
  isLegacyNativeHost,
  hasNativeUpdater,
  bootstrapAvailable = false,
  webUpdateAvailable,
}) {
  if (isNativeHost && hasNativeUpdater) {
    return {
      kind: 'native-check',
      label: 'Check for updates',
      title: 'Check for and install a complete Daymark update',
      isAvailable: false,
    };
  }

  if (bootstrapAvailable && (isLegacyNativeHost || (isNativeHost && !hasNativeUpdater))) {
    return {
      kind: 'legacy-bootstrap',
      label: 'Install desktop update',
      title: 'Download the first Daymark release with complete app updates',
      isAvailable: true,
    };
  }

  return {
    kind: 'web-reload',
    label: webUpdateAvailable ? 'Reload latest' : 'Reload',
    title: webUpdateAvailable ? 'Reload the latest Daymark website' : 'Reload Daymark',
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
