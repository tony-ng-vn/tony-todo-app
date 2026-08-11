import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export function parseRequiredNodeMajor(versionSource) {
  // accept a bare major ("24"), a full semver ("24.14.0"), or a v-prefixed one
  const match = String(versionSource).trim().match(/^v?(\d+)(?:\.\d+){0,2}$/);
  return match ? Number.parseInt(match[1], 10) : null;
}

export function parseInstalledNodeMajor(version) {
  const match = String(version).trim().match(/^v?(\d+)(?:\.\d+){1,2}$/);
  return match ? Number.parseInt(match[1], 10) : null;
}

function main() {
  const scriptDirectory = dirname(fileURLToPath(import.meta.url));
  const requiredSource = readFileSync(resolve(scriptDirectory, '../.node-version'), 'utf8');
  const requiredMajor = parseRequiredNodeMajor(requiredSource);
  const installedMajor = parseInstalledNodeMajor(process.version);

  if (!requiredMajor || !installedMajor) {
    throw new Error('Unable to compare .node-version with the installed Node.js runtime.');
  }

  if (installedMajor !== requiredMajor) {
    throw new Error(
      `Node ${requiredMajor}.x is required, but ${process.version} is active. Switch Node versions before verifying or pushing.`,
    );
  }

  console.log(`Node.js toolchain matches .node-version: ${process.version}`);
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isDirectRun) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
