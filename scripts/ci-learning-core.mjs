import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ANSI_PATTERN = /\u001b\[[0-9;]*m/g;

export function redactSensitiveText(value) {
  return String(value)
    .replace(ANSI_PATTERN, '')
    .replace(/(authorization\s*:\s*bearer\s+)[^\s]+/gi, '$1[REDACTED]')
    // bare "Bearer <token>" without an "Authorization:" prefix; require a credential-shaped
    // token on the same line so ordinary prose like "no bearer token was provided" survives
    .replace(/\b(bearer)[^\S\n]+[A-Za-z0-9._~+/=-]{12,}/gi, '$1 [REDACTED]')
    .replace(/\b(gh[oprsu]_[A-Za-z0-9_]{20,})\b/g, '[REDACTED]')
    .replace(
      // KEY (not just API_KEY) so repo secrets like VITE_INSFORGE_ANON_KEY are covered
      /\b((?:[A-Z][A-Z0-9_]*_)?(?:TOKEN|SECRET|PASSWORD|PASSWD|KEY))\s*=\s*([^\s]+)/g,
      '$1=[REDACTED]',
    )
    // JWTs (InsForge anon keys are JWTs), anywhere in output, not just in an assignment
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}(?:\.[A-Za-z0-9_-]+)?\b/g, '[REDACTED]');
}

// keeps machine-specific paths from fragmenting fingerprints or leaking usernames into artifacts
// the optional drive prefix absorbs a Windows-style "C:" that precedes a slash-converted home path
function scrubMachinePaths(value) {
  return String(value)
    .replace(/(?:[A-Za-z]:)?\/Users\/[^/\s]+/g, '<home>')
    .replace(/(?:[A-Za-z]:)?\/home\/[^/\s]+/g, '<home>')
    // match /private/tmp before the shorter /tmp alternative so macOS's symlinked tmp collapses too
    .replace(/(?:\/private)?\/tmp\b/g, '<tmp>');
}

export function normalizeFailureOutput(value) {
  // backslash-to-slash must run before the path scrub so a Windows "C:\Users\name" path matches it too
  return scrubMachinePaths(redactSensitiveText(value).replace(/\\/g, '/'))
    // collapse whatever remains of the machine root down to a single stable marker for src paths
    .replace(/(?:<home>|<tmp>)(?:\/[^\s:]+)*\/src\//g, '<root>/src/')
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
  // scrub machine paths but keep line numbers and durations readable, unlike normalizedOutput
  const outputLines = scrubMachinePaths(redactedOutput).split('\n');

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

  const matchers = lesson.match ?? [];
  // an empty matcher list is not "matches everything" (vacuous .every truth); it means unmatchable
  if (matchers.length === 0) {
    return false;
  }

  return matchers.every((matcher) =>
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
      // projectKinds is capped to a presence bit so listing many kinds cannot outrank a targeted match
      score:
        (lesson.appliesTo?.phases?.length ? 2 : 0) +
        (lesson.appliesTo?.projectKinds?.length ? 1 : 0) +
        (lesson.match?.length ?? 0),
    }))
    .sort((left, right) => right.score - left.score || left.lesson.id.localeCompare(right.lesson.id));
}

const VALID_MODES = new Set(['full', 'push']);

// pure so it is testable without running the stage loop's side effects (spawning, cache writes)
export function selectStages(plan, scope, mode, platform) {
  if (!VALID_MODES.has(mode)) {
    throw new Error(`Unknown CI verification mode: ${mode}`);
  }
  if (scope !== 'web' && scope !== 'native' && scope !== 'all') {
    throw new Error(`Unknown CI verification scope: ${scope}`);
  }

  const stages =
    scope === 'all'
      ? platform === 'darwin'
        ? [...plan.scopes.web, ...plan.scopes.native]
        : plan.scopes.web
      : plan.scopes[scope];

  return mode === 'push' ? stages.filter((stage) => stage.pushGate !== false) : stages;
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
