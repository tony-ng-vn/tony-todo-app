import { describe, expect, it } from 'vitest';

import {
  buildFailureRecord,
  buildLessonFromCandidate,
  buildRepairPrompt,
  fingerprintFailure,
  lessonMatches,
  matchLessons,
  normalizeFailureOutput,
  redactSensitiveText,
  selectStages,
} from '../scripts/ci-learning-core.mjs';

describe('CI learning core', () => {
  it('creates a stable fingerprint across machine-specific output', () => {
    const first = `FAIL /Users/tony/project/src/example.test.js:19:4\nDuration 128ms`;
    const second = `FAIL /tmp/project/src/example.test.js:44:8\nDuration 941ms`;

    expect(normalizeFailureOutput(first)).toBe(normalizeFailureOutput(second));
    expect(fingerprintFailure('web.tests', first)).toBe(
      fingerprintFailure('web.tests', second),
    );
  });

  it('produces identical fingerprints for scripts/native paths across machines', () => {
    const macOutput = `FAIL /Users/alice/repo/scripts/ci-verify.mjs:19:4\nDuration 128ms`;
    const linuxOutput = `FAIL /home/runner/repo/scripts/ci-verify.mjs:44:8\nDuration 941ms`;

    expect(normalizeFailureOutput(macOutput)).toBe(normalizeFailureOutput(linuxOutput));
    expect(fingerprintFailure('web.tests', macOutput)).toBe(
      fingerprintFailure('web.tests', linuxOutput),
    );
  });

  it('scrubs home and temp directories out of buildFailureRecord entirely', () => {
    const record = buildFailureRecord({
      phase: 'native.tests',
      command: 'swift test',
      exitCode: 1,
      output: 'FAIL /Users/alice/repo/native/Sources/Example.swift:19:4\nDuration 128ms',
      context: { platform: 'darwin' },
    });

    const serialized = JSON.stringify(record);
    expect(serialized).not.toContain('/Users/alice');
    expect(record.outputTail).not.toContain('/Users/alice');
    expect(record.outputTail).toContain('19');
  });

  it('redacts common credentials before evidence is cached or sent to an agent', () => {
    const output = [
      'Authorization: Bearer secret-token-value',
      'GITHUB_TOKEN=ghp_abcdefghijklmnopqrstuvwxyz123456',
      'API_KEY=plain-secret',
    ].join('\n');

    const redacted = redactSensitiveText(output);

    expect(redacted).not.toContain('secret-token-value');
    expect(redacted).not.toContain('ghp_abcdefghijklmnopqrstuvwxyz123456');
    expect(redacted).not.toContain('plain-secret');
    expect(redacted).toContain('[REDACTED]');
  });

  it('redacts KEY-suffixed env assignments, JWTs, and bare Bearer tokens', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
    const output = [
      `VITE_INSFORGE_ANON_KEY=${jwt}`,
      `standalone token in a log line: ${jwt}`,
      'curl -H "Bearer some-loose-token" https://example.com',
    ].join('\n');

    const redacted = redactSensitiveText(output);

    expect(redacted).not.toContain(jwt);
    expect(redacted).not.toContain('some-loose-token');
    expect(redacted).toContain('VITE_INSFORGE_ANON_KEY=[REDACTED]');
    expect(redacted).toContain('[REDACTED]');
  });

  it('does not redact ordinary prose that happens to mention bearer', () => {
    const output = 'no bearer token was provided\nERROR: build failed';

    const redacted = redactSensitiveText(output);

    expect(redacted).toContain('no bearer token was provided');
    expect(redacted).toContain('ERROR: build failed');
  });

  it('retrieves the most specific applicable lessons for a failure', () => {
    const record = buildFailureRecord({
      phase: 'web.node-toolchain',
      command: 'node scripts/check-node-toolchain.mjs',
      exitCode: 1,
      output: 'Node 24.x is required, but v26.6.0 is active.',
      context: { platform: 'darwin', projectKinds: ['node', 'swift'] },
    });
    const lessons = [
      {
        id: 'node-major',
        appliesTo: { phases: ['web.node-toolchain'], projectKinds: ['node'] },
        match: [{ kind: 'includes', value: 'Node 24.x is required' }],
      },
      {
        id: 'generic-node',
        appliesTo: { phases: ['web.node-toolchain'] },
        match: [{ kind: 'includes', value: 'Node' }],
      },
      {
        id: 'swift-only',
        appliesTo: { phases: ['native.toolchain'], projectKinds: ['swift'] },
        match: [{ kind: 'includes', value: 'Swift' }],
      },
    ];

    expect(matchLessons(record, lessons).map(({ lesson }) => lesson.id)).toEqual([
      'node-major',
      'generic-node',
    ]);
  });

  it('can promote stable failure fingerprints into exact reusable lessons', () => {
    const record = buildFailureRecord({
      phase: 'web.build',
      command: 'npm run build',
      exitCode: 1,
      output: 'Build failed because example was not exported',
      context: { projectKinds: ['node'] },
    });

    expect(
      matchLessons(record, [
        {
          id: 'exact-build-failure',
          appliesTo: { phases: ['web.build'] },
          match: [{ kind: 'fingerprint', value: record.fingerprint }],
        },
      ]).map(({ lesson }) => lesson.id),
    ).toEqual(['exact-build-failure']);
  });

  it('never matches a lesson whose match list is missing or empty', () => {
    const record = buildFailureRecord({
      phase: 'web.build',
      command: 'npm run build',
      exitCode: 1,
      output: 'anything at all',
      context: { projectKinds: ['node'] },
    });

    expect(
      lessonMatches(record, { id: 'empty-match', appliesTo: { phases: ['web.build'] }, match: [] }),
    ).toBe(false);
    expect(
      lessonMatches(record, { id: 'missing-match', appliesTo: { phases: ['web.build'] } }),
    ).toBe(false);
  });

  it('builds a bounded repair prompt with evidence, lessons, and safety rules', () => {
    const prompt = buildRepairPrompt({
      attempt: 2,
      maxAttempts: 3,
      failure: {
        phase: 'web.tests',
        command: 'npm test',
        fingerprint: 'abc123',
        outputTail: 'one test failed',
      },
      lessons: [
        {
          id: 'test-regression',
          title: 'Reproduce the focused test first',
          guidance: [{ solution: 'Run the named test before the full suite.' }],
          harness: { command: 'npx vitest run src/example.test.js' },
        },
      ],
    });

    expect(prompt).toContain('Attempt 2 of 3');
    expect(prompt).toContain('abc123');
    expect(prompt).toContain('test-regression');
    expect(prompt).toContain('Do not commit, push, merge, or change branches.');
    expect(prompt).toContain('npx vitest run src/example.test.js');
  });

  it('turns a successful repair candidate into a reviewable exact lesson', () => {
    const lesson = buildLessonFromCandidate({
      id: 'missing-export',
      title: 'Restore the expected export',
      candidate: {
        attempts: 2,
        diffStat: 'src/example.js | 2 ++',
        repairSummary: 'Restored the public export used by the build.',
        failure: {
          phase: 'web.build',
          command: 'npm run build',
          fingerprint: 'abc123',
          outputTail: 'Build failed because example was not exported',
          context: { projectKinds: ['node'] },
        },
      },
    });

    expect(lesson.match).toEqual([{ kind: 'fingerprint', value: 'abc123' }]);
    expect(lesson.harness.command).toBe('npm run build');
    expect(lesson.guidance[0].solution).toContain('Restored the public export');
    expect(lesson.evidence.attempts).toBe(2);
  });
});

