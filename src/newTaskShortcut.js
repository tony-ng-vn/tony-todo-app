export function isApplePlatform() {
  if (typeof navigator === 'undefined') {
    return false;
  }

  const platform = navigator.userAgentData?.platform ?? navigator.platform ?? '';
  return /Mac|iPhone|iPad/i.test(platform);
}

// Cmd+N on Apple platforms, Ctrl+N elsewhere. Ctrl+N is a caret-movement
// binding inside macOS text fields, so it must not open the composer there.
export function isNewTaskShortcut(event) {
  if (event.repeat || event.isComposing || event.altKey || event.shiftKey) {
    return false;
  }

  if (event.key.toLowerCase() !== 'n') {
    return false;
  }

  return isApplePlatform() ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
}

export function newTaskShortcutLabel() {
  return isApplePlatform() ? 'Cmd N' : 'Ctrl N';
}
