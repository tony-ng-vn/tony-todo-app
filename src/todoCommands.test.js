import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  AGENT_API_VERSION,
  AGENT_COMMANDS,
  applyTodoNote,
  commandNeedsTodos,
  createInitialState,
  createTodoId,
  dateAtSanFranciscoTime,
  describeCatalog,
  formatNoteAtLocal,
  formatSummaryDayKey,
  parseNoteEntries,
  parseTodoCommand,
  runTodoCommand,
  toRemoteRecord,
} from './todoCommands.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TODO_COMMANDS_PATH = join(ROOT, 'src/todoCommands.js');
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
  it('parses describe, list, create, complete, daySummary, and appendNote', () => {
    expect(parseTodoCommand({ command: 'describe' })).toEqual({
      ok: true,
      command: { kind: 'describe' },
    });
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
    expect(parseTodoCommand({ command: 'appendNote', id: 'task-1', text: 'Left voicemail' }).command).toEqual({
      kind: 'appendNote',
      target: { by: 'id', id: 'task-1' },
      text: 'Left voicemail',
    });

    expect(parseTodoCommand({ command: 'complete', id: 'task-1', title: 'Call Sam' }).ok).toBe(false);
    expect(parseTodoCommand({ command: 'complete' }).ok).toBe(false);
    expect(parseTodoCommand({ command: 'appendNote', id: 'task-1' }).ok).toBe(false);
  });

  it('returns the live catalog for an unknown command', () => {
    const parsed = parseTodoCommand({ command: 'start' });

    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe('unknown_command');
    expect(parsed.catalog).toEqual(describeCatalog());
    expect(parsed.catalog.commands.map((entry) => entry.command)).toEqual(
      AGENT_COMMANDS.map((entry) => entry.command),
    );
  });

  it('keeps the catalog aligned with the parser', () => {
    expect(AGENT_API_VERSION).toBe(2);
    expect(AGENT_COMMANDS.map((entry) => entry.command)).toEqual([
      'describe',
      'list',
      'create',
      'complete',
      'appendNote',
      'daySummary',
    ]);

    for (const entry of AGENT_COMMANDS) {
      const parsed = parseTodoCommand(entry.bodies[0]);
      expect(parsed.ok).toBe(true);
      expect(parsed.command.kind).toBe(entry.command);
    }
  });

  it('bumps AGENT_API_VERSION when the catalog changes from origin/main', () => {
    const source = readFileSync(TODO_COMMANDS_PATH, 'utf8');
    expect(extractExportedNumber(source, 'AGENT_API_VERSION')).toBe(AGENT_API_VERSION);
    expect(normalizeLiteral(extractExportedArrayLiteral(source, 'AGENT_COMMANDS'))).toContain(
      "command: 'describe'",
    );

    const mergeBase = git(['merge-base', 'HEAD', 'refs/remotes/origin/main']);
    if (!mergeBase) {
      return;
    }

    const baseSource = git(['show', `${mergeBase}:src/todoCommands.js`]);
    if (!baseSource) {
      return;
    }

    const baseVersion = extractExportedNumber(baseSource, 'AGENT_API_VERSION');
    const baseCatalog = extractExportedArrayLiteral(baseSource, 'AGENT_COMMANDS');
    if (baseVersion === null || !baseCatalog) {
      return;
    }

    const currentCatalog = extractExportedArrayLiteral(source, 'AGENT_COMMANDS');
    if (normalizeLiteral(baseCatalog) === normalizeLiteral(currentCatalog)) {
      return;
    }

    expect(AGENT_API_VERSION).toBeGreaterThan(baseVersion);
  });
});

