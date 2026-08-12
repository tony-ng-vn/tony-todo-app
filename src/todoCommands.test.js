import { describe, expect, it } from 'vitest';
import {
  createInitialState,
  createTodoId,
  dateAtSanFranciscoTime,
  formatSummaryDayKey,
  parseTodoCommand,
  runTodoCommand,
  toRemoteRecord,
} from './todoCommands.js';

const UTC_EVENING = new Date('2026-01-15T20:00:00.000Z');

function openTodo(overrides = {}) {
  return {
    id: 'task-1',
    title: 'Call Sam',
    createdAt: '2026-01-15T18:00:00.000Z',
    completedAt: null,
    dueDate: '2026-01-15T08:00:00.000Z',
    source: 'app',
    firstStartedAt: null,
    activeStartedAt: null,
    trackedSeconds: 0,
    timeSegments: [],
    isProgressive: false,
    isProgressSession: false,
    ...overrides,
  };
}

describe('parseTodoCommand', () => {
  it('parses the four commands and complete id XOR title', () => {
    expect(parseTodoCommand({ command: 'list' })).toEqual({
      ok: true,
      command: { kind: 'list' },
    });
    expect(parseTodoCommand({ command: 'create', title: 'Call Sam' }).command).toEqual({
      kind: 'create',
      title: 'Call Sam',
    });
    expect(parseTodoCommand({ command: 'complete', id: 'task-1' }).command).toEqual({
      kind: 'complete',
      target: { by: 'id', id: 'task-1' },
    });
    expect(parseTodoCommand({ command: 'complete', title: 'Call Sam' }).command).toEqual({
      kind: 'complete',
      target: { by: 'title', title: 'Call Sam' },
    });
    expect(parseTodoCommand({ command: 'daySummary', day: '2026-01-15' }).command).toEqual({
      kind: 'daySummary',
      day: '2026-01-15',
    });

    expect(parseTodoCommand({ command: 'complete', id: 'task-1', title: 'Call Sam' }).ok).toBe(false);
    expect(parseTodoCommand({ command: 'complete' }).ok).toBe(false);
    expect(parseTodoCommand({ command: 'start' }).ok).toBe(false);
  });
});

describe('runTodoCommand create', () => {
  it('sets a dueDate on the America/Los_Angeles calendar day of createdAt', () => {
    const result = runTodoCommand(createInitialState(), { kind: 'create', title: 'Call Sam' }, UTC_EVENING);

    expect(result.ok).toBe(true);
    expect(result.view.created).toBe(true);
    expect(formatSummaryDayKey(UTC_EVENING)).toBe('2026-01-15');
    expect(formatSummaryDayKey(new Date('2026-01-15T00:00:00.000Z'))).toBe('2026-01-14');
    expect(formatSummaryDayKey(new Date(result.view.task.dueDate))).toBe('2026-01-15');
    expect(result.view.task.dueDate).toBe(dateAtSanFranciscoTime('2026-01-15', 0).toISOString());
    expect(result.persist.kind).toBe('insert');
    expect(result.persist.todo.dueDate).toBe(result.view.task.dueDate);
  });

  it('stamps source agent on insert', () => {
    const result = runTodoCommand(createInitialState(), { kind: 'create', title: 'Call Sam' }, UTC_EVENING);

    expect(result.view.task.source).toBe('agent');
    expect(result.persist.todo.source).toBe('agent');
    expect(result.persist.todo.id.endsWith('-call-sam')).toBe(true);
    expect(createTodoId('a'.repeat(80), UTC_EVENING).split('-').slice(1).join('-').length).toBeLessThanOrEqual(32);

    const row = { ...toRemoteRecord(result.persist.todo, 'user-1'), loop_status: 'accepted' };
    expect(typeof row.due_date).toBe('string');
    expect(row.due_date).not.toBeNull();
    expect(row.loop_status).toBe('accepted');
    expect(row.source).toBe('agent');
  });

  it('does not insert a duplicate open title', () => {
    const state = createInitialState([openTodo()]);
    const result = runTodoCommand(state, { kind: 'create', title: 'Call Sam' }, UTC_EVENING);

    expect(result.ok).toBe(true);
    expect(result.view.created).toBe(false);
    expect(result.view.task.id).toBe('task-1');
    expect(result.persist).toEqual({ kind: 'none' });
  });

  it('rejects an empty title', () => {
    const result = runTodoCommand(createInitialState(), { kind: 'create', title: '   ' }, UTC_EVENING);
    expect(result).toEqual({
      ok: false,
      error: { code: 'empty_title', message: 'Title is required' },
    });
  });
});

