import { getTimes } from 'suncalc';
import {
  appendNoteText,
  applyTodoNote,
  closeNoteTimeBlock,
  formatNoteAtLocal,
  isEmptyNoteUnitText,
  parseNoteEntries,
} from './noteEntries.js';
import { SAN_FRANCISCO_TIME_ZONE, dateAtSanFranciscoTime, getSanFranciscoDateTimeParts } from './sanFranciscoTime.js';

export { applyTodoNote, dateAtSanFranciscoTime, formatNoteAtLocal, parseNoteEntries };

const SAN_FRANCISCO = { latitude: 37.774929, longitude: -122.419418 };
const DEFAULT_SUNRISE_HOUR = 6;
const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const SUMMARY_BUCKETS = [
  { label: 'Early morning', startAt: (dayKey) => dateAtSanFranciscoTime(dayKey, 0) },
  { label: 'Morning', startAt: getSanFranciscoSunrise },
  { label: 'Lunch', startAt: (dayKey) => dateAtSanFranciscoTime(dayKey, 11 * 60) },
  { label: 'Evening', startAt: (dayKey) => dateAtSanFranciscoTime(dayKey, 14 * 60) },
  { label: 'Night', startAt: (dayKey) => dateAtSanFranciscoTime(dayKey, 20 * 60) },
];

export function createInitialState(todos = []) {
  return { todos: todos.map(normalizeTodo) };
}

export const TODO_KINDS = ['task', 'project'];

export function parseTodoKind(value) {
  return value === 'project' ? 'project' : 'task';
}

export function addTodo(
  state,
  title,
  createdAt = new Date(),
  { dueDate = null, source = 'app', kind = 'task' } = {},
) {
  const cleanTitle = title.trim();

  if (!cleanTitle || findDuplicateTodo(state, cleanTitle)) {
    return state;
  }

  const todoKind = parseTodoKind(kind);
  const assignedDate = todoKind === 'project' ? null : normalizeAssignedDate(dueDate, createdAt);

  return {
    ...state,
    todos: [
      ...state.todos,
      {
        id: createTodoId(cleanTitle, createdAt),
        title: cleanTitle,
        createdAt: createdAt.toISOString(),
        completedAt: null,
        kind: todoKind,
        somedayAt: null,
        dueDate: assignedDate,
        note: '',
        source,
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
        photoUrl: null,
        photoKey: null,
      },
    ],
  };
}

export function findDuplicateTodo(state, title, { excludeTodoId = null } = {}) {
  const matches = findMatchingOpenTodos(state, title, { excludeTodoId });
  return matches[0] ?? null;
}

