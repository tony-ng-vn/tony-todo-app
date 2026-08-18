import { beforeEach, describe, expect, it } from 'vitest';
import {
  archivePriorDaySessions,
  addTodo,
  completeTodo,
  createInitialState,
  failTodo,
  findDuplicateTodo,
  formatDueDate,
  getActiveTodos,
  matchesDueFilter,
  setTodoDueDate,
  setTodoPhoto,
  setTodoSomeday,
  shiftDayKey,
  getBoardColumns,
  getBoardColumnId,
  getCalendarMonth,
  getCompletedTodoSections,
  getDaySummary,
  getMillisecondsUntilNextDay,
  getPendingTodos,
  getProgressSessions,
  getProjectTodos,
  getSomedayTodos,
  getTaskTimeSegments,
  formatDuration,
  getElapsedSeconds,
  getDefaultTaskStartTimestamp,
  getEditableTaskTimeSegments,
  getOpenTodoSections,
  logProgressSession,
  moveCompletedTodoToSummaryBucket,
  moveTodoToBoardColumn,
  pauseTodoTimer,
  partitionPendingTodos,
  partitionTaskFlowTodos,
  promoteTodoToTask,
  reorderCompletedTodosForDay,
  reopenTodo,
  setTodoProgressive,
  startTodoTimer,
  deleteTodo,
  updateTodoTiming,
  updateTodoTimeSegments,
  updateCompletedTodoTiming,
  updateTodoCompletedAt,
  updateTodoProgress,
  updateTodoTitle,
  updateTodoNote,
  resetNoteBurstBaselines,
  hasNoteBurstBaseline,
} from './todoStore.js';
import { formatNoteAtLocal, formatSummaryDayKey } from './todoCommands.js';
import { parseNoteEntries } from './noteEntries.js';

beforeEach(() => {
  resetNoteBurstBaselines();
});

