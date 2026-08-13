import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FRAGMENTS_DIR = join(ROOT, 'changelog.d');
const CHANGELOG_PATH = join(ROOT, 'CHANGELOG.md');
const PACKAGE_JSON_PATH = join(ROOT, 'package.json');
const INFO_PLIST_PATH = join(ROOT, 'native/App/Info.plist');
const CHANGELOG_HEADER = '# Changelog\n\n';

// Canonical category order, matching AGENTS.md's Changelog section and
// existing CHANGELOG.md entries. A release only includes the categories
// its fragments actually touched.
export const CANONICAL_CATEGORIES = ['Web App', 'Backend', 'Native App', 'CI & Tooling', 'Docs'];

const CATEGORY_HEADER = /^\*\*(.+)\*\*$/;
const BULLET_LINE = /^-\s+(.*)$/;

// Parses one fragment file's content into ordered {category, bullets}
// sections. Fragments use the same "**Category**" / "- " bullet shape
// as a compiled CHANGELOG.md entry (see changelog.d/README.md).
export function parseFragment(content, sourceName = 'fragment') {
  const sections = [];
  let current = null;

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    const headerMatch = line.match(CATEGORY_HEADER);
    if (headerMatch) {
      const category = headerMatch[1];
      if (!CANONICAL_CATEGORIES.includes(category)) {
        throw new Error(
          `Unknown changelog category "${category}" in ${sourceName}. Valid categories: ${CANONICAL_CATEGORIES.join(', ')}`,
        );
      }
      current = { category, bullets: [] };
      sections.push(current);
      continue;
    }

    const bulletMatch = line.match(BULLET_LINE);
    if (bulletMatch) {
      if (!current) {
        throw new Error(`Bullet found before any "**Category**" heading in ${sourceName}`);
      }
      current.bullets.push(bulletMatch[1]);
      continue;
    }

    throw new Error(`Unrecognized line in ${sourceName}: "${line}"`);
  }

  return sections;
}

// Merges parsed fragments' sections by category, in canonical order.
// Categories no fragment touched are omitted entirely.
export function mergeSections(parsedFragments) {
  if (parsedFragments.length === 0) {
    throw new Error(
      'No changelog fragments found in changelog.d/. Add one before compiling (see changelog.d/README.md).',
    );
  }

  const byCategory = new Map();
  for (const sections of parsedFragments) {
    for (const { category, bullets } of sections) {
      if (!byCategory.has(category)) {
        byCategory.set(category, []);
      }
      byCategory.get(category).push(...bullets);
    }
  }

  return CANONICAL_CATEGORIES.filter((category) => byCategory.has(category)).map((category) => ({
    category,
    bullets: byCategory.get(category),
  }));
}

export function renderCategorySections(sections) {
  return sections
    .map(
      ({ category, bullets }) =>
        `**${category}**\n\n${bullets.map((bullet) => `- ${bullet}`).join('\n')}`,
    )
    .join('\n\n');
}

// Matches the exact shape of an existing CHANGELOG.md entry.
export function renderChangelogEntry({ version, date, sections }) {
  return `## v${version}\n\n${date}\n\n${renderCategorySections(sections)}\n\n---\n\n`;
}

export function computeNextVersion(currentVersion, bump) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(currentVersion);
  if (!match) {
    throw new Error(`Cannot parse version "${currentVersion}" as major.minor.patch`);
  }

  let major = Number(match[1]);
  let minor = Number(match[2]);
  let patch = Number(match[3]);

  if (bump === 'major') {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (bump === 'minor') {
    minor += 1;
    patch = 0;
  } else if (bump === 'patch') {
    patch += 1;
  } else {
    throw new Error(`Unknown bump type "${bump}"; expected patch, minor, or major`);
  }

  return `${major}.${minor}.${patch}`;
}

export function computeNextBuildVersion(currentBuildVersion) {
  if (!/^\d+$/.test(currentBuildVersion)) {
    throw new Error(`Cannot parse native build number "${currentBuildVersion}"`);
  }

  return String(Number(currentBuildVersion) + 1);
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function readFragmentFiles() {
  return readdirSync(FRAGMENTS_DIR)
    .filter((name) => name.endsWith('.md') && name !== 'README.md')
    .sort()
    .map((name) => ({ name, path: join(FRAGMENTS_DIR, name) }));
}

function prependChangelogEntry(entry) {
  const existing = readFileSync(CHANGELOG_PATH, 'utf8');
  if (!existing.startsWith(CHANGELOG_HEADER)) {
    throw new Error('CHANGELOG.md does not start with the expected "# Changelog" header');
  }
  writeFileSync(CHANGELOG_PATH, CHANGELOG_HEADER + entry + existing.slice(CHANGELOG_HEADER.length));
}

function bumpPackageJsonVersion(nextVersion) {
  const pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf8'));
  pkg.version = nextVersion;
  writeFileSync(PACKAGE_JSON_PATH, `${JSON.stringify(pkg, null, 2)}\n`);
}

function bumpInfoPlistVersion(nextVersion) {
  const plist = readFileSync(INFO_PLIST_PATH, 'utf8');
  const shortVersionPattern =
    /(<key>CFBundleShortVersionString<\/key>\s*<string>)[^<]+(<\/string>)/;
  const buildVersionPattern = /(<key>CFBundleVersion<\/key>\s*<string>)([^<]+)(<\/string>)/;
  const buildVersionMatch = plist.match(buildVersionPattern);
  if (!shortVersionPattern.test(plist) || !buildVersionMatch) {
    throw new Error('CFBundleShortVersionString not found in native/App/Info.plist');
  }
  const nextBuildVersion = computeNextBuildVersion(buildVersionMatch[2]);
  writeFileSync(
    INFO_PLIST_PATH,
    plist
      .replace(shortVersionPattern, `$1${nextVersion}$2`)
      .replace(buildVersionPattern, `$1${nextBuildVersion}$3`),
  );
}

// IO wrapper: reads changelog.d/, package.json, and native/App/Info.plist,
// writes the compiled entry and version bumps, refreshes the lockfile, and
// deletes the consumed fragments. Kept separate from the pure functions
// above so those can be unit tested without touching the filesystem.
export function compileChangelog(bump) {
  const fragmentFiles = readFragmentFiles();
  const parsedFragments = fragmentFiles.map(({ name, path }) =>
    parseFragment(readFileSync(path, 'utf8'), `changelog.d/${name}`),
  );
  const sections = mergeSections(parsedFragments);

  const packageJson = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf8'));
  const version = computeNextVersion(packageJson.version, bump);
  const entry = renderChangelogEntry({ version, date: todayDate(), sections });

  prependChangelogEntry(entry);
  bumpPackageJsonVersion(version);
  bumpInfoPlistVersion(version);
  execFileSync('npm', ['install', '--package-lock-only'], { cwd: ROOT, stdio: 'inherit' });

  for (const { path } of fragmentFiles) {
    unlinkSync(path);
  }

  return { version, entry };
}

function main() {
  const bump = process.argv[2];
  if (!['patch', 'minor', 'major'].includes(bump)) {
    throw new Error('Usage: node scripts/compile-changelog.mjs <patch|minor|major>');
  }
  const { version } = compileChangelog(bump);
  console.log(`Compiled CHANGELOG.md entry for v${version}.`);
}

const isDirectRun =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isDirectRun) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