describe('note entries', () => {
  it('parses stamped blocks and blank-line notes', () => {
    expect(parseNoteEntries('')).toEqual([]);
    expect(parseNoteEntries('Ask about the deadline.')).toEqual([
      { at: null, text: 'Ask about the deadline.' },
    ]);
    expect(
      parseNoteEntries('@ 2026-06-08 08:00\nLeft voicemail\n\n@ 2026-06-08 08:12\nWaiting on callback'),
    ).toEqual([
      { at: dateAtSanFranciscoTime('2026-06-08', 8 * 60).toISOString(), text: 'Left voicemail' },
      { at: dateAtSanFranciscoTime('2026-06-08', 8 * 60 + 12).toISOString(), text: 'Waiting on callback' },
    ]);
  });

  it('stamps new note blocks and keeps earlier times', () => {
    const first = new Date('2026-06-08T15:00:00.000Z');
    const later = new Date('2026-06-08T15:12:00.000Z');
    const stamped = applyTodoNote('', 'Left voicemail', first);

    expect(stamped).toBe(`Start: ${formatNoteAtLocal(first)}\nLeft voicemail`);
    expect(applyTodoNote(stamped, `${stamped}\n\nWaiting on callback`, later)).toBe(
      `Start: ${formatNoteAtLocal(first)}\nLeft voicemail\nWaiting on callback`,
    );
  });

  it('stamps every bullet by identity instead of by position, so reordering keeps each time', () => {
    const first = new Date('2026-06-08T15:00:00.000Z');
    const later = new Date('2026-06-08T15:12:00.000Z');
    const now = new Date('2026-06-08T16:00:00.000Z');
    let stored = applyTodoNote('', '- Call Sam', first);
    stored = applyTodoNote(stored, '- Call Sam\n- Email the landlord', later);

    const reordered = applyTodoNote(stored, '- Email the landlord\n- Call Sam', now);

    expect(parseNoteEntries(reordered)).toEqual([
      { at: first.toISOString(), text: '- Email the landlord' },
      { at: first.toISOString(), text: '- Call Sam' },
    ]);
  });

  it('gives every bullet in a legacy multi-dash chunk its own stamp instead of one shared stamp', () => {
    const legacyAt = dateAtSanFranciscoTime('2026-06-08', 8 * 60).toISOString();
    const legacy = '@ 2026-06-08 08:00\n- Call Sam\n- Email the landlord';

    expect(parseNoteEntries(legacy)).toEqual([
      { at: legacyAt, text: '- Call Sam' },
      { at: legacyAt, text: '- Email the landlord' },
    ]);
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
    expect(result.persist.todo.timeSegments).toEqual([]);
    expect(result.persist.todo.firstStartedAt).toBeNull();
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
    expect(result.view.kind).toBe('list');
    expect(result.view.apiVersion).toBe(AGENT_API_VERSION);
    expect(result.view.now).toBe(UTC_EVENING.toISOString());
    expect(result.view.nowLocal).toBe(formatNoteAtLocal(UTC_EVENING));
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

  it('includes timestamped notes so agents can see when each note happened', () => {
    const writtenAt = new Date('2026-01-15T18:12:00.000Z');
    const state = createInitialState([
      openTodo({
        note: `@ ${formatNoteAtLocal(writtenAt)}\nLeft voicemail`,
        updatedAt: '2026-01-15T19:00:00.000Z',
      }),
      openTodo({
        id: 'legacy',
        title: 'Legacy note',
        note: 'Old context without a stamp',
        createdAt: '2026-01-15T17:00:00.000Z',
        updatedAt: '2026-01-15T17:30:00.000Z',
      }),
    ]);
    const result = runTodoCommand(state, { kind: 'list' }, UTC_EVENING);

    expect(result.view.tasks.find((task) => task.id === 'task-1').notes).toEqual([
      {
        at: writtenAt.toISOString(),
        atLocal: formatNoteAtLocal(writtenAt),
        text: 'Left voicemail',
      },
    ]);
    expect(result.view.tasks.find((task) => task.id === 'legacy').notes).toEqual([
      {
        at: '2026-01-15T17:30:00.000Z',
        atLocal: formatNoteAtLocal(new Date('2026-01-15T17:30:00.000Z')),
        text: 'Old context without a stamp',
      },
    ]);
  });

  it('excludes empty structural bullets from agent-facing notes[]', () => {
    const state = createInitialState([openTodo({ note: '- ' })]);
    const result = runTodoCommand(state, { kind: 'list' }, UTC_EVENING);

    expect(result.view.tasks.find((task) => task.id === 'task-1').notes).toEqual([]);
  });
});

describe('runTodoCommand appendNote', () => {
  it('appends a stamped note and persists the task note', () => {
    const state = createInitialState([openTodo({ note: '' })]);
    const result = runTodoCommand(
      state,
      { kind: 'appendNote', target: { by: 'id', id: 'task-1' }, text: 'Left voicemail' },
      UTC_EVENING,
    );

    expect(result.ok).toBe(true);
    expect(result.persist.kind).toBe('update');
    expect(result.persist.todo.note).toBe(`Start: ${formatNoteAtLocal(UTC_EVENING)}\nLeft voicemail`);
    expect(result.view.task.notes).toEqual([
      {
        at: UTC_EVENING.toISOString(),
        atLocal: formatNoteAtLocal(UTC_EVENING),
        text: 'Left voicemail',
      },
    ]);
  });

  it('appends multiple list items as separate stamped notes from one command call', () => {
    const state = createInitialState([openTodo({ note: '' })]);
    const result = runTodoCommand(
      state,
      { kind: 'appendNote', target: { by: 'id', id: 'task-1' }, text: '- a\n- b' },
      UTC_EVENING,
    );

    expect(result.ok).toBe(true);
    expect(result.persist.kind).toBe('update');
    expect(result.persist.todo.note).toBe(
      `Start: ${formatNoteAtLocal(UTC_EVENING)}\n- a\n- b`,
    );
    expect(result.view.task.notes).toEqual([
      { at: UTC_EVENING.toISOString(), atLocal: formatNoteAtLocal(UTC_EVENING), text: '- a' },
      { at: UTC_EVENING.toISOString(), atLocal: formatNoteAtLocal(UTC_EVENING), text: '- b' },
    ]);
  });

  it('files an appended note under the open session instead of a new block', () => {
    const earlier = new Date(UTC_EVENING.getTime() - 20 * 60 * 1000);
    const state = createInitialState([openTodo({ note: `Start: ${formatNoteAtLocal(earlier)}\n- a` })]);
    const result = runTodoCommand(
      state,
      { kind: 'appendNote', target: { by: 'id', id: 'task-1' }, text: '- b' },
      UTC_EVENING,
    );

    expect(result.persist.todo.note).toBe(`Start: ${formatNoteAtLocal(earlier)}\n- a\n- b`);
    expect(result.view.task.notes.map((note) => note.at)).toEqual([earlier.toISOString(), earlier.toISOString()]);
  });

  // Legacy "@" stamps are closed history: an agent note appended today must
  // report today's time, not the last legacy stamp.
  it('opens a fresh session at now when appending to a legacy stamped note', () => {
    const legacy = '@ 2026-06-01 09:00\n- a\n\n@ 2026-06-01 09:05\n- b';
    const state = createInitialState([openTodo({ note: legacy })]);
    const result = runTodoCommand(
      state,
      { kind: 'appendNote', target: { by: 'id', id: 'task-1' }, text: '- c' },
      UTC_EVENING,
    );

    expect(result.persist.todo.note).toBe(`${legacy}\n\nStart: ${formatNoteAtLocal(UTC_EVENING)}\n- c`);
    expect(result.view.task.notes.at(-1)).toEqual({
      at: UTC_EVENING.toISOString(),
      atLocal: formatNoteAtLocal(UTC_EVENING),
      text: '- c',
    });
  });
});

describe('runTodoCommand daySummary', () => {
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

describe('runTodoCommand describe', () => {
  it('returns the live catalog without touching todos', () => {
    const result = runTodoCommand(createInitialState([openTodo()]), { kind: 'describe' }, UTC_EVENING);

    expect(result.ok).toBe(true);
    expect(result.persist).toEqual({ kind: 'none' });
    expect(commandNeedsTodos({ kind: 'describe' })).toBe(false);
    expect(commandNeedsTodos({ kind: 'list' })).toBe(true);
    expect(result.view).toEqual(describeCatalog());
    expect(result.view.apiVersion).toBe(AGENT_API_VERSION);
    expect(result.view.timeZone).toBe('America/Los_Angeles');
  });
});

function git(args) {
  const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : null;
}

function extractExportedNumber(source, name) {
  const match = String(source ?? '').match(new RegExp(`export const ${name} = (\\d+);`));
  return match ? Number(match[1]) : null;
}

function extractExportedArrayLiteral(source, name) {
  const marker = `export const ${name} = `;
  const start = String(source ?? '').indexOf(marker);
  if (start < 0) {
    return null;
  }

  const begin = source.indexOf('[', start);
  if (begin < 0) {
    return null;
  }

  let depth = 0;
  for (let index = begin; index < source.length; index += 1) {
    const character = source[index];
    if (character === '[') {
      depth += 1;
    } else if (character === ']') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(begin, index + 1);
      }
    }
  }

  return null;
}

function normalizeLiteral(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}
