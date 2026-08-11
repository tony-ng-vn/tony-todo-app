import { describe, expect, it } from 'vitest';

import {
  buildFailureRecord,
  buildLessonFromCandidate,
  buildRepairPrompt,
  fingerprintFailure,
  matchLessons,
  normalizeFailureOutput,
  redactSensitiveText,
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