describe('day navigation', () => {
  it('moves one local calendar day in either direction', () => {
    expect(shiftDayKey('2026-08-11', -1)).toBe('2026-08-10');
    expect(shiftDayKey('2026-08-11', 1)).toBe('2026-08-12');
  });

  it('crosses month and year boundaries', () => {
    expect(shiftDayKey('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDayKey('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('duplicate task matching', () => {
  it('matches open tasks after normalizing case, punctuation, and whitespace', () => {
    const state = createInitialState([
      {
        id: 'existing',
        title: 'Send follow-up email',
        createdAt: '2026-06-08T08:00:00.000Z',
        completedAt: null,
      },
    ]);

    expect(findDuplicateTodo(state, '  SEND follow up   email! ')).toMatchObject({ id: 'existing' });
    expect(findDuplicateTodo(state, 'Email follow up send')).toMatchObject({ id: 'existing' });
  });

  it('matches a conservative one-character typo in a substantive title', () => {
    const state = createInitialState([
      {
        id: 'existing',
        title: 'Submit expense report',
        createdAt: '2026-06-08T08:00:00.000Z',
        completedAt: null,
      },
    ]);

    expect(findDuplicateTodo(state, 'Submit expens report')).toMatchObject({ id: 'existing' });
    expect(findDuplicateTodo(state, 'Submit expense reprot')).toMatchObject({ id: 'existing' });
  });

  it('does not match short or meaningfully different titles', () => {
    const state = createInitialState([
      {
        id: 'call-alice',
        title: 'Call Alice',
        createdAt: '2026-06-08T08:00:00.000Z',
        completedAt: null,
      },
    ]);

    expect(findDuplicateTodo(state, 'Call Alicia')).toBeNull();
    expect(findDuplicateTodo(state, 'Call Bob')).toBeNull();
  });

  it('allows a completed task title to be used again', () => {
    let state = createInitialState([
      {
        id: 'completed',
        title: 'Send weekly update',
        createdAt: '2026-06-01T08:00:00.000Z',
        completedAt: '2026-06-01T09:00:00.000Z',
      },
    ]);

    expect(findDuplicateTodo(state, 'Send weekly update')).toBeNull();

    state = addTodo(state, 'Send weekly update', new Date('2026-06-08T08:00:00.000Z'));
    expect(state.todos).toHaveLength(2);
  });

  it('does not add a duplicate open task', () => {
    const createdAt = new Date('2026-06-08T08:00:00.000Z');
    let state = addTodo(createInitialState(), 'Review launch checklist', createdAt);
    const originalState = state;

    state = addTodo(state, 'Review launch checklst', new Date('2026-06-08T09:00:00.000Z'));

    expect(state).toBe(originalState);
    expect(state.todos).toHaveLength(1);
  });

  it('does not rename an open task to duplicate another one', () => {
    const state = createInitialState([
      { id: 'first', title: 'Prepare launch notes', completedAt: null },
      { id: 'second', title: 'Email the team', completedAt: null },
    ]);

    const updated = updateTodoTitle(state, 'second', 'Prepare launch note');

    expect(updated).toBe(state);
    expect(updated.todos[1].title).toBe('Email the team');
  });
});

describe('calendar month', () => {
  const now = new Date(2026, 6, 15, 9, 0, 0); // Wed Jul 15 2026, local

  function completedState() {
    // Two tasks done Jul 15, one done Jul 3.
    return createInitialState([
      { id: 'a', title: 'Ship A', createdAt: new Date(2026, 6, 15, 8).toISOString(), completedAt: new Date(2026, 6, 15, 10).toISOString() },
      { id: 'b', title: 'Ship B', createdAt: new Date(2026, 6, 15, 8).toISOString(), completedAt: new Date(2026, 6, 15, 14).toISOString() },
      { id: 'c', title: 'Ship C', createdAt: new Date(2026, 6, 3, 8).toISOString(), completedAt: new Date(2026, 6, 3, 12).toISOString() },
      { id: 'd', title: 'Still open', createdAt: new Date(2026, 6, 4, 8).toISOString(), completedAt: null },
    ]);
  }

  it('returns a full 6x7 grid with a month label', () => {
    const month = getCalendarMonth(completedState(), { year: 2026, month: 6, now });
    expect(month.monthLabel).toBe('July 2026');
    expect(month.weeks).toHaveLength(6);
    for (const week of month.weeks) {
      expect(week).toHaveLength(7);
    }
    // The grid starts on a Sunday.
    expect(new Date(`${month.weeks[0][0].dateKey}T00:00:00`).getDay()).toBe(0);
  });

  it('groups completed tasks into their day cells and marks in-month/today', () => {
    const month = getCalendarMonth(completedState(), { year: 2026, month: 6, now });
    const cells = month.weeks.flat();
    const byKey = Object.fromEntries(cells.map((cell) => [cell.dateKey, cell]));

    const jul15 = byKey['2026-07-15'];
    expect(jul15.items.map((item) => item.title)).toEqual(['Ship B', 'Ship A']);
    expect(jul15.inMonth).toBe(true);
    expect(jul15.isToday).toBe(true);

    const jul3 = byKey['2026-07-03'];
    expect(jul3.items.map((item) => item.title)).toEqual(['Ship C']);
    expect(jul3.isToday).toBe(false);

    // A day from an adjacent month is present but flagged out-of-month with no items.
    const jun29 = byKey['2026-06-29'];
    expect(jun29.inMonth).toBe(false);
    expect(jun29.items).toEqual([]);
  });
});

describe('todo day summary', () => {
  it('defaults timing entry to the task creation time until a start is recorded', () => {
    const createdAt = new Date('2026-06-08T08:10:00.000Z');
    let state = addTodo(createInitialState(), 'Draft landing page', createdAt);

    expect(getDefaultTaskStartTimestamp(state.todos[0])).toBe(createdAt.toISOString());
    expect(
      getDefaultTaskStartTimestamp({ ...state.todos[0], firstStartedAt: 'not-a-date' }),
    ).toBe(createdAt.toISOString());
    expect(
      getDefaultTaskStartTimestamp({
        ...state.todos[0],
        firstStartedAt: 'not-a-date',
        createdAt: 'not-a-date',
      }),
    ).toBeNull();

    state = startTodoTimer(state, state.todos[0].id, new Date('2026-06-08T09:15:00.000Z'));

    expect(getDefaultTaskStartTimestamp(state.todos[0])).toBe('2026-06-08T09:15:00.000Z');
  });

  it('includes the active work period when editing a running task', () => {
    const todo = {
      id: 'running-task',
      createdAt: '2026-06-08T08:00:00.000Z',
      firstStartedAt: '2026-06-08T09:00:00.000Z',
      activeStartedAt: '2026-06-08T10:00:00.000Z',
      completedAt: null,
      timeSegments: [
        {
          startedAt: '2026-06-08T09:00:00.000Z',
          endedAt: '2026-06-08T09:30:00.000Z',
        },
      ],
    };

    expect(
      getEditableTaskTimeSegments(todo, new Date('2026-06-08T10:45:00.000Z')),
    ).toEqual([
      {
        startedAt: '2026-06-08T09:00:00.000Z',
        endedAt: '2026-06-08T09:30:00.000Z',
      },
      {
        startedAt: '2026-06-08T10:00:00.000Z',
        endedAt: '2026-06-08T10:45:00.000Z',
      },
    ]);
  });

  it('does not invent a time block for a completed task that never used a timer', () => {
    expect(
      getEditableTaskTimeSegments({
        createdAt: '2026-08-14T20:30:00.000Z',
        firstStartedAt: null,
        activeStartedAt: null,
        completedAt: '2026-08-16T20:03:00.000Z',
        timeSegments: [],
      }),
    ).toEqual([]);
  });

  it('recovers a work period for a completed task that has a start but no saved blocks', () => {
    expect(
      getEditableTaskTimeSegments({
        createdAt: '2026-06-08T10:00:00.000Z',
        firstStartedAt: '2026-06-08T12:05:00.000Z',
        activeStartedAt: null,
        completedAt: '2026-06-08T12:10:00.000Z',
        timeSegments: [],
      }),
    ).toEqual([
      {
        startedAt: '2026-06-08T12:05:00.000Z',
        endedAt: '2026-06-08T12:10:00.000Z',
      },
    ]);
  });

  it('does not invent an end time for a task that has not started', () => {
    expect(
      getEditableTaskTimeSegments({
        createdAt: '2026-06-08T08:00:00.000Z',
        firstStartedAt: null,
        activeStartedAt: null,
        completedAt: null,
        timeSegments: [],
      }),
    ).toEqual([
      {
        startedAt: '2026-06-08T08:00:00.000Z',
        endedAt: null,
      },
    ]);
  });

  it('keeps active todos ordered newest first by creation time', () => {
    let state = createInitialState();
    state = addTodo(state, 'Draft landing page', new Date('2026-06-08T08:10:00'));
    state = addTodo(state, 'Send invoice', new Date('2026-06-08T08:05:00'));

    expect(getPendingTodos(state).map((todo) => todo.title)).toEqual(['Draft landing page', 'Send invoice']);
  });

  it('groups open todos by assigned date, newest date first, with newest tasks first', () => {
    let state = createInitialState();
    state = addTodo(state, 'Yesterday task', new Date('2026-06-16T08:00:00'));
    state = addTodo(state, 'Today task', new Date('2026-06-17T09:00:00'));
    state = addTodo(state, 'Tomorrow task', new Date('2026-06-18T10:00:00'));

    const sections = getOpenTodoSections(getPendingTodos(state), new Date('2026-06-17T12:00:00'));

    expect(
      sections.map(({ id, label, isToday, items }) => ({
        id,
        label,
        isToday,
        titles: items.map((item) => item.title),
      })),
    ).toEqual([
      { id: '2026-06-18', label: 'Jun 18, 2026', isToday: false, titles: ['Tomorrow task'] },
      { id: '2026-06-17', label: 'Today todos', isToday: true, titles: ['Today task'] },
      { id: '2026-06-16', label: 'Jun 16, 2026', isToday: false, titles: ['Yesterday task'] },
    ]);
  });

  it('groups completed todos by finish date with newest groups and tasks first', () => {
    const state = createInitialState([
      {
        id: 'older-day',
        title: 'Older day',
        createdAt: '2026-06-15T08:00:00.000Z',
        completedAt: '2026-06-15T18:00:00.000Z',
      },
      {
        id: 'newer-first',
        title: 'Newer first',
        createdAt: '2026-06-16T08:00:00.000Z',
        completedAt: '2026-06-16T17:00:00.000Z',
      },
      {
        id: 'newer-last',
        title: 'Newer last',
        createdAt: '2026-06-16T09:00:00.000Z',
        completedAt: '2026-06-16T19:00:00.000Z',
      },
    ]);

    expect(
      getCompletedTodoSections(state, new Date('2026-06-16T12:00:00.000Z')).map((section) => ({
        id: section.id,
        label: section.label,
        titles: section.items.map((item) => item.title),
      })),
    ).toEqual([
      { id: '2026-06-16', label: 'Today finished', titles: ['Newer last', 'Newer first'] },
      { id: '2026-06-15', label: 'Jun 15, 2026', titles: ['Older day'] },
    ]);
  });

  it('puts legacy open todos without a usable assigned date in an undated group', () => {
    const state = createInitialState([
      {
        id: 'legacy-task',
        title: 'Legacy task',
        createdAt: '',
        completedAt: null,
      },
    ]);

    expect(getOpenTodoSections(getPendingTodos(state), new Date('2026-06-17T12:00:00'))).toEqual([
      {
        id: 'undated',
        label: 'Undated tasks',
        dateKey: null,
        isToday: false,
        items: [expect.objectContaining({ id: 'legacy-task' })],
      },
    ]);
  });

  it('always renders the five recap buckets for the selected day', () => {
    const state = createInitialState();

    expect(getDaySummary(state, '2026-06-08')).toEqual([
      { label: 'Early morning', items: [] },
      { label: 'Morning', items: [] },
      { label: 'Lunch', items: [] },
      { label: 'Evening', items: [] },
      { label: 'Night', items: [] },
    ]);
  });

  it('ignores completed todos with an invalid completion date', () => {
    const state = createInitialState([
      {
        id: 'invalid-completion',
        title: 'Corrupt completion',
        createdAt: '2026-06-08T08:00:00-07:00',
        completedAt: 'invalid',
      },
    ]);

    expect(getDaySummary(state, '2026-06-08').flatMap((section) => section.items)).toEqual([]);
  });

  it('adds completed todos to the summary for the day they were marked done', () => {
    let state = createInitialState();
    state = addTodo(state, 'Review prototype', new Date('2026-06-07T21:30:00-07:00'));
    const todoId = state.todos[0].id;
    const doneAt = new Date('2026-06-08T12:15:00-07:00');

    state = completeTodo(state, todoId, doneAt);

    expect(getPendingTodos(state)).toEqual([]);
    expect(getDaySummary(state, '2026-06-08')[2]).toEqual({
      label: 'Lunch',
      items: [
        {
          id: todoId,
          title: 'Review prototype',
          startedAt: null,
          completedAt: doneAt.toISOString(),
          note: '',
          notes: [],
          durationSeconds: 0,
          durationLabel: '0m',
          outcome: 'done',
          parentTaskId: null,
          isProgressSession: false,
          progressLabel: '',
        },
      ],
    });
  });

  it('marks failed todos as finished with a failed outcome in the day summary', () => {
    let state = createInitialState();
    state = addTodo(state, 'Submit proposal', new Date('2026-06-08T08:00:00-07:00'));
    const todoId = state.todos[0].id;
    const failedAt = new Date('2026-06-08T17:20:00-07:00');

    state = failTodo(state, todoId, failedAt);

    expect(getPendingTodos(state)).toEqual([]);
    expect(state.todos[0]).toMatchObject({
      completedAt: failedAt.toISOString(),
      activeStartedAt: null,
      notionStatus: 'Failed',
    });
    expect(getDaySummary(state, '2026-06-08')[3].items[0]).toMatchObject({
      id: todoId,
      title: 'Submit proposal',
      outcome: 'failed',
    });
  });

  it('groups a day summary into the recap bucket order', () => {
    let state = createInitialState();
    state = addTodo(state, 'Stretch', new Date('2026-06-08T06:30:00-07:00'));
    state = addTodo(state, 'Call Sam', new Date('2026-06-08T07:00:00-07:00'));
    state = completeTodo(state, state.todos[1].id, new Date('2026-06-08T18:45:00-07:00'));
    state = completeTodo(state, state.todos[0].id, new Date('2026-06-08T08:00:00-07:00'));

    expect(getDaySummary(state, '2026-06-08').map((section) => section.label)).toEqual([
      'Early morning',
      'Morning',
      'Lunch',
      'Evening',
      'Night',
    ]);
    expect(getDaySummary(state, '2026-06-08')[1].items[0].title).toBe('Stretch');
    expect(getDaySummary(state, '2026-06-08')[3].items[0].title).toBe('Call Sam');
  });

  it('orders completed tasks in a recap section by end time', () => {
    const state = createInitialState([
      {
        id: 'late-end',
        title: 'Started early, finished last',
        createdAt: '2026-06-08T06:00:00-07:00',
        firstStartedAt: '2026-06-08T06:34:00-07:00',
        completedAt: '2026-06-08T10:02:00-07:00',
        trackedSeconds: 59 * 60,
      },
      {
        id: 'early-end',
        title: 'Started later, finished first',
        createdAt: '2026-06-08T08:00:00-07:00',
        firstStartedAt: '2026-06-08T09:03:00-07:00',
        completedAt: '2026-06-08T09:10:00-07:00',
        trackedSeconds: 7 * 60,
      },
      {
        id: 'middle-end',
        title: 'Finished in the middle',
        createdAt: '2026-06-08T07:00:00-07:00',
        firstStartedAt: '2026-06-08T07:21:00-07:00',
        completedAt: '2026-06-08T09:40:00-07:00',
        trackedSeconds: 6 * 60,
      },
    ]);

    const morningItems = getDaySummary(state, '2026-06-08')[1].items;

    expect(morningItems.map((item) => item.title)).toEqual([
      'Started later, finished first',
      'Finished in the middle',
      'Started early, finished last',
    ]);
    expect(morningItems.map((item) => item.durationLabel)).toEqual(['7m', '6m', '59m']);
  });

  it('separates pre-sunrise completions from Morning using San Francisco sunrise', () => {
    let state = createInitialState();
    state = addTodo(state, 'Midnight task', new Date('2026-06-08T00:00:00-07:00'));
    state = addTodo(state, 'Before sunrise', new Date('2026-06-08T05:30:00-07:00'));
    state = addTodo(state, 'After sunrise', new Date('2026-06-08T06:00:00-07:00'));
    state = addTodo(state, 'Late task', new Date('2026-06-08T23:59:00-07:00'));
    state = completeTodo(state, state.todos[0].id, new Date('2026-06-08T00:00:00-07:00'));
    state = completeTodo(state, state.todos[1].id, new Date('2026-06-08T05:30:00-07:00'));
    state = completeTodo(state, state.todos[2].id, new Date('2026-06-08T06:00:00-07:00'));
    state = completeTodo(state, state.todos[3].id, new Date('2026-06-08T23:59:00-07:00'));

    const summary = getDaySummary(state, '2026-06-08');

    expect(summary[0].items.map((item) => item.title)).toEqual(['Midnight task', 'Before sunrise']);
    expect(summary[1].items.map((item) => item.title)).toEqual(['After sunrise']);
    expect(summary[4].items.map((item) => item.title)).toEqual(['Late task']);
  });

  it('moves the Early morning boundary with the San Francisco seasons', () => {
    let state = createInitialState();
    state = addTodo(state, 'Summer 6:30', new Date('2026-06-08T06:30:00-07:00'));
    state = addTodo(state, 'Winter 6:30', new Date('2026-12-08T06:30:00-08:00'));
    state = completeTodo(state, state.todos[0].id, new Date('2026-06-08T06:30:00-07:00'));
    state = completeTodo(state, state.todos[1].id, new Date('2026-12-08T06:30:00-08:00'));

    expect(getDaySummary(state, '2026-06-08')[1].items[0].title).toBe('Summer 6:30');
    expect(getDaySummary(state, '2026-12-08')[0].items[0].title).toBe('Winter 6:30');
  });

  it('ends Evening at 8:00 PM', () => {
    let state = createInitialState();
    state = addTodo(state, 'Evening edge', new Date('2026-06-08T19:59:00-07:00'));
    state = addTodo(state, 'Night edge', new Date('2026-06-08T20:00:00-07:00'));
    state = completeTodo(state, state.todos[0].id, new Date('2026-06-08T19:59:00-07:00'));
    state = completeTodo(state, state.todos[1].id, new Date('2026-06-08T20:00:00-07:00'));

    const summary = getDaySummary(state, '2026-06-08');

    expect(summary[3].items[0].title).toBe('Evening edge');
    expect(summary[4].items[0].title).toBe('Night edge');
  });

  it('updates a task note without changing other task fields', () => {
    let state = createInitialState();
    state = addTodo(state, 'Call school', new Date('2026-06-08T08:00:00'));
    const todo = state.todos[0];

    const now = new Date('2026-06-08T15:00:00.000Z');
    state = updateTodoNote(state, todo.id, 'Ask about the scholarship deadline.', now);

    expect(state.todos[0]).toEqual({
      ...todo,
      note: `@ ${formatNoteAtLocal(now)}\nAsk about the scholarship deadline.`,
    });
  });

  it('updates a task title when the new title has content', () => {
    let state = createInitialState();
    state = addTodo(state, 'Old task name', new Date('2026-06-08T08:00:00'));

    state = updateTodoTitle(state, state.todos[0].id, '  New task name  ');

    expect(state.todos[0].title).toBe('New task name');
  });

  it('keeps the existing task title when the new title is empty', () => {
    let state = createInitialState();
    state = addTodo(state, 'Keep this name', new Date('2026-06-08T08:00:00'));

    state = updateTodoTitle(state, state.todos[0].id, '   ');

    expect(state.todos[0].title).toBe('Keep this name');
  });

  it('reorders completed todos for a day by rewriting their completion times', () => {
    let state = createInitialState();
    state = addTodo(state, 'First', new Date('2026-06-08T08:00:00-07:00'));
    state = addTodo(state, 'Second', new Date('2026-06-08T08:01:00-07:00'));
    state = completeTodo(state, state.todos[0].id, new Date('2026-06-08T12:00:00-07:00'));
    state = completeTodo(state, state.todos[1].id, new Date('2026-06-08T12:10:00-07:00'));

    state = reorderCompletedTodosForDay(state, '2026-06-08', [state.todos[1].id, state.todos[0].id]);

    const summaryTitles = getDaySummary(state, '2026-06-08')[2].items.map((item) => item.title);
    expect(summaryTitles).toEqual(['Second', 'First']);
    expect(new Date(state.todos[0].completedAt) > new Date(state.todos[1].completedAt)).toBe(true);
  });

  it('updates the finished date and time for a completed todo without changing its duration', () => {
    let state = createInitialState();
    state = addTodo(state, 'File receipt', new Date('2026-06-08T08:00:00'));
    const todoId = state.todos[0].id;
    state = completeTodo(state, todoId, new Date('2026-06-08T08:30:00'));
    state.todos[0] = { ...state.todos[0], trackedSeconds: 17 * 60 };

    state = updateTodoCompletedAt(state, todoId, new Date('2026-06-09T21:45:00-07:00'));

    expect(state.todos[0]).toMatchObject({
      completedAt: new Date('2026-06-09T21:45:00-07:00').toISOString(),
      trackedSeconds: 17 * 60,
    });
    expect(getDaySummary(state, '2026-06-08').flatMap((section) => section.items)).toEqual([]);
    expect(getDaySummary(state, '2026-06-09')[4].items[0]).toMatchObject({
      id: todoId,
      title: 'File receipt',
      durationLabel: '17m',
    });
  });

  it('lets a done date land before the recorded start without rewriting time blocks', () => {
    const startedAt = new Date('2026-08-16T20:30:00.000Z');
    const originalSegments = [
      {
        startedAt: '2026-08-16T20:30:00.000Z',
        endedAt: '2026-08-16T21:00:00.000Z',
      },
    ];
    let state = createInitialState([
      {
        id: 'timed-task',
        title: 'Timed task',
        createdAt: '2026-08-14T20:30:00.000Z',
        firstStartedAt: startedAt.toISOString(),
        completedAt: '2026-08-16T21:00:00.000Z',
        timeSegments: originalSegments,
      },
    ]);
    const doneAt = new Date('2026-08-14T13:03:00.000Z');

    state = updateTodoCompletedAt(state, 'timed-task', doneAt);

    expect(state.todos[0]).toMatchObject({
      completedAt: doneAt.toISOString(),
      firstStartedAt: startedAt.toISOString(),
      timeSegments: originalSegments,
    });
  });

  it('updates completed task start and end times to recalculate duration', () => {
    let state = createInitialState();
    state = addTodo(state, 'Adjust meeting', new Date('2026-06-10T08:00:00.000Z'));
    const todoId = state.todos[0].id;
    state = completeTodo(state, todoId, new Date('2026-06-10T15:00:00.000Z'));

    state = updateCompletedTodoTiming(
      state,
      todoId,
      new Date('2026-06-10T13:15:00.000Z'),
      new Date('2026-06-10T15:45:00.000Z'),
    );

    expect(state.todos[0]).toMatchObject({
      firstStartedAt: '2026-06-10T13:15:00.000Z',
      activeStartedAt: null,
      completedAt: '2026-06-10T15:45:00.000Z',
      trackedSeconds: 150 * 60,
    });
    expect(getDaySummary(state, '2026-06-10').flatMap((section) => section.items)[0]).toMatchObject({
      startedAt: '2026-06-10T13:15:00.000Z',
      completedAt: '2026-06-10T15:45:00.000Z',
      durationSeconds: 150 * 60,
      durationLabel: '2h 30m',
    });
  });

  it('allows manual start and end times on an open task, including past dates', () => {
    let state = createInitialState();
    state = addTodo(state, 'Backfill work', new Date('2026-06-10T08:00:00.000Z'));
    const todoId = state.todos[0].id;

    state = updateTodoTiming(
      state,
      todoId,
      '2026-06-01T13:15:00.000Z',
      '2026-06-01T15:45:00.000Z',
    );

    expect(state.todos[0]).toMatchObject({
      firstStartedAt: '2026-06-01T13:15:00.000Z',
      activeStartedAt: null,
      completedAt: '2026-06-01T15:45:00.000Z',
      trackedSeconds: 150 * 60,
      timeSegments: [
        {
          startedAt: '2026-06-01T13:15:00.000Z',
          endedAt: '2026-06-01T15:45:00.000Z',
        },
      ],
    });
  });

  it('allows manual timing edits on an archived prior-day session', () => {
    let state = createInitialState();
    state = addTodo(state, 'Read chapter', new Date('2026-06-08T08:00:00.000Z'));
    const parentId = state.todos[0].id;
    state = startTodoTimer(state, parentId, new Date('2026-06-08T09:00:00.000Z'));
    state = pauseTodoTimer(state, parentId, new Date('2026-06-08T09:30:00.000Z'));
    state = archivePriorDaySessions(state, new Date('2026-06-10T12:00:00.000Z'));
    const sessionId = getProgressSessions(state, parentId)[0].id;

    state = updateTodoTiming(
      state,
      sessionId,
      '2026-06-09T14:00:00.000Z',
      '2026-06-09T15:00:00.000Z',
    );

    expect(state.todos.find((todo) => todo.id === sessionId)).toMatchObject({
      firstStartedAt: '2026-06-09T14:00:00.000Z',
      completedAt: '2026-06-09T15:00:00.000Z',
      trackedSeconds: 60 * 60,
    });
    expect(state.todos.find((todo) => todo.id === parentId)?.completedAt).toBeNull();
  });

  it('rejects reversed and equal manual timing without swapping or mutating the task', () => {
    let state = createInitialState();
    state = addTodo(state, 'Keep timing valid', new Date('2026-06-10T08:00:00.000Z'));
    const todoId = state.todos[0].id;
    const original = state;

    expect(
      updateTodoTiming(state, todoId, '2026-06-01T15:45:00.000Z', '2026-06-01T13:15:00.000Z'),
    ).toBe(original);
    expect(
      updateTodoTiming(state, todoId, '2026-06-01T13:15:00.000Z', '2026-06-01T13:15:00.000Z'),
    ).toBe(original);
  });

  it('marks an untimed task done without recording a work period', () => {
    let state = createInitialState();
    state = addTodo(state, 'Book OpenAI Dev Day', new Date('2026-08-14T20:30:00.000Z'));
    const todoId = state.todos[0].id;
    const markedAt = new Date('2026-08-16T20:03:00.000Z');

    state = completeTodo(state, todoId, markedAt);

    expect(state.todos[0]).toMatchObject({
      completedAt: markedAt.toISOString(),
      firstStartedAt: null,
      activeStartedAt: null,
      timeSegments: [],
    });
    expect(getEditableTaskTimeSegments(state.todos[0])).toEqual([]);
  });

  it('finishes a paused task at the end of its most recent recorded segment', () => {
    let state = createInitialState();
    state = addTodo(state, 'Finish paused work', new Date('2026-06-10T08:00:00.000Z'));
    const todoId = state.todos[0].id;
    state = startTodoTimer(state, todoId, new Date('2026-06-10T23:00:00.000Z'));
    state = pauseTodoTimer(state, todoId, new Date('2026-06-10T23:20:00.000Z'));

    state = completeTodo(state, todoId, new Date('2026-06-10T16:00:00.000Z'));

    expect(state.todos[0]).toMatchObject({
      completedAt: '2026-06-10T23:20:00.000Z',
      activeStartedAt: null,
      trackedSeconds: 20 * 60,
    });
    expect(getDaySummary(state, '2026-06-10').flatMap((section) => section.items)[0]).toMatchObject({
      id: todoId,
      completedAt: '2026-06-10T23:20:00.000Z',
    });
    expect(getDaySummary(state, '2026-06-11').flatMap((section) => section.items)).toEqual([]);
  });

  it('finishes a paused multi-day task at its most recent segment end', () => {
    let state = createInitialState();
    state = addTodo(state, 'Log paused progress', new Date('2026-06-08T08:00:00.000Z'));
    const parentId = state.todos[0].id;
    state = startTodoTimer(state, parentId, new Date('2026-06-08T23:00:00.000Z'));
    state = pauseTodoTimer(state, parentId, new Date('2026-06-08T23:20:00.000Z'));

    state = logProgressSession(state, parentId, new Date('2026-06-10T16:00:00.000Z'));

    expect(getProgressSessions(state, parentId)[0]).toMatchObject({
      completedAt: '2026-06-08T23:20:00.000Z',
      trackedSeconds: 20 * 60,
    });
    expect(state.todos.find((todo) => todo.id === parentId)?.completedAt).toBe(
      '2026-06-10T16:00:00.000Z',
    );
  });

  it('preserves detailed segments when editing aggregate completed timing', () => {
    let state = createInitialState();
    state = addTodo(state, 'Interrupted work', new Date('2026-06-10T08:00:00.000Z'));
    const todoId = state.todos[0].id;
    state = startTodoTimer(state, todoId, new Date('2026-06-10T09:00:00.000Z'));
    state = pauseTodoTimer(state, todoId, new Date('2026-06-10T09:30:00.000Z'));
    state = startTodoTimer(state, todoId, new Date('2026-06-10T10:00:00.000Z'));
    state = completeTodo(state, todoId, new Date('2026-06-10T10:45:00.000Z'));
    state = updateCompletedTodoTiming(
      state,
      todoId,
      new Date('2026-06-10T08:30:00.000Z'),
      new Date('2026-06-10T11:00:00.000Z'),
    );

    expect(state.todos[0]).toMatchObject({
      firstStartedAt: '2026-06-10T08:30:00.000Z',
      completedAt: '2026-06-10T11:00:00.000Z',
      trackedSeconds: 2 * 60 * 60,
      timeSegments: [
        {
          startedAt: '2026-06-10T08:30:00.000Z',
          endedAt: '2026-06-10T09:30:00.000Z',
        },
        {
          startedAt: '2026-06-10T10:00:00.000Z',
          endedAt: '2026-06-10T11:00:00.000Z',
        },
      ],
    });

    state = updateCompletedTodoTiming(
      state,
      todoId,
      new Date('2026-06-10T08:30:00.000Z'),
      new Date('2026-06-10T09:45:00.000Z'),
    );
    expect(state.todos[0]).toMatchObject({
      firstStartedAt: '2026-06-10T08:30:00.000Z',
      completedAt: '2026-06-10T09:45:00.000Z',
      trackedSeconds: 75 * 60,
      timeSegments: [
        {
          startedAt: '2026-06-10T08:30:00.000Z',
          endedAt: '2026-06-10T09:45:00.000Z',
        },
      ],
    });
  });

  it('accumulates edited time blocks into the tracked total', () => {
    let state = createInitialState();
    state = addTodo(state, 'Split work', new Date('2026-06-10T08:00:00.000Z'));
    const todoId = state.todos[0].id;
    state = completeTodo(state, todoId, new Date('2026-06-10T11:00:00.000Z'));

    state = updateTodoTimeSegments(state, todoId, [
      {
        startedAt: '2026-06-10T09:00:00.000Z',
        endedAt: '2026-06-10T09:30:00.000Z',
      },
      {
        startedAt: '2026-06-10T10:15:00.000Z',
        endedAt: '2026-06-10T11:00:00.000Z',
      },
    ]);

    expect(state.todos[0]).toMatchObject({
      firstStartedAt: '2026-06-10T09:00:00.000Z',
      completedAt: '2026-06-10T11:00:00.000Z',
      trackedSeconds: 75 * 60,
      timeSegments: [
        {
          startedAt: '2026-06-10T09:00:00.000Z',
          endedAt: '2026-06-10T09:30:00.000Z',
        },
        {
          startedAt: '2026-06-10T10:15:00.000Z',
          endedAt: '2026-06-10T11:00:00.000Z',
        },
      ],
    });

    state = updateTodoTimeSegments(state, todoId, [
      state.todos[0].timeSegments[0],
      {
        startedAt: '2026-06-10T10:15:00.000Z',
        endedAt: '2026-06-10T11:15:00.000Z',
      },
    ]);

    expect(state.todos[0]).toMatchObject({
      completedAt: '2026-06-10T11:00:00.000Z',
      trackedSeconds: 90 * 60,
    });
  });

  it('keeps a paused task open when its time blocks are edited', () => {
    let state = createInitialState();
    state = addTodo(state, 'Adjust paused work', new Date('2026-06-10T08:00:00.000Z'));
    const todoId = state.todos[0].id;
    state = startTodoTimer(state, todoId, new Date('2026-06-10T09:00:00.000Z'));
    state = pauseTodoTimer(state, todoId, new Date('2026-06-10T09:30:00.000Z'));

    state = updateTodoTimeSegments(state, todoId, [
      {
        startedAt: '2026-06-10T08:45:00.000Z',
        endedAt: '2026-06-10T09:45:00.000Z',
      },
    ]);

    expect(state.todos[0]).toMatchObject({
      firstStartedAt: '2026-06-10T08:45:00.000Z',
      activeStartedAt: null,
      completedAt: null,
      trackedSeconds: 60 * 60,
      timeSegments: [
        {
          startedAt: '2026-06-10T08:45:00.000Z',
          endedAt: '2026-06-10T09:45:00.000Z',
        },
      ],
    });
  });

  it('keeps a running task active when its time blocks are edited', () => {
    let state = createInitialState();
    state = addTodo(state, 'Adjust active work', new Date('2026-06-10T08:00:00.000Z'));
    const todoId = state.todos[0].id;
    state = startTodoTimer(state, todoId, new Date('2026-06-10T10:00:00.000Z'));

    state = updateTodoTimeSegments(state, todoId, [
      {
        startedAt: '2026-06-10T09:30:00.000Z',
        endedAt: '2026-06-10T10:45:00.000Z',
      },
    ]);

    expect(state.todos[0]).toMatchObject({
      firstStartedAt: '2026-06-10T09:30:00.000Z',
      activeStartedAt: '2026-06-10T10:45:00.000Z',
      completedAt: null,
      trackedSeconds: 75 * 60,
    });
  });

  it('rejects a time block whose end is not after its start', () => {
    let state = createInitialState();
    state = addTodo(state, 'Keep blocks valid', new Date('2026-06-10T08:00:00.000Z'));
    const todoId = state.todos[0].id;
    const original = state;

    expect(
      updateTodoTimeSegments(state, todoId, [
        {
          startedAt: '2026-06-10T10:00:00.000Z',
          endedAt: '2026-06-10T09:00:00.000Z',
        },
      ]),
    ).toBe(original);
  });

  it('deletes a todo and its progress sessions', () => {
    let state = createInitialState();
    state = addTodo(state, 'Read chapter', new Date('2026-06-08T08:00:00'));
    const parentId = state.todos[0].id;
    state = startTodoTimer(state, parentId, new Date('2026-06-08T20:00:00'));
    state = pauseTodoTimer(state, parentId, new Date('2026-06-08T20:20:00'));
    state = archivePriorDaySessions(state, new Date('2026-06-09T20:00:00'));

    state = deleteTodo(state, parentId);

    expect(state.todos).toEqual([]);
    expect(getPendingTodos(state)).toEqual([]);
    expect(getDaySummary(state, '2026-06-08').flatMap((section) => section.items)).toEqual([]);
  });

  it('moves a completed todo to another bucket without changing tracked duration', () => {
    let state = createInitialState();
    state = addTodo(state, 'Morning task', new Date('2026-06-08T08:00:00-07:00'));
    state = addTodo(state, 'Night task', new Date('2026-06-08T08:01:00-07:00'));
    state = completeTodo(state, state.todos[0].id, new Date('2026-06-08T08:30:00-07:00'));
    state = completeTodo(state, state.todos[1].id, new Date('2026-06-08T21:30:00-07:00'));
    state.todos[0] = { ...state.todos[0], trackedSeconds: 47 * 60 };
    const movedId = state.todos[0].id;

    state = moveCompletedTodoToSummaryBucket(state, '2026-06-08', movedId, 'Night');

    const summary = getDaySummary(state, '2026-06-08');
    expect(summary[1].items).toEqual([]);
    expect(summary[4].items.map((item) => item.title)).toEqual(['Night task', 'Morning task']);
    expect(summary[4].items.find((item) => item.id === movedId)).toMatchObject({
      durationSeconds: 47 * 60,
      durationLabel: '47m',
    });
  });

  it('anchors a todo moved to Morning at that date sunrise', () => {
    let state = createInitialState();
    state = addTodo(state, 'Move to sunrise', new Date('2026-06-08T08:00:00-07:00'));
    const todoId = state.todos[0].id;
    state = completeTodo(state, todoId, new Date('2026-06-08T18:00:00-07:00'));

    state = moveCompletedTodoToSummaryBucket(state, '2026-06-08', todoId, 'Morning');

    expect(state.todos[0].completedAt).toBe('2026-06-08T12:48:00.000Z');
    expect(getDaySummary(state, '2026-06-08')[1].items[0].title).toBe('Move to sunrise');
  });

  it('formats tracked duration as minutes, hours, or days', () => {
    expect(formatDuration(0)).toBe('0m');
    expect(formatDuration(59)).toBe('1m');
    expect(formatDuration(59 * 60)).toBe('59m');
    expect(formatDuration(61 * 60)).toBe('1h 1m');
    expect(formatDuration(25 * 60 * 60 + 8 * 60)).toBe('1d 1h 8m');
  });

  it('calculates the delay until the next local day', () => {
    expect(getMillisecondsUntilNextDay(new Date(2026, 5, 11, 23, 59, 58, 500))).toBe(1500);
    expect(getMillisecondsUntilNextDay(new Date(2026, 5, 11, 0, 0, 0, 0))).toBe(24 * 60 * 60 * 1000);
  });

  it('allows multiple tasks to run at the same time', () => {
    let state = createInitialState();
    state = addTodo(state, 'First', new Date('2026-06-08T08:00:00'));
    state = addTodo(state, 'Second', new Date('2026-06-08T08:01:00'));
    const firstId = state.todos[0].id;
    const secondId = state.todos[1].id;

    state = startTodoTimer(state, firstId, new Date('2026-06-08T08:10:00.000Z'));
    state = startTodoTimer(state, secondId, new Date('2026-06-08T08:15:30.000Z'));

    expect(state.todos.find((todo) => todo.id === firstId)).toMatchObject({
      firstStartedAt: '2026-06-08T08:10:00.000Z',
      activeStartedAt: '2026-06-08T08:10:00.000Z',
      trackedSeconds: 0,
    });
    expect(state.todos.find((todo) => todo.id === secondId)).toMatchObject({
      firstStartedAt: '2026-06-08T08:15:30.000Z',
      activeStartedAt: '2026-06-08T08:15:30.000Z',
      trackedSeconds: 0,
    });
  });

  it('reopens a finished task without losing tracked duration', () => {
    let state = createInitialState();
    state = addTodo(state, 'Revise draft', new Date('2026-06-08T08:00:00'));
    const todoId = state.todos[0].id;

    state = startTodoTimer(state, todoId, new Date('2026-06-08T08:10:00.000Z'));
    state = failTodo(state, todoId, new Date('2026-06-08T08:40:00.000Z'));
    state = reopenTodo(state, todoId);

    expect(state.todos[0]).toMatchObject({
      completedAt: null,
      activeStartedAt: null,
      trackedSeconds: 30 * 60,
      notionStatus: null,
    });
    expect(getPendingTodos(state).map((todo) => todo.id)).toEqual([todoId]);
    expect(getDaySummary(state, '2026-06-08').flatMap((section) => section.items)).toEqual([]);
  });

  it('does not reopen progressive session history entries', () => {
    let state = createInitialState();
    state = addTodo(state, 'Read book', new Date('2026-06-08T08:00:00'));
    const parentId = state.todos[0].id;
    state = startTodoTimer(state, parentId, new Date('2026-06-08T20:00:00'));
    state = pauseTodoTimer(state, parentId, new Date('2026-06-08T20:20:00'));
    state = archivePriorDaySessions(state, new Date('2026-06-09T12:00:00'));
    const sessionId = getProgressSessions(state, parentId)[0].id;
    const sessionDoneAt = state.todos.find((todo) => todo.id === sessionId).completedAt;

    state = reopenTodo(state, sessionId);

    expect(state.todos.find((todo) => todo.id === sessionId).completedAt).toBe(sessionDoneAt);
    expect(getPendingTodos(state).map((todo) => todo.id)).toEqual([parentId]);
  });

  it('pauses a running task and reports elapsed seconds', () => {
    let state = createInitialState();
    state = addTodo(state, 'Write notes', new Date('2026-06-08T08:00:00'));
    const todoId = state.todos[0].id;

    state = startTodoTimer(state, todoId, new Date('2026-06-08T08:00:00.000Z'));
    expect(getElapsedSeconds(state.todos[0], new Date('2026-06-08T08:02:05.000Z'))).toBe(125);

    state = pauseTodoTimer(state, todoId, new Date('2026-06-08T08:02:05.000Z'));

    expect(state.todos[0]).toMatchObject({
      activeStartedAt: null,
      trackedSeconds: 125,
      timeSegments: [
        {
          startedAt: '2026-06-08T08:00:00.000Z',
          endedAt: '2026-06-08T08:02:05.000Z',
        },
      ],
    });
  });

  it('resumes a stopped task and keeps total duration across interruptions', () => {
    let state = createInitialState();
    state = addTodo(state, 'Interrupted task', new Date('2026-06-08T08:00:00'));
    const todoId = state.todos[0].id;

    state = startTodoTimer(state, todoId, new Date('2026-06-08T08:00:00.000Z'));
    state = pauseTodoTimer(state, todoId, new Date('2026-06-08T08:05:00.000Z'));
    state = startTodoTimer(state, todoId, new Date('2026-06-08T08:20:00.000Z'));

    expect(getElapsedSeconds(state.todos[0], new Date('2026-06-08T08:27:30.000Z'))).toBe(12 * 60 + 30);

    state = pauseTodoTimer(state, todoId, new Date('2026-06-08T08:27:30.000Z'));

    expect(state.todos[0]).toMatchObject({
      activeStartedAt: null,
      trackedSeconds: 12 * 60 + 30,
      timeSegments: [
        {
          startedAt: '2026-06-08T08:00:00.000Z',
          endedAt: '2026-06-08T08:05:00.000Z',
        },
        {
          startedAt: '2026-06-08T08:20:00.000Z',
          endedAt: '2026-06-08T08:27:30.000Z',
        },
      ],
    });
  });

  it('splits a timer longer than 24 hours into prior-day recap sessions', () => {
    let state = createInitialState();
    state = addTodo(state, 'Long task', new Date('2026-06-08T08:00:00.000Z'));
    const todoId = state.todos[0].id;
    state = startTodoTimer(state, todoId, new Date('2026-06-08T08:00:00.000Z'));

    state = pauseTodoTimer(state, todoId, new Date('2026-06-10T08:00:00.000Z'));

    const sessions = getProgressSessions(state, todoId);
    expect(sessions).toHaveLength(2);
    expect(sessions.reduce((total, session) => total + session.trackedSeconds, 0)).toBe(47 * 60 * 60);
    expect(state.todos.find((todo) => todo.id === todoId)).toMatchObject({
      trackedSeconds: 60 * 60,
      completedAt: null,
      timeSegments: [
        {
          startedAt: '2026-06-10T07:00:00.000Z',
          endedAt: '2026-06-10T08:00:00.000Z',
        },
      ],
    });
  });

  it('ignores an invalid active start without losing existing time segments', () => {
    const existingSegment = {
      startedAt: '2026-06-08T08:00:00.000Z',
      endedAt: '2026-06-08T08:05:00.000Z',
      durationSeconds: 5 * 60,
    };
    const state = createInitialState([
      {
        id: 'invalid-timer',
        title: 'Invalid timer',
        createdAt: '2026-06-08T08:00:00.000Z',
        completedAt: null,
        activeStartedAt: 'not-a-date',
        trackedSeconds: 5 * 60,
        timeSegments: [existingSegment],
      },
    ]);

    const paused = pauseTodoTimer(state, 'invalid-timer', new Date('2026-06-08T09:00:00.000Z'));

    expect(paused.todos[0]).toMatchObject({
      activeStartedAt: null,
      trackedSeconds: 5 * 60,
      timeSegments: [
        {
          startedAt: existingSegment.startedAt,
          endedAt: existingSegment.endedAt,
        },
      ],
    });
  });

  it('finalizes a running timer when a task is completed', () => {
    let state = createInitialState();
    state = addTodo(state, 'Send update', new Date('2026-06-08T08:00:00'));
    const todoId = state.todos[0].id;

    state = startTodoTimer(state, todoId, new Date('2026-06-08T08:10:00.000Z'));
    state = completeTodo(state, todoId, new Date('2026-06-08T08:40:10.000Z'));

    expect(state.todos[0]).toMatchObject({
      completedAt: '2026-06-08T08:40:10.000Z',
      activeStartedAt: null,
      trackedSeconds: 1810,
      timeSegments: [
        {
          startedAt: '2026-06-08T08:10:00.000Z',
          endedAt: '2026-06-08T08:40:10.000Z',
        },
      ],
    });
    const completedSummaryItem = getDaySummary(state, '2026-06-08')
      .flatMap((section) => section.items)
      .find((item) => item.id === todoId);
    expect(completedSummaryItem).toMatchObject({
      durationSeconds: 1810,
      durationLabel: '30m',
    });
  });

  it('archives prior-day timer work into recap sessions and keeps the task open', () => {
    let state = createInitialState();
    state = addTodo(state, 'Read Atomic Habits', new Date('2026-06-08T08:00:00-07:00'));
    const parentId = state.todos[0].id;
    const mondayStart = new Date('2026-06-08T20:00:00-07:00');
    const mondayEnd = new Date('2026-06-08T20:23:00-07:00');
    const wednesday = new Date('2026-06-10T15:00:00-07:00');

    state = startTodoTimer(state, parentId, mondayStart);
    state = pauseTodoTimer(state, parentId, mondayEnd);
    state = archivePriorDaySessions(state, wednesday);

    const parent = state.todos.find((todo) => todo.id === parentId);
    const sessions = getProgressSessions(state, parentId);

    expect(parent).toMatchObject({
      title: 'Read Atomic Habits',
      completedAt: null,
      activeStartedAt: null,
      trackedSeconds: 0,
      timeSegments: [],
    });
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      title: 'Read Atomic Habits',
      parentTaskId: parentId,
      isProgressSession: true,
      firstStartedAt: mondayStart.toISOString(),
      completedAt: mondayEnd.toISOString(),
      trackedSeconds: 23 * 60,
    });
    expect(getPendingTodos(state).map((todo) => todo.id)).toContain(parentId);
    const summaryItem = getDaySummary(state, '2026-06-08')
      .flatMap((section) => section.items)
      .find((item) => item.parentTaskId === parentId);
    expect(summaryItem).toMatchObject({
      title: 'Read Atomic Habits',
      startedAt: mondayStart.toISOString(),
      durationLabel: '23m',
    });
  });

  it('does not create a second recap session for a day that already has one', () => {
    let state = createInitialState();
    state = addTodo(state, 'Read Atomic Habits', new Date('2026-06-08T08:00:00-07:00'));
    const todoId = state.todos[0].id;
    state = startTodoTimer(state, todoId, new Date('2026-06-08T09:00:00-07:00'));
    state = pauseTodoTimer(state, todoId, new Date('2026-06-08T09:20:00-07:00'));
    state = archivePriorDaySessions(state, new Date('2026-06-10T12:00:00-07:00'));
    const afterFirstArchive = state;

    state = {
      todos: state.todos.map((todo) =>
        todo.id === todoId
          ? {
              ...todo,
              timeSegments: [
                {
                  startedAt: new Date('2026-06-08T09:00:00-07:00').toISOString(),
                  endedAt: new Date('2026-06-08T09:20:00-07:00').toISOString(),
                },
                {
                  startedAt: new Date('2026-06-08T09:20:00-07:00').toISOString(),
                  endedAt: new Date('2026-06-08T10:00:00-07:00').toISOString(),
                },
              ],
              trackedSeconds: 60 * 60,
              firstStartedAt: new Date('2026-06-08T09:00:00-07:00').toISOString(),
            }
          : todo,
      ),
    };
    state = archivePriorDaySessions(state, new Date('2026-06-10T15:00:00-07:00'));

    const sessions = getProgressSessions(state, todoId);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe(getProgressSessions(afterFirstArchive, todoId)[0].id);
    expect(sessions[0].trackedSeconds).toBe(60 * 60);
    expect(state.todos.find((todo) => todo.id === todoId).timeSegments).toEqual([]);
  });

  it('does not archive same-day timer work', () => {
    let state = createInitialState();
    state = addTodo(state, 'Same day', new Date('2026-06-10T08:00:00-07:00'));
    const todoId = state.todos[0].id;
    state = startTodoTimer(state, todoId, new Date('2026-06-10T09:00:00-07:00'));
    state = pauseTodoTimer(state, todoId, new Date('2026-06-10T09:20:00-07:00'));
    const afterPause = state;
    state = archivePriorDaySessions(state, new Date('2026-06-10T15:00:00-07:00'));

    expect(state).toBe(afterPause);
    expect(getProgressSessions(state, todoId)).toHaveLength(0);
    expect(state.todos[0].trackedSeconds).toBe(20 * 60);
  });

  it('splits a timer left running overnight at the San Francisco day boundary', () => {
    let state = createInitialState();
    state = addTodo(state, 'Late night write', new Date('2026-06-08T20:00:00-07:00'));
    const todoId = state.todos[0].id;
    state = startTodoTimer(state, todoId, new Date('2026-06-08T23:30:00-07:00'));
    const wednesdayMorning = new Date('2026-06-09T01:10:00-07:00');
    state = archivePriorDaySessions(state, wednesdayMorning);

    const parent = state.todos.find((todo) => todo.id === todoId);
    const sessions = getProgressSessions(state, todoId);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].trackedSeconds).toBe(30 * 60);
    expect(parent.activeStartedAt).toBe(new Date('2026-06-09T00:00:00-07:00').toISOString());
    expect(parent.trackedSeconds).toBe(0);
    expect(parent.completedAt).toBeNull();
  });

  it('keeps an overnight split session in the day it was worked', () => {
    let state = createInitialState();
    state = addTodo(state, 'Late night write', new Date('2026-06-08T20:00:00-07:00'));
    const todoId = state.todos[0].id;
    state = startTodoTimer(state, todoId, new Date('2026-06-08T23:30:00-07:00'));
    state = completeTodo(state, todoId, new Date('2026-06-09T01:10:00-07:00'));

    const mondayItems = getDaySummary(state, '2026-06-08').flatMap((section) => section.items);
    const tuesdayItems = getDaySummary(state, '2026-06-09').flatMap((section) => section.items);
    expect(mondayItems).toHaveLength(1);
    expect(mondayItems[0]).toMatchObject({
      parentTaskId: todoId,
      isProgressSession: true,
      durationSeconds: 30 * 60,
    });
    expect(tuesdayItems).toHaveLength(1);
    expect(tuesdayItems[0]).toMatchObject({ id: todoId, durationSeconds: 70 * 60 });
  });

  it('reuses the overnight session when a stale client archives the same night again', () => {
    let state = createInitialState();
    state = addTodo(state, 'Late night write', new Date('2026-06-08T20:00:00-07:00'));
    const todoId = state.todos[0].id;
    state = startTodoTimer(state, todoId, new Date('2026-06-08T23:30:00-07:00'));
    const running = state;
    state = archivePriorDaySessions(state, new Date('2026-06-09T01:10:00-07:00'));
    const [session] = getProgressSessions(state, todoId);

    // Another client still holds the pre-archive timer but has loaded the session row.
    const stale = createInitialState([...running.todos, session]);
    const rearchived = archivePriorDaySessions(stale, new Date('2026-06-09T01:20:00-07:00'));

    const sessions = getProgressSessions(rearchived, todoId);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe(session.id);
    expect(sessions[0].trackedSeconds).toBe(30 * 60);
  });

  it('keeps a running timer alive when archiving exactly at the day rollover', () => {
    let state = createInitialState();
    state = addTodo(state, 'Late night write', new Date('2026-06-08T20:00:00-07:00'));
    const todoId = state.todos[0].id;
    state = startTodoTimer(state, todoId, new Date('2026-06-08T23:30:00-07:00'));
    const midnight = new Date('2026-06-09T00:00:00-07:00');
    state = archivePriorDaySessions(state, midnight);

    const parent = state.todos.find((todo) => todo.id === todoId);
    expect(getProgressSessions(state, todoId)).toHaveLength(1);
    expect(parent.activeStartedAt).toBe(midnight.toISOString());
    expect(parent.trackedSeconds).toBe(0);
  });

  it('archives the pre-midnight part when pausing after midnight', () => {
    let state = createInitialState();
    state = addTodo(state, 'Late night write', new Date('2026-06-08T20:00:00-07:00'));
    const todoId = state.todos[0].id;
    state = startTodoTimer(state, todoId, new Date('2026-06-08T23:30:00-07:00'));
    state = pauseTodoTimer(state, todoId, new Date('2026-06-09T00:30:00-07:00'));

    const parent = state.todos.find((todo) => todo.id === todoId);
    const sessions = getProgressSessions(state, todoId);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].trackedSeconds).toBe(30 * 60);
    expect(formatSummaryDayKey(new Date(sessions[0].completedAt))).toBe('2026-06-08');
    expect(parent).toMatchObject({
      activeStartedAt: null,
      trackedSeconds: 30 * 60,
      timeSegments: [
        {
          startedAt: new Date('2026-06-09T00:00:00-07:00').toISOString(),
          endedAt: new Date('2026-06-09T00:30:00-07:00').toISOString(),
        },
      ],
    });
  });

  it('archives prior-day work when completing without a pre-archive call', () => {
    let state = createInitialState();
    state = addTodo(state, 'Write investor update', new Date('2026-06-08T08:00:00-07:00'));
    const todoId = state.todos[0].id;
    state = startTodoTimer(state, todoId, new Date('2026-06-08T20:00:00-07:00'));
    state = pauseTodoTimer(state, todoId, new Date('2026-06-08T20:20:00-07:00'));
    state = startTodoTimer(state, todoId, new Date('2026-06-10T10:00:00-07:00'));
    const doneAt = new Date('2026-06-10T10:30:00-07:00');
    state = completeTodo(state, todoId, doneAt);

    const parent = state.todos.find((todo) => todo.id === todoId);
    const sessions = getProgressSessions(state, todoId);
    expect(parent.completedAt).toBe(doneAt.toISOString());
    expect(parent.trackedSeconds).toBe(30 * 60);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].trackedSeconds).toBe(20 * 60);
    expect(getPendingTodos(state).map((todo) => todo.id)).not.toContain(todoId);
  });

  it('preserves multiline progress indentation while editing', () => {
    let state = createInitialState();
    state = addTodo(state, 'Review distractions', new Date('2026-06-09T08:00:00'));
    const todoId = state.todos[0].id;

    state = updateTodoProgress(state, todoId, '\t- Twitter\n\t- LinkedIn\n');

    expect(state.todos[0].progressLabel).toBe('\t- Twitter\n\t- LinkedIn\n');
  });

  it('falls back to normal completion for single-day tasks', () => {
    let state = createInitialState();
    state = addTodo(state, 'Submit form', new Date('2026-06-09T08:00:00'));
    const doneAt = new Date('2026-06-09T09:00:00');

    state = logProgressSession(state, state.todos[0].id, doneAt);

    expect(state.todos).toHaveLength(1);
    expect(state.todos[0].completedAt).toBe(doneAt.toISOString());
  });
});