describe('runTodoCommand complete', () => {
  it('closes the active segment and sets completedAt for a running task', () => {
    const state = createInitialState([
      openTodo({
        firstStartedAt: '2026-06-08T08:10:00.000Z',
        activeStartedAt: '2026-06-08T08:10:00.000Z',
      }),
    ]);
    const now = new Date('2026-06-08T08:40:10.000Z');
    const result = runTodoCommand(state, { kind: 'complete', target: { by: 'id', id: 'task-1' } }, now);

    expect(result.ok).toBe(true);
    expect(result.persist.kind).toBe('update');
    expect(result.persist.todo).toMatchObject({
      completedAt: '2026-06-08T08:40:10.000Z',
      activeStartedAt: null,
      trackedSeconds: 1810,
    });
    expect(result.persist.todo.timeSegments).toEqual([
      {
        startedAt: '2026-06-08T08:10:00.000Z',
        endedAt: '2026-06-08T08:40:10.000Z',
      },
    ]);
    expect(result.view.task.completedAt).toBe('2026-06-08T08:40:10.000Z');
  });

  it('backdates a paused task to the last segment end', () => {
    const state = createInitialState([
      openTodo({
        firstStartedAt: '2026-06-10T23:00:00.000Z',
        activeStartedAt: null,
        trackedSeconds: 20 * 60,
        timeSegments: [
          {
            startedAt: '2026-06-10T23:00:00.000Z',
            endedAt: '2026-06-10T23:20:00.000Z',
          },
        ],
      }),
    ]);
    const result = runTodoCommand(
      state,
      { kind: 'complete', target: { by: 'id', id: 'task-1' } },
      new Date('2026-06-10T16:00:00.000Z'),
    );

    expect(result.ok).toBe(true);
    expect(result.persist.todo.completedAt).toBe('2026-06-10T23:20:00.000Z');
    expect(result.persist.todo.activeStartedAt).toBeNull();
    expect(result.view.task.completedAt).toBe('2026-06-10T23:20:00.000Z');
  });

  it('does not complete a progressive task', () => {
    const state = createInitialState([openTodo({ isProgressive: true })]);
    const result = runTodoCommand(
      state,
      { kind: 'complete', target: { by: 'id', id: 'task-1' } },
      UTC_EVENING,
    );

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('progressive_unsupported');
  });

  it('completes an open task by title', () => {
    const state = createInitialState([openTodo({ title: 'Send weekly update' })]);
    const result = runTodoCommand(
      state,
      { kind: 'complete', target: { by: 'title', title: 'send weekly update' } },
      new Date('2026-01-15T21:00:00.000Z'),
    );

    expect(result.ok).toBe(true);
    expect(result.persist.kind).toBe('update');
    expect(result.persist.todo.id).toBe('task-1');
    expect(result.persist.todo.completedAt).toBe('2026-01-15T21:00:00.000Z');
  });

  it('returns not_found or ambiguous_title for title resolution', () => {
    const missing = runTodoCommand(
      createInitialState(),
      { kind: 'complete', target: { by: 'title', title: 'Call Sam' } },
      UTC_EVENING,
    );
    expect(missing.error.code).toBe('not_found');

    const ambiguous = runTodoCommand(
      createInitialState([
        openTodo({ id: 'one', title: 'Review launch checklist' }),
        openTodo({ id: 'two', title: 'Review launch checklist' }),
      ]),
      { kind: 'complete', target: { by: 'title', title: 'Review launch checklist' } },
      UTC_EVENING,
    );
    expect(ambiguous.error.code).toBe('ambiguous_title');
  });

  it('treats an already completed task as success without writing', () => {
    const state = createInitialState([
      openTodo({ completedAt: '2026-01-15T19:00:00.000Z', trackedSeconds: 60 }),
    ]);
    const result = runTodoCommand(
      state,
      { kind: 'complete', target: { by: 'id', id: 'task-1' } },
      UTC_EVENING,
    );

    expect(result.ok).toBe(true);
    expect(result.persist).toEqual({ kind: 'none' });
    expect(result.view.task.completedAt).toBe('2026-01-15T19:00:00.000Z');
  });
});

describe('runTodoCommand list and daySummary', () => {
  it('lists open tasks with derived status and completable', () => {
    const state = createInitialState([
      openTodo({ id: 'ready', title: 'Ready' }),
      openTodo({
        id: 'running',
        title: 'Running',
        firstStartedAt: '2026-01-15T18:00:00.000Z',
        activeStartedAt: '2026-01-15T18:00:00.000Z',
      }),
      openTodo({ id: 'progressive', title: 'Read', isProgressive: true }),
      openTodo({ id: 'done', title: 'Done', completedAt: '2026-01-15T19:00:00.000Z' }),
      openTodo({ id: 'session', title: 'Session', isProgressSession: true, completedAt: '2026-01-15T19:00:00.000Z' }),
    ]);
    const result = runTodoCommand(state, { kind: 'list' }, UTC_EVENING);

    expect(result.persist).toEqual({ kind: 'none' });
    expect(result.view.tasks.map((task) => task.id)).toEqual(['ready', 'running', 'progressive']);
    expect(result.view.tasks.find((task) => task.id === 'ready')).toMatchObject({
      status: 'not_started',
      completable: true,
    });
    expect(result.view.tasks.find((task) => task.id === 'running')).toMatchObject({
      status: 'in_progress',
      completable: true,
    });
    expect(result.view.tasks.find((task) => task.id === 'progressive')).toMatchObject({
      completable: false,
    });
  });

  it('returns existing day-summary buckets', () => {
    const state = createInitialState([
      openTodo({
        id: 'done',
        title: 'Shipped',
        completedAt: '2026-06-08T19:15:00.000Z',
        firstStartedAt: '2026-06-08T18:00:00.000Z',
        trackedSeconds: 120,
      }),
    ]);
    const result = runTodoCommand(state, { kind: 'daySummary', day: '2026-06-08' }, UTC_EVENING);

    expect(result.ok).toBe(true);
    expect(result.persist).toEqual({ kind: 'none' });
    expect(result.view.day).toBe('2026-06-08');
    expect(result.view.sections.map((section) => section.label)).toEqual([
      'Early morning',
      'Morning',
      'Lunch',
      'Evening',
      'Night',
    ]);
    expect(result.view.sections.flatMap((section) => section.items).map((item) => item.id)).toEqual(['done']);
  });
});
