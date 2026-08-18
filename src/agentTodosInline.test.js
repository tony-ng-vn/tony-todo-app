import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformWithOxc } from 'vite';
import { afterEach, describe, expect, it } from 'vitest';
import { bundleDomainSource, inlineAgentTodos } from '../scripts/inline-agent-todos.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('agent-todos bundle', () => {
  it('splices src/todoCommands.js through an import, not a comment', () => {
    const shell = readFileSync(join(ROOT, 'functions/agent-todos.shell.ts'), 'utf8');
    expect(shell).toContain("import './todoCommands.js';");
    expect(shell).not.toContain('INLINE:');
  });

  it('looks up per-user dlg_ keys and ignores body ownerUserId on that path', () => {
    const shell = readFileSync(join(ROOT, 'functions/agent-todos.shell.ts'), 'utf8');
    expect(shell).toContain("from('agent_tokens')");
    expect(shell).toContain('agentTokenUserId');
    expect(shell).toContain('agentTokenUserId ?? verifiedUserId');
    expect(shell).toContain("eq('token_hash'");
    expect(shell).not.toContain(".eq('token',");
  });

  it('returns the live catalog for describe and unknown commands without loading todos', () => {
    const shell = readFileSync(join(ROOT, 'functions/agent-todos.shell.ts'), 'utf8');
    expect(shell).toContain('commandNeedsTodos');
    expect(shell).toContain('parsed.catalog ? { error: parsed.error, ...parsed.catalog }');
    expect(shell).toContain("case 'unknown_command':");
    expect(shell).toContain('body.apiVersion === undefined');
  });

  it('keeps functions/agent-todos.ts generated from the domain module', () => {
    expect(() => inlineAgentTodos({ check: true })).not.toThrow();
  });

  // The generated file deploys straight to Deno after merge, so a splice
  // that produces unparseable TypeScript (e.g. a "$`" in the domain source
  // being read as a String.replace pattern) must fail here, not in prod.
  it('generates a syntactically valid TypeScript module', async () => {
    const generated = readFileSync(join(ROOT, 'functions/agent-todos.ts'), 'utf8');

    await expect(transformWithOxc(generated, 'agent-todos.ts')).resolves.toBeDefined();
  });
});

describe('bundleDomainSource import matching', () => {
  let fixtureDir;

  afterEach(() => {
    if (fixtureDir) {
      rmSync(fixtureDir, { recursive: true, force: true });
      fixtureDir = undefined;
    }
  });

  function writeFixture(files) {
    fixtureDir = mkdtempSync(join(tmpdir(), 'agent-todos-fixture-'));
    for (const [name, content] of Object.entries(files)) {
      writeFileSync(join(fixtureDir, name), content);
    }
    return join(fixtureDir, 'entry.js');
  }

  it('does not let an "import" inside a comment consume real code through a later "from"', () => {
    const entry = writeFixture({
      'entry.js': [
        "// see import notes for context",
        "const marker = 'keep me';",
        '',
        "import { real } from './real.js';",
        '',
        'export function entry() {',
        '  return real() + marker;',
        '}',
        '',
      ].join('\n'),
      'real.js': ["export function real() {", "  return 'real ';", '}', ''].join('\n'),
    });

    const result = bundleDomainSource(entry);

    expect(result).toContain('// see import notes for context');
    expect(result).toContain("const marker = 'keep me';");
    expect(result).toContain('function real()');
    expect(result).toContain('function entry()');
    expect(result).not.toContain("import { real } from './real.js'");
  });

  it('inlines a relative side-effect import and removes the statement from the body', () => {
    const entry = writeFixture({
      'entry.js': [
        "import './setup.js';",
        '',
        'export function entry() {',
        "  return 'entry';",
        '}',
        '',
      ].join('\n'),
      'setup.js': ['globalThis.setupRan = true;', ''].join('\n'),
    });

    const result = bundleDomainSource(entry);

    expect(result).toContain('globalThis.setupRan = true;');
    expect(result).not.toContain("import './setup.js';");
  });

  it('hoists an external side-effect import like any other external import', () => {
    const entry = writeFixture({
      'entry.js': [
        "import 'external-side-effect-pkg';",
        '',
        'export function entry() {',
        "  return 'entry';",
        '}',
        '',
      ].join('\n'),
    });

    const result = bundleDomainSource(entry);

    expect(result).toContain("import 'external-side-effect-pkg';");
    expect(result.indexOf("import 'external-side-effect-pkg';")).toBe(
      result.lastIndexOf("import 'external-side-effect-pkg';"),
    );
  });

  it('canonicalizes external imports before dedup so trailing semicolon differences do not duplicate the header', () => {
    const entry = writeFixture({
      'entry.js': [
        "import { helper } from 'some-pkg';",
        "import { dep } from './dep.js';",
        '',
        'export function entry() {',
        '  return helper() + dep();',
        '}',
        '',
      ].join('\n'),
      // No trailing semicolon - the same package import, differing only in
      // a trailing semicolon/whitespace, should still dedup with entry.js's.
      'dep.js': ["import { helper } from 'some-pkg'", 'export function dep() {', '  return helper();', '}', ''].join(
        '\n',
      ),
    });

    const result = bundleDomainSource(entry);

    const occurrences = (result.match(/from 'some-pkg'/g) ?? []).length;
    expect(occurrences).toBe(1);
  });
});
