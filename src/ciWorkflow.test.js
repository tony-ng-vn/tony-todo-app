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
const prePushHook = readFileSync(
  new URL('../.githooks/pre-push', import.meta.url),
  'utf8',
);
const gitignore = readFileSync(new URL('../.gitignore', import.meta.url), 'utf8');

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
    expect(stepsByName['Run canonical web verification'].run).toBe(
      'npm run verify:web',
    );

    const nativeStepsByName = Object.fromEntries(
      workflow.jobs['native-menubar'].steps.map((step) => [step.name, step]),
    );

    expect(nativeStepsByName['Run canonical native verification'].run).toBe(
      'npm run verify:native',
    );
  });

  it('keeps local verification aligned with CI', () => {
    expect(packageJson.scripts['audit:dependencies']).toBe(
      'npm audit --audit-level=high',
    );
    expect(packageJson.scripts['check:swift-toolchain']).toBe(
      'node scripts/check-swift-toolchain.mjs',
    );
    expect(packageJson.scripts['check:node-toolchain']).toBe(
      'node scripts/check-node-toolchain.mjs',
    );
    expect(packageJson.scripts.verify).toBe(
      'node scripts/ci-verify.mjs --scope all',
    );
    expect(packageJson.scripts['verify:web']).toBe(
      'node scripts/ci-verify.mjs --scope web',
    );
    expect(packageJson.scripts['verify:native']).toBe(
      'node scripts/ci-verify.mjs --scope native',
    );
    expect(packageJson.scripts['ci:replay']).toBe(
      'node scripts/ci-replay.mjs',
    );
    expect(packageJson.scripts['ci:repair']).toBe(
      'node scripts/ci-repair.mjs',
    );
    expect(packageJson.scripts['ci:promote']).toBe(
      'node scripts/ci-promote-lesson.mjs',
    );
    expect(gitignore).toContain('.ci-learning');
    expect(packageJson.scripts.prepare).toBe(
      'node scripts/install-git-hooks.mjs',
    );
    expect(packageJson.scripts['setup:hooks']).toBe(
      'node scripts/install-git-hooks.mjs',
    );
    expect(prePushHook).toContain('npm run verify');
    expect(prePushHook).toContain('npm run verify:web');
    expect(prePushHook).toContain('SKIP_VERIFY');
  });

  it('checks dependency health before feature work discovers advisories', () => {
    expect(dependencyWorkflow.on.schedule).toEqual([
      { cron: '17 15 * * *' },
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

  it('preserves redacted failure packets from both CI environments', () => {
    for (const job of [workflow.jobs.verify, workflow.jobs['native-menubar']]) {
      const upload = job.steps.find((step) => step.name.startsWith('Preserve '));
      expect(upload.if).toBe('failure()');
      expect(upload.uses).toMatch(/^actions\/upload-artifact@[0-9a-f]{40}$/);
      expect(upload.with.path).toBe('.ci-learning/latest-failure.json');
      expect(upload.with['retention-days']).toBe(30);
    }
  });
});
