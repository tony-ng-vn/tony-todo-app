import {
  SUMMARY_BUCKETS,
  addTodo,
  closeActiveTimeSegment,
  compareTodosNewestFirst,
  completeTodo,
  createInitialState,
  createTodoId,
  findDuplicateTodo,
  formatDuration,
  formatSummaryDayKey,
  getActiveSegmentSeconds,
  getBoardColumnId,
  getCompletedTodos,
  getCompletionTimestamp,
  getDayPartLabel,
  getDaySummary,
  getPendingTodos,
  getProjectTodos,
  parseTodoKind,
  normalizeTimeSegments,
  normalizeTodo,
  normalizedTrackedSeconds,
} from './todoCommands.js';

export {
  addTodo,
  closeActiveTimeSegment,
  completeTodo,
  createInitialState,
  createTodoId,
  findDuplicateTodo,
  formatDuration,
  getBoardColumnId,
  getCompletedTodos,
  getCompletionTimestamp,
  getDayPartLabel,
  getDaySummary,
  getPendingTodos,
  getProjectTodos,
  parseTodoKind,
};

export const BOARD_COLUMNS = [
  { id: 'not_started', label: 'Not started' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'paused', label: 'Paused' },
  { id: 'stall', label: 'Stall' },
  { id: 'done', label: 'Done' },
];

export function failTodo(state, todoId, failedAt = new Date()) {
  return {
    ...state,
    todos: state.todos.map((todo) => {
      if (todo.id !== todoId) {
        return todo;
      }

      const doneAt = getCompletionTimestamp(todo, failedAt);

      return {
        ...todo,
        ...closeActiveTimeSegment(todo, doneAt),
        completedAt: doneAt.toISOString(),
        somedayAt: null,
        activeStartedAt: null,
        notionStatus: 'Failed',
      };
    }),
  };
}

export function updateTodoCompletedAt(state, todoId, completedAt) {
  const doneDate = new Date(completedAt);
  if (Number.isNaN(doneDate.getTime())) {
    return state;
  }

  const todo = state.todos.find((item) => item.id === todoId);
  const startedAt = todo?.firstStartedAt ? new Date(todo.firstStartedAt) : null;
  if (startedAt && !Number.isNaN(startedAt.getTime()) && startedAt >= doneDate) {
    return state;
  }

  const doneAt = doneDate.toISOString();

  return {
    ...state,
    todos: state.todos.map((todo) =>
      todo.id === todoId && todo.completedAt
        ? {
            ...todo,
            completedAt: doneAt,
            activeStartedAt: null,
          }
        : todo,
    ),
  };
}

export function deleteTodo(state, todoId) {
  return {
    ...state,
    todos: state.todos.filter((todo) => todo.id !== todoId && todo.parentTaskId !== todoId),
  };
}

export function updateCompletedTodoTiming(state, todoId, startedAt, completedAt) {
  return updateTodoTiming(state, todoId, startedAt, completedAt);
}

export function updateTodoTiming(state, todoId, startedAt, completedAt) {
  const start = new Date(startedAt);
  const end = new Date(completedAt);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
    return state;
  }

  const startTime = start.getTime();
  const endTime = end.getTime();

  return {
    ...state,
    todos: state.todos.map((todo) => {
      if (todo.id !== todoId) {
        return todo;
      }

      const existingSegments = normalizeTimeSegments(todo.timeSegments);
      const timeSegments = updateTimeSegmentBounds(existingSegments, startTime, endTime) ?? [
        {
          startedAt: new Date(startTime).toISOString(),
          endedAt: new Date(endTime).toISOString(),
        },
      ];

      return {
        ...todo,
        firstStartedAt: new Date(startTime).toISOString(),
        activeStartedAt: null,
        completedAt: new Date(endTime).toISOString(),
        trackedSeconds: totalTimeSegmentSeconds(timeSegments),
        timeSegments,
      };
    }),
  };
}

