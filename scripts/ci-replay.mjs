import { resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { buildFailureRecord, lessonMatches, loadLessons } from './ci-learning-core.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lessons = loadLessons(resolve(repositoryRoot, '.ci/lessons'));

for (const lesson of lessons) {
  if (!lesson.id || !lesson.title || !lesson.match?.length || !lesson.failureExamples?.length) {
    throw new Error(`Lesson ${lesson.id ?? '<unknown>'} is missing required evidence.`);
  }
  for (const example of lesson.failureExamples) {
    const record = buildFailureRecord({
      phase: lesson.appliesTo?.phases?.[0] ?? 'unknown',
      command: lesson.harness?.command ?? 'unknown',
      exitCode: 1,
      output: example,
      context: { projectKinds: lesson.appliesTo?.projectKinds ?? [] },
    });
    if (!lessonMatches(record, lesson)) {
      throw new Error(`Lesson ${lesson.id} no longer recognizes its saved failure evidence.`);
    }
  }

  if (lesson.harness?.command) {
    console.log(`[ci-learning] Replaying ${lesson.id}: ${lesson.harness.command}`);
    const result = spawnSync(lesson.harness.command, {
      cwd: repositoryRoot,
      env: process.env,
      shell: true,
      stdio: 'inherit',
    });
    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }
  }
}

console.log(`[ci-learning] Replayed ${lessons.length} reusable CI lessons.`);
