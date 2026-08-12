import { getTimes } from 'suncalc';

const SAN_FRANCISCO = { latitude: 37.774929, longitude: -122.419418 };
const SAN_FRANCISCO_TIME_ZONE = 'America/Los_Angeles';
const DEFAULT_SUNRISE_HOUR = 6;
const SAN_FRANCISCO_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-US-u-nu-latn', {
  timeZone: SAN_FRANCISCO_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const SUMMARY_BUCKETS = [
  { label: 'Early morning', startAt: (dayKey) => dateAtSanFranciscoTime(dayKey, 0) },
  { label: 'Morning', startAt: getSanFranciscoSunrise },
  { label: 'Lunch', startAt: (dayKey) => dateAtSanFranciscoTime(dayKey, 11 * 60) },
  { label: 'Evening', startAt: (dayKey) => dateAtSanFranciscoTime(dayKey, 14 * 60) },
  { label: 'Night', startAt: (dayKey) => dateAtSanFranciscoTime(dayKey, 20 * 60) },
];

export const BOARD_COLUMNS = [
  { id: 'not_started', label: 'Not started' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'paused', label: 'Paused' },
  { id: 'someday', label: 'Someday' },
  { id: 'done', label: 'Done' },
];

export function createInitialState(todos = []) {
  return { todos: todos.map(normalizeTodo) };
}

export function addTodo(state, title, createdAt = new Date(), { dueDate = null } = {}) {
  const cleanTitle = title.trim();

  if (!cleanTitle || findDuplicateTodo(state, cleanTitle)) {
    return state;
  }

  const assignedDate = normalizeAssignedDate(dueDate, createdAt);

  return {
    ...state,
    todos: [
      ...state.todos,
      {
        id: createTodoId(cleanTitle, createdAt),
        title: cleanTitle,
        createdAt: createdAt.toISOString(),
        completedAt: null,
        somedayAt: null,
        dueDate: assignedDate,
        note: '',
        source: 'app',
        notionPageId: null,
        notionDatabaseId: null,
        notionStatus: null,
        firstStartedAt: null,
        activeStartedAt: null,
        trackedSeconds: 0,
        timeSegments: [],
        isProgressive: false,
        parentTaskId: null,
        isProgressSession: false,
        progressLabel: '',
      },
    ],
  };
}

export function findDuplicateTodo(state, title, { excludeTodoId = null } = {}) {
  const candidateTitle = normalizeTaskTitle(title);
  if (!candidateTitle) {
    return null;
  }

  return (
    state.todos.find((todo) => {
      if (todo.id === excludeTodoId || todo.completedAt || todo.isProgressSession) {
        return false;
      }

      return taskTitlesMatch(candidateTitle, normalizeTaskTitle(todo.title));
    }) ?? null
  );
}

export function completeTodo(state, todoId, completedAt = new Date()) {
  return {
    ...state,
    todos: state.todos.map((todo) => {
      if (todo.id !== todoId) {
        return todo;
      }

      const doneAt = getCompletionTimestamp(todo, completedAt);

      return {
        ...todo,
        ...closeActiveTimeSegment(todo, doneAt),
        completedAt: doneAt.toISOString(),
        somedayAt: null,
        activeStartedAt: null,
      };
    }),
  };
}

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

export function getPendingTodos(state) {
  return state.todos
    .filter((todo) => !todo.completedAt && !todo.isProgressSession)
    .toSorted(compareTodosNewestFirst);
}

export function getActiveTodos(state) {
  return getPendingTodos(state).filter((todo) => !todo.somedayAt);
}

export function getSomedayTodos(state) {
  return getPendingTodos(state).filter((todo) => Boolean(todo.somedayAt));
}

