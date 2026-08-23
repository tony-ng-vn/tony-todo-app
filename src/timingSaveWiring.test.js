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
    'handleSomedayChange',
    'handlePromoteProject',
  ])('queues web timing writes from %s', (handler) => {
    expect(readFunction(webPage, handler)).toContain('syncTaskTimingChange(');
  });

  it.each(['handleComplete', 'handleFail', 'handleTimerAction', 'handleNoteInput'])(
    'queues every task archived by %s',
    (handler) => {
      expect(readFunction(webPage, handler)).toContain('syncArchivedTimingChanges(');
    },
  );

  it('queues each board workflow change under its affected task', () => {
    expect(readFunction(webPage, 'moveBoardTodo')).toContain('syncWorkflowTimingChanges(');
    expect(readFunction(webPage, 'syncWorkflowTimingChanges')).toContain(
      'syncTaskTimingChange(',
    );
  });

  it.each(['handleCompletedAtChange', 'moveSummaryTodo', 'reopenSummaryTodo'])(
    'queues every task changed by %s',
    (handler) => {
      expect(readFunction(webPage, handler)).toContain('syncCompletionTimingChanges(');
    },
  );

  it('queues completion changes under every affected task key', () => {
    expect(readFunction(webPage, 'syncCompletionTimingChanges')).toContain(
      'syncTaskTimingChange(',
    );
  });

  it('queues each web task insert before later timing updates', () => {
    expect(readFunction(webPage, 'handleSubmit')).toContain('syncTaskTimingChange(');
    expect(readFunction(webPage, 'handleCreateTaskInColumn').match(/syncTaskTimingChange\(/g)).toHaveLength(
      2,
    );
  });

  it('queues each task changed by the automatic day rollover', () => {
    expect(readFunction(webPage, 'syncSelectedDayToToday')).toContain(
      'syncArchivedTimingChanges(',
    );
    expect(readFunction(webPage, 'syncArchivedTimingChanges')).toContain(
      'syncTaskTimingChange(',
    );
  });

  it('queues menu bar Stall changes under the task key', () => {
    expect(readFunction(menubarPage, 'handleSomedayChange')).toContain('syncTaskTimingChange(');
  });

  it.each(['handleTimerAction', 'handleComplete', 'handleNoteInput'])(
    'queues menu bar timing writes from %s',
    (handler) => {
      expect(readFunction(menubarPage, handler)).toContain('syncArchivedTimingChanges(');
    },
  );

  it('queues menu bar archive changes under every affected task key', () => {
    expect(readFunction(menubarPage, 'syncArchivedTimingChanges')).toContain(
      'syncTaskTimingChange(',
    );
  });

  it('queues the menu bar task insert before later timing updates', () => {
    expect(readFunction(menubarPage, 'handleAdd')).toContain('syncTaskTimingChange(');
  });

  it.each([
    ['web', webPage],
    ['menu bar', menubarPage],
  ])('drains timing saves before %s hydration and sign-out', (_label, source) => {
    expect(readFunction(source, 'hydrateRemoteTodos')).toContain('queueTimingSave.flushAll()');
    expect(readFunction(source, 'hydrateRemoteTodos')).toContain('syncArchivedTimingChanges(');
    expect(readFunction(source, 'handleSignOut')).toContain('queueTimingSave.flushAll()');
  });
});
