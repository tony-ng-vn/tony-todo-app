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
  it('is the first section so agents cannot miss it', () => {
    const firstHeading = agents.match(/^## .+$/m)?.[0];
    expect(firstHeading).toBe('## Commits');
    expect(agents.indexOf('## Commits')).toBeLessThan(
      agents.indexOf('<!-- INSFORGE:START -->')
    );
  });

  it('lives outside the InsForge skill-sync block', () => {
    const insforgeStart = agents.indexOf('<!-- INSFORGE:START -->');
    const insforgeEnd = agents.indexOf('<!-- INSFORGE:END -->');
    const commits = agents.indexOf('## Commits');
    expect(insforgeStart).toBeGreaterThan(-1);
    expect(insforgeEnd).toBeGreaterThan(insforgeStart);
    expect(commits).toBeGreaterThan(-1);
    expect(commits < insforgeStart || commits > insforgeEnd).toBe(true);
  });

  it('forbids squashing a whole PR into one commit', () => {
    const commits = sectionAfter('## Commits');
    expect(commits).toContain('One idea per commit');
    expect(commits).toContain('Never implement the whole PR');
    expect(commits).toContain('single commit');
  });
});
