import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FUNCTIONS_DIR = 'functions';
const SHELL_SUFFIX = '.shell.ts';
const SOURCE_SUFFIX = '.ts';

export const TODO_APP_PROJECT_ID = '7e77e15d-9e4d-4591-9951-8b99289200cd';

const LIVE_SOURCE_HEADER = /^Function:.*\n(?:Status:.*\n)?---\n/;

export function listDeployableSlugs(fileNames) {
  return fileNames
    .filter(
      (name) =>
        name.endsWith(SOURCE_SUFFIX) && !name.endsWith(SHELL_SUFFIX) && !name.startsWith('.'),
    )
    .map((name) => name.slice(0, -SOURCE_SUFFIX.length))
    .sort();
}

export function slugsFromChangedPaths(paths) {
  const slugs = new Set();

  for (const relativePath of paths) {
    const normalized = relativePath.replaceAll('\\', '/');
    const prefix = `${FUNCTIONS_DIR}/`;
    if (!normalized.startsWith(prefix)) {
      continue;
    }

    const fileName = normalized.slice(prefix.length);
    if (fileName.includes('/') || fileName.endsWith(SHELL_SUFFIX) || !fileName.endsWith(SOURCE_SUFFIX)) {
      continue;
    }

    slugs.add(fileName.slice(0, -SOURCE_SUFFIX.length));
  }

  return [...slugs].sort();
}

export function stripLiveFunctionSource(output) {
  return String(output ?? '')
    .replaceAll('\r\n', '\n')
    .replace(LIVE_SOURCE_HEADER, '');
}

export function normalizeFunctionSource(source) {
  return String(source ?? '')
    .replaceAll('\r\n', '\n')
    .replace(/^\uFEFF/, '');
}

export function sourcesMatch(localSource, liveOutput) {
  return normalizeFunctionSource(localSource) === normalizeFunctionSource(stripLiveFunctionSource(liveOutput));
}

export function parseSyncArgs(argv) {
  const options = {
    deployAll: false,
    deployChanged: false,
    check: false,
    base: null,
    head: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case '--deploy-all':
        options.deployAll = true;
        break;
      case '--deploy-changed':
        options.deployChanged = true;
        break;
      case '--check':
        options.check = true;
        break;
      case '--base':
        options.base = argv[index + 1] ?? null;
        index += 1;
        break;
      case '--head':
        options.head = argv[index + 1] ?? null;
        index += 1;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (options.deployAll && options.deployChanged) {
    throw new Error('Use only one of --deploy-all or --deploy-changed');
  }

  if (options.deployChanged && (!options.base || !options.head)) {
    throw new Error('--deploy-changed requires --base and --head');
  }

  if (!options.deployAll && !options.deployChanged && !options.check) {
    throw new Error('Pass --check, --deploy-all, and/or --deploy-changed');
  }

  return options;
}

function defaultGitDiff(root, base, head) {
  const output = execFileSync('git', ['diff', '--name-only', `${base}..${head}`, '--', FUNCTIONS_DIR], {
    cwd: root,
    encoding: 'utf8',
  });
  return output.split('\n').map((line) => line.trim()).filter(Boolean);
}

function defaultRunInsforge(args, { capture = false, cwd = ROOT } = {}) {
  return execFileSync('npx', ['-y', '@insforge/cli', ...args], {
    cwd,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
  });
}

export function syncInsforgeFunctions({
  root = ROOT,
  argv = process.argv.slice(2),
  listFiles = (directory) => readdirSync(directory),
  readSource = (filePath) => readFileSync(filePath, 'utf8'),
  gitDiff = defaultGitDiff,
  runInsforge = defaultRunInsforge,
  log = console,
} = {}) {
  const options = parseSyncArgs(argv);
  const functionsDirectory = join(root, FUNCTIONS_DIR);
  const allSlugs = listDeployableSlugs(listFiles(functionsDirectory));

  if (allSlugs.length === 0) {
    throw new Error(`No deployable function files found in ${FUNCTIONS_DIR}/`);
  }

  let slugsToDeploy = [];
  if (options.deployAll) {
    slugsToDeploy = allSlugs;
  } else if (options.deployChanged) {
    slugsToDeploy = slugsFromChangedPaths(gitDiff(root, options.base, options.head));
    const deletedSlugs = slugsToDeploy.filter((slug) => !allSlugs.includes(slug));
    if (deletedSlugs.length > 0) {
      throw new Error(
        `Changed paths include deleted function source files: ${deletedSlugs.join(', ')}. Remove the live functions explicitly before rerunning this deployment. No functions were deployed.`,
      );
    }
  }

  for (const slug of slugsToDeploy) {
    const filePath = join(FUNCTIONS_DIR, `${slug}${SOURCE_SUFFIX}`);
    log.error(`Deploying ${slug} from ${filePath}`);
    runInsforge(['functions', 'deploy', slug, '--file', filePath], { cwd: root });
  }

  if (!options.check) {
    return { deployed: slugsToDeploy, checked: [] };
  }

  const mismatches = [];
  for (const slug of allSlugs) {
    const localSource = readSource(join(functionsDirectory, `${slug}${SOURCE_SUFFIX}`));
    const liveOutput = runInsforge(['functions', 'code', slug], { capture: true, cwd: root });
    if (!sourcesMatch(localSource, liveOutput)) {
      mismatches.push(slug);
    }
  }

  if (mismatches.length > 0) {
    throw new Error(
      `Live InsForge function source does not match the repo: ${mismatches.join(', ')}. Merged code is not live until this job deploys successfully.`,
    );
  }

  log.error(`Live function source matches the repo (${allSlugs.join(', ')}).`);
  return { deployed: slugsToDeploy, checked: allSlugs };
}

const isDirectRun =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isDirectRun) {
  try {
    syncInsforgeFunctions();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
