import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(
  new URL('../.github/workflows/ci.yml', import.meta.url),
  'utf8',
);

describe('CI workflow', () => {
  it('gates pull requests and main pushes with the deploy-critical checks', () => {
    expect(workflow).toContain('pull_request:');
    expect(workflow).toContain('push:');
    expect(workflow.match(/      - main/g)).toHaveLength(2);
    expect(workflow).toContain('node-version: 24');
    expect(workflow).toContain('run: npm ci');
    expect(workflow).toContain('run: npm test');
    expect(workflow).toContain('run: npm run build');
    expect(workflow).toContain('run: npm audit --audit-level=high');
  });

  it('limits permissions and pins actions to immutable revisions', () => {
    expect(workflow).toContain('permissions:\n  contents: read');

    const actionReferences = [...workflow.matchAll(/uses: ([^\s#]+)/g)].map(
      ([, reference]) => reference,
    );

    expect(actionReferences).toHaveLength(2);
    for (const reference of actionReferences) {
      expect(reference).toMatch(/@[a-f0-9]{40}$/);
    }
  });
});
