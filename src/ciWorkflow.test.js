import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const workflow = parse(
  readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8'),
);
const nodeVersion = readFileSync(
  new URL('../.node-version', import.meta.url),
  'utf8',
).trim();

describe('CI workflow', () => {
  it('gates pull requests and main pushes with the deploy-critical checks', () => {
    expect(workflow.on.pull_request.branches).toContain('main');
    expect(workflow.on.push.branches).toContain('main');

    const stepsByName = Object.fromEntries(
      workflow.jobs.verify.steps.map((step) => [step.name, step]),
    );

    expect(stepsByName['Set up Node.js'].with['node-version-file']).toBe(
      '.node-version',
    );
    expect(nodeVersion).toBe('24');
    expect(stepsByName['Install dependencies'].run).toBe('npm ci');
    expect(stepsByName['Run tests'].run).toBe('npm test');
    expect(stepsByName['Build production bundle'].run).toBe('npm run build');
    expect(stepsByName['Audit high-severity dependencies'].run).toBe(
      'npm audit --audit-level=high',
    );
  });

  it('limits permissions and pins actions to immutable revisions', () => {
    expect(workflow.permissions.contents).toBe('read');

    const actionReferences = workflow.jobs.verify.steps
      .map((step) => step.uses)
      .filter(Boolean);

    expect(actionReferences.length).toBeGreaterThan(0);
    for (const reference of actionReferences) {
      expect(reference).toMatch(/@[a-f0-9]{40}$/);
    }
  });
});
