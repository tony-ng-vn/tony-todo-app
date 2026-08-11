import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  buildFailureRecord,
  loadLessons,
  matchLessons,
} from './ci-learning-core.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cacheDirectory = resolve(repositoryRoot, '.ci-learning');
const lessonsDirectory = resolve(repositoryRoot, '.ci/lessons');
const plan = JSON.parse(readFileSync(resolve(repositoryRoot, '.ci/verification.json'), 'utf8'));
const requestedScope = readOption('--scope') ?? 'all';

function readOption(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function gitValue(args) {
  const result = spawnSync('git', args, { cwd: repositoryRoot, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : null;
}

function selectedStages() {
  if (requestedScope === 'web' || requestedScope === 'native') {
    return plan.scopes[requestedScope];
  }
  if (requestedScope !== 'all') {
    throw new Error(`Unknown CI verification scope: ${requestedScope}`);
  }
  return process.platform === 'darwin'
    ? [...plan.scopes.web, ...plan.scopes.native]
    : plan.scopes.web;
}

mkdirSync(cacheDirectory, { recursive: true });
const lessons = loadLessons(lessonsDirectory);

for (const stage of selectedStages()) {
  console.log(`\n[ci-learning] ${stage.phase}: ${stage.command}`);
  const result = spawnSync(stage.command, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: { ...process.env, CI_LEARNING_PHASE: stage.phase },
    maxBuffer: 20 * 1024 * 1024,
    shell: true,
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (output) {
    process.stdout.write(output);
  }
  if (result.status === 0) {
    continue;
  }

  const record = buildFailureRecord({
    phase: stage.phase,
    command: stage.command,
    exitCode: result.status ?? 1,
    signal: result.signal,
    output,
    context: {
      branch: gitValue(['branch', '--show-current']),
      commit: gitValue(['rev-parse', 'HEAD']),
      platform: process.platform,
      architecture: process.arch,
      node: process.version,
      projectKinds: plan.projectKinds,
    },
  });
  const matches = matchLessons(record, lessons).map(({ lesson, score }) => ({
    id: lesson.id,
    title: lesson.title,
    score,
    harness: lesson.harness,
    guidance: lesson.guidance,
  }));
  const learnedRecord = { ...record, matchedLessons: matches };
  const serialized = `${JSON.stringify(learnedRecord, null, 2)}\n`;
  writeFileSync(resolve(cacheDirectory, 'latest-failure.json'), serialized);
  appendFileSync(resolve(cacheDirectory, 'failure-history.jsonl'), `${JSON.stringify(learnedRecord)}\n`);

  console.error(`\n[ci-learning] Cached failure ${record.fingerprint} in .ci-learning/latest-failure.json.`);
  if (matches.length > 0) {
    console.error(`[ci-learning] Matched lessons: ${matches.map((match) => match.id).join(', ')}`);
  } else {
    console.error('[ci-learning] No existing lesson matched. A successful repair can become a new candidate lesson.');
  }
  process.exit(result.status ?? 1);
}

writeFileSync(
  resolve(cacheDirectory, 'latest-success.json'),
  `${JSON.stringify({ schemaVersion: 1, completedAt: new Date().toISOString(), scope: requestedScope }, null, 2)}\n`,
);
console.log(`\n[ci-learning] ${requestedScope} verification passed.`);
