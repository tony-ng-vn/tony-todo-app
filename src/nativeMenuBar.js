export const NATIVE_MENU_BAR_MESSAGE = 'doneLogMenuBar';

function getNativeMenuBarHandler(targetWindow) {
  return targetWindow?.webkit?.messageHandlers?.[NATIVE_MENU_BAR_MESSAGE];
}

export function canShowNativeMenuBar(targetWindow) {
  const handler = getNativeMenuBarHandler(targetWindow);
  return Boolean(targetWindow?.__doneLogCanShowMenuBar && handler?.postMessage);
}

export function requestNativeMenuBar(targetWindow) {
  if (!canShowNativeMenuBar(targetWindow)) {
    return false;
  }

  getNativeMenuBarHandler(targetWindow).postMessage({ command: 'show' });
  return true;
}
