import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  buildFailureRecord,
  loadLessons,
  matchLessons,
  selectStages,
} from './ci-learning-core.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cacheDirectory = resolve(repositoryRoot, '.ci-learning');
const lessonsDirectory = resolve(repositoryRoot, '.ci/lessons');
const plan = JSON.parse(readFileSync(resolve(repositoryRoot, '.ci/verification.json'), 'utf8'));
const requestedScope = readOption('--scope') ?? 'all';
const requestedMode = readOption('--mode') ?? 'full';

// bound memory on huge stage output; the failure packet only ever needs the tail
const MAX_ACCUMULATED_OUTPUT = 5 * 1024 * 1024;

function readOption(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function gitValue(args) {
  const result = spawnSync('git', args, { cwd: repositoryRoot, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : null;
}

function appendCapped(accumulated, chunk) {
  const next = accumulated + chunk;
  return next.length > MAX_ACCUMULATED_OUTPUT ? next.slice(-MAX_ACCUMULATED_OUTPUT) : next;
}

function runStage(stage) {
  return new Promise((resolveStage) => {
    const child = spawn(stage.command, {
      cwd: repositoryRoot,
      env: { ...process.env, CI_LEARNING_PHASE: stage.phase },
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';
    let settled = false;
    child.stdout.on('data', (chunk) => {
      process.stdout.write(chunk);
      output = appendCapped(output, chunk.toString('utf8'));
    });
    child.stderr.on('data', (chunk) => {
      process.stderr.write(chunk);
      output = appendCapped(output, chunk.toString('utf8'));
    });
    child.on('close', (code, signal) => {
      if (settled) {
        return;
      }
      settled = true;
      resolveStage({ status: code, signal, output });
    });
    // if the process never launches (e.g. missing shell/binary), 'close' never fires; without
    // this handler the promise would hang forever instead of failing the stage
    child.on('error', (error) => {
      if (settled) {
        return;
      }
      settled = true;
      const message = `[ci-learning] failed to launch stage command: ${error.message}\n`;
      process.stderr.write(message);
      resolveStage({ status: 1, signal: null, output: appendCapped(output, message) });
    });
  });
}

mkdirSync(cacheDirectory, { recursive: true });
const lessons = loadLessons(lessonsDirectory);

const fullStages = selectStages(plan, requestedScope, 'full', process.platform);
const stages = selectStages(plan, requestedScope, requestedMode, process.platform);

if (requestedMode === 'push') {
  const skippedPhases = fullStages
    .filter((stage) => !stages.includes(stage))
    .map((stage) => stage.phase);
  console.log(
    `[ci-learning] push mode: skipping ${skippedPhases.length > 0 ? skippedPhases.join(', ') : '(none)'} (covered by required CI checks)`,
  );
}

for (const stage of stages) {
  console.log(`\n[ci-learning] ${stage.phase}: ${stage.command}`);
  const result = await runStage(stage);
  if (result.status === 0) {
    continue;
  }

  const record = buildFailureRecord({
    phase: stage.phase,
    command: stage.command,
    exitCode: result.status ?? 1,
    signal: result.signal,
    output: result.output,
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