describe('note editing bursts', () => {
  const NOTE_BURST_GAP_MS = 5000;

  it('mints a new time for a gradual rewrite within one typing burst, even though each step looks similar', () => {
    // Save the first bullet, then let the burst gap elapse before the
    // rewrite starts: this is what makes the test meaningful. If the burst
    // baseline were captured right after an empty note (the old version of
    // this test), matching would never see "- Getting lunch now" as a
    // candidate and a fresh stamp would be inevitable regardless of whether
    // the anti-chaining logic works at all. Starting the burst a full gap
    // later forces the baseline captured at burst start to actually contain
    // "- Getting lunch now", so a real similarity comparison is exercised.
    //
    // The stamp format only has minute precision, so timestamps are chosen
    // to straddle a minute boundary: every gap inside the burst stays under
    // the 5s window, but the final call lands on a whole minute distinct
    // from savedAt's, making "kept the original stamp" and "minted a fresh
    // one" distinguishable by exact equality.
    const savedAt = new Date('2026-07-01T09:59:00.000Z');
    let state = createInitialState();
    state = addTodo(state, 'Lunch plan', savedAt);
    const todoId = state.todos[0].id;
    state = updateTodoNote(state, todoId, '- Getting lunch now', savedAt);

    const burstStart = new Date(savedAt.getTime() + NOTE_BURST_GAP_MS + 53000);
    const steps = ['- Not getting lunch now', '- Not getting lunch soon', '- Not getting lunch yet'];
    let callAt = burstStart;
    let lastCallAt;
    for (const draft of steps) {
      lastCallAt = callAt;
      state = updateTodoNote(state, todoId, draft, callAt);
      callAt = new Date(callAt.getTime() + 1000);
    }

    expect(lastCallAt.toISOString()).not.toBe(savedAt.toISOString());
    expect(parseNoteEntries(state.todos[0].note)).toEqual([
      { at: lastCallAt.toISOString(), text: '- Not getting lunch yet' },
    ]);
  });

  it('keeps the original time for a typo fix made in a later burst', () => {
    const first = new Date('2026-07-01T10:00:00.000Z');
    let state = createInitialState();
    state = addTodo(state, 'Call plan', first);
    const todoId = state.todos[0].id;
    state = updateTodoNote(state, todoId, '- Cal mom', first);

    // A later burst: the gap since the last tracked update is >= the burst
    // window, so the baseline refreshes to whatever is currently stored
    // (not a frozen baseline from before the first bullet even existed).
    const laterBurstAt = new Date(first.getTime() + NOTE_BURST_GAP_MS);
    state = updateTodoNote(state, todoId, '- Call mom', laterBurstAt);

    expect(parseNoteEntries(state.todos[0].note)).toEqual([{ at: first.toISOString(), text: '- Call mom' }]);
  });

  it('keeps both original times when reordering two bullets in a later burst', () => {
    const first = new Date('2026-07-01T10:00:00.000Z');
    const laterStamp = new Date('2026-07-01T10:05:00.000Z');
    let state = createInitialState();
    state = addTodo(state, 'Errands plan', first);
    const todoId = state.todos[0].id;
    state = updateTodoNote(state, todoId, '- Buy milk', first);
    state = updateTodoNote(state, todoId, '- Buy milk\n- Walk the dog', laterStamp);

    const laterBurstAt = new Date(laterStamp.getTime() + NOTE_BURST_GAP_MS);
    state = updateTodoNote(state, todoId, '- Walk the dog\n- Buy milk', laterBurstAt);

    expect(parseNoteEntries(state.todos[0].note)).toEqual([
      { at: laterStamp.toISOString(), text: '- Walk the dog' },
      { at: first.toISOString(), text: '- Buy milk' },
    ]);
  });

  it('does not track a baseline for a todo id that does not exist in state', () => {
    const state = createInitialState();

    const result = updateTodoNote(state, 'missing-id', 'draft', new Date('2026-07-01T10:00:00.000Z'));

    expect(result).toBe(state);
    expect(hasNoteBurstBaseline('missing-id')).toBe(false);
  });

  it('prunes a stale baseline entry after a later call updates a different todo', () => {
    const t0 = new Date('2026-07-01T10:00:00.000Z');
    let state = createInitialState();
    state = addTodo(state, 'First plan', t0);
    const firstId = state.todos[0].id;
    state = updateTodoNote(state, firstId, '- first', t0);

    expect(hasNoteBurstBaseline(firstId)).toBe(true);

    state = addTodo(state, 'Second plan', t0);
    const secondId = state.todos[1].id;
    const laterCall = new Date(t0.getTime() + NOTE_BURST_GAP_MS);
    state = updateTodoNote(state, secondId, '- second', laterCall);

    expect(hasNoteBurstBaseline(firstId)).toBe(false);
    expect(hasNoteBurstBaseline(secondId)).toBe(true);
  });
});

