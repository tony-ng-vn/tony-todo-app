import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const workflow = parse(
  readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8'),
);
const functionsWorkflow = parse(
  readFileSync(new URL('../.github/workflows/insforge-functions.yml', import.meta.url), 'utf8'),
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
const verificationPlan = JSON.parse(
  readFileSync(new URL('../.ci/verification.json', import.meta.url), 'utf8'),
);

describe('CI workflow', () => {
  it('gates pull requests and main pushes with the deploy-critical checks', () => {
    expect(workflow.on.pull_request.branches).toContain('main');
    expect(workflow.on.pull_request.types).toContain('edited');
    expect(workflow.on.push.branches).toContain('main');

    const stepsByName = Object.fromEntries(
      workflow.jobs.verify.steps.map((step) => [step.name, step]),
    );

    expect(stepsByName['Set up Node.js'].with['node-version-file']).toBe(
      '.node-version',
    );
    expect(stepsByName['Check out repository'].with['fetch-depth']).toBe(0);
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
    expect(packageJson.scripts['check:contribution-policy']).toBe(
      'node scripts/check-contribution-policy.mjs',
    );
    expect(verificationPlan.scopes.web[0]).toEqual({
      phase: 'web.contribution-policy',
      command: 'npm run check:contribution-policy',
    });
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
    expect(packageJson.scripts['verify:push']).toBe(
      'node scripts/ci-verify.mjs --scope all --mode push',
    );
    expect(packageJson.scripts['verify:push:web']).toBe(
      'node scripts/ci-verify.mjs --scope web --mode push',
    );
    expect(packageJson.scripts['sync:insforge-functions']).toBe(
      'node scripts/insforge-functions-sync.mjs',
    );
    expect(prePushHook).toContain('npm run verify:push');
    expect(prePushHook).toContain('npm run verify:push:web');
    expect(prePushHook).toContain('SKIP_VERIFY');
  });

  it('marks exactly the heavy local stages as excluded from the push gate', () => {
    const pushGateFalseStages = [...verificationPlan.scopes.web, ...verificationPlan.scopes.native]
      .filter((stage) => stage.pushGate === false)
      .map((stage) => stage.phase);

    expect(pushGateFalseStages.sort()).toEqual(
      [
        'web.clean-install',
        'web.dependency-audit',
        'native.release-build',
        'native.app-bundle',
      ].sort(),
    );
  });

  it('checks dependency health before feature work discovers advisories', () => {
    expect(dependencyWorkflow.on.schedule).toEqual([
      { cron: '17 15 * * *' },
    ]);
    expect(dependencyWorkflow.on).toHaveProperty('workflow_dispatch');
    const auditStepsByName = Object.fromEntries(
      dependencyWorkflow.jobs.audit.steps.map((step) => [step.name, step]),
    );
    expect(auditStepsByName['Audit high-severity dependencies'].run).toBe(
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

  it('groups low-risk npm devDependency bumps and cools down every ecosystem', () => {
    const npmUpdate = dependabot.updates.find(
      (update) => update['package-ecosystem'] === 'npm',
    );
    const actionsUpdate = dependabot.updates.find(
      (update) => update['package-ecosystem'] === 'github-actions',
    );

    expect(npmUpdate.groups['dev-tooling']).toEqual({
      'applies-to': 'version-updates',
      'dependency-type': 'development',
      'update-types': ['minor', 'patch'],
    });
    expect(actionsUpdate.groups).toBeUndefined();

    for (const update of [npmUpdate, actionsUpdate]) {
      expect(update.cooldown['default-days']).toBeGreaterThanOrEqual(5);
    }
  });

  it('self-tests the failure packet path daily since ci.yml only uploads on failure', () => {
    const auditStepsByName = Object.fromEntries(
      dependencyWorkflow.jobs.audit.steps.map((step) => [step.name, step]),
    );

    expect(auditStepsByName['Build failure packet self-test'].run).toBe(
      'npm run ci:selftest-packet',
    );

    const upload = auditStepsByName['Upload failure packet self-test'];
    expect(upload.with.path).toBe('.ci-learning/selftest-failure.json');
    expect(upload.with['if-no-files-found']).toBe('error');
    expect(upload.with['retention-days']).toBe(1);
    expect(packageJson.scripts['ci:selftest-packet']).toBe(
      'node scripts/ci-selftest-packet.mjs',
    );
  });

  it('keeps every upload-artifact reference identical across both workflows', () => {
    const references = [workflow, dependencyWorkflow].flatMap((currentWorkflow) =>
      Object.values(currentWorkflow.jobs).flatMap((job) =>
        job.steps
          .map((step) => step.uses)
          .filter((uses) => uses?.startsWith('actions/upload-artifact@')),
      ),
    );

    expect(references.length).toBeGreaterThan(1);
    expect(new Set(references).size).toBe(1);
  });

  it('limits permissions and pins actions to immutable revisions', () => {
    expect(workflow.permissions.contents).toBe('read');
    expect(dependencyWorkflow.permissions.contents).toBe('read');
    expect(functionsWorkflow.permissions.contents).toBe('read');

    const actionReferences = [workflow, dependencyWorkflow, functionsWorkflow].flatMap(
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

  it('deploys InsForge functions from GitHub after CI is green on main', () => {
    expect(functionsWorkflow.on.workflow_run.workflows).toEqual(['CI']);
    expect(functionsWorkflow.on.workflow_run.types).toEqual(['completed']);
    expect(functionsWorkflow.on).toHaveProperty('workflow_dispatch');
    expect(functionsWorkflow.on.pull_request).toBeUndefined();
    expect(functionsWorkflow.concurrency['cancel-in-progress']).toBe(false);

    const deploy = functionsWorkflow.jobs.deploy;
    expect(deploy.name).toBe('Deploy InsForge functions');
    expect(deploy.if).toContain("github.event_name == 'workflow_dispatch'");
    expect(deploy.if).toContain("github.ref == 'refs/heads/main'");
    expect(deploy.if).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(deploy.if).toContain("github.event.workflow_run.head_branch == 'main'");
    expect(deploy.env.INSFORGE_PROJECT_ID).toBe('7e77e15d-9e4d-4591-9951-8b99289200cd');
    expect(packageJson.devDependencies['@insforge/cli']).toBe('0.2.6');

    const stepsByName = Object.fromEntries(deploy.steps.map((step) => [step.name, step]));
    expect(stepsByName['Check out repository'].with.ref).toContain('workflow_run.head_sha');
    expect(stepsByName['Install dependencies'].run).toBe('npm ci');
    expect(stepsByName['Deploy changed functions and verify live source'].run).toContain(
      'npx -y --offline @insforge/cli@0.2.6 login --user-api-key',
    );
    expect(stepsByName['Deploy changed functions and verify live source'].run).toContain(
      'sync:insforge-functions',
    );
    expect(stepsByName['Deploy changed functions and verify live source'].run).toContain('--check');
    expect(stepsByName['Deploy changed functions and verify live source'].env).toEqual({
      INSFORGE_USER_API_KEY: '${{ secrets.INSFORGE_USER_API_KEY }}',
    });
  });
});
