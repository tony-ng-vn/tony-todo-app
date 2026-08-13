import { describe, expect, it } from 'vitest';

import {
  INSFORGE_CLI_SPEC,
  listDeployableSlugs,
  parseSyncArgs,
  slugsFromChangedPaths,
  sourcesMatch,
  stripLiveFunctionSource,
  syncInsforgeFunctions,
} from '../scripts/insforge-functions-sync.mjs';

describe('listDeployableSlugs', () => {
  it('keeps generated function files and skips the agent-todos shell', () => {
    expect(
      listDeployableSlugs([
        'agent-todos.shell.ts',
        'agent-todos.ts',
        'draft-follow-up.ts',
        '.keep',
      ]),
    ).toEqual(['agent-todos', 'draft-follow-up']);
  });
});

describe('slugsFromChangedPaths', () => {
  it('maps functions/*.ts changes to slugs and ignores the shell file', () => {
    expect(
      slugsFromChangedPaths([
        'functions/agent-todos.ts',
        'functions/agent-todos.shell.ts',
        'src/todoCommands.js',
        'functions/nested/nope.ts',
      ]),
    ).toEqual(['agent-todos']);
  });
});

describe('stripLiveFunctionSource', () => {
  it('removes the CLI header so live source can match the repo file', () => {
    const live = [
      'Function: agent-todos (agent-todos)',
      'Status:   active',
      '---',
      'export default async function handler() {}',
      '',
    ].join('\n');

    expect(stripLiveFunctionSource(live)).toBe('export default async function handler() {}\n');
  });
});

describe('sourcesMatch', () => {
  it('treats CRLF and a live CLI header as the same source', () => {
    const local = 'export default async function handler() {}\n';
    const live = 'Function: agent-todos (agent-todos)\nStatus:   active\n---\nexport default async function handler() {}\r\n';
    expect(sourcesMatch(local, live)).toBe(true);
  });

  it('fails when live source drifted', () => {
    expect(sourcesMatch('const a = 1;\n', 'Function: x\n---\nconst a = 2;\n')).toBe(false);
  });
});

describe('parseSyncArgs', () => {
  it('requires a mode', () => {
    expect(() => parseSyncArgs([])).toThrow(/--check/);
  });

  it('requires a range for changed deploys', () => {
    expect(() => parseSyncArgs(['--deploy-changed'])).toThrow(/--base and --head/);
  });
});

describe('syncInsforgeFunctions', () => {
  it('deploys only changed slugs then checks every repo function against live source', () => {
    const deployed = [];
    const coded = [];
    const sources = {
      'agent-todos.ts': 'agent source\n',
      'draft-follow-up.ts': 'draft source\n',
    };

    const result = syncInsforgeFunctions({
      root: '/repo',
      argv: ['--deploy-changed', '--base', 'abc', '--head', 'def', '--check'],
      listFiles: () => ['agent-todos.shell.ts', 'agent-todos.ts', 'draft-follow-up.ts'],
      readSource: (filePath) => sources[filePath.split('/').at(-1)],
      gitDiff: () => ['functions/agent-todos.ts'],
      runInsforge: (args) => {
        if (args[1] === 'deploy') {
          deployed.push(args[2]);
          return '';
        }

        coded.push(args[2]);
        const body = args[2] === 'agent-todos' ? 'agent source\n' : 'draft source\n';
        return `Function: ${args[2]}\nStatus:   active\n---\n${body}`;
      },
      log: { error() {} },
    });

    expect(deployed).toEqual(['agent-todos']);
    expect(coded).toEqual(['agent-todos', 'draft-follow-up']);
    expect(result).toEqual({
      deployed: ['agent-todos'],
      checked: ['agent-todos', 'draft-follow-up'],
    });
  });

  it('fails before any deploy when a changed function file was deleted', () => {
    const deployed = [];

    expect(() =>
      syncInsforgeFunctions({
        root: '/repo',
        argv: ['--deploy-changed', '--base', 'abc', '--head', 'def'],
        listFiles: () => ['agent-todos.ts'],
        gitDiff: () => ['functions/draft-follow-up.ts'],
        runInsforge: (args) => {
          if (args[1] === 'deploy') {
            deployed.push(args[2]);
          }
          return '';
        },
        log: { error() {} },
      }),
    ).toThrow(/deleted and cannot be deployed: draft-follow-up/);

    expect(deployed).toEqual([]);
  });

  it('pins the InsForge CLI package version', () => {
    expect(INSFORGE_CLI_SPEC).toBe('@insforge/cli@0.2.6');
  });

  it('fails when live source does not match the repo', () => {
    expect(() =>
      syncInsforgeFunctions({
        root: '/repo',
        argv: ['--check'],
        listFiles: () => ['agent-todos.ts'],
        readSource: () => 'repo source\n',
        runInsforge: () => 'Function: agent-todos\n---\nlive source\n',
        log: { error() {} },
      }),
    ).toThrow(/does not match the repo: agent-todos/);
  });
});
