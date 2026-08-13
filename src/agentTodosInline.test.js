import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { inlineAgentTodos } from '../scripts/inline-agent-todos.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('agent-todos bundle', () => {
  it('splices src/todoCommands.js through an import, not a comment', () => {
    const shell = readFileSync(join(ROOT, 'functions/agent-todos.shell.ts'), 'utf8');
    expect(shell).toContain("import './todoCommands.js';");
    expect(shell).not.toContain('INLINE:');
  });

  it('keeps functions/agent-todos.ts generated from the domain module', () => {
    expect(() => inlineAgentTodos({ check: true })).not.toThrow();
  });
});
