export const NATIVE_WINDOW_DRAG_SELECTOR =
  '.brand-row, .board-header, .panel-heading, .summary-top, .detail-header';

export const NATIVE_WINDOW_NO_DRAG_SELECTOR = [
  'button',
  'a',
  'input',
  'textarea',
  'select',
  'label',
  'option',
  '[role="button"]',
  '[role="tab"]',
  '[contenteditable="true"]',
  '.header-actions',
  '.board-header-actions',
  '.theme-toggle',
  '.calendar-picker',
  '.view-toggle',
  '.summary-date-navigation',
  '.detail-window-actions',
].join(', ');

export function isNativeWindowDragTarget(target) {
  if (target == null || typeof target.closest !== 'function') {
    return false;
  }

  if (target.closest(NATIVE_WINDOW_NO_DRAG_SELECTOR)) {
    return false;
  }

  return Boolean(target.closest(NATIVE_WINDOW_DRAG_SELECTOR));
}

export function installNativeWindowChrome(targetWindow = globalThis) {
  const documentRef = targetWindow?.document;
  if (!documentRef || targetWindow.__doneLogNativeWindowChromeInstalled) {
    return;
  }

  targetWindow.__doneLogNativeWindowChromeInstalled = true;
  if (!targetWindow.__doneLogNativeDragInstalled) {
    targetWindow.__doneLogNativeDragInstalled = true;
    documentRef.addEventListener('mousedown', (event) => {
      if (event.button !== 0 || !isNativeWindowDragTarget(event.target)) {
        return;
      }

      event.preventDefault?.();
      targetWindow.webkit?.messageHandlers?.doneLogWindow?.postMessage({
        command: 'drag',
      });
    });
  }
  documentRef.addEventListener('dblclick', (event) => {
    if (!isNativeWindowDragTarget(event.target)) {
      return;
    }

    targetWindow.webkit?.messageHandlers?.doneLogWindow?.postMessage({
      command: 'zoom',
    });
  });
}
