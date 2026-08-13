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
