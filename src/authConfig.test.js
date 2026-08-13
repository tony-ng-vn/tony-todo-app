import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const config = readFileSync(join(ROOT, 'insforge.toml'), 'utf8');

// Guard against the auth lockdown being reverted by a config edit.
// The live InsForge dashboard can drift from this file; the deploy
// checklist in the PR covers pushing it to the backend.
describe('auth configuration lockdown', () => {
  it('keeps public sign-up disabled', () => {
    expect(config).toContain('disable_signup = true');
  });

  it('requires passwords of at least 12 characters', () => {
    const match = config.match(/min_length = (\d+)/);
    expect(match).not.toBeNull();
    expect(Number(match[1])).toBeGreaterThanOrEqual(12);
  });
});
