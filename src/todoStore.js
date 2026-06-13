const SUMMARY_BUCKETS = [
  { label: 'Morning', start: 5, end: 11 },
  { label: 'Lunch', start: 11, end: 14 },
  { label: 'Evening', start: 14, end: 21 },
  { label: 'Night', start: 21, end: 5 },
];

export function createInitialState(todos = []) {
  return { todos: todos.map(normalizeTodo) };
}

export function addTodo(state, title, createdAt = new Date()) {
  const cleanTitle = title.trim();

  if (!cleanTitle) {
    return state;
  }

  return {
    ...state,
    todos: [
      ...state.todos,
      {
        id: createTodoId(cleanTitle, createdAt),
        title: cleanTitle,
        createdAt: createdAt.toISOString(),
        completedAt: null,
        note: '',
        source: 'app',
        notionPageId: null,
        notionDatabaseId: null,
        notionStatus: null,
        firstStartedAt: null,
        activeStartedAt: null,
        trackedSeconds: 0,
        isProgressive: false,
        parentTaskId: null,
        isProgressSession: false,
        progressLabel: '',
      },
    ],
  };
}

export function completeTodo(state, todoId, completedAt = new Date()) {
  const doneAt = completedAt.toISOString();
  return {
    ...state,
    todos: state.todos.map((todo) =>
      todo.id === todoId
        ? {
            ...todo,
            completedAt: doneAt,
            activeStartedAt: null,
            trackedSeconds: getElapsedSeconds(todo, completedAt),
          }
        : todo,
    ),
  };
}

export function failTodo(state, todoId, failedAt = new Date()) {
  const doneAt = failedAt.toISOString();
  return {
    ...state,
    todos: state.todos.map((todo) =>
      todo.id === todoId
        ? {
            ...todo,
            completedAt: doneAt,
            activeStartedAt: null,
            trackedSeconds: getElapsedSeconds(todo, failedAt),
            notionStatus: 'Failed',
          }
        : todo,
    ),
  };
}

export function updateTodoCompletedAt(state, todoId, completedAt) {
  const doneAt = completedAt.toISOString();

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
  const start = new Date(startedAt);
  const end = new Date(completedAt);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return state;
  }

  const startTime = Math.min(start.getTime(), end.getTime());
  const endTime = Math.max(start.getTime(), end.getTime());
  const trackedSeconds = Math.floor((endTime - startTime) / 1000);

  return {
    ...state,
    todos: state.todos.map((todo) =>
      todo.id === todoId && todo.completedAt
        ? {
            ...todo,
            firstStartedAt: new Date(startTime).toISOString(),
            activeStartedAt: null,
            completedAt: new Date(endTime).toISOString(),
            trackedSeconds,
          }
        : todo,
    ),
  };
}

export function startTodoTimer(state, todoId, startedAt = new Date()) {
  const startedAtIso = startedAt.toISOString();

  return {
    ...state,
    todos: state.todos.map((todo) => {
      if (todo.completedAt) {
        return todo;
      }

      if (todo.id === todoId) {
        return {
          ...todo,
          firstStartedAt: todo.firstStartedAt ?? startedAtIso,
          activeStartedAt: startedAtIso,
          trackedSeconds: normalizedTrackedSeconds(todo),
        };
      }

      return todo.activeStartedAt
        ? {
            ...todo,
            activeStartedAt: null,
            trackedSeconds: getElapsedSeconds(todo, startedAt),
          }
        : todo;
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
            activeStartedAt: null,
            trackedSeconds: getElapsedSeconds(todo, pausedAt),
          }
        : todo,
    ),
  };
}

export function getPendingTodos(state) {
  return state.todos
    .filter((todo) => !todo.completedAt && !todo.isProgressSession)
    .toSorted((first, second) => new Date(first.createdAt) - new Date(second.createdAt));
}

export function getCompletedTodos(state) {
  return state.todos
    .filter((todo) => todo.completedAt)
    .toSorted((first, second) => new Date(first.completedAt) - new Date(second.completedAt));
}