export function updateTodoTimeSegments(state, todoId, segments) {
  if (!Array.isArray(segments) || segments.length === 0) {
    return state;
  }

  const timeSegments = segments
    .map((segment) => {
      const startedAt = new Date(segment?.startedAt);
      const endedAt = new Date(segment?.endedAt);
      if (
        Number.isNaN(startedAt.getTime()) ||
        Number.isNaN(endedAt.getTime()) ||
        startedAt >= endedAt
      ) {
        return null;
      }

      return {
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
      };
    })
    .filter(Boolean);

  if (timeSegments.length !== segments.length) {
    return state;
  }

  timeSegments.sort((first, second) => new Date(first.startedAt) - new Date(second.startedAt));
  const firstStartedAt = timeSegments[0].startedAt;
  const latestEndedAt = timeSegments.reduce(
    (latest, segment) =>
      new Date(segment.endedAt) > new Date(latest) ? segment.endedAt : latest,
    timeSegments[0].endedAt,
  );

  return {
    ...state,
    todos: state.todos.map((todo) => {
      if (todo.id !== todoId) {
        return todo;
      }

      const wasCompleted = Boolean(todo.completedAt);
      const wasRunning = Boolean(todo.activeStartedAt);

      return {
        ...todo,
        firstStartedAt,
        activeStartedAt: wasRunning ? latestEndedAt : null,
        completedAt: wasCompleted ? latestEndedAt : null,
        trackedSeconds: totalTimeSegmentSeconds(timeSegments),
        timeSegments,
      };
    }),
  };
}

export function startTodoTimer(state, todoId, startedAt = new Date()) {
  const startedAtIso = startedAt.toISOString();

  return {
    ...state,
    todos: state.todos.map((todo) => {
      if (todo.completedAt || todo.id !== todoId) {
        return todo;
      }

      if (todo.activeStartedAt) {
        return todo;
      }

      return {
        ...todo,
        somedayAt: null,
        firstStartedAt: todo.firstStartedAt ?? startedAtIso,
        activeStartedAt: startedAtIso,
        trackedSeconds: normalizedTrackedSeconds(todo),
        timeSegments: normalizeTimeSegments(todo.timeSegments),
      };
    }),
  };
}

export function pauseTodoTimer(state, todoId, pausedAt = new Date()) {
  return {
    ...state,
    todos: state.todos.map((todo) =>
      todo.id === todoId && todo.activeStartedAt
        ? {
            ...todo,
            ...closeActiveTimeSegment(todo, pausedAt),
            activeStartedAt: null,
          }
        : todo,
    ),
  };
}

export function reopenTodo(state, todoId) {
  return {
    ...state,
    todos: state.todos.map((todo) =>
      todo.id === todoId && todo.completedAt && !todo.isProgressSession
        ? {
            ...todo,
            completedAt: null,
            somedayAt: null,
            activeStartedAt: null,
            notionStatus: null,
            trackedSeconds: normalizedTrackedSeconds(todo),
          }
        : todo,
    ),
  };
}

export function getActiveTodos(state) {
  return getPendingTodos(state).filter((todo) => !todo.somedayAt);
}

export function getSomedayTodos(state) {
  return getPendingTodos(state).filter((todo) => Boolean(todo.somedayAt));
}

export function partitionPendingTodos(todos) {
  const groups = { ready: [], ongoing: [], paused: [] };

  for (const todo of todos) {
    const columnId = getBoardColumnId(todo);
    if (columnId === 'in_progress') {
      groups.ongoing.push(todo);
    } else if (columnId === 'paused') {
      groups.paused.push(todo);
    } else if (columnId === 'not_started') {
      groups.ready.push(todo);
    }
  }

  return Object.fromEntries(
    Object.entries(groups).map(([key, items]) => [key, items.toSorted(compareTodosNewestFirst)]),
  );
}

