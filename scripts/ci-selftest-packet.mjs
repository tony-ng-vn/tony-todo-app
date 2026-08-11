import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildFailureRecord } from './ci-learning-core.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cacheDirectory = resolve(repositoryRoot, '.ci-learning');
const packetPath = resolve(cacheDirectory, 'selftest-failure.json');

// synthetic secret and path exercise redaction and machine-path scrubbing the same way a real
// failure would; the artifact upload step below (if-no-files-found: error) proves this ran at all,
// since ci.yml's own upload only fires on failure() and a green CI run never exercises it
const record = buildFailureRecord({
  phase: 'selftest.packet',
  command: 'selftest',
  exitCode: 1,
  output: [
    'FAIL /Users/selftest/project/src/example.js:19:4',
    'FAKE_API_KEY=selftest-value',
    'Duration 128ms',
  ].join('\n'),
  context: { projectKinds: ['node'] },
});

mkdirSync(cacheDirectory, { recursive: true });
writeFileSync(packetPath, `${JSON.stringify(record, null, 2)}\n`);

const serialized = JSON.stringify(record);
const leaks = [];
if (serialized.includes('selftest-value')) {
  leaks.push('the fake secret "selftest-value" survived redaction');
}
if (serialized.includes('/Users/selftest')) {
  leaks.push('the fake path "/Users/selftest" survived the machine-path scrub');
}

if (leaks.length > 0) {
  console.error(`[ci-learning] Failure packet self-test failed:\n- ${leaks.join('\n- ')}`);
  process.exit(1);
}

console.log(`[ci-learning] Failure packet self-test passed: ${packetPath}`);
