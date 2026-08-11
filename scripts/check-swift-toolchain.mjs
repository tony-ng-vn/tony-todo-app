import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

export function parseRequiredToolsVersion(packageSource) {
  return packageSource.match(/swift-tools-version:\s*(\d+(?:\.\d+){1,2})/)?.[1] ?? null;
}

export function parseInstalledSwiftVersion(versionOutput) {
  return versionOutput.match(/Swift version\s+(\d+(?:\.\d+){1,2})/i)?.[1] ?? null;
}

export function isVersionAtLeast(installedVersion, requiredVersion) {
  const installedParts = versionParts(installedVersion);
  const requiredParts = versionParts(requiredVersion);

  for (let index = 0; index < Math.max(installedParts.length, requiredParts.length); index += 1) {
    const installedPart = installedParts[index] ?? 0;
    const requiredPart = requiredParts[index] ?? 0;
    if (installedPart !== requiredPart) {
      return installedPart > requiredPart;
    }
  }

  return true;
}

function versionParts(version) {
  return version.split('.').map((part) => Number.parseInt(part, 10));
}

function main() {
  const scriptDirectory = dirname(fileURLToPath(import.meta.url));
  const packageSource = readFileSync(resolve(scriptDirectory, '../native/Package.swift'), 'utf8');
  const swiftResult = spawnSync('swift', ['--version'], { encoding: 'utf8' });
  const versionOutput = `${swiftResult.stdout ?? ''}\n${swiftResult.stderr ?? ''}`;
  const requiredVersion = parseRequiredToolsVersion(packageSource);
  const installedVersion = parseInstalledSwiftVersion(versionOutput);

  if (swiftResult.status !== 0 || !requiredVersion || !installedVersion) {
    throw new Error(`unable to compare Package.swift with the installed Swift toolchain\n${versionOutput.trim()}`);
  }

  if (!isVersionAtLeast(installedVersion, requiredVersion)) {
    throw new Error(`Swift ${requiredVersion} or newer is required, but Swift ${installedVersion} is installed`);
  }

  console.log(`Swift toolchain satisfies package requirement: installed ${installedVersion}, required ${requiredVersion}+`);
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