export function partitionTaskFlowTodos(todos, currentDate = new Date()) {
  const { ready, ongoing, paused } = partitionPendingTodos(todos);
  const currentDayKey = formatDayKey(currentDate);
  const pausedToday = [];
  const pausedOther = [];

  for (const todo of paused) {
    if (getTodoAssignedDayKey(todo) === currentDayKey) {
      pausedToday.push(todo);
    } else {
      pausedOther.push(todo);
    }
  }

  return {
    scheduled: [...ready, ...pausedToday].toSorted(compareTodosNewestFirst),
    ongoing,
    paused: pausedOther,
  };
}

export const BOARD_DUE_FILTERS = ['all', 'overdue', 'today', 'week'];

export function matchesDueFilter(todo, filter, now = new Date()) {
  if (!filter || filter === 'all') {
    return true;
  }

  if (!todo?.dueDate) {
    return false;
  }

  const due = new Date(todo.dueDate);
  if (Number.isNaN(due.getTime())) {
    return false;
  }

  const dueKey = formatDayKey(due);
  const todayKey = formatDayKey(now);

  if (filter === 'overdue') {
    return dueKey < todayKey;
  }

  if (filter === 'today') {
    return dueKey === todayKey;
  }

  if (filter === 'week') {
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() + 6);
    return dueKey >= todayKey && dueKey <= formatDayKey(weekEnd);
  }

  return true;
}

export function getBoardColumns(state, { dayKey, dueFilter = 'all', now = new Date() } = {}) {
  const pending = getPendingTodos(state);
  const doneDayKey = dayKey ?? formatDayKey(now);
  const notStarted = [];
  const inProgress = [];
  const paused = [];
  const stall = [];

  for (const todo of pending) {
    if (!matchesDueFilter(todo, dueFilter, now)) {
      continue;
    }

    const columnId = getBoardColumnId(todo);
    if (columnId === 'in_progress') {
      inProgress.push(enrichBoardItem(todo, now));
    } else if (columnId === 'paused') {
      paused.push(enrichBoardItem(todo, now));
    } else if (columnId === 'stall') {
      stall.push(enrichBoardItem(todo, now));
    } else {
      notStarted.push(enrichBoardItem(todo, now));
    }
  }

  const done = getCompletedTodos(state)
    .filter((todo) => formatDayKey(new Date(todo.completedAt)) === doneDayKey)
    .map((todo) => enrichBoardItem(todo, now));

  return BOARD_COLUMNS.map((column) => {
    if (column.id === 'not_started') {
      return { ...column, items: notStarted };
    }

    if (column.id === 'in_progress') {
      return { ...column, items: inProgress };
    }

    if (column.id === 'paused') {
      return { ...column, items: paused };
    }

    if (column.id === 'stall') {
      return { ...column, items: stall };
    }

    return { ...column, items: done };
  });
}

export function moveTodoToBoardColumn(state, todoId, columnId, at = new Date()) {
  let todo = state.todos.find((entry) => entry.id === todoId);

  if (!todo || todo.isProgressSession || !BOARD_COLUMNS.some((column) => column.id === columnId)) {
    return state;
  }

  let currentColumnId = getBoardColumnId(todo);
  if (currentColumnId === columnId) {
    return state;
  }

  if (columnId === 'stall') {
    return setTodoSomeday(state, todoId, at);
  }

  if (currentColumnId === 'stall' && columnId === 'paused' && !todo.firstStartedAt) {
    return state;
  }

  if (currentColumnId === 'stall') {
    state = restoreTodoFromSomeday(state, todoId);
    todo = state.todos.find((entry) => entry.id === todoId);
    currentColumnId = getBoardColumnId(todo);
  }

  if (columnId === 'not_started') {
    if (currentColumnId === 'done') {
      return reopenTodo(state, todoId);
    }

    return state;
  }

  if (columnId === 'in_progress') {
    if (currentColumnId === 'done') {
      return startTodoTimer(reopenTodo(state, todoId), todoId, at);
    }

    return startTodoTimer(state, todoId, at);
  }

  if (columnId === 'paused') {
    if (currentColumnId === 'in_progress') {
      return pauseTodoTimer(state, todoId, at);
    }

    if (currentColumnId === 'done') {
      return reopenTodo(state, todoId);
    }

    return state;
  }

  if (columnId === 'done') {
    return logProgressSession(state, todoId, at);
  }

  return state;
}

