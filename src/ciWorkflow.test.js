import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const workflow = parse(
  readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8'),
);
const dependencyWorkflow = parse(
  readFileSync(new URL('../.github/workflows/dependency-health.yml', import.meta.url), 'utf8'),
);
const dependabot = parse(
  readFileSync(new URL('../.github/dependabot.yml', import.meta.url), 'utf8'),
);
const packageJson = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
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
      'npm run audit:dependencies',
    );

    const nativeStepsByName = Object.fromEntries(
      workflow.jobs['native-menubar'].steps.map((step) => [step.name, step]),
    );

    expect(nativeStepsByName['Verify Swift toolchain'].run).toBe(
      'npm run check:swift-toolchain',
    );
    expect(nativeStepsByName['Test Swift menu bar host'].run).toBe(
      'npm run test:native-menubar',
    );
    expect(nativeStepsByName['Build release binary'].run).toBe(
      'npm run build:native-menubar',
    );
  });

  it('keeps local verification aligned with CI', () => {
    expect(packageJson.scripts['audit:dependencies']).toBe(
      'npm audit --audit-level=high',
    );
    expect(packageJson.scripts['verify:web']).toBe(
      'npm test && npm run build && npm run audit:dependencies',
    );
    expect(packageJson.scripts['verify:native']).toBe(
      'npm run check:swift-toolchain && npm run test:native-menubar && npm run build:native-menubar && npm run menubar:bundle',
    );
    expect(packageJson.scripts.verify).toBe(
      'npm run verify:web && npm run verify:native',
    );
  });

  it('checks dependency health before feature work discovers advisories', () => {
    expect(dependencyWorkflow.on.schedule).toEqual([
      { cron: '0 15 * * 1-5' },
    ]);
    expect(dependencyWorkflow.on).toHaveProperty('workflow_dispatch');
    expect(dependencyWorkflow.jobs.audit.steps.at(-1).run).toBe(
      'npm run audit:dependencies',
    );

    expect(
      dependabot.updates.map((update) => update['package-ecosystem']),
    ).toEqual(['npm', 'github-actions']);
    expect(
      dependabot.updates.every(
        (update) => update.schedule.interval === 'weekly',
      ),
    ).toBe(true);
  });

  it('limits permissions and pins actions to immutable revisions', () => {
    expect(workflow.permissions.contents).toBe('read');
    expect(dependencyWorkflow.permissions.contents).toBe('read');

    const actionReferences = [workflow, dependencyWorkflow].flatMap(
      (currentWorkflow) =>
        Object.values(currentWorkflow.jobs).flatMap((job) =>
          job.steps.map((step) => step.uses).filter(Boolean),
        ),
    );

    expect(actionReferences.length).toBeGreaterThan(0);
    for (const reference of actionReferences) {
      expect(reference).toMatch(/@[a-f0-9]{40}$/);
    }
  });
});
