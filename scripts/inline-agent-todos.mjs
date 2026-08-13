import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOMAIN_PATH = join(ROOT, 'src/todoCommands.js');
const SHELL_PATH = join(ROOT, 'functions/agent-todos.shell.ts');
const GENERATED_PATH = join(ROOT, 'functions/agent-todos.ts');
const MARKER = "import './todoCommands.js';";

// Matches one `import ... from '<specifier>';` statement (plus its trailing
// newline, so removing it doesn't leave a blank line behind).
const IMPORT_STATEMENT = /import\s+[\s\S]*?\s+from\s+['"]([^'"]+)['"];?\n?/g;
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
// flattened into one script: relative imports are resolved and inlined
// depth-first (each module included once, dependencies before dependents),
// external package imports are hoisted to the top and deduped, and `export`
// keywords are stripped since the bundle has no module boundaries left.
function bundleDomainSource(entryPath) {
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
    let body = '';
    let lastIndex = 0;

    for (const match of source.matchAll(IMPORT_STATEMENT)) {
      const [statement, specifier] = match;
      body += source.slice(lastIndex, match.index);
      lastIndex = match.index + statement.length;

      if (RELATIVE_SPECIFIER.test(specifier)) {
        visit(resolve(dir, specifier));
        continue;
      }

      if (!seenExternalImports.has(statement)) {
        seenExternalImports.add(statement);
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