export function setTodoSomeday(state, todoId, somedayAt = new Date()) {
  const parkedAt = new Date(somedayAt);
  if (Number.isNaN(parkedAt.getTime())) {
    return state;
  }

  return {
    ...state,
    todos: state.todos.map((todo) => {
      if (todo.id !== todoId || todo.isProgressSession || parseTodoKind(todo.kind) === 'project') {
        return todo;
      }

      return {
        ...todo,
        ...closeActiveTimeSegment(todo, parkedAt),
        completedAt: null,
        somedayAt: parkedAt.toISOString(),
        activeStartedAt: null,
        notionStatus: null,
      };
    }),
  };
}

export function restoreTodoFromSomeday(state, todoId) {
  return {
    ...state,
    todos: state.todos.map((todo) =>
      todo.id === todoId && todo.somedayAt ? { ...todo, somedayAt: null } : todo,
    ),
  };
}

export function promoteTodoToTask(state, todoId) {
  return {
    ...state,
    todos: state.todos.map((todo) =>
      todo.id === todoId && parseTodoKind(todo.kind) === 'project'
        ? { ...todo, kind: 'task', somedayAt: null }
        : todo,
    ),
  };
}

function enrichBoardItem(todo, now) {
  const durationSeconds = getElapsedSeconds(todo, now);

  return {
    ...todo,
    durationSeconds,
    durationLabel: formatDuration(durationSeconds),
    outcome: todo.notionStatus === 'Failed' ? 'failed' : todo.completedAt ? 'done' : null,
  };
}

export function getOpenTodoSections(todos, currentDate = new Date()) {
  const currentDayKey = formatDayKey(currentDate);
  const sectionsByDate = new Map();

  for (const todo of todos.toSorted(compareTodosNewestFirst)) {
    const dayKey = getTodoAssignedDayKey(todo);
    const sectionId = dayKey ?? 'undated';
    if (!sectionsByDate.has(sectionId)) {
      sectionsByDate.set(sectionId, {
        id: sectionId,
        label:
          dayKey === currentDayKey
            ? 'Today todos'
            : dayKey
              ? formatDateGroupLabel(dayKey)
              : 'Undated tasks',
        dateKey: dayKey,
        isToday: dayKey === currentDayKey,
        items: [],
      });
    }
    sectionsByDate.get(sectionId).items.push(todo);
  }

  return [...sectionsByDate.values()]
    .map((section) => ({ ...section, items: section.items.toSorted(compareTodosNewestFirst) }))
    .toSorted((first, second) => {
      if (!first.dateKey) return 1;
      if (!second.dateKey) return -1;
      return second.dateKey.localeCompare(first.dateKey);
    });
}

export function getCompletedTodoSections(state, currentDate = new Date()) {
  const currentDayKey = formatDayKey(currentDate);
  const sectionsByDate = new Map();

  for (const todo of getCompletedTodos(state)) {
    const completedDate = new Date(todo.completedAt);
    if (Number.isNaN(completedDate.getTime())) {
      continue;
    }

    const dayKey = formatDayKey(completedDate);
    if (!sectionsByDate.has(dayKey)) {
      sectionsByDate.set(dayKey, {
        id: dayKey,
        label: dayKey === currentDayKey ? 'Today finished' : formatDateGroupLabel(dayKey),
        dateKey: dayKey,
        isToday: dayKey === currentDayKey,
        items: [],
      });
    }
    sectionsByDate.get(dayKey).items.push(todo);
  }

  return [...sectionsByDate.values()].toSorted((first, second) =>
    second.dateKey.localeCompare(first.dateKey),
  );
}

