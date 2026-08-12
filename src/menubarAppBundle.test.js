import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('menu bar app bundle', () => {
  it('declares a menu bar macOS app bundle', () => {
    const plist = readFileSync(path.join(repoRoot, 'native/App/Info.plist'), 'utf8');
    const packageJson = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));

    expect(plist).toContain('<string>com.tonynguyen.donelog</string>');
    expect(plist).toContain('<string>done-log-menubar</string>');
    expect(plist).toMatch(/<key>LSUIElement<\/key>\s*<true\/>/);
    expect(plist).toMatch(/<key>LSMinimumSystemVersion<\/key>\s*<string>14\.0<\/string>/);
    expect(plist).toMatch(
      new RegExp(
        `<key>CFBundleShortVersionString<\\/key>\\s*<string>${packageJson.version}<\\/string>`,
      ),
    );
  });

  it('exposes bundle and install commands', () => {
    const packageJson = JSON.parse(
      readFileSync(path.join(repoRoot, 'package.json'), 'utf8'),
    );

    expect(packageJson.scripts['menubar:bundle']).toBe('bash scripts/build-menubar-app.sh');
    expect(packageJson.scripts['menubar:install']).toBe('bash scripts/install-menubar-app.sh');
  });

  it('keeps local app identity stable when a signing certificate is available', () => {
    const buildScript = readFileSync(
      path.join(repoRoot, 'scripts/build-menubar-app.sh'),
      'utf8',
    );

    expect(buildScript).toContain('DONE_LOG_CODESIGN_IDENTITY');
    expect(buildScript).toContain('security find-identity -v -p codesigning');
    expect(buildScript).toContain('--sign "$CODE_SIGN_IDENTITY"');
  });

  it('keeps task notes in a draggable native window', () => {
    const controller = readFileSync(
      path.join(repoRoot, 'native/Sources/DoneLogMenuBar/FloatingNoteWindowController.swift'),
      'utf8',
    );

    expect(controller).toContain('NSPanel');
    expect(controller).toContain('window.level = .floating');
    expect(controller).toContain('window.isMovableByWindowBackground = true');
    expect(controller).toContain('window.contentMinSize');
    expect(controller).toContain('contentController.onCloseWindow');
  });

  it('keeps the status item visible across app replacements', () => {
    const controller = readFileSync(
      path.join(repoRoot, 'native/Sources/DoneLogMenuBar/MenuBarController.swift'),
      'utf8',
    );

    expect(controller).toContain('statusItem.autosaveName');
    expect(controller).toContain('statusItem.isVisible = true');
    expect(controller).toContain('withLength: NSStatusItem.squareLength');
  });

  it('opens the browser-sized experience in a native window', () => {
    const controller = readFileSync(
      path.join(repoRoot, 'native/Sources/DoneLogMenuBar/FullAppWindowController.swift'),
      'utf8',
    );
    const app = readFileSync(
      path.join(repoRoot, 'native/Sources/DoneLogMenuBar/DoneLogMenuBarApp.swift'),
      'utf8',
    );

    expect(controller).toContain('MenuBarConfiguration.fullAppSize');
    expect(controller).toContain('application.setActivationPolicy(.regular)');
    expect(controller).toContain('application.setActivationPolicy(.accessory)');
    expect(controller).toContain('.moveToActiveSpace');
    expect(app).toContain('NativeAppLaunchPolicy.shouldOpenFullApp');
  });

  it('keeps generated app bundles out of Spotlight-visible dist', () => {
    const builder = readFileSync(path.join(repoRoot, 'scripts/build-menubar-app.sh'), 'utf8');
    const installer = readFileSync(path.join(repoRoot, 'scripts/install-menubar-app.sh'), 'utf8');

    expect(builder).toContain('BUILD_ROOT="$REPO_ROOT/.build/app-bundle"');
    expect(installer).toContain('SOURCE_APP="$REPO_ROOT/.build/app-bundle/Done Log.app"');
    expect(builder).not.toContain('BUILD_ROOT="$REPO_ROOT/dist"');
    expect(installer).not.toContain('SOURCE_APP="$REPO_ROOT/dist/Done Log.app"');
  });

  it('installs one app and leaves startup to the user', () => {
    const installer = readFileSync(path.join(repoRoot, 'scripts/install-menubar-app.sh'), 'utf8');

    expect(installer).toContain('"$INSTALLED_BINARY" --unregister-login-item');
    expect(installer).not.toContain('"$INSTALLED_BINARY" --register-login-item');
    expect(installer).not.toContain('/usr/bin/open -n');
    expect(installer).toContain('Open it from Applications when you are ready');
  });

  it('refuses to replace a newer installed app with an older build', () => {
    const comparer = path.join(repoRoot, 'scripts/app-version-is-newer.sh');
    const installer = readFileSync(path.join(repoRoot, 'scripts/install-menubar-app.sh'), 'utf8');

    expect(spawnSync(comparer, ['0.8.0', '0.7.2']).status).toBe(0);
    expect(spawnSync(comparer, ['0.8.0', '0.8.0']).status).toBe(1);
    expect(spawnSync(comparer, ['0.7.2', '0.8.0']).status).toBe(1);
    expect(installer).toContain('app-version-is-newer.sh');
    expect(installer).toContain('refusing to replace newer Done Log');
  });

  it('marks native web views before the menu bar page loads', () => {
    const controller = readFileSync(
      path.join(repoRoot, 'native/Sources/DoneLogMenuBar/MenuBarWebViewController.swift'),
      'utf8',
    );

    expect(controller).toContain('window.__doneLogNativeHost = true');
    expect(controller).toContain('injectionTime: .atDocumentStart');
  });
});
