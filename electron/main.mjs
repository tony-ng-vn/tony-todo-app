import { Buffer } from 'node:buffer';
import { app, BrowserWindow, Menu, nativeImage, screen, session, shell, Tray } from 'electron';
import { isSafeExternalUrl, positionPopover, resolveMenubarUrl } from './shellConfig.js';

const POPOVER_WIDTH = 420;
const POPOVER_HEIGHT = 640;
const isSmokeCheck = process.env.MENUBAR_SHELL_SMOKE === '1';
const menubarUrl = resolveMenubarUrl();

let popoverWindow = null;
let tray = null;
let smokeFinished = false;
let smokeTimer = null;

app.setName('Done Log');

if (!app.requestSingleInstanceLock()) {
  if (isSmokeCheck) {
    process.stderr.write('MENUBAR_SHELL_FAILED another Done Log instance is running\n');
    app.exit(1);
  } else {
    app.quit();
  }
}

app.on('second-instance', () => {
  showPopover();
});

app.whenReady().then(() => {
  app.dock?.hide();
  denyRemotePermissions();
  createPopover();
  createTray();
});

app.on('activate', () => {
  showPopover();
});

app.on('window-all-closed', () => {
  // The tray owns the app lifecycle on macOS.
});

function createPopover() {
  popoverWindow = new BrowserWindow({
    width: POPOVER_WIDTH,
    height: POPOVER_HEIGHT,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    roundedCorners: true,
    vibrancy: 'under-window',
    visualEffectState: 'active',
    backgroundColor: '#00000000',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  popoverWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  popoverWindow.setAlwaysOnTop(true, 'pop-up-menu');
  configureSmokeCheck();
  popoverWindow.loadURL(menubarUrl).catch((error) => {
    if (isSmokeCheck) {
      finishSmokeCheck(1, `MENUBAR_SHELL_FAILED ${error.message}`);
    } else {
      process.stderr.write(`Failed to load menu bar route: ${error.message}\n`);
    }
  });
  popoverWindow.on('blur', () => {
    if (!isSmokeCheck && !popoverWindow.webContents.isDevToolsOpened()) {
      popoverWindow.hide();
    }
  });

  popoverWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternalUrl(url);
    return { action: 'deny' };
  });
  popoverWindow.webContents.on('will-attach-webview', (event) => {
    event.preventDefault();
  });
  popoverWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== menubarUrl) {
      event.preventDefault();
      openExternalUrl(url);
    }
  });
}

function createTray() {
  tray = new Tray(createTrayIcon());
  tray.setToolTip('Done Log');
  tray.on('click', togglePopover);
  tray.on('right-click', () => {
    tray.popUpContextMenu(
      Menu.buildFromTemplate([
        { label: 'Open Done Log', click: () => openExternalUrl(new URL('/', menubarUrl).toString()) },
        { type: 'separator' },
        { label: 'Quit', role: 'quit' },
      ]),
    );
  });
}

function denyRemotePermissions() {
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
  session.defaultSession.setDevicePermissionHandler(() => false);
}

function configureSmokeCheck() {
  if (!isSmokeCheck) {
    return;
  }

  smokeTimer = setTimeout(() => {
    finishSmokeCheck(1, 'MENUBAR_SHELL_FAILED timed out while loading');
  }, 15000);

  popoverWindow.webContents.once('did-finish-load', () => {
    finishSmokeCheck(0, 'MENUBAR_SHELL_READY');
  });
  popoverWindow.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedUrl, isMainFrame) => {
      if (isMainFrame) {
        finishSmokeCheck(
          1,
          `MENUBAR_SHELL_FAILED ${errorCode} ${errorDescription} ${validatedUrl}`,
        );
      }
    },
  );
}

function finishSmokeCheck(exitCode, message) {
  if (!isSmokeCheck || smokeFinished) {
    return;
  }

  smokeFinished = true;
  clearTimeout(smokeTimer);
  const stream = exitCode === 0 ? process.stdout : process.stderr;
  stream.write(`${message}\n`);
  setTimeout(() => app.exit(exitCode), exitCode === 0 ? 250 : 0);
}

function openExternalUrl(url) {
  if (isSafeExternalUrl(url)) {
    void shell.openExternal(url);
  }
}

function createTrayIcon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
      <circle cx="18" cy="18" r="13" fill="none" stroke="black" stroke-width="3"/>
      <path d="M11 18.5l4.5 4.5L25 13.5" fill="none" stroke="black" stroke-width="3"
        stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
  const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  const icon = nativeImage.createFromDataURL(dataUrl).resize({ width: 18, height: 18 });
  icon.setTemplateImage(true);
  return icon;
}

function togglePopover() {
  if (popoverWindow.isVisible()) {
    popoverWindow.hide();
    return;
  }

  showPopover();
}

function showPopover() {
  if (!popoverWindow || !tray) {
    return;
  }

  const trayBounds = tray.getBounds();
  const windowBounds = popoverWindow.getBounds();
  const trayCenter = {
    x: Math.round(trayBounds.x + trayBounds.width / 2),
    y: Math.round(trayBounds.y + trayBounds.height / 2),
  };
  const display = screen.getDisplayNearestPoint(trayCenter);
  const position = positionPopover(trayBounds, windowBounds, display.workArea);
  popoverWindow.setPosition(position.x, position.y, false);
  popoverWindow.show();
  popoverWindow.focus();
}
