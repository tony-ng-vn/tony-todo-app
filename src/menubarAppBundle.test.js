import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('menu bar app bundle', () => {
  it('declares a background-only macOS app bundle', () => {
    const plist = readFileSync(path.join(repoRoot, 'native/App/Info.plist'), 'utf8');

    expect(plist).toContain('<string>com.tonynguyen.donelog</string>');
    expect(plist).toContain('<string>done-log-menubar</string>');
    expect(plist).toMatch(/<key>LSUIElement<\/key>\s*<true\/>/);
    expect(plist).toMatch(/<key>LSMinimumSystemVersion<\/key>\s*<string>14\.0<\/string>/);
  });

  it('exposes bundle and install commands', () => {
    const packageJson = JSON.parse(
      readFileSync(path.join(repoRoot, 'package.json'), 'utf8'),
    );

    expect(packageJson.scripts['menubar:bundle']).toBe('bash scripts/build-menubar-app.sh');
    expect(packageJson.scripts['menubar:install']).toBe('bash scripts/install-menubar-app.sh');
  });
});