describe('board view columns', () => {
  it('places paused tasks assigned to today with scheduled tasks and keeps older pauses separate', () => {
    const todos = getPendingTodos(
      createInitialState([
        {
          id: 'today-ready',
          title: 'Today ready',
          createdAt: '2026-06-08T08:00:00.000Z',
          dueDate: '2026-06-08T07:00:00.000Z',
        },
        {
          id: 'today-paused',
          title: 'Today paused',
          createdAt: '2026-06-08T08:05:00.000Z',
          dueDate: '2026-06-08T07:00:00.000Z',
          firstStartedAt: '2026-06-08T09:00:00.000Z',
          activeStartedAt: null,
        },
        {
          id: 'older-paused',
          title: 'Older paused',
          createdAt: '2026-06-07T08:00:00.000Z',
          dueDate: '2026-06-07T07:00:00.000Z',
          firstStartedAt: '2026-06-07T09:00:00.000Z',
          activeStartedAt: null,
        },
      ]),
    );

    const groups = partitionTaskFlowTodos(todos, new Date('2026-06-08T12:00:00.000Z'));

    expect(groups.scheduled.map((todo) => todo.id)).toEqual(['today-paused', 'today-ready']);
    expect(groups.paused.map((todo) => todo.id)).toEqual(['older-paused']);
  });

  it('splits todos into not started, in progress, paused, someday, and done columns', () => {
    let state = createInitialState();
    state = addTodo(state, 'Backlog task', new Date('2026-06-08T08:00:00'));
    state = addTodo(state, 'Active task', new Date('2026-06-08T08:05:00'));
    state = addTodo(state, 'Paused task', new Date('2026-06-08T08:07:00'));
    state = addTodo(state, 'Someday task', new Date('2026-06-08T08:08:00'));
    state = addTodo(state, 'Finished task', new Date('2026-06-08T08:10:00'));
    const [, activeId, pausedId, somedayId, finishedId] = state.todos.map((todo) => todo.id);

    state = startTodoTimer(state, activeId, new Date('2026-06-08T09:00:00'));
    state = startTodoTimer(state, pausedId, new Date('2026-06-08T09:05:00'));
    state = pauseTodoTimer(state, pausedId, new Date('2026-06-08T09:15:00'));
    state = setTodoSomeday(state, somedayId, new Date('2026-06-08T09:30:00'));
    state = completeTodo(state, finishedId, new Date('2026-06-08T10:00:00'));

    const columns = getBoardColumns(state, { dayKey: '2026-06-08' });

    expect(columns.map((column) => column.id)).toEqual([
      'not_started',
      'in_progress',
      'paused',
      'stall',
      'done',
    ]);
    expect(columns[0].items.map((todo) => todo.title)).toEqual(['Backlog task']);
    expect(columns[1].items.map((todo) => todo.title)).toEqual(['Active task']);
    expect(columns[2].items.map((todo) => todo.title)).toEqual(['Paused task']);
    expect(columns[3].items.map((todo) => todo.title)).toEqual(['Someday task']);
    expect(columns[4].items.map((todo) => todo.title)).toEqual(['Finished task']);
    expect(columns[4].items[0].durationLabel).toBe('0m');
    expect(partitionPendingTodos(getPendingTodos(state))).toMatchObject({
      ready: [expect.objectContaining({ title: 'Backlog task' })],
      ongoing: [expect.objectContaining({ title: 'Active task' })],
      paused: [expect.objectContaining({ title: 'Paused task' })],
    });
  });

  it('parks a running task in someday and restores it without losing tracked time', () => {
    let state = createInitialState();
    state = addTodo(state, 'Explore a future idea', new Date('2026-06-08T08:00:00.000Z'));
    const todoId = state.todos[0].id;
    state = startTodoTimer(state, todoId, new Date('2026-06-08T09:00:00.000Z'));

    const parkedAt = new Date('2026-06-08T09:20:00.000Z');
    state = moveTodoToBoardColumn(state, todoId, 'stall', parkedAt);

    expect(state.todos[0]).toMatchObject({
      somedayAt: parkedAt.toISOString(),
      activeStartedAt: null,
      completedAt: null,
      trackedSeconds: 20 * 60,
    });
    expect(getBoardColumnId(state.todos[0])).toBe('stall');
    expect(getActiveTodos(state)).toEqual([]);
    expect(getSomedayTodos(state).map((todo) => todo.id)).toEqual([todoId]);

    state = moveTodoToBoardColumn(state, todoId, 'paused', new Date('2026-06-09T09:00:00.000Z'));

    expect(state.todos[0].somedayAt).toBeNull();
    expect(getBoardColumnId(state.todos[0])).toBe('paused');
    expect(getActiveTodos(state).map((todo) => todo.id)).toEqual([todoId]);
  });

  it('keeps a never-started someday task parked when it is moved to paused', () => {
    let state = createInitialState();
    state = addTodo(state, 'Maybe later', new Date('2026-06-08T08:00:00.000Z'));
    const todoId = state.todos[0].id;
    state = setTodoSomeday(state, todoId, new Date('2026-06-08T09:00:00.000Z'));

    state = moveTodoToBoardColumn(state, todoId, 'paused', new Date('2026-06-09T09:00:00.000Z'));

    expect(getBoardColumnId(state.todos[0])).toBe('stall');
    expect(state.todos[0].somedayAt).toBe('2026-06-08T09:00:00.000Z');
  });

  it('only shows done tasks for the selected day on the board', () => {
    let state = createInitialState();
    state = addTodo(state, 'Yesterday done', new Date('2026-06-07T08:00:00'));
    state = addTodo(state, 'Today done', new Date('2026-06-08T08:00:00'));
    const [yesterdayId, todayId] = state.todos.map((todo) => todo.id);

    state = completeTodo(state, yesterdayId, new Date('2026-06-07T12:00:00'));
    state = completeTodo(state, todayId, new Date('2026-06-08T12:00:00'));

    const columns = getBoardColumns(state, { dayKey: '2026-06-08' });
    expect(columns.find((column) => column.id === 'done').items.map((todo) => todo.title)).toEqual([
      'Today done',
    ]);
  });

  it('keeps each board column newest first and leaves a started task in ongoing state', () => {
    let state = createInitialState();
    state = addTodo(state, 'Older ready', new Date('2026-06-08T08:00:00'));
    state = addTodo(state, 'Newer ready', new Date('2026-06-08T09:00:00'));
    const olderId = state.todos[0].id;
    const newerId = state.todos[1].id;

    state = startTodoTimer(state, olderId, new Date('2026-06-08T09:15:00'));

    const columns = getBoardColumns(state, { dayKey: '2026-06-08' });

    expect(columns.find((column) => column.id === 'not_started').items.map((todo) => todo.id)).toEqual([
      newerId,
    ]);
    expect(columns.find((column) => column.id === 'in_progress').items.map((todo) => todo.id)).toEqual([
      olderId,
    ]);
    expect(partitionPendingTodos(getPendingTodos(state)).ongoing.map((todo) => todo.id)).toEqual([
      olderId,
    ]);
  });

  it('starts the timer when a task moves from not started to in progress', () => {
    let state = createInitialState();
    state = addTodo(state, 'Write brief', new Date('2026-06-08T08:00:00'));
    const todoId = state.todos[0].id;
    const startedAt = new Date('2026-06-08T09:15:00');

    state = moveTodoToBoardColumn(state, todoId, 'in_progress', startedAt);

    expect(state.todos[0]).toMatchObject({
      activeStartedAt: startedAt.toISOString(),
      firstStartedAt: startedAt.toISOString(),
      completedAt: null,
    });
  });

  it('ends the timer and records duration when a task moves to done', () => {
    let state = createInitialState();
    state = addTodo(state, 'Ship fix', new Date('2026-06-08T08:00:00'));
    const todoId = state.todos[0].id;
    state = startTodoTimer(state, todoId, new Date('2026-06-08T09:00:00'));
    const doneAt = new Date('2026-06-08T09:45:00');

    state = moveTodoToBoardColumn(state, todoId, 'done', doneAt);

    expect(state.todos[0]).toMatchObject({
      completedAt: doneAt.toISOString(),
      activeStartedAt: null,
      trackedSeconds: 45 * 60,
    });
  });

  it('pauses the timer when a task moves to paused', () => {
    let state = createInitialState();
    state = addTodo(state, 'Pause me', new Date('2026-06-08T08:00:00'));
    const todoId = state.todos[0].id;
    state = startTodoTimer(state, todoId, new Date('2026-06-08T09:00:00'));
    const pausedAt = new Date('2026-06-08T09:20:00');

    state = moveTodoToBoardColumn(state, todoId, 'paused', pausedAt);

    expect(state.todos[0]).toMatchObject({
      activeStartedAt: null,
      completedAt: null,
      trackedSeconds: 20 * 60,
    });
    expect(getBoardColumnId(state.todos[0])).toBe('paused');
  });

  it('reopens a done task into in progress and starts a fresh timer segment', () => {
    let state = createInitialState();
    state = addTodo(state, 'Reopen me', new Date('2026-06-08T08:00:00'));
    const todoId = state.todos[0].id;
    state = startTodoTimer(state, todoId, new Date('2026-06-08T09:00:00'));
    state = completeTodo(state, todoId, new Date('2026-06-08T09:30:00'));
    const restartedAt = new Date('2026-06-08T11:00:00');

    state = moveTodoToBoardColumn(state, todoId, 'in_progress', restartedAt);

    expect(state.todos[0]).toMatchObject({
      completedAt: null,
      activeStartedAt: restartedAt.toISOString(),
      trackedSeconds: 30 * 60,
    });
  });

  it('completes a task when moving it to done after archiving prior days', () => {
    let state = createInitialState();
    state = addTodo(state, 'Read book', new Date('2026-06-08T08:00:00'));
    const parentId = state.todos[0].id;
    state = startTodoTimer(state, parentId, new Date('2026-06-08T09:00:00'));
    const doneAt = new Date('2026-06-08T09:25:00');

    state = moveTodoToBoardColumn(state, parentId, 'done', doneAt);

    const parent = state.todos.find((todo) => todo.id === parentId);
    expect(parent).toMatchObject({
      completedAt: doneAt.toISOString(),
      activeStartedAt: null,
      trackedSeconds: 25 * 60,
    });
    expect(getProgressSessions(state, parentId)).toHaveLength(0);
  });
});

