import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const webPage = readFileSync(new URL('./routes/+page.svelte', import.meta.url), 'utf8');
const menubarPage = readFileSync(new URL('./routes/menubar/+page.svelte', import.meta.url), 'utf8');

function readFunction(source, name) {
  const start = source.indexOf(`function ${name}`);
  const nextAsync = source.indexOf('\n  async function ', start + 1);
  const nextSync = source.indexOf('\n  function ', start + 1);
  const end = [nextAsync, nextSync].filter((index) => index >= 0).sort((a, b) => a - b)[0];

  expect(start).toBeGreaterThanOrEqual(0);
  return source.slice(start, end < 0 ? source.length : end);
}

describe('task timing save wiring', () => {
  it.each([
    'handleComplete',
    'handleFail',
    'handleTimerAction',
    'moveBoardTodo',
    'handleCompletedAtChange',
    'handleSomedayChange',
    'moveSummaryTodo',
    'reopenSummaryTodo',
    'handleNoteInput',
  ])('queues web timing writes from %s', (handler) => {
    expect(readFunction(webPage, handler)).toContain('syncTaskTimingChange(');
  });

  it('queues each task changed by the automatic day rollover', () => {
    expect(readFunction(webPage, 'syncSelectedDayToToday')).toContain(
      'syncArchivedTimingChanges(',
    );
    expect(readFunction(webPage, 'syncArchivedTimingChanges')).toContain(
      'syncTaskTimingChange(',
    );
  });

  it.each(['handleTimerAction', 'handleComplete', 'handleNoteInput', 'handleSomedayChange'])(
    'queues menu bar timing writes from %s',
    (handler) => {
      expect(readFunction(menubarPage, handler)).toContain('syncTaskTimingChange(');
    },
  );
});
