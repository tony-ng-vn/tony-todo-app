import { describe, expect, it } from 'vitest';
import {
  addTodo,
  completeTodo,
  createInitialState,
  failTodo,
  getDaySummary,
  getMillisecondsUntilNextDay,
  getPendingTodos,
  getProgressSessions,
  formatDuration,
  getElapsedSeconds,
  logProgressSession,
  moveCompletedTodoToSummaryBucket,
  pauseTodoTimer,
  reorderCompletedTodosForDay,
  reopenTodo,
  setTodoProgressive,
  startTodoTimer,
  deleteTodo,
  updateCompletedTodoTiming,
  updateTodoCompletedAt,
  updateTodoProgress,
  updateTodoTitle,
  updateTodoNote,
} from './todoStore.js';

describe('todo day summary', () => {
  it('keeps active todos ordered by creation time', () => {
    let state = createInitialState();
    state = addTodo(state, 'Draft landing page', new Date('2026-06-08T08:10:00'));
    state = addTodo(state, 'Send invoice', new Date('2026-06-08T08:05:00'));

    expect(getPendingTodos(state).map((todo) => todo.title)).toEqual([
      'Send invoice',
      'Draft landing page',
    ]);
  });

  it('always renders the four recap buckets for the selected day', () => {
    const state = createInitialState();

    expect(getDaySummary(state, '2026-06-08')).toEqual([
      { label: 'Morning', items: [] },
      { label: 'Lunch', items: [] },
      { label: 'Evening', items: [] },
      { label: 'Night', items: [] },
    ]);
  });

  it('adds completed todos to the summary for the day they were marked done', () => {
    let state = createInitialState();
    state = addTodo(state, 'Review prototype', new Date('2026-06-07T21:30:00'));
    const todoId = state.todos[0].id;
    const doneAt = new Date('2026-06-08T12:15:00');

    state = completeTodo(state, todoId, doneAt);

    expect(getPendingTodos(state)).toEqual([]);
    expect(getDaySummary(state, '2026-06-08')[1]).toEqual({
      label: 'Lunch',
      items: [
        {
          id: todoId,
          title: 'Review prototype',
          completedAt: doneAt.toISOString(),
          note: '',
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
    state = addTodo(state, 'Submit proposal', new Date('2026-06-08T08:00:00'));
    const todoId = state.todos[0].id;
    const failedAt = new Date('2026-06-08T17:20:00');

    state = failTodo(state, todoId, failedAt);

    expect(getPendingTodos(state)).toEqual([]);
    expect(state.todos[0]).toMatchObject({
      completedAt: failedAt.toISOString(),
      activeStartedAt: null,
      notionStatus: 'Failed',
    });
    expect(getDaySummary(state, '2026-06-08')[2].items[0]).toMatchObject({
      id: todoId,
      title: 'Submit proposal',
      outcome: 'failed',
    });
  });

  it('groups a day summary into fixed buckets in recap order', () => {
    let state = createInitialState();
    state = addTodo(state, 'Stretch', new Date('2026-06-08T06:30:00'));
    state = addTodo(state, 'Call Sam', new Date('2026-06-08T07:00:00'));
    state = completeTodo(state, state.todos[1].id, new Date('2026-06-08T18:45:00'));
    state = completeTodo(state, state.todos[0].id, new Date('2026-06-08T08:00:00'));

    expect(getDaySummary(state, '2026-06-08').map((section) => section.label)).toEqual([
      'Morning',
      'Lunch',
      'Evening',
      'Night',
    ]);
    expect(getDaySummary(state, '2026-06-08')[0].items[0].title).toBe('Stretch');
    expect(getDaySummary(state, '2026-06-08')[2].items[0].title).toBe('Call Sam');
  });

  it('updates a task note without changing other task fields', () => {
    let state = createInitialState();
    state = addTodo(state, 'Call school', new Date('2026-06-08T08:00:00'));
    const todo = state.todos[0];

    state = updateTodoNote(state, todo.id, 'Ask about the scholarship deadline.');

    expect(state.todos[0]).toEqual({
      ...todo,
      note: 'Ask about the scholarship deadline.',
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
    state = addTodo(state, 'First', new Date('2026-06-08T08:00:00'));
    state = addTodo(state, 'Second', new Date('2026-06-08T08:01:00'));
    state = completeTodo(state, state.todos[0].id, new Date('2026-06-08T12:00:00'));
    state = completeTodo(state, state.todos[1].id, new Date('2026-06-08T12:10:00'));

    state = reorderCompletedTodosForDay(state, '2026-06-08', [state.todos[1].id, state.todos[0].id]);

    const summaryTitles = getDaySummary(state, '2026-06-08')[1].items.map((item) => item.title);
    expect(summaryTitles).toEqual(['Second', 'First']);
    expect(new Date(state.todos[1].completedAt) < new Date(state.todos[0].completedAt)).toBe(true);
  });

  it('updates the finished date and time for a completed todo without changing its duration', () => {
    let state = createInitialState();
    state = addTodo(state, 'File receipt', new Date('2026-06-08T08:00:00'));
    const todoId = state.todos[0].id;
    state = completeTodo(state, todoId, new Date('2026-06-08T08:30:00'));
    state.todos[0] = { ...state.todos[0], trackedSeconds: 17 * 60 };

    state = updateTodoCompletedAt(state, todoId, new Date('2026-06-09T21:45:00'));

    expect(state.todos[0]).toMatchObject({
      completedAt: new Date('2026-06-09T21:45:00').toISOString(),
      trackedSeconds: 17 * 60,
    });
    expect(getDaySummary(state, '2026-06-08').flatMap((section) => section.items)).toEqual([]);
    expect(getDaySummary(state, '2026-06-09')[3].items[0]).toMatchObject({
      id: todoId,
      title: 'File receipt',
      durationLabel: '17m',
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
      durationSeconds: 150 * 60,
      durationLabel: '2h 30m',
    });
  });

  it('deletes a todo and its progress sessions', () => {
    let state = createInitialState();
    state = addTodo(state, 'Read chapter', new Date('2026-06-09T08:00:00'));
    const parentId = state.todos[0].id;
    state = setTodoProgressive(state, parentId, true);
    state = updateTodoProgress(state, parentId, 'pages 10-20');
    state = logProgressSession(state, parentId, new Date('2026-06-09T20:00:00'));

    state = deleteTodo(state, parentId);

    expect(state.todos).toEqual([]);
    expect(getPendingTodos(state)).toEqual([]);
    expect(getDaySummary(state, '2026-06-09').flatMap((section) => section.items)).toEqual([]);
  });

  it('moves a completed todo to another bucket without changing tracked duration', () => {
    let state = createInitialState();
    state = addTodo(state, 'Morning task', new Date('2026-06-08T08:00:00'));
    state = addTodo(state, 'Night task', new Date('2026-06-08T08:01:00'));
    state = completeTodo(state, state.todos[0].id, new Date('2026-06-08T08:30:00'));
    state = completeTodo(state, state.todos[1].id, new Date('2026-06-08T21:30:00'));
    state.todos[0] = { ...state.todos[0], trackedSeconds: 47 * 60 };
    const movedId = state.todos[0].id;

    state = moveCompletedTodoToSummaryBucket(state, '2026-06-08', movedId, 'Night');

    const summary = getDaySummary(state, '2026-06-08');
    expect(summary[0].items).toEqual([]);
    expect(summary[3].items.map((item) => item.title)).toEqual(['Night task', 'Morning task']);
    expect(summary[3].items.find((item) => item.id === movedId)).toMatchObject({
      durationSeconds: 47 * 60,
      durationLabel: '47m',
    });
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
    state = addTodo(state, 'Read book', new Date('2026-06-09T08:00:00'));
    const parentId = state.todos[0].id;
    const sessionDoneAt = new Date('2026-06-09T20:00:00');
    state = setTodoProgressive(state, parentId, true);
    state = logProgressSession(state, parentId, sessionDoneAt);
    const sessionId = getProgressSessions(state, parentId)[0].id;

    state = reopenTodo(state, sessionId);

    expect(state.todos.find((todo) => todo.id === sessionId).completedAt).toBe(sessionDoneAt.toISOString());
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
    });
    const completedSummaryItem = getDaySummary(state, '2026-06-08')
      .flatMap((section) => section.items)
      .find((item) => item.id === todoId);
    expect(completedSummaryItem).toMatchObject({
      durationSeconds: 1810,
      durationLabel: '30m',
    });
  });

  it('logs a progressive task session without completing the parent task', () => {
    let state = createInitialState();
    state = addTodo(state, 'Read Atomic Habits', new Date('2026-06-09T08:00:00'));
    const parentId = state.todos[0].id;

    state = setTodoProgressive(state, parentId, true);
    state = updateTodoProgress(state, parentId, 'pages 41-52');
    const doneAt = new Date('2026-06-09T20:28:00');
    state = startTodoTimer(state, parentId, new Date('2026-06-09T20:00:00'));
    state = logProgressSession(state, parentId, doneAt);

    const parent = state.todos.find((todo) => todo.id === parentId);
    const sessions = getProgressSessions(state, parentId);

    expect(parent).toMatchObject({
      title: 'Read Atomic Habits',
      isProgressive: true,
      completedAt: null,
      activeStartedAt: null,
      trackedSeconds: 0,
      progressLabel: 'pages 41-52',
    });
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      title: 'Read Atomic Habits',
      parentTaskId: parentId,
      isProgressSession: true,
      progressLabel: 'pages 41-52',
      completedAt: doneAt.toISOString(),
      trackedSeconds: 28 * 60,
    });
    expect(getPendingTodos(state).map((todo) => todo.id)).toContain(parentId);
    const summaryItem = getDaySummary(state, '2026-06-09')
      .flatMap((section) => section.items)
      .find((item) => item.parentTaskId === parentId);
    expect(summaryItem).toMatchObject({
      title: 'Read Atomic Habits',
      progressLabel: 'pages 41-52',
      durationLabel: '28m',
    });
  });

  it('falls back to normal completion for non-progressive tasks', () => {
    let state = createInitialState();
    state = addTodo(state, 'Submit form', new Date('2026-06-09T08:00:00'));
    const doneAt = new Date('2026-06-09T09:00:00');

    state = logProgressSession(state, state.todos[0].id, doneAt);

    expect(state.todos).toHaveLength(1);
    expect(state.todos[0].completedAt).toBe(doneAt.toISOString());
  });
});