describe('task due dates', () => {
  it('assigns a new todo to its creation date when no date is chosen', () => {
    let state = createInitialState();
    state = addTodo(state, 'No deadline', new Date('2026-06-08T08:00:00'));
    expect(state.todos.at(-1).dueDate).toBe(new Date(2026, 5, 8).toISOString());
  });

  it('stores a due date passed at creation time', () => {
    let state = createInitialState();
    state = addTodo(state, 'Ship it', new Date('2026-06-08T08:00:00'), {
      dueDate: '2026-06-12T00:00:00.000Z',
    });
    expect(state.todos.at(-1).dueDate).toBe('2026-06-12T00:00:00.000Z');
  });

  it('backfills dueDate to null for todos loaded without the field', () => {
    const state = createInitialState([
      { id: 'legacy-1', title: 'Old task', createdAt: '2026-06-01T08:00:00.000Z', completedAt: null },
    ]);
    expect(state.todos[0].dueDate).toBeNull();
  });

  it('sets and clears a due date on an existing todo', () => {
    let state = createInitialState();
    state = addTodo(state, 'Ship', new Date('2026-06-08T08:00:00'));
    const id = state.todos[0].id;

    state = setTodoDueDate(state, id, '2026-06-12T00:00:00.000Z');
    expect(state.todos[0].dueDate).toBe('2026-06-12T00:00:00.000Z');

    state = setTodoDueDate(state, id, null);
    expect(state.todos[0].dueDate).toBeNull();
  });

  it('sets and clears a task photo on an existing todo', () => {
    let state = createInitialState();
    state = addTodo(state, 'Ship', new Date('2026-06-08T08:00:00'));
    const id = state.todos[0].id;

    state = setTodoPhoto(state, id, {
      photoUrl: 'https://files.example/photo.jpg',
      photoKey: 'user-1/task/photo.jpg',
    });
    expect(state.todos[0].photoUrl).toBe('https://files.example/photo.jpg');
    expect(state.todos[0].photoKey).toBe('user-1/task/photo.jpg');

    state = setTodoPhoto(state, id, { photoUrl: null, photoKey: null });
    expect(state.todos[0].photoUrl).toBeNull();
    expect(state.todos[0].photoKey).toBeNull();
  });

  it('formats a due date as a short month/day label', () => {
    // Local midnight of Jun 12, so the label is stable regardless of timezone.
    const iso = new Date(2026, 5, 12).toISOString();
    expect(formatDueDate(iso)).toBe('Jun 12');
  });

  it('formats a missing or invalid due date as an empty string', () => {
    expect(formatDueDate(null)).toBe('');
    expect(formatDueDate('not-a-date')).toBe('');
  });
});

