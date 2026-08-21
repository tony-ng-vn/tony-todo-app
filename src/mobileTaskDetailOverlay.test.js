import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const appHtml = readFileSync(new URL('../src/app.html', import.meta.url), 'utf8');
const taskDetail = readFileSync(
  new URL('../src/lib/components/TaskDetail.svelte', import.meta.url),
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

describe('mobile task detail overlay', () => {
  const overlay = ruleBlock(
    styles,
    'html:not(.is-native-host) .workspace.has-detail .task-detail {',
  );

  it('fills the small viewport instead of shrinking to content height', () => {
    expect(overlay).not.toMatch(/^\s*height:\s*auto;/m);
    expect(overlay).toMatch(/height:\s*100svh;/);
    expect(overlay).toMatch(/max-height:\s*100svh;/);
  });

  it('keeps the header actions in a flex row so Close stays tappable', () => {
    const header = ruleBlock(
      styles,
      'html:not(.is-native-host) .workspace.has-detail .detail-header {',
    );
    const actions = ruleBlock(
      styles,
      'html:not(.is-native-host) .workspace.has-detail .detail-window-actions {',
    );
    expect(header).toMatch(/flex-shrink:\s*0;/);
    expect(header).toMatch(/position:\s*sticky;/);
    expect(actions).toMatch(/display:\s*flex;/);
  });

  it('locks the overlay to the visual viewport while the keyboard is open', () => {
    expect(taskDetail).toMatch(/visualViewport/);
    expect(appHtml).toMatch(/interactive-widget=resizes-content/);
  });
});
