import { describe, expect, it } from 'vitest';
import {
  AGENT_KEY_NAME_MAX,
  AGENT_TODOS_URL,
  buildAgentSetupPrompt,
  createAgentToken,
  hashAgentToken,
  isAgentAccessToken,
  normalizeAgentKeyName,
  sha256Hex,
} from './agentSetup.js';

describe('createAgentToken', () => {
  it('builds a dlg_ key from 32 random bytes', () => {
    const bytes = Uint8Array.from({ length: 32 }, (_, i) => i);
    expect(createAgentToken(() => bytes)).toBe(
      'dlg_000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
    );
  });
});

describe('isAgentAccessToken', () => {
  it('accepts only the dlg_ hex format', () => {
    const token = createAgentToken(() => new Uint8Array(32).fill(7));
    expect(isAgentAccessToken(token)).toBe(true);
    expect(isAgentAccessToken('INGEST_NOT_AN_AGENT_KEY')).toBe(false);
    expect(isAgentAccessToken('eyJhbGciOiJIUzI1NiJ9.e30.sig')).toBe(false);
    expect(isAgentAccessToken('dlg_short')).toBe(false);
  });
});

describe('normalizeAgentKeyName', () => {
  it('trims and collapses spaces', () => {
    expect(normalizeAgentKeyName('  Cursor   Codex  ')).toBe('Cursor Codex');
  });

  it('rejects an empty name', () => {
    expect(() => normalizeAgentKeyName('   ')).toThrow('Name the key');
  });

  it('rejects a name that is too long', () => {
    expect(() => normalizeAgentKeyName('k'.repeat(AGENT_KEY_NAME_MAX + 1))).toThrow('40 characters');
  });
});

describe('buildAgentSetupPrompt', () => {
  it('copies a ready-to-paste HTTP setup without ownerUserId', () => {
    const token = createAgentToken(() => new Uint8Array(32).fill(10));
    const prompt = buildAgentSetupPrompt({ token });

    expect(prompt).toContain(`POST ${AGENT_TODOS_URL}`);
    expect(prompt).toContain(`Authorization: Bearer ${token}`);
    expect(prompt).toContain('{"command":"list"}');
    expect(prompt).toContain('{"command":"create","title":"..."}');
    expect(prompt).toContain('{"command":"complete","id":"..."}');
    expect(prompt).toContain('{"command":"appendNote","id":"...","text":"..."}');
    expect(prompt).toContain('{"command":"daySummary"}');
    expect(prompt).toContain('notes[]');
    expect(prompt).not.toMatch(/"ownerUserId"/);
    expect(prompt).not.toContain('INGEST_FUNCTION_TOKEN');
  });
});

describe('agent token hashing', () => {
  it('hashes with sha-256 hex', async () => {
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('hashes a valid agent token to 64 hex chars that leak nothing', async () => {
    const token = createAgentToken();
    const hash = await hashAgentToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token.slice(4, 20));
  });

  it('refuses to hash an invalid token', async () => {
    await expect(hashAgentToken('nope')).rejects.toThrow('not valid');
  });
});
