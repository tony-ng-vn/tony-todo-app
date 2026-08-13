import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOMAIN_PATH = join(ROOT, 'src/todoCommands.js');
const SHELL_PATH = join(ROOT, 'functions/agent-todos.shell.ts');
const GENERATED_PATH = join(ROOT, 'functions/agent-todos.ts');
const MARKER = "import './todoCommands.js';";
const RELATIVE_IMPORT = /from\s+['"]\.\.?[/]/;

export function inlineAgentTodos({ check = false } = {}) {
  const domain = rewriteDomainSource(readFileSync(DOMAIN_PATH, 'utf8'));
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

function rewriteDomainSource(source) {
  if (RELATIVE_IMPORT.test(source)) {
    throw new Error('src/todoCommands.js must not use relative imports');
  }

  return source
    .replaceAll("from 'suncalc'", "from 'npm:suncalc'")
    .replaceAll('from "suncalc"', 'from "npm:suncalc"')
    .replace(/^export /gm, '');
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
