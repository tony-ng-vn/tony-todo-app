import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

if (process.env.CI) {
  console.log('Skipping local Git hook setup in CI.');
  process.exit(0);
}

const repositoryCheck = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], {
  cwd: repositoryRoot,
  encoding: 'utf8',
});
if (repositoryCheck.status !== 0) {
  console.log('Skipping Git hook setup outside a working tree.');
  process.exit(0);
}

const configResult = spawnSync('git', ['config', 'core.hooksPath', '.githooks'], {
  cwd: repositoryRoot,
  encoding: 'utf8',
});
if (configResult.status !== 0) {
  throw new Error(configResult.stderr.trim() || 'Unable to configure the repository Git hooks.');
}

console.log('Installed repository Git hooks from .githooks.');
