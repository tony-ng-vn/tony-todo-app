import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOMAIN_PATH = join(ROOT, 'src/todoCommands.js');
const SHELL_PATH = join(ROOT, 'functions/agent-todos.shell.ts');
const GENERATED_PATH = join(ROOT, 'functions/agent-todos.ts');
const MARKER = "import './todoCommands.js';";

// Matches one `import ... from '<specifier>';` statement (plus its trailing
// newline, so removing it doesn't leave a blank line behind). Anchored to
// the start of a line (leading whitespace allowed) and bounded to never
// cross a semicolon, so an "import" keyword sitting inside a comment or
// string cannot walk forward through real code looking for the next "from"
// and delete everything in between.
const IMPORT_STATEMENT = /^[\t ]*import\s+[^;]*?\s+from\s+['"]([^'"]+)['"];?\n?/gm;
// Side-effect imports ("import './x.js';", no bindings, no "from") - same
// anchoring rationale as IMPORT_STATEMENT above.
const SIDE_EFFECT_IMPORT = /^[\t ]*import\s+['"]([^'"]+)['"];?\n?/gm;
const RELATIVE_SPECIFIER = /^\.\.?\//;
const LOCAL_REEXPORT_LINE = /^export \{[^}]*\};?\s*$/gm;

export function inlineAgentTodos({ check = false } = {}) {
  const domain = bundleDomainSource(DOMAIN_PATH);
  const shell = readFileSync(SHELL_PATH, 'utf8');
  if (!shell.includes(MARKER)) {
    throw new Error(`Missing ${MARKER} in functions/agent-todos.shell.ts`);
  }

  const generated = shell.replace(MARKER, domain.trimEnd());

  if (check) {
    let existing = '';
    try {
      existing = readFileSync(GENERATED_PATH, 'utf8');
    } catch {
      throw new Error('functions/agent-todos.ts is missing; run npm run bundle:agent-todos');
    }

    if (existing !== generated) {
      throw new Error('functions/agent-todos.ts is stale; run npm run bundle:agent-todos');
    }

    return;
  }

  writeFileSync(GENERATED_PATH, generated);
}

// Deno functions deploy as a single file, so every local module reachable
// from src/todoCommands.js (e.g. noteEntries.js, sanFranciscoTime.js) gets
// flattened into one script: relative imports - including side-effect-only
// ones - are resolved and inlined depth-first (each module included once,
// dependencies before dependents), external package imports are hoisted to
// the top and deduped, and `export` keywords are stripped since the bundle
// has no module boundaries left. Exported for direct testing of the import
// matching, since none of these shapes exist in the real module graph.
export function bundleDomainSource(entryPath) {
  const externalImports = [];
  const seenExternalImports = new Set();
  const bodies = [];
  const visited = new Set();

  function visit(path) {
    if (visited.has(path)) {
      return;
    }
    visited.add(path);

    const source = readFileSync(path, 'utf8');
    const dir = dirname(path);
    const matches = [...source.matchAll(IMPORT_STATEMENT), ...source.matchAll(SIDE_EFFECT_IMPORT)].sort(
      (a, b) => a.index - b.index,
    );

    let body = '';
    let lastIndex = 0;

    for (const match of matches) {
      if (match.index < lastIndex) {
        // Already covered by a previously processed match; skip defensively
        // rather than slicing backwards.
        continue;
      }

      const [statement, specifier] = match;
      body += source.slice(lastIndex, match.index);
      lastIndex = match.index + statement.length;

      if (RELATIVE_SPECIFIER.test(specifier)) {
        visit(resolve(dir, specifier));
        continue;
      }

      const canonical = canonicalizeExternalImport(statement);
      if (!seenExternalImports.has(canonical)) {
        seenExternalImports.add(canonical);
        externalImports.push(statement.trimEnd());
      }
    }

    body += source.slice(lastIndex);
    bodies.push(stripExports(body).trim());
  }

  visit(entryPath);

  const header = externalImports
    .map((statement) =>
      statement
        .replaceAll("from 'suncalc'", "from 'npm:suncalc'")
        .replaceAll('from "suncalc"', 'from "npm:suncalc"'),
    )
    .join('\n');

  const bundled = header ? `${header}\n\n${bodies.join('\n\n')}` : bodies.join('\n\n');
  return bundled.replace(/\n{3,}/g, '\n\n');
}

// Two occurrences of the same external import can differ only in a trailing
// semicolon or trailing whitespace depending on where they sit in their
// file; canonicalizing before the dedup check treats them as the same
// import instead of emitting the line twice.
function canonicalizeExternalImport(statement) {
  return statement.trim().replace(/;+$/, '').trim();
}

function stripExports(source) {
  // A bare `export { a, b };` only re-exported names from another local
  // module; once everything is flattened those names are already top-level
  // bindings, so the statement is dropped instead of left as dead code.
  return source.replace(LOCAL_REEXPORT_LINE, '').replace(/^export /gm, '');
}

const isDirectRun =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isDirectRun) {
  try {
    inlineAgentTodos({ check: process.argv.includes('--check') });
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
