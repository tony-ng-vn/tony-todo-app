import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildLessonFromCandidate } from './ci-learning-core.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const candidateArgument = readOption('--candidate');
const id = readOption('--id');
const title = readOption('--title');

function readOption(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

if (!candidateArgument || !id || !title) {
  throw new Error('Usage: npm run ci:promote -- --candidate <path> --id <slug> --title <title>');
}
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
  throw new Error('Lesson id must be a lowercase hyphenated slug.');
}

const candidatePath = resolve(repositoryRoot, candidateArgument);
if (!candidatePath.startsWith(resolve(repositoryRoot, '.ci-learning/'))) {
  throw new Error('Only candidates from .ci-learning can be promoted.');
}
if (!existsSync(candidatePath)) {
  throw new Error(`Candidate does not exist: ${candidateArgument}`);
}

const candidate = JSON.parse(readFileSync(candidatePath, 'utf8'));
let lesson;
try {
  lesson = buildLessonFromCandidate({ id, title, candidate });
} catch (error) {
  throw new Error(`Candidate ${basename(candidatePath)} is invalid: ${error.message}`);
}

const lessonsDirectory = resolve(repositoryRoot, '.ci/lessons');
const lessonPath = resolve(lessonsDirectory, `${id}.json`);
if (existsSync(lessonPath)) {
  throw new Error(`Lesson already exists: ${id}`);
}
mkdirSync(lessonsDirectory, { recursive: true });
writeFileSync(lessonPath, `${JSON.stringify(lesson, null, 2)}\n`);
console.log(`Promoted ${candidateArgument} to .ci/lessons/${id}.json.`);
console.log('Review its context, solution, and tradeoffs, then run npm run ci:replay.');