describe('board due-date filter', () => {
  const now = new Date(2026, 6, 19, 9, 0, 0); // Sun Jul 19 2026, local
  const withDue = (dueDate) => ({ id: 'x', title: 't', dueDate });

  it('keeps every task under the "all" filter, including tasks with no due date', () => {
    expect(matchesDueFilter(withDue(null), 'all', now)).toBe(true);
    expect(matchesDueFilter(withDue(new Date(2026, 6, 10).toISOString()), 'all', now)).toBe(true);
  });

  it('matches only past-due tasks under "overdue"', () => {
    expect(matchesDueFilter(withDue(new Date(2026, 6, 18).toISOString()), 'overdue', now)).toBe(true);
    expect(matchesDueFilter(withDue(new Date(2026, 6, 19).toISOString()), 'overdue', now)).toBe(false);
    expect(matchesDueFilter(withDue(null), 'overdue', now)).toBe(false);
  });

  it('matches only today under "today"', () => {
    expect(matchesDueFilter(withDue(new Date(2026, 6, 19).toISOString()), 'today', now)).toBe(true);
    expect(matchesDueFilter(withDue(new Date(2026, 6, 20).toISOString()), 'today', now)).toBe(false);
  });

  it('matches today through six days out under "week"', () => {
    expect(matchesDueFilter(withDue(new Date(2026, 6, 19).toISOString()), 'week', now)).toBe(true);
    expect(matchesDueFilter(withDue(new Date(2026, 6, 25).toISOString()), 'week', now)).toBe(true);
    expect(matchesDueFilter(withDue(new Date(2026, 6, 26).toISOString()), 'week', now)).toBe(false);
    expect(matchesDueFilter(withDue(new Date(2026, 6, 18).toISOString()), 'week', now)).toBe(false);
  });

  it('applies the filter to the open board columns only', () => {
    const state = createInitialState([
      { id: 'a', title: 'Overdue task', createdAt: new Date(2026, 6, 1).toISOString(), completedAt: null, dueDate: new Date(2026, 6, 18).toISOString() },
      { id: 'b', title: 'Future task', createdAt: new Date(2026, 6, 1).toISOString(), completedAt: null, dueDate: new Date(2026, 6, 30).toISOString() },
      { id: 'c', title: 'No due date', createdAt: new Date(2026, 6, 1).toISOString(), completedAt: null, dueDate: null },
    ]);

    const columns = getBoardColumns(state, { dueFilter: 'overdue', now });
    const notStarted = columns.find((column) => column.id === 'not_started');
    expect(notStarted.items.map((item) => item.id)).toEqual(['a']);
  });
});

