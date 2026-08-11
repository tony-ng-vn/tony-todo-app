import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  buildRepairPrompt,
  loadLessons,
  matchLessons,
  parseNulDelimitedList,
  redactSensitiveText,
} from './ci-learning-core.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cacheDirectory = resolve(repositoryRoot, '.ci-learning');
const latestFailurePath = resolve(cacheDirectory, 'latest-failure.json');
const maxAttempts = Number.parseInt(readOption('--max-attempts') ?? '3', 10);
const scope = readOption('--scope') ?? 'all';

function readOption(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    ...options,
  });
}

function runVerification() {
  return run(process.execPath, ['scripts/ci-verify.mjs', '--scope', scope], { stdio: 'inherit' });
}

function currentBranch() {
  return run('git', ['branch', '--show-current']).stdout.trim();
}

function invokeAgent(prompt, outputPath) {
  const customCommand = process.env.CI_REPAIR_AGENT_COMMAND;
  if (customCommand) {
    const result = spawnSync(customCommand, {
      cwd: repositoryRoot,
      encoding: 'utf8',
      env: process.env,
      input: prompt,
      shell: true,
      maxBuffer: 20 * 1024 * 1024,
    });
    if (result.stdout) {
      process.stdout.write(result.stdout);
    }
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }
    writeFileSync(outputPath, redactSensitiveText(`${result.stdout ?? ''}${result.stderr ?? ''}`));
    return result;
  }
  return run(
    'codex',
    ['exec', '--ephemeral', '--sandbox', 'workspace-write', '--cd', repositoryRoot, '--output-last-message', outputPath, '-'],
    { input: prompt, stdio: ['pipe', 'inherit', 'inherit'] },
  );
}

if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 5) {
  throw new Error('--max-attempts must be an integer from 1 through 5.');
}
const branch = currentBranch();
if (!branch || branch === 'main' || branch === 'master') {
  throw new Error('CI repair must run on a feature branch. It never edits a protected branch.');
}

mkdirSync(cacheDirectory, { recursive: true });
const initialResult = runVerification();
if (initialResult.status === 0) {
  console.log('[ci-learning] Verification already passes. No repair is needed.');
  process.exit(0);
}
if (!existsSync(latestFailurePath)) {
  throw new Error('Verification failed without producing a failure packet.');
}

const originalFailure = JSON.parse(readFileSync(latestFailurePath, 'utf8'));
const lessons = loadLessons(resolve(repositoryRoot, '.ci/lessons'));

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  const currentFailure = JSON.parse(readFileSync(latestFailurePath, 'utf8'));
  const matchedLessons = matchLessons(currentFailure, lessons).map(({ lesson }) => lesson);
  const prompt = buildRepairPrompt({
    attempt,
    maxAttempts,
    failure: currentFailure,
    lessons: matchedLessons,
  });
  const agentOutputPath = resolve(cacheDirectory, `agent-attempt-${attempt}.txt`);
  const agentResult = invokeAgent(prompt, agentOutputPath);
  if (agentResult.status !== 0) {
    throw new Error(`The repair agent stopped with exit code ${agentResult.status ?? 1}.`);
  }

  const verificationResult = runVerification();
  const agentSummary = existsSync(agentOutputPath)
    ? redactSensitiveText(readFileSync(agentOutputPath, 'utf8')).trim()
    : null;
  const nextFailure = verificationResult.status === 0
    ? null
    : JSON.parse(readFileSync(latestFailurePath, 'utf8'));
  appendFileSync(
    resolve(cacheDirectory, 'repair-attempts.jsonl'),
    `${JSON.stringify({
      schemaVersion: 1,
      attemptedAt: new Date().toISOString(),
      branch,
      attempt,
      beforeFingerprint: currentFailure.fingerprint,
      afterFingerprint: nextFailure?.fingerprint ?? null,
      passed: verificationResult.status === 0,
      agentSummary,
    })}\n`,
  );
  if (verificationResult.status !== 0) {
    continue;
  }

  const diffStat = run('git', ['diff', '--stat']).stdout.trim();
  // git diff --stat misses files the agent created; list them without touching the index (no git add).
  // -z is NUL-delimited so filenames with newlines or significant whitespace survive intact.
  const untrackedFiles = parseNulDelimitedList(
    run('git', ['ls-files', '--others', '--exclude-standard', '-z']).stdout,
  );
  const candidate = {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    branch,
    attempts: attempt,
    failure: originalFailure,
    repairSummary: agentSummary,
    diffStat,
    untrackedFiles,
    status: 'candidate',
    note: 'Review this candidate before promoting it into .ci/lessons.',
  };
  const candidatePath = resolve(cacheDirectory, `candidate-${originalFailure.fingerprint}.json`);
  writeFileSync(candidatePath, `${JSON.stringify(candidate, null, 2)}\n`);
  appendFileSync(resolve(cacheDirectory, 'repair-history.jsonl'), `${JSON.stringify(candidate)}\n`);
  console.log(`[ci-learning] Repair passed verification after ${attempt} attempt(s).`);
  console.log(`[ci-learning] Review the reusable lesson candidate at ${candidatePath}.`);
  process.exit(0);
}

throw new Error(`CI repair reached ${maxAttempts} attempts without passing verification. The failure history was preserved for review.`);
