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

    expect(plist).toContain('<string>com.tonynguyen.donelog.menubar</string>');
    expect(plist).toContain('<string>done-log-menubar</string>');
    expect(plist).toMatch(/<key>LSUIElement<\/key>\s*<true\/>/);
    expect(plist).toMatch(/<key>LSMinimumSystemVersion<\/key>\s*<string>14\.0<\/string>/);
    expect(plist).toMatch(
      new RegExp(
        `<key>CFBundleShortVersionString<\\/key>\\s*<string>${packageJson.version}<\\/string>`,
      ),
    );
    expect(plist).toContain('<key>SUFeedURL</key>');
    expect(plist).toContain(
      '<string>https://github.com/tony-ng-vn/tony-todo-app/releases/latest/download/appcast.xml</string>',
    );
    expect(plist).toMatch(/<key>SUPublicEDKey<\/key>\s*<string>[^<]+<\/string>/);
    expect(plist).toMatch(/<key>SUVerifyUpdateBeforeExtraction<\/key>\s*<true\/>/);
  });

  it('links the native app to the pinned Sparkle updater', () => {
    const manifest = readFileSync(path.join(repoRoot, 'native/Package.swift'), 'utf8');

    expect(manifest).toContain('https://github.com/sparkle-project/Sparkle');
    expect(manifest).toContain('exact: "2.9.5"');
    expect(manifest).toContain('.product(name: "Sparkle", package: "Sparkle")');
  });

  it('exposes bundle and install commands', () => {
    const packageJson = JSON.parse(
      readFileSync(path.join(repoRoot, 'package.json'), 'utf8'),
    );

    expect(packageJson.scripts['menubar:bundle']).toBe('bash scripts/build-menubar-app.sh');
    expect(packageJson.scripts['menubar:install']).toBe('bash scripts/install-menubar-app.sh');
  });

  it('runs native checks through the signed app bundle identity', () => {
    const packageJson = JSON.parse(
      readFileSync(path.join(repoRoot, 'package.json'), 'utf8'),
    );

    expect(packageJson.scripts.menubar).toBe('bash scripts/run-menubar-app.sh');
    expect(packageJson.scripts['menubar:dev']).toContain('bash scripts/run-menubar-app.sh');
    expect(packageJson.scripts['menubar:check']).toContain('bash scripts/run-menubar-app.sh');
    expect(packageJson.scripts.menubar).not.toContain('swift run');
    expect(packageJson.scripts['menubar:dev']).not.toContain('swift run');
    expect(packageJson.scripts['menubar:check']).not.toContain('swift run');
  });

  it('keeps local menu bar runs off the installed app identity', () => {
    const runner = readFileSync(
      path.join(repoRoot, 'scripts/run-menubar-app.sh'),
      'utf8',
    );
    const installer = readFileSync(
      path.join(repoRoot, 'scripts/install-menubar-app.sh'),
      'utf8',
    );
    const builder = readFileSync(
      path.join(repoRoot, 'scripts/build-menubar-app.sh'),
      'utf8',
    );

    expect(runner).toContain('DONE_LOG_INSTANCE="${DONE_LOG_INSTANCE:-dev}"');
    expect(runner).toContain('com.tonynguyen.donelog.dev');
    expect(runner).not.toContain('menubar:install');
    expect(installer).toContain('unset DONE_LOG_INSTANCE');
    expect(builder).toContain('DONE_LOG_BUNDLE_IDENTIFIER');
    expect(installer).toContain('refusing to install a development Daymark');
    expect(installer).toContain('com.tonynguyen.donelog.menubar');
    expect(installer).toContain('com.tonynguyen.donelog');
    expect(installer).toContain(
      'if [[ "$SOURCE_IDENTIFIER" != "com.tonynguyen.donelog.menubar" ]]; then',
    );
    expect(installer).toContain('Sparkle.framework');
  });

  it('keeps local app identity stable when a signing certificate is available', () => {
    const buildScript = readFileSync(
      path.join(repoRoot, 'scripts/build-menubar-app.sh'),
      'utf8',
    );

    expect(buildScript).toContain('DONE_LOG_CODESIGN_IDENTITY');
    expect(buildScript).toContain('security find-identity -v -p codesigning');
    expect(buildScript).toContain('--sign "$CODE_SIGN_IDENTITY"');
    expect(buildScript).toContain('Contents/Frameworks/Sparkle.framework');
    expect(buildScript).toContain('@executable_path/../Frameworks');
    expect(buildScript).not.toContain(
      'if [[ "$CODE_SIGN_IDENTITY" != "-" ]]; then\n  /usr/bin/codesign "${SIGNING_OPTIONS[@]}"',
    );
    expect(buildScript).not.toMatch(/codesign\s+\\\n\s+--force\s+\\\n\s+--deep/);
  });

  it('publishes notarized and signed native releases', () => {
    const workflow = readFileSync(
      path.join(repoRoot, '.github/workflows/native-release.yml'),
      'utf8',
    );

    expect(workflow).toContain('xcrun notarytool submit');
    expect(workflow).toContain('xcrun stapler staple');
    expect(workflow).toContain('generate_appcast');
    expect(workflow).toContain('Curve25519.Signing.PrivateKey');
    expect(workflow).toContain('embedded Sparkle public key does not match');
    expect(workflow).toContain('sign_update');
    expect(workflow).toContain('sparkle:edSignature=');
    expect(workflow).toContain('SPARKLE_PRIVATE_KEY');
    expect(workflow).toContain('Done-Log.dmg');
    expect(workflow).toContain('appcast.xml');
    expect(workflow).toContain('fetch-depth: 0');
    expect(workflow).toContain('git merge-base --is-ancestor "$GITHUB_SHA" origin/main');
    expect(workflow).toContain('environment: native-release');
    expect(workflow).toContain('native build version must exceed the published Sparkle build');
  });

  it('keeps task notes in a draggable native window', () => {
    const controller = readFileSync(
      path.join(repoRoot, 'native/Sources/DoneLogMenuBar/FloatingNoteWindowController.swift'),
      'utf8',
    );
    const menuBarController = readFileSync(
      path.join(repoRoot, 'native/Sources/DoneLogMenuBar/MenuBarController.swift'),
      'utf8',
    );
    const note = readFileSync(
      path.join(repoRoot, 'src/lib/components/FloatingTaskNote.svelte'),
      'utf8',
    );

    expect(controller).toContain('NSPanel');
    expect(controller).toContain('window.level = .floating');
    expect(controller).toContain('window.hidesOnDeactivate = false');
    expect(controller).toContain('NativeWindowPolicy.applyChrome');
    expect(controller).toContain('usesWindowChrome: true');
    expect(controller).toContain('window.contentMinSize');
    expect(controller).toContain('contentController.onCloseWindow');
    expect(menuBarController).toContain('onShowMenuBar:');
    expect(controller).toContain('NativeMenuBarReturnPolicy.performReturn');
    expect(controller).toContain('self?.close()');
    expect(note).toContain('requestNativeMenuBar(window)');
    expect(note).toContain('Mini todos');
    expect(note).toContain('class="floating-note-header"');
  });

  it('keeps floating-note activation from opening the full app', () => {
    const policy = readFileSync(
      path.join(repoRoot, 'native/Sources/DoneLogMenuBar/NativeAppLaunchPolicy.swift'),
      'utf8',
    );
    const app = readFileSync(
      path.join(repoRoot, 'native/Sources/DoneLogMenuBar/DoneLogMenuBarApp.swift'),
      'utf8',
    );
    const noteController = readFileSync(
      path.join(repoRoot, 'native/Sources/DoneLogMenuBar/FloatingNoteWindowController.swift'),
      'utf8',
    );

    expect(policy).toContain('case floatingNoteActivation');
    expect(policy).toContain('reopenIntentRestoreNanoseconds');
    expect(app).toContain('NativeAppLaunchPolicy.reopenAction');
    expect(noteController).toContain(
      'NativeAppLaunchPolicy.withReopenIntent(.floatingNoteActivation)',
    );
    expect(noteController).toContain('makeKeyAndOrderFront');
    const showBody = noteController.slice(
      noteController.indexOf('func show()'),
      noteController.indexOf('func windowDidResize'),
    );
    expect(showBody.indexOf('withReopenIntent')).toBeLessThan(
      showBody.indexOf('makeKeyAndOrderFront'),
    );
    expect(showBody.indexOf('withReopenIntent')).toBeLessThan(
      showBody.indexOf('NSApp.activate'),
    );
  });

  it('uses one visible status item without restoring a poisoned position', () => {
    const controller = readFileSync(
      path.join(repoRoot, 'native/Sources/DoneLogMenuBar/MenuBarController.swift'),
      'utf8',
    );
    const app = readFileSync(
      path.join(repoRoot, 'native/Sources/DoneLogMenuBar/DoneLogMenuBarApp.swift'),
      'utf8',
    );

    const config = readFileSync(
      path.join(repoRoot, 'native/Sources/DoneLogMenuBar/MenuBarConfiguration.swift'),
      'utf8',
    );

    expect(config).toContain('statusItemAutosaveName');
    expect(config).toContain('primary-status-item-v4');
    expect(config).not.toContain('DoneLogStatusItem');
    expect(config).not.toContain('NSStatusItem Preferred Position');
    expect(config).not.toContain('NSStatusItem VisibleCC');
    expect(config).toContain('statusItem.isVisible = true');
    expect(config).toContain('withLength: NSStatusItem.squareLength');
    expect(controller).toContain('statusItemWindow.isVisible');
    expect(controller).toContain('statusItemFrameIsInMenuBar');
    expect(controller).toContain('func revealStatusItem()');
    expect(controller).toContain('statusItem.menu = contextMenu');
    expect(controller).not.toContain('statusItem.menu = nil');
    expect(app).toContain('hostStatusItem');
    expect(app).toContain('shouldKeepWaitingForStatusItem');
    expect(app).not.toContain('shouldRecreateStatusItem');
    expect(controller).not.toContain('recreateStatusItem');
    expect(app).toContain('allowUnhosted: true');
    expect(app).toContain('shouldOpenFullAppAfterTimeout');
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
    const webViewController = readFileSync(
      path.join(
        repoRoot,
        'native/Sources/DoneLogMenuBar/MenuBarWebViewController.swift',
      ),
      'utf8',
    );

    expect(controller).toContain('MenuBarConfiguration.fullAppSize');
    expect(controller).toContain('application.setActivationPolicy(.accessory)');
    expect(controller).toContain('application.setActivationPolicy(.regular)');
    expect(controller).toContain('onActivationPolicyChanged?()');
    expect(controller).toContain('.moveToActiveSpace');
    expect(controller).toContain('windowWillUseStandardFrame');
    expect(controller).toContain('screen?.visibleFrame');
    expect(webViewController).toContain("document.addEventListener('mousedown'");
    expect(webViewController).toContain('window.performDrag(with: event)');
    expect(app).toContain('NativeAppLaunchPolicy.action(for: launchIntent)');
  });

  it('keeps generated app bundles out of Spotlight-visible dist', () => {
    const builder = readFileSync(path.join(repoRoot, 'scripts/build-menubar-app.sh'), 'utf8');
    const installer = readFileSync(path.join(repoRoot, 'scripts/install-menubar-app.sh'), 'utf8');

    expect(builder).toContain('BUILD_ROOT="$REPO_ROOT/.build/app-bundle"');
    expect(installer).toContain('SOURCE_APP="$REPO_ROOT/.build/app-bundle/Daymark.app"');
    expect(builder).not.toContain('BUILD_ROOT="$REPO_ROOT/dist"');
    expect(installer).not.toContain('SOURCE_APP="$REPO_ROOT/dist/Daymark.app"');
  });

  it('installs one app and leaves startup to the user', () => {
    const installer = readFileSync(path.join(repoRoot, 'scripts/install-menubar-app.sh'), 'utf8');

    expect(installer).toContain('--unregister-login-item');
    expect(installer).not.toContain('--register-login-item');
    expect(installer).not.toContain('/usr/bin/open -n');
    expect(installer).toContain('INSTALLED_APP="/Applications/Daymark.app"');
    expect(installer).toContain('LEGACY_APP="/Applications/Done Log.app"');
    expect(installer).toContain('Open it from Applications when you are ready');
    expect(installer).toContain('com.tonynguyen.donelog.macos');
  });

  it('refuses to replace a newer installed app with an older build', () => {
    const comparer = path.join(repoRoot, 'scripts/app-version-is-newer.sh');
    const installer = readFileSync(path.join(repoRoot, 'scripts/install-menubar-app.sh'), 'utf8');

    expect(spawnSync(comparer, ['0.8.0', '0.7.2']).status).toBe(0);
    expect(spawnSync(comparer, ['0.8.0', '0.8.0']).status).toBe(1);
    expect(spawnSync(comparer, ['0.7.2', '0.8.0']).status).toBe(1);
    expect(installer).toContain('app-version-is-newer.sh');
    expect(installer).toContain('refusing to replace newer Daymark');
  });

  it('marks native web views before the menu bar page loads', () => {
    const controller = readFileSync(
      path.join(repoRoot, 'native/Sources/DoneLogMenuBar/MenuBarWebViewController.swift'),
      'utf8',
    );
    const styles = readFileSync(path.join(repoRoot, 'src/styles.css'), 'utf8');

    expect(controller).toContain('window.__doneLogNativeHost = true');
    expect(controller).toContain('injectionTime: .atDocumentStart');
    expect(controller).not.toContain("createElement('style')");
    expect(styles).toContain('html.is-native-host .view-toggle');
    expect(styles).toContain('--native-traffic-lights-inset');
    expect(styles).not.toContain('padding: var(--native-titlebar-inset) 0 0');
    expect(styles).toContain('flex-wrap: wrap;');
    expect(styles).toContain('html.is-native-host .floating-note-shell');
    expect(styles).toContain('padding-top: calc(18px + var(--native-titlebar-inset));');
  });

  it('keeps native workspace status compact and removes redundant labels', () => {
    const styles = readFileSync(path.join(repoRoot, 'src/styles.css'), 'utf8');
    const summary = readFileSync(
      path.join(repoRoot, 'src/lib/components/SummaryPanel.svelte'),
      'utf8',
    );
    const detail = readFileSync(
      path.join(repoRoot, 'src/lib/components/TaskDetail.svelte'),
      'utf8',
    );
    const rail = readFileSync(
      path.join(repoRoot, 'src/lib/components/FlowRail.svelte'),
      'utf8',
    );

    expect(styles).toMatch(/html\.is-native-host \.flow-rail\s*{[^}]*display:\s*none;/s);
    expect(styles).toMatch(/html\.is-native-host \.workspace,[\s\S]*?padding:\s*12px;/);
    expect(styles).toContain('border-radius: 14px 0 0 14px;');
    expect(styles).toMatch(
      /html\.is-native-host \.task-panel \.brand-row\s*{[^}]*padding-inline-start:\s*0;/s,
    );
    expect(styles).toMatch(
      /html\.is-native-host \.summary-section\s*{[^}]*padding-inline:\s*0;/s,
    );
    expect(summary).toContain('class="recap-completion-count"');
    expect(detail).not.toContain('Task page');
    expect(rail).not.toContain('rail-caption');
  });
});