describe('project kind', () => {
  it('defaults new todos to task and keeps projects off the board', () => {
    let state = createInitialState();
    state = addTodo(state, 'Ship the landing page', new Date('2026-06-08T08:00:00.000Z'));
    state = addTodo(state, 'Garden studio', new Date('2026-06-08T08:05:00.000Z'), {
      kind: 'project',
      dueDate: '2026-06-09T00:00:00.000Z',
    });

    expect(state.todos.map((todo) => todo.kind)).toEqual(['task', 'project']);
    expect(state.todos[1].dueDate).toBeNull();
    expect(getPendingTodos(state).map((todo) => todo.title)).toEqual(['Ship the landing page']);
    expect(getProjectTodos(state).map((todo) => todo.title)).toEqual(['Garden studio']);
    expect(
      getBoardColumns(state, { dayKey: '2026-06-08' }).flatMap((column) =>
        column.items.map((item) => item.title),
      ),
    ).toEqual(['Ship the landing page']);
  });

  it('treats a missing kind as a task', () => {
    const state = createInitialState([
      {
        id: 'legacy',
        title: 'Old row',
        createdAt: '2026-06-08T08:00:00.000Z',
        completedAt: null,
      },
    ]);

    expect(state.todos[0].kind).toBe('task');
    expect(getPendingTodos(state).map((todo) => todo.id)).toEqual(['legacy']);
  });

  it('refuses to park a project in someday', () => {
    let state = addTodo(createInitialState(), 'Cabin rebuild', new Date('2026-06-08T08:00:00.000Z'), {
      kind: 'project',
    });
    const todoId = state.todos[0].id;

    state = setTodoSomeday(state, todoId, new Date('2026-06-08T09:00:00.000Z'));

    expect(state.todos[0].somedayAt).toBeNull();
    expect(getProjectTodos(state).map((todo) => todo.id)).toEqual([todoId]);
  });

  it('promotes a project into an active task', () => {
    let state = addTodo(createInitialState(), 'Garden studio', new Date('2026-06-08T08:00:00.000Z'), {
      kind: 'project',
    });
    const todoId = state.todos[0].id;

    state = promoteTodoToTask(state, todoId);

    expect(state.todos[0].kind).toBe('task');
    expect(getPendingTodos(state).map((todo) => todo.id)).toEqual([todoId]);
    expect(getProjectTodos(state)).toEqual([]);
  });
});
