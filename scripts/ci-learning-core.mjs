import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ANSI_PATTERN = /\u001b\[[0-9;]*m/g;

export function redactSensitiveText(value) {
  return String(value)
    .replace(ANSI_PATTERN, '')
    .replace(/(authorization\s*:\s*bearer\s+)[^\s]+/gi, '$1[REDACTED]')
    .replace(/\b(gh[oprsu]_[A-Za-z0-9_]{20,})\b/g, '[REDACTED]')
    .replace(
      /\b((?:[A-Z][A-Z0-9_]*_)?(?:TOKEN|SECRET|PASSWORD|PASSWD|API_KEY))\s*=\s*([^\s]+)/g,
      '$1=[REDACTED]',
    );
}

export function normalizeFailureOutput(value) {
  return redactSensitiveText(value)
    .replace(/\\/g, '/')
    .replace(/(?:\/Users\/[^/]+|\/tmp)(?:\/[^\s:]+)*\/src\//g, '<root>/src/')
    .replace(/:\d+:\d+\b/g, ':<line>:<column>')
    .replace(/\b(?:Duration\s+)?\d+(?:\.\d+)?m?s\b/gi, '<duration>')
    .replace(/[ \t]+$/gm, '')
    .trim();
}

export function fingerprintFailure(phase, output) {
  return createHash('sha256')
    .update(`${phase}\n${normalizeFailureOutput(output)}`)
    .digest('hex')
    .slice(0, 16);
}

export function buildFailureRecord({
  phase,
  command,
  exitCode,
  signal = null,
  output,
  context = {},
  now = new Date(),
}) {
  const redactedOutput = redactSensitiveText(output);
  const outputLines = redactedOutput.split('\n');

  return {
    schemaVersion: 1,
    capturedAt: now.toISOString(),
    phase,
    command,
    exitCode,
    signal,
    fingerprint: fingerprintFailure(phase, redactedOutput),
    outputTail: outputLines.slice(-160).join('\n').trim(),
    normalizedOutput: normalizeFailureOutput(redactedOutput),
    context,
  };
}

function matcherMatches(output, matcher) {
  if (matcher.kind === 'includes') {
    return output.toLowerCase().includes(String(matcher.value).toLowerCase());
  }
  if (matcher.kind === 'regex') {
    return new RegExp(matcher.value, matcher.flags ?? 'i').test(output);
  }
  return false;
}

export function lessonMatches(record, lesson) {
  const phases = lesson.appliesTo?.phases ?? [];
  if (phases.length > 0 && !phases.includes(record.phase)) {
    return false;
  }

  const requiredKinds = lesson.appliesTo?.projectKinds ?? [];
  const projectKinds = record.context?.projectKinds ?? [];
  if (requiredKinds.some((kind) => !projectKinds.includes(kind))) {
    return false;
  }

  return (lesson.match ?? []).every((matcher) =>
    matcher.kind === 'fingerprint'
      ? record.fingerprint === matcher.value
      : matcherMatches(record.normalizedOutput ?? record.outputTail ?? '', matcher),
  );
}

export function matchLessons(record, lessons) {
  return lessons
    .filter((lesson) => lessonMatches(record, lesson))
    .map((lesson) => ({
      lesson,
      score:
        (lesson.appliesTo?.phases?.length ? 2 : 0) +
        (lesson.appliesTo?.projectKinds?.length ?? 0) +
        (lesson.match?.length ?? 0),
    }))
    .sort((left, right) => right.score - left.score || left.lesson.id.localeCompare(right.lesson.id));
}

export function loadLessons(lessonsDirectory) {
  return readdirSync(lessonsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => JSON.parse(readFileSync(join(lessonsDirectory, entry.name), 'utf8')))
    .sort((left, right) => left.id.localeCompare(right.id));
}

export function buildRepairPrompt({ attempt, maxAttempts, failure, lessons }) {
  const lessonSummary = lessons.length
    ? JSON.stringify(lessons, null, 2)
    : 'No prior lesson matched this failure. Diagnose from the evidence and keep the fix narrow.';

  return `You are repairing a local CI failure before the branch is pushed.\n\nAttempt ${attempt} of ${maxAttempts}.\n\nFailure evidence:\n${JSON.stringify(failure, null, 2)}\n\nRelevant prior lessons:\n${lessonSummary}\n\nWork only in this repository. Preserve unrelated changes. Diagnose the root cause and choose the smallest robust fix that fits this project and this failure context. Run the narrow harness from a matching lesson first when one exists. Do not commit, push, merge, or change branches. Do not weaken, skip, or delete a failing check. Stop after implementing and locally checking one repair; the outer CI learning loop will run the canonical verification again.`;
}

export function buildLessonFromCandidate({ id, title, candidate }) {
  const failure = candidate.failure;
  if (!failure?.fingerprint || !failure.phase || !failure.command || !failure.outputTail) {
    throw new Error('Candidate is missing failure evidence.');
  }

  return {
    schemaVersion: 1,
    id,
    title,
    appliesTo: {
      phases: [failure.phase],
      projectKinds: failure.context?.projectKinds ?? [],
    },
    match: [{ kind: 'fingerprint', value: failure.fingerprint }],
    failureExamples: [failure.outputTail],
    harness: { command: failure.command },
    guidance: [
      {
        when: `Failure ${failure.fingerprint} occurs during ${failure.phase}.`,
        solution: candidate.repairSummary || 'Review the successful diff and describe why it fixed this failure.',
        tradeoffs: 'Review and refine this generated lesson before committing it.',
      },
    ],
    evidence: {
      attempts: candidate.attempts,
      diffStat: candidate.diffStat,
    },
  };
}