export function getDaySummary(state, dayKey) {
  const sections = new Map(SUMMARY_BUCKETS.map((bucket) => [bucket.label, []]));

  for (const todo of getCompletedTodos(state)) {
    const completedDate = new Date(todo.completedAt);
    if (formatDayKey(completedDate) !== dayKey) {
      continue;
    }

    const label = getDayPartLabel(completedDate);
    sections.get(label).push({
      id: todo.id,
      title: todo.title,
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
  if (!cleanTitle) {
    return state;
  }

  return {
    ...state,
    todos: state.todos.map((todo) => (todo.id === todoId ? { ...todo, title: cleanTitle } : todo)),
  };
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
            progressLabel: progressLabel.trim(),
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

  const session = createProgressSession(parent, completedAt);

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

export function reorderCompletedTodosForDay(state, dayKey, orderedIds) {
  const completedForDay = getCompletedTodos(state).filter((todo) => formatDayKey(new Date(todo.completedAt)) === dayKey);
  if (completedForDay.length === 0) {
    return state;
  }

  const existingById = new Map(completedForDay.map((todo) => [todo.id, todo]));
  const orderedForDay = [
    ...orderedIds.map((id) => existingById.get(id)).filter(Boolean),
    ...completedForDay.filter((todo) => !orderedIds.includes(todo.id)),
  ];
  const firstCompletion = new Date(completedForDay[0].completedAt);
  const nextCompletedAtById = new Map(
    orderedForDay.map((todo, index) => [todo.id, new Date(firstCompletion.getTime() + index * 60_000).toISOString()]),
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

  if (!targetSection || !movingTodo || formatDayKey(new Date(movingTodo.completedAt)) !== dayKey) {
    return state;
  }

  const targetIds = targetSection.items.map((item) => item.id).filter((id) => id !== todoId);
  const targetIndex = targetId ? targetIds.indexOf(targetId) : -1;
  const orderedTargetIds =
    targetIndex === -1
      ? [...targetIds, todoId]
      : [...targetIds.slice(0, targetIndex), todoId, ...targetIds.slice(targetIndex)];
  const completedAtById = new Map(
    orderedTargetIds.map((id, index) => [id, completedAtForBucketPosition(dayKey, bucketLabel, index)]),
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
  return baseSeconds + Math.max(0, Math.min(elapsed, 24 * 60 * 60));
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
  const hour = date.getHours();
  return SUMMARY_BUCKETS.find((bucket) =>
    bucket.start < bucket.end
      ? hour >= bucket.start && hour < bucket.end
      : hour >= bucket.start || hour < bucket.end,
  )?.label ?? 'Night';
}

export function createTodoId(title, date) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 32);

  return `${date.getTime()}-${slug || 'todo'}`;
}

function normalizedTrackedSeconds(todo) {
  return Math.max(0, Math.floor(Number(todo.trackedSeconds ?? 0)));
}

function normalizeTodo(todo) {
  return {
    ...todo,
    note: todo.note ?? '',
    source: todo.source ?? 'app',
    notionPageId: todo.notionPageId ?? null,
    notionDatabaseId: todo.notionDatabaseId ?? null,
    notionStatus: todo.notionStatus ?? null,
    firstStartedAt: todo.firstStartedAt ?? null,
    activeStartedAt: todo.activeStartedAt ?? null,
    trackedSeconds: normalizedTrackedSeconds(todo),
    isProgressive: Boolean(todo.isProgressive),
    parentTaskId: todo.parentTaskId ?? null,
    isProgressSession: Boolean(todo.isProgressSession),
    progressLabel: todo.progressLabel ?? '',
  };
}

function createProgressSession(parent, completedAt) {
  const doneAt = completedAt.toISOString();
  const trackedSeconds = getElapsedSeconds(parent, completedAt);

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
      trackedSeconds,
    }),
  };
}

function createProgressSessionId(parentId, completedAt) {
  return `${completedAt.getTime()}-${parentId.slice(0, 24)}-session`;
}

function completedAtForBucketPosition(dayKey, bucketLabel, index) {
  const bucket = SUMMARY_BUCKETS.find((candidate) => candidate.label === bucketLabel);
  const date = new Date(`${dayKey}T00:00:00`);
  date.setHours(bucket.start, index, 0, 0);
  return date.toISOString();
}
