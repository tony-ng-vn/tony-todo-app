import { describe, expect, it } from 'vitest';
import { createAgentToken, sha256Hex } from './agentSetup.js';
import { loadAgentToken, saveAgentToken } from './agentTokenRemote.js';

function stubClient({ rows = [] } = {}) {
  const calls = { inserts: [] };
  const result = (data) => Promise.resolve({ data, error: null });
  const chain = {
    select: () => chain,
    eq: () => chain,
    limit: () => result(rows),
    insert: (payload) => {
      calls.inserts.push(payload);
      return result(null);
    },
    update: () => ({ eq: () => result(null) }),
    delete: () => ({ eq: () => result(null) }),
  };
  return { client: { database: { from: () => chain } }, calls };
}

describe('agentTokenRemote with hashed keys', () => {
  it('returns null when no key row exists', async () => {
    const { client } = stubClient({ rows: [] });
    expect(await loadAgentToken(client, 'user-1')).toBeNull();
  });

  it('returns only the name for a stored hash, never a token', async () => {
    const hash = await sha256Hex(createAgentToken());
    const { client } = stubClient({ rows: [{ token_hash: hash, name: 'Cursor' }] });
    const record = await loadAgentToken(client, 'user-1');
    expect(record).toEqual({ name: 'Cursor' });
  });

  it('stores the sha-256 hash, never the plaintext key', async () => {
    const token = createAgentToken();
    const { client, calls } = stubClient({ rows: [] });
    await saveAgentToken(client, 'user-1', { token, name: 'Cursor' });
    const inserted = calls.inserts[0][0];
    expect(inserted.token_hash).toBe(await sha256Hex(token));
    expect(JSON.stringify(inserted)).not.toContain(token);
  });
});
