import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(ROOT, path), 'utf8');

// functions/*.ts deploy as standalone Deno files that vitest cannot import,
// so these tests pin the security-critical source patterns instead (same
// convention as agentTodosInline.test.js).
describe('owner-only llm functions', () => {
  for (const file of ['functions/ingest-granola-loops.ts', 'functions/draft-follow-up.ts']) {
    it(`${file} rejects signed-in users who are not the owner`, () => {
      const source = read(file);
      expect(source).toContain("Deno.env.get('OWNER_EMAIL')");
      expect(source).toContain("json({ error: 'Forbidden' }, 403)");
    });
  }
});

describe('prompt injection fencing', () => {
  it('fences meeting content in the extraction prompt', () => {
    const source = read('functions/ingest-granola-loops.ts');
    expect(source).toContain('<untrusted-meeting-content>');
    expect(source).toContain('</untrusted-meeting-content>');
    expect(source).toContain('not instructions');
  });

  it('fences evidence content in the drafting prompt', () => {
    const source = read('functions/draft-follow-up.ts');
    expect(source).toContain('<untrusted-meeting-content>');
    expect(source).toContain('not instructions');
  });
});

describe('per-user rate limiting', () => {
  it('rate limits user-triggered granola ingestion', () => {
    const source = read('functions/ingest-granola-loops.ts');
    expect(source).toContain("from('rate_limit_events')");
    expect(source).toContain('429');
  });

  it('rate limits user-triggered drafting', () => {
    const source = read('functions/draft-follow-up.ts');
    expect(source).toContain("from('rate_limit_events')");
    expect(source).toContain('429');
  });
});

// These two functions ran live-only for a while; tracking them here puts them
// under the same deploy-sync check and security pins as the rest.
describe('claim-preauth-todos', () => {
  it('claims only null-owner rows for the verified session user', () => {
    const source = read('functions/claim-preauth-todos.ts');
    expect(source).toContain('auth.getCurrentUser()');
    expect(source).toContain("json({ error: 'Unauthorized' }, 401)");
    expect(source).toContain(".is('user_id', null)");
    expect(source).toContain(".eq('client_id', clientId)");
    // Ownership always comes from the verified token, never the request body.
    expect(source).toContain('user_id: user.id');
    expect(source).not.toMatch(/body\.user_?id/i);
  });
});

describe('extract-video-knowledge', () => {
  it('derives ownership from the verified token on the user path', () => {
    const source = read('functions/extract-video-knowledge.ts');
    expect(source).toContain("json({ error: 'Unauthorized' }, 401)");
    expect(source).toContain(
      "isTrustedInternalCaller ? readString(body, 'ownerUserId') : verifiedUserId",
    );
    expect(source).toContain(".eq('user_id', ownerUserId)");
  });

  it('caps and validates model output before storing cards', () => {
    const source = read('functions/extract-video-knowledge.ts');
    expect(source).toContain('TRANSCRIPT_CHAR_LIMIT');
    expect(source).toContain('slice(0, MAX_CARDS)');
    expect(source).toContain('MAX_BODY_LENGTH');
  });
});
