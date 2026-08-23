import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const taskPanel = readFileSync(
  new URL('../src/lib/components/TaskPanel.svelte', import.meta.url),
  'utf8',
);
const composer = readFileSync(
  new URL('../src/lib/components/AddTaskOverlay.svelte', import.meta.url),
  'utf8',
);

function ruleBlock(source, selector) {
  const start = source.indexOf(selector);
  expect(start, `missing selector ${selector}`).toBeGreaterThan(-1);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') {
      depth += 1;
    } else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(open + 1, index);
      }
    }
  }
  throw new Error(`unclosed rule for ${selector}`);
}

function searchInputMarkup() {
  const start = taskPanel.indexOf('id="task-search"');
  expect(start).toBeGreaterThan(-1);
  return taskPanel.slice(Math.max(0, start - 180), start + 420);
}

describe('task search typing chrome', () => {
  it('uses a plain text field like the new-task composer', () => {
    const markup = searchInputMarkup();
    expect(markup).toMatch(/type="text"/);
    expect(markup).toMatch(/inputmode="search"/);
    expect(markup).not.toMatch(/type="search"/);
  });

  it('matches the composer field surface and drops the native focus glow', () => {
    const search = ruleBlock(styles, '.task-search {');
    const searchInput = ruleBlock(styles, '.task-search input {');
    const searchFocus = ruleBlock(
      styles,
      '.task-search input:focus,\n.task-search input:focus-visible {',
    );
    const composerTitle = ruleBlock(composer, '.composer-title {');

    expect(search).toContain('background: var(--field-surface);');
    expect(search).toContain('border-radius: 12px;');
    expect(composerTitle).toContain('background: var(--field-surface);');
    expect(composerTitle).toContain('border-radius: 12px;');
    expect(searchInput).toMatch(/outline:\s*none;/);
    expect(searchFocus).toMatch(/outline:\s*none;/);
    expect(searchFocus).toMatch(/box-shadow:\s*none;/);
  });
});