export function completeTodo(state, todoId, completedAt = new Date()) {
  const archived = archivePriorDaySessions(state, completedAt);

  return {
    ...archived,
    todos: archived.todos.map((todo) => {
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

export function applyTodoTimeSegmentEdits(state, todoId, timeSegments, now = new Date()) {
  const todo = state.todos.find((item) => item.id === todoId);
  if (!todo) {
    return state;
  }

  if (todo.isProgressSession) {
    return applyDirectSessionTimeSegmentEdits(state, todo, timeSegments);
  }

  const existingSessions = state.todos.filter(
    (item) => item.isProgressSession && item.parentTaskId === todoId,
  );
  if (existingSessions.length === 0) {
    return replaceTodoTimeSegments(state, todo, timeSegments);
  }

  const todayKey = formatSummaryDayKey(now);
  const homeDayKey = todo.completedAt
    ? formatSummaryDayKey(new Date(todo.completedAt))
    : todayKey;
  const existingSessionIds = new Set(existingSessions.map((session) => session.id));
  const parentSegments = [];
  const sessionSegmentsByDay = new Map();
  const sessionSegmentsById = new Map();

  for (const piece of timeSegments.flatMap(splitSegmentBySummaryDays)) {
    const segment = { startedAt: piece.startedAt, endedAt: piece.endedAt };
    if (piece.sessionId && existingSessionIds.has(piece.sessionId)) {
      const segmentsByDay = sessionSegmentsById.get(piece.sessionId) ?? new Map();
      const current = segmentsByDay.get(piece.dayKey) ?? [];
      current.push(segment);
      segmentsByDay.set(piece.dayKey, current);
      sessionSegmentsById.set(piece.sessionId, segmentsByDay);
      continue;
    }

    if (piece.dayKey === homeDayKey || piece.dayKey >= todayKey) {
      parentSegments.push(segment);
      continue;
    }

    const current = sessionSegmentsByDay.get(piece.dayKey) ?? [];
    current.push(segment);
    sessionSegmentsByDay.set(piece.dayKey, current);
  }

  parentSegments.sort((first, second) => new Date(first.startedAt) - new Date(second.startedAt));
  for (const pieces of sessionSegmentsByDay.values()) {
    pieces.sort((first, second) => new Date(first.startedAt) - new Date(second.startedAt));
  }

  const { nextSessions, removedSessionIds } = assignProgressSessionsToDays(
    todo,
    state.todos,
    sessionSegmentsByDay,
    sessionSegmentsById,
  );
  const updatedParent = withEditedTimeSegments(todo, parentSegments);
  const nextById = new Map([
    [updatedParent.id, updatedParent],
    ...nextSessions.map((session) => [session.id, session]),
  ]);
  const existingIds = new Set(state.todos.map((item) => item.id));

  return {
    ...state,
    todos: [
      ...state.todos
        .filter((item) => !removedSessionIds.has(item.id))
        .map((item) => nextById.get(item.id) ?? item),
      ...nextSessions.filter((session) => !existingIds.has(session.id)),
    ],
  };
}

function applyDirectSessionTimeSegmentEdits(state, session, timeSegments) {
  const sessionSegmentsByDay = new Map();
  for (const piece of timeSegments.flatMap(splitSegmentBySummaryDays)) {
    const current = sessionSegmentsByDay.get(piece.dayKey) ?? [];
    current.push({ startedAt: piece.startedAt, endedAt: piece.endedAt });
    sessionSegmentsByDay.set(piece.dayKey, current);
  }

  if (sessionSegmentsByDay.size === 0) {
    return state;
  }

  for (const pieces of sessionSegmentsByDay.values()) {
    pieces.sort((first, second) => new Date(first.startedAt) - new Date(second.startedAt));
  }

  const originalDayKey = session.completedAt
    ? formatSummaryDayKey(new Date(session.completedAt))
    : null;
  const primaryDayKey = sessionSegmentsByDay.has(originalDayKey)
    ? originalDayKey
    : [...sessionSegmentsByDay.keys()].toSorted()[0];
  const parent =
    state.todos.find((item) => item.id === session.parentTaskId) ?? session;
  const siblingDays = new Map(sessionSegmentsByDay);
  siblingDays.delete(primaryDayKey);

  let todos = state.todos.map((item) =>
    item.id === session.id
      ? replaceProgressSessionSegments(session, primaryDayKey, sessionSegmentsByDay.get(primaryDayKey))
      : item,
  );

  for (const [dayKey, segments] of siblingDays) {
    const existing = findProgressSessionForDay(todos, session.parentTaskId, dayKey);
    if (existing) {
      const merged = mergeTimeSegments(existing.timeSegments, segments);
      todos = todos.map((item) =>
        item.id === existing.id ? replaceProgressSessionSegments(existing, dayKey, merged) : item,
      );
      continue;
    }

    todos = [...todos, createDayProgressSession(parent, dayKey, segments)];
  }

  return { ...state, todos };
}

function assignProgressSessionsToDays(
  parent,
  existingTodos,
  sessionSegmentsByDay,
  sessionSegmentsById = new Map(),
) {
  const existingSessions = existingTodos.filter(
    (item) => item.isProgressSession && item.parentTaskId === parent.id,
  );
  const neededDays = [...sessionSegmentsByDay.keys()].toSorted();
  const nextSessions = [];
  const usedIds = new Set();
  const assignedUnownedDays = new Set();
  const claimedIds = new Set(existingTodos.map((item) => item.id));

  for (const [sessionId, segmentsByDay] of sessionSegmentsById) {
    const existing = existingSessions.find((session) => session.id === sessionId);
    if (!existing) {
      continue;
    }

    const days = [...segmentsByDay.keys()].toSorted();
    const originalDay = existing.completedAt
      ? formatSummaryDayKey(new Date(existing.completedAt))
      : null;
    const primaryDay = segmentsByDay.has(originalDay) ? originalDay : days[0];
    nextSessions.push(
      replaceProgressSessionSegments(existing, primaryDay, segmentsByDay.get(primaryDay)),
    );
    usedIds.add(existing.id);

    for (const dayKey of days.filter((day) => day !== primaryDay)) {
      const created = createUnclaimedProgressSession(
        parent,
        dayKey,
        segmentsByDay.get(dayKey),
        claimedIds,
      );
      nextSessions.push(created);
      claimedIds.add(created.id);
    }
  }

  for (const dayKey of neededDays) {
    const existing = existingSessions.find(
      (session) =>
        !usedIds.has(session.id) &&
        session.completedAt &&
        formatSummaryDayKey(new Date(session.completedAt)) === dayKey,
    );
    if (!existing) {
      continue;
    }

    nextSessions.push(
      replaceProgressSessionSegments(existing, dayKey, sessionSegmentsByDay.get(dayKey)),
    );
    usedIds.add(existing.id);
    assignedUnownedDays.add(dayKey);
  }

  const leftoverDays = neededDays.filter((dayKey) => !assignedUnownedDays.has(dayKey));
  const leftoverSessions = existingSessions.filter(
    (session) => recoverTodoTimeSegments(session).length > 0 && !usedIds.has(session.id),
  );

  leftoverDays.forEach((dayKey, index) => {
    const donor = leftoverSessions[index];
    const segments = sessionSegmentsByDay.get(dayKey);
    if (donor) {
      nextSessions.push(replaceProgressSessionSegments(donor, dayKey, segments));
      usedIds.add(donor.id);
      return;
    }

    const created = createUnclaimedProgressSession(parent, dayKey, segments, claimedIds);
    nextSessions.push(created);
    claimedIds.add(created.id);
  });

  const removedSessionIds = new Set(
    existingSessions
      .filter(
        (session) =>
          recoverTodoTimeSegments(session).length > 0 &&
          !nextSessions.some((item) => item.id === session.id),
      )
      .map((session) => session.id),
  );

  return { nextSessions, removedSessionIds };
}

function replaceTodoTimeSegments(state, parent, timeSegments) {
  return {
    ...state,
    todos: state.todos.map((todo) => (todo.id === parent.id ? withEditedTimeSegments(parent, timeSegments) : todo)),
  };
}

function withEditedTimeSegments(todo, timeSegments) {
  const firstStartedAt = timeSegments[0]?.startedAt ?? null;
  const latestEndedAt = timeSegments.reduce(
    (latest, segment) =>
      new Date(segment.endedAt) > new Date(latest) ? segment.endedAt : latest,
    timeSegments[0]?.endedAt ?? null,
  );
  const wasCompleted = Boolean(todo.completedAt);
  const wasRunning = Boolean(todo.activeStartedAt);

  return {
    ...todo,
    firstStartedAt,
    activeStartedAt: wasRunning && latestEndedAt ? latestEndedAt : null,
    completedAt: wasCompleted ? todo.completedAt : null,
    trackedSeconds: totalSegmentSeconds(timeSegments),
    timeSegments,
  };
}

function replaceProgressSessionSegments(session, dayKey, segments) {
  const firstStart = new Date(segments[0].startedAt);
  const lastEnd = new Date(segments.at(-1).endedAt);

  return normalizeTodo({
    ...session,
    createdAt: firstStart.toISOString(),
    completedAt: progressSessionEndedAt(dayKey, lastEnd).toISOString(),
    firstStartedAt: firstStart.toISOString(),
    activeStartedAt: null,
    trackedSeconds: totalSegmentSeconds(segments),
    timeSegments: segments,
  });
}

export function archivePriorDaySessions(state, now = new Date()) {
  const todayKey = formatSummaryDayKey(now);
  if (!todayKey) {
    return state;
  }

  const sessions = [];
  const updatedSessions = [];
  const todos = state.todos.map((todo) => {
    if (todo.completedAt || todo.isProgressSession || parseTodoKind(todo.kind) !== 'task') {
      return todo;
    }

    const archived = archiveOpenTodoPriorDays(todo, now, todayKey, state.todos);
    if (!archived) {
      return todo;
    }

    sessions.push(...archived.sessions);
    updatedSessions.push(...archived.updatedSessions);
    return archived.parent;
  });

  if (
    sessions.length === 0 &&
    updatedSessions.length === 0 &&
    todos.every((todo, index) => todo === state.todos[index])
  ) {
    return state;
  }

  const updatedById = new Map(updatedSessions.map((session) => [session.id, session]));

  return {
    ...state,
    todos: [...todos.map((todo) => updatedById.get(todo.id) ?? todo), ...sessions],
  };
}

export function getPendingTodos(state) {
  return state.todos
    .filter((todo) => parseTodoKind(todo.kind) === 'task' && !todo.completedAt && !todo.isProgressSession)
    .toSorted(compareTodosNewestFirst);
}

export function getProjectTodos(state) {
  return state.todos
    .filter(
      (todo) => parseTodoKind(todo.kind) === 'project' && !todo.completedAt && !todo.isProgressSession,
    )
    .toSorted(compareTodosNewestFirst);
}

export function getBoardColumnId(todo) {
  if (todo.completedAt) {
    return 'done';
  }

  if (todo.somedayAt) {
    return 'stall';
  }

  if (todo.activeStartedAt) {
    return 'in_progress';
  }

  if (todo.firstStartedAt) {
    return 'paused';
  }

  return 'not_started';
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
      notes: toNoteViews(todo),
      durationSeconds: normalizedTrackedSeconds(todo),
      durationLabel: formatDuration(normalizedTrackedSeconds(todo)),
      outcome: todo.notionStatus === 'Failed' ? 'failed' : 'done',
      parentTaskId: todo.parentTaskId ?? null,
      isProgressSession: Boolean(todo.isProgressSession),
      progressLabel: todo.progressLabel ?? '',
    });
  }

  return Array.from(sections, ([label, items]) => ({
    label,
    items: items.toSorted(compareSummaryItemsByEnd),
  }));
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

export function closeActiveTimeSegment(todo, stoppedAt) {
  const timeSegments = normalizeTimeSegments(todo.timeSegments);
  if (!todo.activeStartedAt) {
    return {
      trackedSeconds: normalizedTrackedSeconds(todo),
      timeSegments,
      note: todo.note ?? '',
    };
  }

  const startedAt = new Date(todo.activeStartedAt);
  const endedAt = new Date(stoppedAt);
  if (Number.isNaN(startedAt.getTime()) || Number.isNaN(endedAt.getTime())) {
    return {
      trackedSeconds: normalizedTrackedSeconds(todo),
      timeSegments,
      note: todo.note ?? '',
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
    note: closeNoteTimeBlock(todo.note ?? '', normalizedEnd),
  };
}

export function getCompletionTimestamp(todo, requestedAt) {
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

export function normalizeTimeSegments(segments) {
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

export function normalizedTrackedSeconds(todo) {
  return Math.max(0, Math.floor(Number(todo.trackedSeconds ?? 0)));
}

export function recoverTodoTimeSegments(todo) {
  const recorded = normalizeTimeSegments(todo?.timeSegments);
  const missingSeconds = Math.max(0, normalizedTrackedSeconds(todo) - totalSegmentSeconds(recorded));
  if (missingSeconds > 0) {
    const syntheticEnd = new Date(recorded[0]?.startedAt ?? todo?.completedAt);
    if (!Number.isNaN(syntheticEnd.getTime())) {
      recorded.unshift({
        startedAt: new Date(syntheticEnd.getTime() - missingSeconds * 1000).toISOString(),
        endedAt: syntheticEnd.toISOString(),
      });
    }
  }

  if (recorded.length > 0) {
    return recorded;
  }

  const startedAt = new Date(todo?.firstStartedAt);
  const endedAt = new Date(todo?.completedAt);
  if (
    !Number.isNaN(startedAt.getTime()) &&
    !Number.isNaN(endedAt.getTime()) &&
    startedAt < endedAt
  ) {
    return [{ startedAt: startedAt.toISOString(), endedAt: endedAt.toISOString() }];
  }

  return [];
}

export function getActiveSegmentSeconds(startedAt, endedAt) {
  if (Number.isNaN(startedAt.getTime()) || Number.isNaN(endedAt.getTime())) {
    return 0;
  }

  const elapsed = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000);
  return Math.max(0, elapsed);
}

export function compareTodosNewestFirst(first, second) {
  const firstCreatedAt = new Date(first.createdAt).getTime();
  const secondCreatedAt = new Date(second.createdAt).getTime();
  const firstTime = Number.isNaN(firstCreatedAt) ? -Infinity : firstCreatedAt;
  const secondTime = Number.isNaN(secondCreatedAt) ? -Infinity : secondCreatedAt;
  return secondTime - firstTime;
}

export function normalizeTodo(todo) {
  const kind = parseTodoKind(todo.kind);

  return {
    ...todo,
    kind,
    somedayAt: kind === 'project' ? null : todo.somedayAt ?? null,
    dueDate: kind === 'project' ? null : todo.dueDate ?? null,
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
    photoUrl: todo.photoUrl ?? null,
    photoKey: todo.photoKey ?? null,
  };
}

export function formatSummaryDayKey(date) {
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const parts = getSanFranciscoDateTimeParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function toRemoteRecord(todo, userId) {
  return {
    id: todo.id,
    user_id: userId,
    title: todo.title,
    created_at: todo.createdAt,
    completed_at: todo.completedAt,
    kind: parseTodoKind(todo.kind),
    someday_at: todo.somedayAt ?? null,
    due_date: todo.dueDate ?? null,
    note: todo.note ?? '',
    source: todo.source ?? 'app',
    notion_page_id: todo.notionPageId ?? null,
    notion_database_id: todo.notionDatabaseId ?? null,
    notion_status: todo.notionStatus ?? null,
    first_started_at: todo.firstStartedAt ?? null,
    active_started_at: todo.activeStartedAt ?? null,
    tracked_seconds: normalizedTrackedSeconds(todo),
    time_segments: normalizeTimeSegments(todo.timeSegments),
    is_progressive: Boolean(todo.isProgressive),
    parent_task_id: todo.parentTaskId ?? null,
    is_progress_session: Boolean(todo.isProgressSession),
    progress_label: todo.progressLabel ?? '',
    photo_url: todo.photoUrl ?? null,
    photo_key: todo.photoKey ?? null,
  };
}

export function fromRemoteRecord(record) {
  return {
    id: record.id,
    title: record.title,
    createdAt: record.created_at,
    completedAt: record.completed_at,
    kind: parseTodoKind(record.kind),
    somedayAt: record.someday_at ?? null,
    dueDate: record.due_date ?? null,
    note: record.note ?? '',
    source: record.source ?? 'app',
    notionPageId: record.notion_page_id ?? null,
    notionDatabaseId: record.notion_database_id ?? null,
    notionStatus: record.notion_status ?? null,
    firstStartedAt: record.first_started_at ?? null,
    activeStartedAt: record.active_started_at ?? null,
    trackedSeconds: Math.max(0, Math.floor(Number(record.tracked_seconds ?? 0))),
    timeSegments: normalizeTimeSegments(record.time_segments),
    isProgressive: Boolean(record.is_progressive),
    parentTaskId: record.parent_task_id ?? null,
    isProgressSession: Boolean(record.is_progress_session),
    progressLabel: record.progress_label ?? '',
    photoUrl: record.photo_url ?? null,
    photoKey: record.photo_key ?? null,
    updatedAt: record.updated_at ?? null,
  };
}

export function toRemoteCompletionFields(todo) {
  return {
    completed_at: todo.completedAt,
    someday_at: todo.somedayAt ?? null,
    notion_status: todo.notionStatus ?? null,
    first_started_at: todo.firstStartedAt ?? null,
    active_started_at: todo.activeStartedAt ?? null,
    tracked_seconds: normalizedTrackedSeconds(todo),
    time_segments: normalizeTimeSegments(todo.timeSegments),
  };
}

// Bump this when AGENT_COMMANDS changes so callers can refresh with describe.
export const AGENT_API_VERSION = 2;

export const AGENT_COMMANDS = [
  {
    command: 'describe',
    summary: 'Current command list and apiVersion.',
    bodies: [{ command: 'describe' }],
  },
  {
    command: 'list',
    summary: 'Open tasks with now, nowLocal, and notes[] (at, atLocal, text).',
    bodies: [{ command: 'list' }],
  },
  {
    command: 'create',
    summary: 'Create a task. A duplicate open title returns the existing task.',
    bodies: [{ command: 'create', title: '...' }],
  },
  {
    command: 'complete',
    summary: 'Complete by id or title, not both.',
    bodies: [
      { command: 'complete', id: '...' },
      { command: 'complete', title: '...' },
    ],
  },
  {
    command: 'appendNote',
    summary: 'Append a note. Each list item is its own dated note.',
    bodies: [
      { command: 'appendNote', id: '...', text: '...' },
      { command: 'appendNote', title: '...', text: '...' },
    ],
  },
  {
    command: 'daySummary',
    summary: 'Completed work for a day (default today).',
    bodies: [
      { command: 'daySummary' },
      { command: 'daySummary', day: 'YYYY-MM-DD' },
    ],
  },
];

export function describeCatalog() {
  return {
    kind: 'describe',
    apiVersion: AGENT_API_VERSION,
    timeZone: SAN_FRANCISCO_TIME_ZONE,
    commands: AGENT_COMMANDS,
  };
}

export function commandNeedsTodos(command) {
  return command?.kind !== 'describe';
}

export function parseTodoCommand(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return invalidCommand('Expected a JSON object');
  }

  switch (body.command) {
    case 'describe':
      return { ok: true, command: { kind: 'describe' } };
    case 'list':
      return { ok: true, command: { kind: 'list' } };
    case 'create':
      if (typeof body.title !== 'string') {
        return invalidCommand('create requires a title string');
      }
      return { ok: true, command: { kind: 'create', title: body.title } };
    case 'complete':
      return parseCompleteCommand(body);
    case 'appendNote':
      return parseAppendNoteCommand(body);
    case 'daySummary':
      return parseDaySummaryCommand(body);
    default:
      return unknownCommandResult();
  }
}

export function runTodoCommand(state, command, now) {
  return withApiVersion(runTodoCommandBody(state, command, now));
}

function runTodoCommandBody(state, command, now) {
  switch (command.kind) {
    case 'describe':
      return runDescribeCommand();
    case 'list':
      return runListCommand(state, now);
    case 'create':
      return runCreateCommand(state, command.title, now);
    case 'complete':
      return runCompleteCommand(state, command.target, now);
    case 'appendNote':
      return runAppendNoteCommand(state, command.target, command.text, now);
    case 'daySummary':
      return runDaySummaryCommand(state, command.day, now);
    default:
      return unknownCommandResult();
  }
}

function parseAppendNoteCommand(body) {
  if (typeof body.text !== 'string' || !body.text.trim()) {
    return invalidCommand('appendNote requires a text string');
  }

  const target = parseTaskTarget(body, 'appendNote');
  if (!target.ok) {
    return target;
  }

  return {
    ok: true,
    command: { kind: 'appendNote', target: target.target, text: body.text.trim() },
  };
}

function parseCompleteCommand(body) {
  const target = parseTaskTarget(body, 'complete');
  if (!target.ok) {
    return target;
  }

  return { ok: true, command: { kind: 'complete', target: target.target } };
}

function parseTaskTarget(body, commandName) {
  const hasId = typeof body.id === 'string' && body.id.length > 0;
  const hasTitle = typeof body.title === 'string' && body.title.length > 0;
  if (hasId === hasTitle) {
    return invalidCommand(`${commandName} requires id or title, not both`);
  }

  if (hasId) {
    return { ok: true, target: { by: 'id', id: body.id } };
  }

  return { ok: true, target: { by: 'title', title: body.title } };
}

function parseDaySummaryCommand(body) {
  if (body.day === undefined || body.day === null || body.day === '') {
    return { ok: true, command: { kind: 'daySummary' } };
  }

  if (typeof body.day !== 'string' || !DAY_KEY_PATTERN.test(body.day)) {
    return invalidCommand('day must be YYYY-MM-DD');
  }

  return { ok: true, command: { kind: 'daySummary', day: body.day } };
}

function runDescribeCommand() {
  return {
    ok: true,
    view: describeCatalog(),
    persist: { kind: 'none' },
  };
}

function runListCommand(state, now) {
  return {
    ok: true,
    view: {
      kind: 'list',
      now: now.toISOString(),
      nowLocal: formatNoteAtLocal(now),
      tasks: getPendingTodos(state).map(toOpenTaskView),
    },
    persist: { kind: 'none' },
  };
}

function runCreateCommand(state, title, now) {
  const cleanTitle = title.trim();
  if (!cleanTitle) {
    return { ok: false, error: { code: 'empty_title', message: 'Title is required' } };
  }

  const duplicate = findDuplicateTodo(state, cleanTitle);
  if (duplicate) {
    return {
      ok: true,
      view: { kind: 'create', created: false, task: toOpenTaskView(duplicate) },
      persist: { kind: 'none' },
    };
  }

  const dueDate = agentDueDateFromCreatedAt(now);
  const next = addTodo(state, cleanTitle, now, { dueDate, source: 'agent' });
  const todo = next.todos.at(-1);

  return {
    ok: true,
    view: { kind: 'create', created: true, task: toOpenTaskView(todo) },
    persist: { kind: 'insert', todo },
  };
}

function runCompleteCommand(state, target, now) {
  const resolved = resolveCompleteTarget(state, target);
  if (!resolved.ok) {
    return resolved;
  }

  const todo = resolved.todo;
  if (todo.completedAt) {
    return {
      ok: true,
      view: { kind: 'complete', task: toCompletedTaskView(todo) },
      persist: { kind: 'none' },
    };
  }

  // completeTodo archives every open task's prior-day work, so persist all of
  // it: new session rows plus any other row whose timing changed.
  const next = completeTodo(state, todo.id, now);
  const beforeById = new Map(state.todos.map((item) => [item.id, item]));
  const updated = next.todos.find((item) => item.id === todo.id);
  const sessions = next.todos.filter((item) => !beforeById.has(item.id));
  const updates = next.todos.filter((item) => {
    const before = beforeById.get(item.id);
    return Boolean(before && item.id !== todo.id && todoTimingChanged(before, item));
  });

  return {
    ok: true,
    view: { kind: 'complete', task: toCompletedTaskView(updated) },
    persist: { kind: 'update', todo: updated, sessions, updates },
  };
}

function runAppendNoteCommand(state, target, text, now) {
  const resolved = resolveCompleteTarget(state, target);
  if (!resolved.ok) {
    return resolved;
  }

  const todo = resolved.todo;
  const updated = {
    ...todo,
    note: appendNoteText(todo.note ?? '', text, now),
  };

  return {
    ok: true,
    view: { kind: 'appendNote', task: toOpenTaskView(updated) },
    persist: { kind: 'update', todo: updated },
  };
}

function runDaySummaryCommand(state, day, now) {
  const dayKey = day ?? formatSummaryDayKey(now);
  return {
    ok: true,
    view: {
      kind: 'daySummary',
      day: dayKey,
      sections: getDaySummary(state, dayKey),
    },
    persist: { kind: 'none' },
  };
}

function resolveCompleteTarget(state, target) {
  switch (target.by) {
    case 'id': {
      const todo = state.todos.find((item) => item.id === target.id);
      if (!todo) {
        return { ok: false, error: { code: 'not_found', message: 'Task not found' } };
      }
      return { ok: true, todo };
    }
    case 'title': {
      const matches = findMatchingOpenTodos(state, target.title);
      if (matches.length === 0) {
        return { ok: false, error: { code: 'not_found', message: 'Task not found' } };
      }
      if (matches.length > 1) {
        return {
          ok: false,
          error: { code: 'ambiguous_title', message: 'Multiple open tasks match that title' },
        };
      }
      return { ok: true, todo: matches[0] };
    }
    default:
      return { ok: false, error: { code: 'invalid', message: 'Invalid complete target' } };
  }
}

function findMatchingOpenTodos(state, title, { excludeTodoId = null } = {}) {
  const candidateTitle = normalizeTaskTitle(title);
  if (!candidateTitle) {
    return [];
  }

  return state.todos.filter((todo) => {
    if (todo.id === excludeTodoId || todo.completedAt || todo.isProgressSession) {
      return false;
    }

    return taskTitlesMatch(candidateTitle, normalizeTaskTitle(todo.title));
  });
}

function toOpenTaskView(todo) {
  const status = getBoardColumnId(todo);
  return {
    id: todo.id,
    title: todo.title,
    dueDate: todo.dueDate ?? null,
    createdAt: todo.createdAt,
    source: todo.source ?? 'app',
    status: status === 'done' ? 'not_started' : status,
    completable: true,
    note: todo.note ?? '',
    notes: toNoteViews(todo),
  };
}

function toCompletedTaskView(todo) {
  const durationSeconds = normalizedTrackedSeconds(todo);
  return {
    id: todo.id,
    title: todo.title,
    completedAt: todo.completedAt,
    durationSeconds,
    durationLabel: formatDuration(durationSeconds),
  };
}

function agentDueDateFromCreatedAt(createdAt) {
  const createdDate = new Date(createdAt);
  const dayKey = formatSummaryDayKey(createdDate);
  return dateAtSanFranciscoTime(dayKey, 0).toISOString();
}

function invalidCommand(message) {
  return { ok: false, error: { code: 'invalid', message } };
}

function unknownCommandResult() {
  return {
    ok: false,
    error: {
      code: 'unknown_command',
      message: 'Unknown command. Call describe for the current list.',
    },
    catalog: describeCatalog(),
  };
}

function withApiVersion(result) {
  if (!result.ok) {
    return result;
  }

  return {
    ...result,
    view: { ...result.view, apiVersion: AGENT_API_VERSION },
  };
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

function isPausedTodo(todo) {
  return Boolean(todo && !todo.completedAt && todo.firstStartedAt && !todo.activeStartedAt);
}

function archiveOpenTodoPriorDays(todo, now, todayKey, existingTodos) {
  const closedSegments = normalizeTimeSegments(todo.timeSegments);
  const closedPieces = closedSegments.flatMap(splitSegmentBySummaryDays);
  const livePieces = todo.activeStartedAt
    ? splitSegmentBySummaryDays({
        startedAt: todo.activeStartedAt,
        endedAt: now.toISOString(),
      })
    : [];
  const priorClosed = [...closedPieces, ...livePieces].filter((piece) => piece.dayKey < todayKey);
  if (priorClosed.length === 0) {
    return null;
  }

  const sessionsByDay = new Map();
  for (const piece of priorClosed) {
    const current = sessionsByDay.get(piece.dayKey) ?? [];
    current.push({ startedAt: piece.startedAt, endedAt: piece.endedAt });
    sessionsByDay.set(piece.dayKey, current);
  }

  const sessions = [];
  const updatedSessions = [];
  for (const [dayKey, segments] of [...sessionsByDay.entries()].toSorted(([firstDay], [secondDay]) =>
    firstDay.localeCompare(secondDay),
  )) {
    const existing = findProgressSessionForDay(existingTodos, todo.id, dayKey);
    if (existing) {
      const mergedSegments = mergeTimeSegments(existing.timeSegments, segments);
      const updated = rebuildProgressSession(existing, dayKey, mergedSegments);
      if (todoTimingChanged(existing, updated)) {
        updatedSessions.push(updated);
      }
      continue;
    }

    sessions.push(createDayProgressSession(todo, dayKey, segments));
  }

  const remainingClosed = closedPieces
    .filter((piece) => piece.dayKey >= todayKey)
    .map((piece) => ({ startedAt: piece.startedAt, endedAt: piece.endedAt }));
  const liveRemainderStart = liveRemainderStartedAt(todo, now, todayKey);
  // Like closeActiveTimeSegment, trackedSeconds covers closed segments only;
  // the live remainder is counted from activeStartedAt until it is closed.
  const trackedSeconds =
    totalSegmentSeconds(remainingClosed) + unsegmentedTrackedSeconds(todo, closedSegments);
  const firstStartedAt = remainingClosed[0]?.startedAt ?? liveRemainderStart?.toISOString() ?? null;

  return {
    parent: {
      ...todo,
      firstStartedAt,
      activeStartedAt: liveRemainderStart ? liveRemainderStart.toISOString() : null,
      trackedSeconds,
      timeSegments: remainingClosed,
    },
    sessions,
    updatedSessions,
  };
}

function liveRemainderStartedAt(todo, now, todayKey) {
  if (!todo.activeStartedAt) {
    return null;
  }

  const liveStart = new Date(todo.activeStartedAt);
  if (Number.isNaN(liveStart.getTime())) {
    return null;
  }

  // A timer started before today keeps running from today's midnight (which
  // may equal now when the day rollover fires); anything else runs untouched.
  const liveDayKey = formatSummaryDayKey(liveStart);
  return liveDayKey < todayKey ? dateAtSanFranciscoTime(todayKey, 0) : liveStart;
}

function splitSegmentBySummaryDays(segment) {
  const start = new Date(segment.startedAt);
  const end = new Date(segment.endedAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
    return [];
  }

  const pieces = [];
  let cursor = start;
  while (cursor < end) {
    const dayKey = formatSummaryDayKey(cursor);
    const nextDayStart = dateAtSanFranciscoTime(nextSummaryDayKey(dayKey), 0);
    const pieceEnd = nextDayStart < end ? nextDayStart : end;
    if (getActiveSegmentSeconds(cursor, pieceEnd) > 0) {
      pieces.push({
        dayKey,
        startedAt: cursor.toISOString(),
        endedAt: pieceEnd.toISOString(),
        ...(segment.sessionId ? { sessionId: segment.sessionId } : {}),
      });
    }
    cursor = pieceEnd;
  }

  return pieces;
}

function nextSummaryDayKey(dayKey) {
  const [year, month, day] = dayKey.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
}

// A piece that runs up to midnight ends at the first instant of the next day,
// so the session's completedAt is pulled back inside its own day: the recap
// and findProgressSessionForDay both key sessions by the completedAt day.
function progressSessionEndedAt(dayKey, lastEnd) {
  if (formatSummaryDayKey(lastEnd) === dayKey) {
    return lastEnd;
  }

  return new Date(dateAtSanFranciscoTime(nextSummaryDayKey(dayKey), 0).getTime() - 1);
}

function createDayProgressSession(parent, dayKey, segments) {
  const firstStart = new Date(segments[0].startedAt);
  const endedAt = progressSessionEndedAt(dayKey, new Date(segments.at(-1).endedAt));

  return normalizeTodo({
    id: createProgressSessionId(parent.id, endedAt),
    title: parent.title,
    createdAt: firstStart.toISOString(),
    completedAt: endedAt.toISOString(),
    note: '',
    source: 'progress-session',
    parentTaskId: parent.id,
    isProgressSession: true,
    progressLabel: '',
    firstStartedAt: firstStart.toISOString(),
    activeStartedAt: null,
    trackedSeconds: totalSegmentSeconds(segments),
    timeSegments: segments,
  });
}

function createUnclaimedProgressSession(parent, dayKey, segments, claimedIds) {
  const session = createDayProgressSession(parent, dayKey, segments);
  if (!claimedIds.has(session.id)) {
    return session;
  }

  const startedAt = new Date(segments[0].startedAt).getTime();
  let attempt = 1;
  let id;
  do {
    id = `${session.id}-${startedAt}-${attempt}`;
    attempt += 1;
  } while (claimedIds.has(id));

  return { ...session, id };
}

function findProgressSessionForDay(existingTodos, parentId, dayKey) {
  return (
    existingTodos.find((item) => {
      if (!item.isProgressSession || item.parentTaskId !== parentId || !item.completedAt) {
        return false;
      }

      return formatSummaryDayKey(new Date(item.completedAt)) === dayKey;
    }) ?? null
  );
}

function rebuildProgressSession(session, dayKey, segments) {
  const firstStart = new Date(segments[0].startedAt);
  const lastEnd = new Date(
    Math.max(new Date(segments.at(-1).endedAt).getTime(), new Date(session.completedAt).getTime()),
  );

  return normalizeTodo({
    ...session,
    completedAt: progressSessionEndedAt(dayKey, lastEnd).toISOString(),
    firstStartedAt: firstStart.toISOString(),
    activeStartedAt: null,
    trackedSeconds:
      totalSegmentSeconds(segments) +
      unsegmentedTrackedSeconds(session, normalizeTimeSegments(session.timeSegments)),
    timeSegments: segments,
  });
}

// Time tracked before time_segments existed (no backfill) is not covered by
// any segment; keep it when trackedSeconds is rebuilt from segments.
function unsegmentedTrackedSeconds(todo, segments) {
  return Math.max(0, normalizedTrackedSeconds(todo) - totalSegmentSeconds(segments));
}

function todoTimingChanged(before, after) {
  return (
    before.completedAt !== after.completedAt ||
    before.trackedSeconds !== after.trackedSeconds ||
    before.firstStartedAt !== after.firstStartedAt ||
    before.activeStartedAt !== after.activeStartedAt ||
    JSON.stringify(normalizeTimeSegments(before.timeSegments)) !==
      JSON.stringify(normalizeTimeSegments(after.timeSegments))
  );
}

function mergeTimeSegments(first, second) {
  const merged = [];

  for (const segment of [...normalizeTimeSegments(first), ...normalizeTimeSegments(second)].toSorted(
    (left, right) => new Date(left.startedAt) - new Date(right.startedAt),
  )) {
    const last = merged.at(-1);
    if (last && new Date(segment.startedAt) <= new Date(last.endedAt)) {
      if (new Date(segment.endedAt) > new Date(last.endedAt)) {
        last.endedAt = segment.endedAt;
      }
      continue;
    }

    merged.push({ startedAt: segment.startedAt, endedAt: segment.endedAt });
  }

  return merged;
}

function createProgressSessionId(parentId, completedAt) {
  return `${completedAt.getTime()}-${parentId.slice(0, 24)}-session`;
}

export function totalSegmentSeconds(segments) {
  return segments.reduce(
    (total, segment) =>
      total + getActiveSegmentSeconds(new Date(segment.startedAt), new Date(segment.endedAt)),
    0,
  );
}

function compareSummaryItemsByEnd(first, second) {
  const firstEnd = validTimestamp(first.completedAt);
  const secondEnd = validTimestamp(second.completedAt);

  if (firstEnd === null && secondEnd === null) return 0;
  if (firstEnd === null) return 1;
  if (secondEnd === null) return -1;
  return firstEnd - secondEnd;
}

function validTimestamp(value) {
  const timestamp = value ? new Date(value).getTime() : Number.NaN;
  return Number.isNaN(timestamp) ? null : timestamp;
}

function getSanFranciscoSunrise(dayKey) {
  const referenceDate = dateAtSanFranciscoTime(dayKey, 12 * 60);
  const sunrise = getTimes(referenceDate, SAN_FRANCISCO.latitude, SAN_FRANCISCO.longitude).sunrise;

  if (!Number.isNaN(sunrise.getTime())) {
    return new Date(Math.round(sunrise.getTime() / 60_000) * 60_000);
  }

  return dateAtSanFranciscoTime(dayKey, DEFAULT_SUNRISE_HOUR * 60);
}

function toNoteViews(todo) {
  return parseNoteEntries(todo.note ?? '')
    .filter((entry) => !isEmptyNoteUnitText(entry.text))
    .map((entry) => {
      const at = entry.at ?? todo.updatedAt ?? todo.createdAt ?? null;
      return {
        at,
        atLocal: at ? formatNoteAtLocal(at) : null,
        text: entry.text,
      };
    });
}
