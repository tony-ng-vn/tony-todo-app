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

  it('looks up per-user dlg_ keys and ignores body ownerUserId on that path', () => {
    const shell = readFileSync(join(ROOT, 'functions/agent-todos.shell.ts'), 'utf8');
    expect(shell).toContain("from('agent_tokens')");
    expect(shell).toContain('agentTokenUserId');
    expect(shell).toContain('agentTokenUserId ?? verifiedUserId');
    expect(shell).toContain("eq('token_hash'");
    expect(shell).not.toContain(".eq('token',");
  });

  it('keeps functions/agent-todos.ts generated from the domain module', () => {
    expect(() => inlineAgentTodos({ check: true })).not.toThrow();
  });
});