export function getCalendarMonth(state, { year, month, now = new Date() } = {}) {
  const byDay = new Map();
  for (const todo of getCompletedTodos(state)) {
    const key = formatDayKey(new Date(todo.completedAt));
    if (!byDay.has(key)) {
      byDay.set(key, []);
    }
    byDay.get(key).push(todo);
  }

  const todayKey = formatDayKey(now);
  const firstOfMonth = new Date(year, month, 1);
  const gridStart = new Date(year, month, 1 - firstOfMonth.getDay());
  const cursor = new Date(gridStart);
  const weeks = [];

  for (let week = 0; week < 6; week += 1) {
    const days = [];
    for (let day = 0; day < 7; day += 1) {
      const key = formatDayKey(cursor);
      days.push({
        dateKey: key,
        day: cursor.getDate(),
        inMonth: cursor.getMonth() === month,
        isToday: key === todayKey,
        items: byDay.get(key) ?? [],
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(days);
  }

  return {
    year,
    month,
    monthLabel: new Intl.DateTimeFormat([], { month: 'long', year: 'numeric' }).format(firstOfMonth),
    weeks,
  };
}

export function updateTodoNote(state, todoId, note) {
  return {
    ...state,
    todos: state.todos.map((todo) => (todo.id === todoId ? { ...todo, note } : todo)),
  };
}

export function updateTodoTitle(state, todoId, title) {
  const cleanTitle = title.trim();
  if (!cleanTitle || findDuplicateTodo(state, cleanTitle, { excludeTodoId: todoId })) {
    return state;
  }

  return {
    ...state,
    todos: state.todos.map((todo) => (todo.id === todoId ? { ...todo, title: cleanTitle } : todo)),
  };
}

export function setTodoDueDate(state, todoId, dueDate) {
  return {
    ...state,
    todos: state.todos.map((todo) => (todo.id === todoId ? { ...todo, dueDate: dueDate ?? null } : todo)),
  };
}

export function formatDueDate(dueDate) {
  if (!dueDate) {
    return '';
  }

  const date = new Date(dueDate);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat([], { month: 'short', day: 'numeric' }).format(date);
}

export function formatTaskTimestamp(timestamp) {
  if (!timestamp) {
    return '';
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function getDefaultTaskStartTimestamp(todo) {
  for (const timestamp of [todo?.firstStartedAt, todo?.createdAt]) {
    if (!timestamp) {
      continue;
    }

    const date = new Date(timestamp);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  return null;
}

export function getEditableTaskTimeSegments(todo, activeEndedAt = new Date()) {
  const recordedSegments = normalizeTimeSegments(todo?.timeSegments);

  if (todo?.activeStartedAt) {
    const startedAt = new Date(todo.activeStartedAt);
    const endedAt = new Date(activeEndedAt);
    if (!Number.isNaN(startedAt.getTime()) && !Number.isNaN(endedAt.getTime())) {
      return [
        ...recordedSegments,
        {
          startedAt: startedAt.toISOString(),
          endedAt: new Date(Math.max(startedAt.getTime(), endedAt.getTime())).toISOString(),
        },
      ];
    }
  }

  if (recordedSegments.length) {
    return recordedSegments;
  }

  const completedAt = todo?.completedAt ? new Date(todo.completedAt) : null;
  return [
    {
      startedAt: getDefaultTaskStartTimestamp(todo),
      endedAt: completedAt && !Number.isNaN(completedAt.getTime()) ? completedAt.toISOString() : null,
    },
  ];
}

export function setTodoProgressive(state, todoId, isProgressive) {
  return {
    ...state,
    todos: state.todos.map((todo) =>
      todo.id === todoId && !todo.isProgressSession
        ? {
            ...todo,
            isProgressive: Boolean(isProgressive),
          }
        : todo,
    ),
  };
}

export function updateTodoProgress(state, todoId, progressLabel) {
  return {
    ...state,
    todos: state.todos.map((todo) =>
      todo.id === todoId
        ? {
            ...todo,
            progressLabel: progressLabel ?? '',
          }
        : todo,
    ),
  };
}

export function logProgressSession(state, todoId, completedAt = new Date()) {
  const parent = state.todos.find((todo) => todo.id === todoId);

  if (!parent?.isProgressive) {
    return completeTodo(state, todoId, completedAt);
  }

  const session = createProgressSession(parent, getCompletionTimestamp(parent, completedAt));

  return {
    ...state,
    todos: [
      ...state.todos.map((todo) =>
        todo.id === todoId
          ? {
              ...todo,
              firstStartedAt: null,
              activeStartedAt: null,
              trackedSeconds: 0,
              timeSegments: [],
            }
          : todo,
      ),
      session,
    ],
  };
}

export function getProgressSessions(state, parentTaskId) {
  return state.todos
    .filter((todo) => todo.parentTaskId === parentTaskId && todo.isProgressSession)
    .toSorted((first, second) => new Date(second.completedAt) - new Date(first.completedAt));
}

export function getTaskTimeSegments(state, taskId) {
  const task = state.todos.find((todo) => todo.id === taskId);
  if (!task) {
    return [];
  }

  const sessionSegments = task.isProgressive
    ? getProgressSessions(state, taskId).flatMap((session) => normalizeTimeSegments(session.timeSegments))
    : [];

  return [...sessionSegments, ...normalizeTimeSegments(task.timeSegments)]
    .toSorted((first, second) => new Date(first.startedAt) - new Date(second.startedAt))
    .map((segment) => ({
      ...segment,
      durationSeconds: getActiveSegmentSeconds(new Date(segment.startedAt), new Date(segment.endedAt)),
    }));
}

export function reorderCompletedTodosForDay(state, dayKey, orderedIds) {
  const completedForDay = getCompletedTodos(state).filter(
    (todo) => formatSummaryDayKey(new Date(todo.completedAt)) === dayKey,
  );
  if (completedForDay.length === 0) {
    return state;
  }

  const existingById = new Map(completedForDay.map((todo) => [todo.id, todo]));
  const orderedForDay = [
    ...orderedIds.map((id) => existingById.get(id)).filter(Boolean),
    ...completedForDay.filter((todo) => !orderedIds.includes(todo.id)),
  ];
  const latestCompletion = new Date(completedForDay[0].completedAt);
  const nextCompletedAtById = new Map(
    orderedForDay.map((todo, index) => [
      todo.id,
      new Date(latestCompletion.getTime() - index * 60_000).toISOString(),
    ]),
  );

  return {
    ...state,
    todos: state.todos.map((todo) =>
      nextCompletedAtById.has(todo.id) ? { ...todo, completedAt: nextCompletedAtById.get(todo.id) } : todo,
    ),
  };
}

export function moveCompletedTodoToSummaryBucket(state, dayKey, todoId, bucketLabel, targetId = null) {
  if (!SUMMARY_BUCKETS.some((bucket) => bucket.label === bucketLabel)) {
    return state;
  }

  const summary = getDaySummary(state, dayKey);
  const targetSection = summary.find((section) => section.label === bucketLabel);
  const movingTodo = state.todos.find((todo) => todo.id === todoId && todo.completedAt);

  if (!targetSection || !movingTodo || formatSummaryDayKey(new Date(movingTodo.completedAt)) !== dayKey) {
    return state;
  }

  const targetIds = targetSection.items.map((item) => item.id).filter((id) => id !== todoId);
  const targetIndex = targetId ? targetIds.indexOf(targetId) : -1;
  const orderedTargetIds =
    targetIndex === -1
      ? [...targetIds, todoId]
      : [...targetIds.slice(0, targetIndex), todoId, ...targetIds.slice(targetIndex)];
  const completedAtById = new Map(
    orderedTargetIds.map((id, index) => [
      id,
      completedAtForBucketPosition(dayKey, bucketLabel, index, orderedTargetIds.length),
    ]),
  );

  return {
    ...state,
    todos: state.todos.map((todo) =>
      completedAtById.has(todo.id) ? { ...todo, completedAt: completedAtById.get(todo.id) } : todo,
    ),
  };
}

export function formatDayKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function shiftDayKey(dayKey, offset) {
  const [year, month, day] = dayKey.split('-').map(Number);
  const shiftedDate = new Date(year, month - 1, day);
  shiftedDate.setDate(shiftedDate.getDate() + offset);
  return formatDayKey(shiftedDate);
}

export function getMillisecondsUntilNextDay(now = new Date()) {
  const nextDay = new Date(now);
  nextDay.setHours(24, 0, 0, 0);
  return nextDay.getTime() - now.getTime();
}

export function getElapsedSeconds(todo, now = new Date()) {
  const baseSeconds = normalizedTrackedSeconds(todo);
  if (!todo.activeStartedAt) {
    return baseSeconds;
  }

  const startedAt = new Date(todo.activeStartedAt).getTime();
  const nowTime = now.getTime();
  const elapsed = Math.floor((nowTime - startedAt) / 1000);
  return baseSeconds + Math.max(0, elapsed);
}

function getTodoAssignedDayKey(todo) {
  const assignedDate = todo?.dueDate ? new Date(todo.dueDate) : null;
  if (assignedDate && !Number.isNaN(assignedDate.getTime())) {
    return formatDayKey(assignedDate);
  }

  const createdDate = new Date(todo?.createdAt);
  return Number.isNaN(createdDate.getTime()) ? null : formatDayKey(createdDate);
}

function formatDateGroupLabel(dayKey) {
  const date = new Date(`${dayKey}T00:00:00`);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function totalTimeSegmentSeconds(segments) {
  return segments.reduce(
    (total, segment) =>
      total + getActiveSegmentSeconds(new Date(segment.startedAt), new Date(segment.endedAt)),
    0,
  );
}

function updateTimeSegmentBounds(segments, startTime, endTime) {
  const startIso = new Date(startTime).toISOString();
  const endIso = new Date(endTime).toISOString();

  if (segments.length <= 1) {
    return [{ startedAt: startIso, endedAt: endIso }];
  }

  const firstEndedAt = new Date(segments[0].endedAt).getTime();
  const lastStartedAt = new Date(segments.at(-1).startedAt).getTime();
  if (startTime > firstEndedAt || endTime < lastStartedAt) {
    return null;
  }

  return segments.map((segment, index) => ({
    startedAt: index === 0 ? startIso : segment.startedAt,
    endedAt: index === segments.length - 1 ? endIso : segment.endedAt,
  }));
}

function createProgressSession(parent, completedAt) {
  const doneAt = completedAt.toISOString();
  const stoppedTimer = closeActiveTimeSegment(parent, completedAt);

  return {
    ...normalizeTodo({
      id: createProgressSessionId(parent.id, completedAt),
      title: parent.title,
      createdAt: parent.activeStartedAt ?? completedAt.toISOString(),
      completedAt: doneAt,
      note: parent.progressLabel ?? '',
      source: 'progress-session',
      parentTaskId: parent.id,
      isProgressSession: true,
      progressLabel: parent.progressLabel ?? '',
      firstStartedAt: parent.firstStartedAt ?? null,
      activeStartedAt: null,
      trackedSeconds: stoppedTimer.trackedSeconds,
      timeSegments: stoppedTimer.timeSegments,
    }),
  };
}

function createProgressSessionId(parentId, completedAt) {
  return `${completedAt.getTime()}-${parentId.slice(0, 24)}-session`;
}

function completedAtForBucketPosition(dayKey, bucketLabel, index, itemCount) {
  const bucket = SUMMARY_BUCKETS.find((candidate) => candidate.label === bucketLabel);
  return new Date(bucket.startAt(dayKey).getTime() + (itemCount - index - 1) * 60_000).toISOString();
}