export function getBoardColumnId(todo) {
  if (todo.completedAt) {
    return 'done';
  }

  if (todo.somedayAt) {
    return 'someday';
  }

  if (todo.activeStartedAt) {
    return 'in_progress';
  }

  if (todo.firstStartedAt) {
    return 'paused';
  }

  return 'not_started';
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

// Board filter presets keyed off a task's due date. 'all' shows everything;
// the rest only match tasks that actually have a due date.
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
  const someday = [];

  for (const todo of pending) {
    if (!matchesDueFilter(todo, dueFilter, now)) {
      continue;
    }

    const columnId = getBoardColumnId(todo);
    if (columnId === 'in_progress') {
      inProgress.push(enrichBoardItem(todo, now));
    } else if (columnId === 'paused') {
      paused.push(enrichBoardItem(todo, now));
    } else if (columnId === 'someday') {
      someday.push(enrichBoardItem(todo, now));
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

    if (column.id === 'someday') {
      return { ...column, items: someday };
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

  if (columnId === 'someday') {
    return setTodoSomeday(state, todoId, at);
  }

  if (currentColumnId === 'someday' && columnId === 'paused' && !todo.firstStartedAt) {
    return state;
  }

  if (currentColumnId === 'someday') {
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
      if (todo.id !== todoId || todo.isProgressSession) {
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

export function getCompletedTodos(state) {
  return state.todos
    .filter((todo) => todo.completedAt)
    .toSorted((first, second) => {
      const firstTime = new Date(first.completedAt).getTime();
      const secondTime = new Date(second.completedAt).getTime();
      const safeFirstTime = Number.isNaN(firstTime) ? -Infinity : firstTime;
      const safeSecondTime = Number.isNaN(secondTime) ? -Infinity : secondTime;
      return safeSecondTime - safeFirstTime;
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

// Month grid of completed tasks, grouped by the day each task was finished.
// month is 0-based. Always returns 6 weeks x 7 days so the grid height is
// stable, including leading/trailing days from adjacent months (flagged with
// inMonth: false), Notion-calendar style.
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

export function getDaySummary(state, dayKey) {
  const sections = new Map(SUMMARY_BUCKETS.map((bucket) => [bucket.label, []]));

  for (const todo of getCompletedTodos(state)) {
    const completedDate = new Date(todo.completedAt);
    if (formatSummaryDayKey(completedDate) !== dayKey) {
      continue;
    }

    const label = getDayPartLabel(completedDate);
    sections.get(label).push({
      id: todo.id,
      title: todo.title,
      startedAt: todo.firstStartedAt ?? null,
      completedAt: todo.completedAt,
      note: todo.note ?? '',
      durationSeconds: normalizedTrackedSeconds(todo),
      durationLabel: formatDuration(normalizedTrackedSeconds(todo)),
      outcome: todo.notionStatus === 'Failed' ? 'failed' : 'done',
      parentTaskId: todo.parentTaskId ?? null,
      isProgressSession: Boolean(todo.isProgressSession),
      progressLabel: todo.progressLabel ?? '',
    });
  }

  return Array.from(sections, ([label, items]) => ({ label, items }));
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

// Short, day-granular label for a task's due date (e.g. "Jun 12"). Empty for
// no/invalid date. Formatted in local time to match the day the user picked.
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

export function formatDuration(seconds) {
  const cleanSeconds = Math.max(0, seconds);
  const totalMinutes = cleanSeconds === 0 ? 0 : Math.max(1, Math.floor(cleanSeconds / 60));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${totalMinutes}m`;
}

export function getDayPartLabel(date) {
  const dayKey = formatSummaryDayKey(date);
  if (!dayKey) {
    return 'Night';
  }

  return SUMMARY_BUCKETS.toReversed().find((bucket) => date >= bucket.startAt(dayKey))?.label ?? 'Early morning';
}

export function createTodoId(title, date) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 32);

  return `${date.getTime()}-${slug || 'todo'}`;
}

function normalizeTaskTitle(title) {
  return String(title ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function taskTitlesMatch(candidateTitle, existingTitle) {
  if (!existingTitle) {
    return false;
  }

  if (candidateTitle === existingTitle) {
    return true;
  }

  const candidateTokens = candidateTitle.split(' ');
  const existingTokens = existingTitle.split(' ');
  if (
    candidateTokens.length >= 3 &&
    candidateTokens.length === existingTokens.length &&
    candidateTokens.toSorted().join(' ') === existingTokens.toSorted().join(' ')
  ) {
    return true;
  }

  const longerLength = Math.max(candidateTitle.length, existingTitle.length);
  if (longerLength < 12) {
    return false;
  }

  const allowedDistance = longerLength >= 24 ? 2 : 1;
  if (Math.abs(candidateTitle.length - existingTitle.length) > allowedDistance) {
    return false;
  }

  return editDistanceAtMost(candidateTitle, existingTitle, allowedDistance);
}

function editDistanceAtMost(first, second, limit) {
  let previous = Array.from({ length: second.length + 1 }, (_, index) => index);
  let previousPrevious = null;

  for (let firstIndex = 1; firstIndex <= first.length; firstIndex += 1) {
    const current = [firstIndex];
    let rowMinimum = current[0];

    for (let secondIndex = 1; secondIndex <= second.length; secondIndex += 1) {
      const substitutionCost = first[firstIndex - 1] === second[secondIndex - 1] ? 0 : 1;
      current[secondIndex] = Math.min(
        current[secondIndex - 1] + 1,
        previous[secondIndex] + 1,
        previous[secondIndex - 1] + substitutionCost,
      );
      if (
        previousPrevious &&
        first[firstIndex - 1] === second[secondIndex - 2] &&
        first[firstIndex - 2] === second[secondIndex - 1]
      ) {
        current[secondIndex] = Math.min(
          current[secondIndex],
          previousPrevious[secondIndex - 2] + 1,
        );
      }
      rowMinimum = Math.min(rowMinimum, current[secondIndex]);
    }

    if (rowMinimum > limit) {
      return false;
    }

    previousPrevious = previous;
    previous = current;
  }

  return previous[second.length] <= limit;
}

function normalizedTrackedSeconds(todo) {
  return Math.max(0, Math.floor(Number(todo.trackedSeconds ?? 0)));
}

function compareTodosNewestFirst(first, second) {
  const firstCreatedAt = new Date(first.createdAt).getTime();
  const secondCreatedAt = new Date(second.createdAt).getTime();
  const firstTime = Number.isNaN(firstCreatedAt) ? -Infinity : firstCreatedAt;
  const secondTime = Number.isNaN(secondCreatedAt) ? -Infinity : secondCreatedAt;
  return secondTime - firstTime;
}

function normalizeAssignedDate(dueDate, createdAt) {
  const explicitDate = dueDate ? new Date(dueDate) : null;
  if (explicitDate && !Number.isNaN(explicitDate.getTime())) {
    return explicitDate.toISOString();
  }

  const creationDate = new Date(createdAt);
  if (Number.isNaN(creationDate.getTime())) {
    return null;
  }

  creationDate.setHours(0, 0, 0, 0);
  return creationDate.toISOString();
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

function getCompletionTimestamp(todo, requestedAt) {
  const requestedDate = new Date(requestedAt);
  if (!isPausedTodo(todo)) {
    return requestedDate;
  }

  const lastSegmentEnd = normalizeTimeSegments(todo.timeSegments)
    .map((segment) => new Date(segment.endedAt))
    .filter((date) => !Number.isNaN(date.getTime()))
    .toSorted((first, second) => second - first)[0];
  return lastSegmentEnd && !Number.isNaN(lastSegmentEnd.getTime()) ? lastSegmentEnd : requestedDate;
}

function isPausedTodo(todo) {
  return Boolean(todo && !todo.completedAt && todo.firstStartedAt && !todo.activeStartedAt);
}

function normalizeTimeSegments(segments) {
  if (!Array.isArray(segments)) {
    return [];
  }

  return segments
    .map((segment) => {
      if (!segment?.startedAt || !segment?.endedAt) {
        return null;
      }

      const startedAt = new Date(segment?.startedAt);
      const endedAt = new Date(segment?.endedAt);
      if (Number.isNaN(startedAt.getTime()) || Number.isNaN(endedAt.getTime())) {
        return null;
      }

      return {
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
      };
    })
    .filter(Boolean);
}

function closeActiveTimeSegment(todo, stoppedAt) {
  const timeSegments = normalizeTimeSegments(todo.timeSegments);
  if (!todo.activeStartedAt) {
    return {
      trackedSeconds: normalizedTrackedSeconds(todo),
      timeSegments,
    };
  }

  const startedAt = new Date(todo.activeStartedAt);
  const endedAt = new Date(stoppedAt);
  if (Number.isNaN(startedAt.getTime()) || Number.isNaN(endedAt.getTime())) {
    return {
      trackedSeconds: normalizedTrackedSeconds(todo),
      timeSegments,
    };
  }

  const normalizedEnd = new Date(Math.max(startedAt.getTime(), endedAt.getTime()));
  const durationSeconds = getActiveSegmentSeconds(startedAt, normalizedEnd);

  return {
    trackedSeconds: normalizedTrackedSeconds(todo) + durationSeconds,
    timeSegments: [
      ...timeSegments,
      {
        startedAt: startedAt.toISOString(),
        endedAt: normalizedEnd.toISOString(),
      },
    ],
  };
}

function getActiveSegmentSeconds(startedAt, endedAt) {
  if (Number.isNaN(startedAt.getTime()) || Number.isNaN(endedAt.getTime())) {
    return 0;
  }

  const elapsed = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000);
  return Math.max(0, elapsed);
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

function normalizeTodo(todo) {
  return {
    ...todo,
    somedayAt: todo.somedayAt ?? null,
    dueDate: todo.dueDate ?? null,
    note: todo.note ?? '',
    source: todo.source ?? 'app',
    notionPageId: todo.notionPageId ?? null,
    notionDatabaseId: todo.notionDatabaseId ?? null,
    notionStatus: todo.notionStatus ?? null,
    firstStartedAt: todo.firstStartedAt ?? null,
    activeStartedAt: todo.activeStartedAt ?? null,
    trackedSeconds: normalizedTrackedSeconds(todo),
    timeSegments: normalizeTimeSegments(todo.timeSegments),
    isProgressive: Boolean(todo.isProgressive),
    parentTaskId: todo.parentTaskId ?? null,
    isProgressSession: Boolean(todo.isProgressSession),
    progressLabel: todo.progressLabel ?? '',
  };
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

function getSanFranciscoSunrise(dayKey) {
  const referenceDate = dateAtSanFranciscoTime(dayKey, 12 * 60);
  const sunrise = getTimes(referenceDate, SAN_FRANCISCO.latitude, SAN_FRANCISCO.longitude).sunrise;

  if (!Number.isNaN(sunrise.getTime())) {
    return new Date(Math.round(sunrise.getTime() / 60_000) * 60_000);
  }

  return dateAtSanFranciscoTime(dayKey, DEFAULT_SUNRISE_HOUR * 60);
}

function formatSummaryDayKey(date) {
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const parts = getSanFranciscoDateTimeParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function dateAtSanFranciscoTime(dayKey, minutesAfterMidnight) {
  const [year, month, day] = dayKey.split('-').map(Number);
  const hour = Math.floor(minutesAfterMidnight / 60);
  const minute = minutesAfterMidnight % 60;
  const desiredWallTime = Date.UTC(year, month - 1, day, hour, minute);
  let result = new Date(desiredWallTime);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = getSanFranciscoDateTimeParts(result);
    const renderedWallTime = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
    );
    result = new Date(result.getTime() + desiredWallTime - renderedWallTime);
  }

  return result;
}

function getSanFranciscoDateTimeParts(date) {
  return Object.fromEntries(
    SAN_FRANCISCO_DATE_TIME_FORMATTER.formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
}
