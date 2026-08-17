import { createAdminClient, createClient } from 'npm:@insforge/sdk';

import { getTimes } from 'npm:suncalc';

// Shared America/Los_Angeles time helpers used by both todoCommands.js and
// noteEntries.js. Split out so notes can format/parse local stamps without a
// circular import back into todoCommands.js.
const SAN_FRANCISCO_TIME_ZONE = 'America/Los_Angeles';

const SAN_FRANCISCO_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-US-u-nu-latn', {
  timeZone: SAN_FRANCISCO_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function getSanFranciscoDateTimeParts(date) {
  return Object.fromEntries(
    SAN_FRANCISCO_DATE_TIME_FORMATTER.formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
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

// Notes are stored as timer session blocks:
//   Start: YYYY-MM-DD HH:mm
//   - bullet
//   End: YYYY-MM-DD HH:mm
// Legacy "@ YYYY-MM-DD HH:mm" headers still parse. Editor drafts strip both
// kinds of headings; identity matching keeps bullets in their original block
// when the user reorders or edits them.

const LOCAL_TIME_PATTERN = '(\\d{4}-\\d{2}-\\d{2}) (\\d{2}):(\\d{2})';
const NOTE_STAMP_PATTERN = new RegExp(`^@ ${LOCAL_TIME_PATTERN}\\s*import { createAdminClient, createClient } from 'npm:@insforge/sdk';

);
const START_HEADING_PATTERN = new RegExp(`^Start:\\s+${LOCAL_TIME_PATTERN}\\s*import { createAdminClient, createClient } from 'npm:@insforge/sdk';

);
const END_HEADING_PATTERN = new RegExp(`^End:\\s+${LOCAL_TIME_PATTERN}\\s*import { createAdminClient, createClient } from 'npm:@insforge/sdk';

);
const LIST_MARKER_PATTERN = /^(?:[-*+]|\d+[.)])(?:[\t ]+([\s\S]*))?$/;
const CHECKBOX_PATTERN = /^\[[ xX]\](?:[\t ]+([\s\S]*))?$/;
const SIMILARITY_THRESHOLD = 0.5;
const TOKEN_MATCH_RATIO = 0.75;
const NEW_BLOCK_INDEX = -1;

function formatNoteAtLocal(date) {
  const parts = getSanFranciscoDateTimeParts(new Date(date));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

function parseNoteEntries(note) {
  return flattenNoteTimeBlocks(parseNoteTimeBlocks(note)).map((entry) => ({
    at: entry.at,
    text: entry.text,
  }));
}

function parseNoteTimeBlocks(note) {
  // Trim trailing newlines only, not all trailing whitespace: a note that
  // ends in an empty structural line ("- ") must keep that line's trailing
  // space intact, or the reseeded editor draft would no longer match what
  // the user actually typed.
  const raw = String(note ?? '').replace(/\n+$/, '');
  if (!raw) {
    return [];
  }

  const blocks = [];
  let current = null;

  function startBlock(startedAt, kind) {
    if (current) {
      blocks.push(current);
    }
    current = { startedAt, endedAt: null, kind, lines: [] };
  }

  for (const line of raw.split('\n')) {
    const startAt = matchLocalHeading(line, START_HEADING_PATTERN);
    if (startAt) {
      startBlock(startAt, 'session');
      continue;
    }

    const stampAt = matchLocalHeading(line, NOTE_STAMP_PATTERN);
    if (stampAt) {
      startBlock(stampAt, 'stamp');
      continue;
    }

    const endAt = matchLocalHeading(line, END_HEADING_PATTERN);
    if (endAt) {
      if (!current) {
        current = { startedAt: endAt, endedAt: endAt, kind: 'session', lines: [] };
      } else {
        current.endedAt = endAt;
        current.kind = 'session';
      }
      blocks.push(current);
      current = null;
      continue;
    }

    if (!current) {
      current = { startedAt: null, endedAt: null, kind: 'plain', lines: [] };
    }
    current.lines.push(line);
  }

  if (current) {
    blocks.push(current);
  }

  return blocks;
}

function openNoteTimeBlock(note, startedAt) {
  const startedAtIso = new Date(startedAt).toISOString();
  const blocks = parseNoteTimeBlocks(note);
  const last = blocks.at(-1);
  if (last && !last.endedAt) {
    if (!last.startedAt) {
      last.startedAt = startedAtIso;
      last.kind = 'session';
    }
    return serializeNoteTimeBlocks(blocks);
  }

  blocks.push({ startedAt: startedAtIso, endedAt: null, kind: 'session', lines: [] });
  return serializeNoteTimeBlocks(blocks);
}

function closeNoteTimeBlock(note, endedAt) {
  const endedAtIso = new Date(endedAt).toISOString();
  const blocks = parseNoteTimeBlocks(note);
  const last = blocks.at(-1);
  if (!last || last.endedAt) {
    return serializeNoteTimeBlocks(blocks);
  }

  if (!last.startedAt) {
    last.startedAt = endedAtIso;
  }
  last.endedAt = endedAtIso;
  last.kind = 'session';
  return serializeNoteTimeBlocks(blocks);
}

function serializeNoteTimeBlocks(blocks) {
  return blocks
    .map((block) => {
      const parts = [];
      if (block.startedAt) {
        parts.push(`Start: ${formatNoteAtLocal(block.startedAt)}`);
      }
      for (const line of block.lines) {
        if (line.trim() || line.endsWith(' ')) {
          parts.push(line);
        }
      }
      if (block.endedAt) {
        parts.push(`End: ${formatNoteAtLocal(block.endedAt)}`);
      }
      return parts.join('\n');
    })
    .filter(Boolean)
    .join('\n');
}

// True for a unit with no visible content once its marker/checkbox is
// stripped ("- ", "-", "- [ ]"). These are real structural units - kept in
// parseNoteEntries's output and in storage - but they are never stamped and
// must stay invisible to anything that only wants real note content.
function isEmptyNoteUnitText(text) {
  return normalizeUnitText(text) === '';
}

// nextNote is normally plain editor text (no "@ " headers), but existing
// callers build it by appending fresh text onto the previous stored note, so
// units that already carry a header from parsing pass through unchanged;
// only unstamped units go through identity matching against previousNote.
function applyTodoNote(previousNote, nextNote, now = new Date()) {
  const previousBlocks = parseNoteTimeBlocks(previousNote);
  const nextEntries = flattenNoteTimeBlocks(parseNoteTimeBlocks(nextNote));
  if (nextEntries.length === 0) {
    if (previousBlocks.some((block) => block.startedAt && !block.endedAt && block.lines.length === 0)) {
      return serializeNoteTimeBlocks(previousBlocks);
    }
    return '';
  }

  const previousUnits = flattenNoteTimeBlocks(previousBlocks).map((entry, index) => ({
    entry,
    index,
    normalized: normalizeUnitText(entry.text),
    used: false,
  }));
  // Empty units are never eligible to be matched against - they must not
  // claim or receive a stamp, so they are marked used up front and every
  // pass below simply skips them like any other already-spoken-for unit.
  for (const unit of previousUnits) {
    if (!unit.normalized) {
      unit.used = true;
    }
  }

  const resolved = new Array(nextEntries.length).fill(null);
  const pending = [];
  nextEntries.forEach((entry, index) => {
    if (entry.at) {
      resolved[index] = entry;
      return;
    }
    const normalized = normalizeUnitText(entry.text);
    if (!normalized) {
      // Marker-only unit ("- "): stays a bare unstamped line, never matched.
      resolved[index] = assignEmptyUnit(entry, previousBlocks);
      return;
    }
    pending.push({ entry, index, normalized });
  });

  reservePassThroughUnits(nextEntries, previousUnits);
  matchUniquePairs(pending, previousUnits, resolved);
  matchFirstAvailableByText(pending, previousUnits, resolved);
  matchBySimilarity(pending, previousUnits, resolved);

  for (const item of pending) {
    if (resolved[item.index]) {
      continue;
    }
    resolved[item.index] = assignToOpenBlock(item.entry, previousBlocks, now);
  }

  // A unit can match a previous unit that itself has no stamp (a legacy
  // chunk only stamps its first paragraph; a later paragraph parses as
  // at: null). A non-empty unit must not stay unstamped forever, so it gets
  // backfilled with the open block start (or now) here - empty structural
  // units are exempt, they are never stamped.
  for (let index = 0; index < resolved.length; index += 1) {
    const entry = resolved[index];
    if (!entry.at && !isEmptyNoteUnitText(entry.text)) {
      resolved[index] = assignToOpenBlock(entry, previousBlocks, now);
    }
  }

  inheritOpenBlockMeta(resolved);

  return serializeResolvedTimeBlocks(resolved);
}

// Editor draft with no "@ " headers and no blank separators between bullets,
// so applyTodoNote can re-match this text against the stored note by identity.
function stripNoteStampsForEditor(storedNote) {
  return parseNoteEntries(storedNote)
    .map((entry) => entry.text)
    .join('\n');
}

// A next entry that already carries a header (parsed straight from an
// explicit "@ " line, e.g. the untouched part of an appendNote flow) skips
// matching entirely and keeps its own stamp - but its previous-side
// counterpart must still be marked used, or a later similar bullet in the
// same note could steal that still-present bullet's time in passes A-D.
function reservePassThroughUnits(nextEntries, previousUnits) {
  for (const entry of nextEntries) {
    if (!entry.at) {
      continue;
    }
    const normalized = normalizeUnitText(entry.text);
    const match = previousUnits.find(
      (unit) => !unit.used && unit.entry.at === entry.at && unit.normalized === normalized,
    );
    if (match) {
      match.used = true;
    }
  }
}

// Pass A: a normalized string unique on both sides pairs unambiguously
// (handles reordering unique bullets without relying on position).
function matchUniquePairs(pending, previousUnits, resolved) {
  const nextCounts = countNormalized(pending.filter((item) => !resolved[item.index]));
  const previousCounts = countNormalized(previousUnits.filter((unit) => !unit.used));

  for (const item of pending) {
    if (resolved[item.index]) {
      continue;
    }
    if (nextCounts.get(item.normalized) !== 1 || previousCounts.get(item.normalized) !== 1) {
      continue;
    }

    const match = previousUnits.find((unit) => !unit.used && unit.normalized === item.normalized);
    if (!match) {
      continue;
    }
    match.used = true;
    resolved[item.index] = copyResolvedUnit(match.entry, item.entry.text);
  }
}

// Pass B: duplicate identical bullets pair off in document order.
function matchFirstAvailableByText(pending, previousUnits, resolved) {
  for (const item of pending) {
    if (resolved[item.index]) {
      continue;
    }
    const match = previousUnits.find((unit) => !unit.used && unit.normalized === item.normalized);
    if (!match) {
      continue;
    }
    match.used = true;
    resolved[item.index] = copyResolvedUnit(match.entry, item.entry.text);
  }
}

// Pass C: fuzzy match by token similarity, next units walked in document
// order so an earlier bullet claims a shared best candidate before a later one.
function matchBySimilarity(pending, previousUnits, resolved) {
  for (const item of pending) {
    if (resolved[item.index]) {
      continue;
    }

    let best = null;
    let bestScore = -1;
    for (const unit of previousUnits) {
      if (unit.used) {
        continue;
      }
      const score = unitSimilarity(unit.normalized, item.normalized);
      if (score < SIMILARITY_THRESHOLD) {
        continue;
      }
      if (score > bestScore) {
        bestScore = score;
        best = unit;
        continue;
      }
      if (score === bestScore && best) {
        const bestDistance = Math.abs(best.index - item.index);
        const candidateDistance = Math.abs(unit.index - item.index);
        if (candidateDistance < bestDistance) {
          best = unit;
        }
      }
    }

    if (!best) {
      continue;
    }
    best.used = true;
    resolved[item.index] = copyResolvedUnit(best.entry, item.entry.text);
  }
}

function countNormalized(items) {
  const counts = new Map();
  for (const item of items) {
    counts.set(item.normalized, (counts.get(item.normalized) ?? 0) + 1);
  }
  return counts;
}

function unitSimilarity(normalizedPrev, normalizedNext) {
  const tokensPrev = normalizedPrev.split(' ').filter(Boolean);
  const tokensNext = normalizedNext.split(' ').filter(Boolean);
  if (tokensPrev.length === 0 && tokensNext.length === 0) {
    // Neither side (both empty units, in practice excluded from matching
    // long before this point) has anything to compare - 0/0 would be NaN.
    return 0;
  }
  const paired = pairedTokenCount(tokensPrev, tokensNext);
  return paired / (tokensPrev.length + tokensNext.length - paired);
}

// Greedy in-order alignment: walk tokensA in order, consuming the earliest
// still-unused tokensB token that pairs with it.
function pairedTokenCount(tokensA, tokensB) {
  let bIndex = 0;
  let paired = 0;
  for (const tokenA of tokensA) {
    let found = -1;
    for (let k = bIndex; k < tokensB.length; k += 1) {
      if (tokensMatch(tokenA, tokensB[k])) {
        found = k;
        break;
      }
    }
    if (found !== -1) {
      paired += 1;
      bIndex = found + 1;
    }
  }
  return paired;
}

function tokensMatch(a, b) {
  if (a === b) {
    return true;
  }
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) {
    return true;
  }
  return 1 - levenshteinDistance(a, b) / maxLen >= TOKEN_MATCH_RATIO;
}

function levenshteinDistance(a, b) {
  if (a === b) {
    return 0;
  }
  if (!a.length) {
    return b.length;
  }
  if (!b.length) {
    return a.length;
  }

  let previousRow = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const currentRow = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currentRow[j] = Math.min(currentRow[j - 1] + 1, previousRow[j] + 1, previousRow[j - 1] + cost);
    }
    previousRow = currentRow;
  }
  return previousRow[b.length];
}

// Normalize for matching only: strip a list marker and, if present, a
// checkbox marker, then collapse whitespace and lowercase. Never touches
// stored text - only used to compare bullet identity across edits.
function normalizeUnitText(rawLine) {
  let text = rawLine.trim();

  const markerMatch = text.match(LIST_MARKER_PATTERN);
  if (markerMatch) {
    text = (markerMatch[1] ?? '').trim();
    const checkboxMatch = text.match(CHECKBOX_PATTERN);
    if (checkboxMatch) {
      text = (checkboxMatch[1] ?? '').trim();
    }
  }

  return text.replace(/\s+/g, ' ').toLowerCase();
}

function matchLocalHeading(line, pattern) {
  const match = line.match(pattern);
  if (!match) {
    return null;
  }
  return dateAtSanFranciscoTime(match[1], Number(match[2]) * 60 + Number(match[3])).toISOString();
}

function flattenNoteTimeBlocks(blocks) {
  return blocks.flatMap((block, blockIndex) => {
    const chunkText = block.lines.join('\n').replace(/^\n+|\n+$/g, '');
    if (block.kind === 'stamp' || (block.kind === 'plain' && !block.startedAt)) {
      return splitChunkIntoUnits(chunkText, block.startedAt).map((unit) => ({
        ...unit,
        blockIndex,
        startedAt: unit.at,
        endedAt: block.endedAt,
      }));
    }

    return block.lines
      .filter((line) => line.trim())
      .map((line) => {
        const isEmpty = isEmptyNoteUnitText(line);
        return {
          at: isEmpty ? null : block.startedAt,
          text: line,
          blockIndex,
          startedAt: block.startedAt,
          endedAt: block.endedAt,
        };
      });
  });
}

function findOpenBlockIndex(blocks) {
  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    if (!blocks[index].endedAt) {
      return index;
    }
  }
  return NEW_BLOCK_INDEX;
}

function copyResolvedUnit(source, text) {
  return {
    at: source.at,
    text,
    blockIndex: source.blockIndex,
    startedAt: source.startedAt ?? source.at,
    endedAt: source.endedAt ?? null,
  };
}

function assignEmptyUnit(entry, previousBlocks) {
  const openIndex = findOpenBlockIndex(previousBlocks);
  const openBlock = openIndex === NEW_BLOCK_INDEX ? null : previousBlocks[openIndex];
  return {
    at: null,
    text: entry.text,
    blockIndex: openBlock ? openIndex : (entry.blockIndex ?? NEW_BLOCK_INDEX),
    startedAt: openBlock?.startedAt ?? entry.startedAt ?? null,
    endedAt: null,
  };
}

function assignToOpenBlock(entry, previousBlocks, now) {
  const openIndex = findOpenBlockIndex(previousBlocks);
  const openBlock = openIndex === NEW_BLOCK_INDEX ? null : previousBlocks[openIndex];
  const startedAt = openBlock?.startedAt ?? now.toISOString();
  return {
    at: startedAt,
    text: entry.text,
    blockIndex: openBlock ? openIndex : NEW_BLOCK_INDEX,
    startedAt,
    endedAt: null,
  };
}

function inheritOpenBlockMeta(resolved) {
  for (let index = 0; index < resolved.length; index += 1) {
    const entry = resolved[index];
    if (!entry || !isEmptyNoteUnitText(entry.text) || entry.startedAt) {
      continue;
    }
    const neighbor = resolved[index - 1] ?? resolved[index + 1];
    if (!neighbor) {
      continue;
    }
    resolved[index] = {
      ...entry,
      blockIndex: neighbor.blockIndex,
      startedAt: neighbor.startedAt ?? null,
      endedAt: neighbor.endedAt ?? null,
    };
  }
}

function serializeResolvedTimeBlocks(resolved) {
  const blocks = [];
  for (const entry of resolved) {
    if (!entry || !entry.text.trim()) {
      continue;
    }
    const startedAt = entry.startedAt ?? entry.at ?? null;
    const endedAt = entry.endedAt ?? null;
    const blockIndex = entry.blockIndex ?? NEW_BLOCK_INDEX;
    const last = blocks.at(-1);
    const sameBlock =
      last && last.blockIndex === blockIndex && last.startedAt === startedAt && last.endedAt === endedAt;
    if (sameBlock) {
      last.lines.push(entry.text);
      continue;
    }
    blocks.push({
      blockIndex,
      startedAt,
      endedAt,
      kind: 'session',
      lines: [entry.text],
    });
  }

  return serializeNoteTimeBlocks(blocks);
}

// Within one chunk, blank lines still delimit paragraphs; only the first
// paragraph inherits the chunk's header stamp (matches legacy behavior for
// free text). Every non-blank line in a paragraph is its own unit - the fix
// for bullets that used to share one stamp per chunk. A marker-only line
// ("- ") is still a real unit (kept in document order, e.g. between two
// stamped bullets) - it just never carries a stamp, regardless of which
// paragraph it falls in.
function splitChunkIntoUnits(text, at) {
  const paragraphs = text.split(/\n{2,}/).map((paragraph) => paragraph.replace(/^\n+|\n+$/g, ''));

  const units = [];
  paragraphs.forEach((paragraph, paragraphIndex) => {
    const paragraphAt = paragraphIndex === 0 ? at : null;
    for (const line of paragraph.split('\n')) {
      if (!line.trim()) {
        continue;
      }
      const isEmpty = !normalizeUnitText(line);
      units.push({ at: isEmpty ? null : paragraphAt, text: line });
    }
  });

  return units;
}

const SAN_FRANCISCO = { latitude: 37.774929, longitude: -122.419418 };
const DEFAULT_SUNRISE_HOUR = 6;
const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const SUMMARY_BUCKETS = [
  { label: 'Early morning', startAt: (dayKey) => dateAtSanFranciscoTime(dayKey, 0) },
  { label: 'Morning', startAt: getSanFranciscoSunrise },
  { label: 'Lunch', startAt: (dayKey) => dateAtSanFranciscoTime(dayKey, 11 * 60) },
  { label: 'Evening', startAt: (dayKey) => dateAtSanFranciscoTime(dayKey, 14 * 60) },
  { label: 'Night', startAt: (dayKey) => dateAtSanFranciscoTime(dayKey, 20 * 60) },
];

function createInitialState(todos = []) {
  return { todos: todos.map(normalizeTodo) };
}

const TODO_KINDS = ['task', 'project'];

function parseTodoKind(value) {
  return value === 'project' ? 'project' : 'task';
}

function addTodo(
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

function findDuplicateTodo(state, title, { excludeTodoId = null } = {}) {
  const matches = findMatchingOpenTodos(state, title, { excludeTodoId });
  return matches[0] ?? null;
}

function completeTodo(state, todoId, completedAt = new Date()) {
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

function getPendingTodos(state) {
  return state.todos
    .filter((todo) => parseTodoKind(todo.kind) === 'task' && !todo.completedAt && !todo.isProgressSession)
    .toSorted(compareTodosNewestFirst);
}

function getProjectTodos(state) {
  return state.todos
    .filter(
      (todo) => parseTodoKind(todo.kind) === 'project' && !todo.completedAt && !todo.isProgressSession,
    )
    .toSorted(compareTodosNewestFirst);
}

function getBoardColumnId(todo) {
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

function getCompletedTodos(state) {
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

function getDaySummary(state, dayKey) {
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
    items: items.toSorted(compareSummaryItemsByStart),
  }));
}

function formatDuration(seconds) {
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

function getDayPartLabel(date) {
  const dayKey = formatSummaryDayKey(date);
  if (!dayKey) {
    return 'Night';
  }

  return SUMMARY_BUCKETS.toReversed().find((bucket) => date >= bucket.startAt(dayKey))?.label ?? 'Early morning';
}

function createTodoId(title, date) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 32);

  return `${date.getTime()}-${slug || 'todo'}`;
}

function closeActiveTimeSegment(todo, stoppedAt) {
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

function normalizedTrackedSeconds(todo) {
  return Math.max(0, Math.floor(Number(todo.trackedSeconds ?? 0)));
}

function getActiveSegmentSeconds(startedAt, endedAt) {
  if (Number.isNaN(startedAt.getTime()) || Number.isNaN(endedAt.getTime())) {
    return 0;
  }

  const elapsed = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000);
  return Math.max(0, elapsed);
}

function compareTodosNewestFirst(first, second) {
  const firstCreatedAt = new Date(first.createdAt).getTime();
  const secondCreatedAt = new Date(second.createdAt).getTime();
  const firstTime = Number.isNaN(firstCreatedAt) ? -Infinity : firstCreatedAt;
  const secondTime = Number.isNaN(secondCreatedAt) ? -Infinity : secondCreatedAt;
  return secondTime - firstTime;
}

function normalizeTodo(todo) {
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

function formatSummaryDayKey(date) {
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const parts = getSanFranciscoDateTimeParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function toRemoteRecord(todo, userId) {
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

function fromRemoteRecord(record) {
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

function toRemoteCompletionFields(todo) {
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
const AGENT_API_VERSION = 2;

const AGENT_COMMANDS = [
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

function describeCatalog() {
  return {
    kind: 'describe',
    apiVersion: AGENT_API_VERSION,
    timeZone: SAN_FRANCISCO_TIME_ZONE,
    commands: AGENT_COMMANDS,
  };
}

function commandNeedsTodos(command) {
  return command?.kind !== 'describe';
}

function parseTodoCommand(body) {
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

function runTodoCommand(state, command, now) {
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
  if (todo.isProgressive) {
    return {
      ok: false,
      error: { code: 'progressive_unsupported', message: 'Progressive tasks cannot be completed this way' },
    };
  }

  if (todo.completedAt) {
    return {
      ok: true,
      view: { kind: 'complete', task: toCompletedTaskView(todo) },
      persist: { kind: 'none' },
    };
  }

  const next = completeTodo(state, todo.id, now);
  const updated = next.todos.find((item) => item.id === todo.id);

  return {
    ok: true,
    view: { kind: 'complete', task: toCompletedTaskView(updated) },
    persist: { kind: 'update', todo: updated },
  };
}

function runAppendNoteCommand(state, target, text, now) {
  const resolved = resolveCompleteTarget(state, target);
  if (!resolved.ok) {
    return resolved;
  }

  const todo = resolved.todo;
  const nextNote = todo.note?.trim() ? `${todo.note.trimEnd()}\n\n${text}` : text;
  const updated = {
    ...todo,
    note: applyTodoNote(todo.note ?? '', nextNote, now),
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
    completable: !todo.isProgressive,
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

function compareSummaryItemsByStart(first, second) {
  const firstStart = validTimestamp(first.startedAt);
  const secondStart = validTimestamp(second.startedAt);

  if (firstStart === null && secondStart === null) return 0;
  if (firstStart === null) return 1;
  if (secondStart === null) return -1;
  return firstStart - secondStart;
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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const AGENT_TODO_COLUMNS =
  'id,title,created_at,completed_at,kind,someday_at,due_date,note,source,notion_page_id,notion_database_id,notion_status,first_started_at,active_started_at,tracked_seconds,time_segments,is_progressive,parent_task_id,is_progress_session,progress_label';

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: { code: 'invalid', message: 'Use POST' } }, 405);
  }

  const providedToken = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  const expectedToken = Deno.env.get('INGEST_FUNCTION_TOKEN');
  const isTrustedInternalCaller = Boolean(expectedToken) && providedToken === expectedToken;
  const isAgentAccessToken =
    typeof providedToken === 'string' && /^dlg_[0-9a-f]{64}$/.test(providedToken);

  let agentTokenUserId = null;
  let verifiedUserId = null;
  if (!isTrustedInternalCaller && isAgentAccessToken) {
    const lookupClient = createAdminClient({
      baseUrl: Deno.env.get('INSFORGE_BASE_URL'),
      apiKey: Deno.env.get('API_KEY'),
    });
    const { data } = await lookupClient.database
      .from('agent_tokens')
      .select('user_id')
      .eq('token_hash', await sha256Hex(providedToken))
      .limit(1);
    agentTokenUserId = data?.[0]?.user_id ?? null;
  } else if (!isTrustedInternalCaller && providedToken) {
    const userClient = createClient({
      baseUrl: Deno.env.get('INSFORGE_BASE_URL'),
      accessToken: providedToken,
    });
    const { data } = await userClient.auth.getCurrentUser();
    verifiedUserId = data?.user?.id ?? null;
  }

  if (!isTrustedInternalCaller && !agentTokenUserId && !verifiedUserId) {
    return json({ error: { code: 'unauthorized', message: 'Unauthorized' } }, 401);
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const ownerUserId = isTrustedInternalCaller
    ? (body.ownerUserId ?? null)
    : (agentTokenUserId ?? verifiedUserId);
  if (!ownerUserId || typeof ownerUserId !== 'string') {
    return json(
      { error: { code: 'invalid', message: 'ownerUserId is required for the shared-secret path' } },
      400,
    );
  }

  const parsed = parseTodoCommand(body);
  if (!parsed.ok) {
    return json(
      parsed.catalog ? { error: parsed.error, ...parsed.catalog } : { error: parsed.error },
      statusFor(parsed.error.code),
    );
  }

  if (!commandNeedsTodos(parsed.command)) {
    const result = runTodoCommand(createInitialState(), parsed.command, new Date());
    if (!result.ok) {
      return json(
        result.catalog ? { error: result.error, ...result.catalog } : { error: result.error },
        statusFor(result.error.code),
      );
    }
    return json(result.view, 200);
  }

  const client =
    isTrustedInternalCaller || agentTokenUserId
      ? createAdminClient({
          baseUrl: Deno.env.get('INSFORGE_BASE_URL'),
          apiKey: Deno.env.get('API_KEY'),
        })
      : createClient({
          baseUrl: Deno.env.get('INSFORGE_BASE_URL'),
          accessToken: providedToken,
        });

  const { data, error } = await client.database
    .from('todos')
    .select(AGENT_TODO_COLUMNS)
    .eq('user_id', ownerUserId)
    .neq('loop_status', 'inbox');

  if (error) {
    return json({ error: { code: 'internal', message: `Failed to load todos: ${error.message}` } }, 500);
  }

  const state = createInitialState((data ?? []).map(fromRemoteRecord));
  const result = runTodoCommand(state, parsed.command, new Date());
  if (!result.ok) {
    return json({ error: result.error }, statusFor(result.error.code));
  }

  try {
    await persistTodoCommand(client, ownerUserId, result.persist);
  } catch (persistError) {
    return json(
      { error: { code: 'internal', message: persistError.message ?? 'Failed to persist todo' } },
      500,
    );
  }

  return json(result.view, 200);
}

async function persistTodoCommand(client, ownerUserId, persist) {
  if (persist.kind === 'none') {
    return;
  }

  if (persist.kind === 'insert') {
    const { error } = await client.database.from('todos').insert([
      {
        ...toRemoteRecord(persist.todo, ownerUserId),
        due_date: persist.todo.dueDate,
        loop_status: 'accepted',
      },
    ]);
    if (error) {
      throw error;
    }
    return;
  }

  const { error } = await client.database
    .from('todos')
    .update({
      ...toRemoteCompletionFields(persist.todo),
      note: persist.todo.note ?? '',
      updated_at: new Date().toISOString(),
    })
    .eq('id', persist.todo.id)
    .eq('user_id', ownerUserId);

  if (error) {
    throw error;
  }
}

function statusFor(code) {
  switch (code) {
    case 'empty_title':
    case 'invalid':
    case 'unknown_command':
      return 400;
    case 'not_found':
      return 404;
    case 'ambiguous_title':
    case 'progressive_unsupported':
      return 409;
    default:
      return 500;
  }
}

function json(body, status) {
  const payload =
    body && typeof body === 'object' && !Array.isArray(body) && body.apiVersion === undefined
      ? { ...body, apiVersion: AGENT_API_VERSION }
      : body;
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Keys are stored hashed (migrations/20260813160200_hash-agent-tokens.sql),
// so the incoming plaintext dlg_ key is hashed before lookup.
async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value)));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
