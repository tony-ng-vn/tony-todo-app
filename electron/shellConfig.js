export const DEFAULT_MENUBAR_URL = 'https://tony-todo-app.vercel.app/menubar';

export function resolveMenubarUrl(environment = process.env) {
  const override = environment.DONE_LOG_MENUBAR_URL?.trim();
  return override && isSafeExternalUrl(override) ? override : DEFAULT_MENUBAR_URL;
}

export function isSafeExternalUrl(value) {
  try {
    const protocol = new URL(value).protocol;
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

export function positionPopover(trayBounds, windowBounds, workArea) {
  const centeredX = Math.round(trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2);
  const minX = workArea.x;
  const maxX = Math.max(minX, workArea.x + workArea.width - windowBounds.width);
  const x = Math.min(Math.max(centeredX, minX), maxX);
  const trayBottom = Math.round(trayBounds.y + trayBounds.height);
  const minY = workArea.y;
  const maxY = Math.max(minY, workArea.y + workArea.height - windowBounds.height);
  const y = Math.min(Math.max(trayBottom, minY), maxY);

  return { x, y };
}
