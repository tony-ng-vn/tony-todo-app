import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const agents = readFileSync(join(ROOT, 'AGENTS.md'), 'utf8');

function sectionAfter(heading) {
  const start = agents.indexOf(heading);
  expect(start).toBeGreaterThan(-1);
  const rest = agents.slice(start + heading.length);
  const next = rest.search(/\n## /);
  return next === -1 ? rest : rest.slice(0, next);
}

describe('AGENTS.md commit rule', () => {
  it('lives outside the InsForge skill-sync block', () => {
    const insforgeEnd = agents.indexOf('<!-- INSFORGE:END -->');
    const commits = agents.indexOf('## Commits');
    expect(insforgeEnd).toBeGreaterThan(-1);
    expect(commits).toBeGreaterThan(insforgeEnd);
  });

  it('forbids squashing a whole PR into one commit', () => {
    const commits = sectionAfter('## Commits');
    expect(commits).toContain('One idea per commit');
    expect(commits).toContain('Never implement the whole PR');
    expect(commits).toContain('single commit');
  });
});