describe('selectStages', () => {
  const plan = {
    scopes: {
      web: [
        { phase: 'web.node-toolchain', command: 'node scripts/check-node-toolchain.mjs' },
        { phase: 'web.clean-install', command: 'npm ci', pushGate: false },
        { phase: 'web.tests', command: 'npm test' },
        { phase: 'web.build', command: 'npm run build' },
        { phase: 'web.dependency-audit', command: 'npm run audit:dependencies', pushGate: false },
      ],
      native: [
        { phase: 'native.swift-toolchain', command: 'npm run check:swift-toolchain' },
        { phase: 'native.tests', command: 'npm run test:native-menubar' },
        { phase: 'native.release-build', command: 'npm run build:native-menubar', pushGate: false },
        { phase: 'native.app-bundle', command: 'npm run menubar:bundle', pushGate: false },
      ],
    },
  };

  it('runs every stage for a scope in full mode', () => {
    expect(selectStages(plan, 'web', 'full', 'darwin').map((stage) => stage.phase)).toEqual([
      'web.node-toolchain',
      'web.clean-install',
      'web.tests',
      'web.build',
      'web.dependency-audit',
    ]);
  });

  it('drops exactly the pushGate:false stages in push mode', () => {
    expect(selectStages(plan, 'all', 'push', 'darwin').map((stage) => stage.phase)).toEqual([
      'web.node-toolchain',
      'web.tests',
      'web.build',
      'native.swift-toolchain',
      'native.tests',
    ]);
  });

  it('filters by scope the same way in both modes', () => {
    expect(selectStages(plan, 'native', 'full', 'darwin').map((stage) => stage.phase)).toEqual([
      'native.swift-toolchain',
      'native.tests',
      'native.release-build',
      'native.app-bundle',
    ]);
    expect(selectStages(plan, 'native', 'push', 'darwin').map((stage) => stage.phase)).toEqual([
      'native.swift-toolchain',
      'native.tests',
    ]);
  });

  it('splits scope "all" between darwin and non-darwin platforms', () => {
    expect(selectStages(plan, 'all', 'full', 'linux').map((stage) => stage.phase)).toEqual([
      'web.node-toolchain',
      'web.clean-install',
      'web.tests',
      'web.build',
      'web.dependency-audit',
    ]);
    expect(selectStages(plan, 'all', 'full', 'darwin').length).toBe(9);
  });

  it('throws on an unknown scope or mode', () => {
    expect(() => selectStages(plan, 'bogus', 'full', 'darwin')).toThrow();
    expect(() => selectStages(plan, 'web', 'bogus', 'darwin')).toThrow();
  });
});
