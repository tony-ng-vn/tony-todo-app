import { beforeEach, describe, expect, it } from 'vitest';
import { dateAtSanFranciscoTime } from './sanFranciscoTime.js';
import {
  applyTodoNote,
  closeNoteTimeBlock,
  formatNoteAtLocal,
  openNoteTimeBlock,
  parseNoteEntries,
  parseNoteTimeBlocks,
  stripNoteStampsForEditor,
} from './noteEntries.js';
import {
  addTodo,
  completeTodo,
  createInitialState,
  pauseTodoTimer,
  resetNoteBurstBaselines,
  setTodoSomeday,
  startTodoTimer,
  updateTodoNote,
  updateTodoNoteFromEditor,
} from './todoStore.js';

const START = new Date('2026-08-17T05:12:00.000Z');
const PAUSE = new Date('2026-08-17T05:40:00.000Z');
const RESUME = new Date('2026-08-17T06:00:00.000Z');
const SECOND_PAUSE = new Date('2026-08-17T06:15:00.000Z');
const LATER_NOTE = new Date('2026-08-17T06:30:00.000Z');

function startHeading(date) {
  return `Start: ${formatNoteAtLocal(date)}`;
}

function endHeading(date) {
  return `End: ${formatNoteAtLocal(date)}`;
}

describe('note time blocks', () => {
  it('opens a Start heading for an empty note', () => {
    expect(openNoteTimeBlock('', START)).toBe(startHeading(START));
  });

  it('keeps the same open block when start is called again', () => {
    const opened = openNoteTimeBlock('', START);

    expect(openNoteTimeBlock(opened, RESUME)).toBe(opened);
  });

  it('closes the open block with an End heading on pause', () => {
    const opened = openNoteTimeBlock('', START);

    expect(closeNoteTimeBlock(opened, PAUSE)).toBe(`${startHeading(START)}\n${endHeading(PAUSE)}`);
  });

  it('stacks a new Start after a closed block', () => {
    const first = closeNoteTimeBlock(openNoteTimeBlock('', START), PAUSE);
    const resumed = openNoteTimeBlock(first, RESUME);

    expect(resumed).toBe(
      `${startHeading(START)}\n${endHeading(PAUSE)}\n\n${startHeading(RESUME)}`,
    );
  });

  it('parses Start/End blocks and treats body lines as notes under the Start time', () => {
    const note = [
      startHeading(START),
      '- first',
      '- second',
      endHeading(PAUSE),
      '',
      startHeading(RESUME),
      '- third',
    ].join('\n');

    expect(parseNoteTimeBlocks(note)).toEqual([
      {
        startedAt: START.toISOString(),
        endedAt: PAUSE.toISOString(),
        kind: 'session',
        lines: ['- first', '- second'],
      },
      {
        startedAt: RESUME.toISOString(),
        endedAt: null,
        kind: 'session',
        lines: ['- third'],
      },
    ]);
    expect(parseNoteEntries(note)).toEqual([
      { at: START.toISOString(), text: '- first' },
      { at: START.toISOString(), text: '- second' },
      { at: RESUME.toISOString(), text: '- third' },
    ]);
  });

  it('parses a run of legacy stamps as one closed block that keeps its lines verbatim', () => {
    const legacy = '@ 2026-06-08 10:00\n- a\n\n@ 2026-06-08 10:03\n- b\n\n@ 2026-06-08 10:07\n- c\n\n';

    expect(parseNoteTimeBlocks(legacy)).toEqual([
      {
        startedAt: dateAtSanFranciscoTime('2026-06-08', 10 * 60).toISOString(),
        endedAt: dateAtSanFranciscoTime('2026-06-08', 10 * 60 + 7).toISOString(),
        kind: 'stamp',
        lines: ['- a', '', '@ 2026-06-08 10:03', '- b', '', '@ 2026-06-08 10:07', '- c'],
      },
    ]);
  });

  it('leaves a legacy note verbatim when the timer starts and stacks a fresh Start after it', () => {
    const legacy = '@ 2026-06-08 10:00\n- a\n\n@ 2026-06-08 10:03\n- b';

    expect(openNoteTimeBlock(legacy, START)).toBe(`${legacy}\n\n${startHeading(START)}`);
    expect(closeNoteTimeBlock(legacy, PAUSE)).toBe(legacy);
  });

  it('hides Start/End headings in the editor draft', () => {
    const stored = [
      startHeading(START),
      '- first',
      '- second',
      endHeading(PAUSE),
      '',
      startHeading(RESUME),
      '- third',
    ].join('\n');

    expect(stripNoteStampsForEditor(stored)).toBe('- first\n- second\n- third');
  });

  // The editor shows exactly what the user typed: headings are the only
  // thing removed, blank lines are the user's, and a session boundary adds
  // nothing on its own. So strip(apply(prev, draft)) must give back draft.
  it('projects a draft typed after a pause back unchanged, blank line or not', () => {
    const closed = `${startHeading(START)}\n- old\n${endHeading(PAUSE)}`;

    const tight = applyTodoNote(closed, '- old\n- n', RESUME);
    expect(tight).toBe(`${closed}\n\n${startHeading(RESUME)}\n- n`);
    expect(stripNoteStampsForEditor(tight)).toBe('- old\n- n');

    const spaced = applyTodoNote(closed, '- old\n\n- n', RESUME);
    expect(spaced).toBe(`${closed}\n\n${startHeading(RESUME)}\n\n- n`);
    expect(stripNoteStampsForEditor(spaced)).toBe('- old\n\n- n');
  });

  it('keeps blank and whitespace-only lines inside a session verbatim', () => {
    const paragraphs = applyTodoNote('', 'para one\n\npara two', START);
    expect(paragraphs).toBe(`${startHeading(START)}\npara one\n\npara two`);
    expect(stripNoteStampsForEditor(paragraphs)).toBe('para one\n\npara two');
    expect(parseNoteEntries(paragraphs)).toEqual([
      { at: START.toISOString(), text: 'para one' },
      { at: START.toISOString(), text: 'para two' },
    ]);

    const indented = applyTodoNote('', '\tIndented line\n\t', START);
    expect(stripNoteStampsForEditor(indented)).toBe('\tIndented line\n\t');
  });

  it('shows a run of legacy stamps and a new session as one continuous list', () => {
    const legacy = '@ 2026-06-08 10:00\n- a\n\n@ 2026-06-08 10:03\n- b';

    const next = applyTodoNote(legacy, '- a\n- b\n- c', START);

    expect(stripNoteStampsForEditor(next)).toBe('- a\n- b\n- c');
  });

  it('keeps new bullets in the open time block instead of minting a new stamp', () => {
    const stored = applyTodoNote('', '- first', START);
    const next = applyTodoNote(stored, '- first\n- second', PAUSE);

    expect(next).toBe(`${startHeading(START)}\n- first\n- second`);
    expect(parseNoteEntries(next)).toEqual([
      { at: START.toISOString(), text: '- first' },
      { at: START.toISOString(), text: '- second' },
    ]);
  });

  // Session headings mirror the timer, so an edit never removes one: a
  // cleared draft leaves only the headings behind, an emptied session keeps
  // its Start/End pair, and a session that never had notes still stands.
  it('keeps only the session headings when the draft is cleared', () => {
    const stored = `${startHeading(START)}\n- first\n${endHeading(PAUSE)}\n\n${startHeading(RESUME)}`;

    expect(applyTodoNote(stored, '', LATER_NOTE)).toBe(
      `${startHeading(START)}\n${endHeading(PAUSE)}\n\n${startHeading(RESUME)}`,
    );
    expect(applyTodoNote('- plain text', '', LATER_NOTE)).toBe('');
  });

  it('keeps an empty Start/End pair in place when later notes are added', () => {
    const stored = `${startHeading(START)}\n- first\n${endHeading(PAUSE)}\n\n${startHeading(RESUME)}\n${endHeading(SECOND_PAUSE)}`;

    const next = applyTodoNote(stored, '- first\n- later', LATER_NOTE);

    expect(next).toBe(
      [
        startHeading(START),
        '- first',
        endHeading(PAUSE),
        '',
        startHeading(RESUME),
        endHeading(SECOND_PAUSE),
        '',
        startHeading(LATER_NOTE),
        '- later',
      ].join('\n'),
    );
    expect(stripNoteStampsForEditor(next)).toBe('- first\n- later');
  });

  it('opens a new time block for notes added after End', () => {
    const closed = `${startHeading(START)}\n- first\n${endHeading(PAUSE)}`;
    const next = applyTodoNote(closed, '- first\n- second', RESUME);

    expect(next).toBe(
      `${startHeading(START)}\n- first\n${endHeading(PAUSE)}\n\n${startHeading(RESUME)}\n- second`,
    );
  });
});

describe('timer-backed note time blocks', () => {
  beforeEach(() => {
    resetNoteBurstBaselines();
  });

  it('writes Start into the note when the timer starts', () => {
    let state = createInitialState();
    state = addTodo(state, 'Write the talk', START);
    const todoId = state.todos[0].id;

    state = startTodoTimer(state, todoId, START);

    expect(state.todos[0].note).toBe(startHeading(START));
    expect(stripNoteStampsForEditor(state.todos[0].note)).toBe('');
  });

  it('writes End into the note when the timer pauses', () => {
    let state = createInitialState();
    state = addTodo(state, 'Write the talk', START);
    const todoId = state.todos[0].id;
    state = startTodoTimer(state, todoId, START);
    state = updateTodoNote(state, todoId, '- outline', START);
    state = pauseTodoTimer(state, todoId, PAUSE);

    expect(state.todos[0].note).toBe(
      `${startHeading(START)}\n- outline\n${endHeading(PAUSE)}`,
    );
  });

  it('keeps writing in the same block when the user forgets to pause', () => {
    let state = createInitialState();
    state = addTodo(state, 'Write the talk', START);
    const todoId = state.todos[0].id;
    state = startTodoTimer(state, todoId, START);
    state = updateTodoNote(state, todoId, '- outline', START);
    state = updateTodoNote(state, todoId, '- outline\n- examples', PAUSE);

    expect(state.todos[0].activeStartedAt).toBe(START.toISOString());
    expect(state.todos[0].note).toBe(`${startHeading(START)}\n- outline\n- examples`);
    expect(state.todos[0].note).not.toContain('End:');
  });

  it('auto-starts a new task when the first note is typed without a Start click', () => {
    let state = createInitialState();
    state = addTodo(state, 'Brand new note', START);
    const todoId = state.todos[0].id;

    state = updateTodoNoteFromEditor(state, todoId, '- forgot to press start', START);

    expect(state.todos[0].activeStartedAt).toBe(START.toISOString());
    expect(state.todos[0].firstStartedAt).toBe(START.toISOString());
    expect(state.todos[0].note).toBe(`${startHeading(START)}\n- forgot to press start`);
  });

  it('auto-starts a new time block when notes continue after a pause without pressing start', () => {
    let state = createInitialState();
    state = addTodo(state, 'Write the talk', START);
    const todoId = state.todos[0].id;
    state = startTodoTimer(state, todoId, START);
    state = updateTodoNote(state, todoId, '- outline', START);
    state = pauseTodoTimer(state, todoId, PAUSE);

    state = updateTodoNoteFromEditor(state, todoId, '- outline\n- next session', RESUME);

    expect(state.todos[0].activeStartedAt).toBe(RESUME.toISOString());
    expect(state.todos[0].note).toBe(
      `${startHeading(START)}\n- outline\n${endHeading(PAUSE)}\n\n${startHeading(RESUME)}\n- next session`,
    );
  });

  it('stacks closed blocks when the user starts and pauses more than once', () => {
    let state = createInitialState();
    state = addTodo(state, 'Write the talk', START);
    const todoId = state.todos[0].id;
    state = startTodoTimer(state, todoId, START);
    state = updateTodoNote(state, todoId, '- first session', START);
    state = pauseTodoTimer(state, todoId, PAUSE);
    state = startTodoTimer(state, todoId, RESUME);
    state = updateTodoNote(state, todoId, '- first session\n- second session', RESUME);
    state = pauseTodoTimer(state, todoId, SECOND_PAUSE);

    expect(state.todos[0].note).toBe(
      [
        startHeading(START),
        '- first session',
        endHeading(PAUSE),
        '',
        startHeading(RESUME),
        '- second session',
        endHeading(SECOND_PAUSE),
      ].join('\n'),
    );
  });

  // The burst baseline is captured before the burst starts; a Pause (or any
  // other change to the stored note) in the middle of a burst must not be
  // undone by the next keystroke re-applying against that stale baseline.
  it('keeps the End written by a pause that lands in the middle of a typing burst', () => {
    let state = createInitialState();
    state = addTodo(state, 'Write the talk', START);
    const todoId = state.todos[0].id;
    state = startTodoTimer(state, todoId, START);
    state = updateTodoNote(state, todoId, '- outline', START);
    const pausedAt = new Date(START.getTime() + 1000);
    state = pauseTodoTimer(state, todoId, pausedAt);
    const resumedAt = new Date(START.getTime() + 2000);
    state = startTodoTimer(state, todoId, resumedAt);

    state = updateTodoNote(state, todoId, '- outline\n- more', new Date(START.getTime() + 3000));

    expect(state.todos[0].note).toBe(
      `${startHeading(START)}\n- outline\n${endHeading(pausedAt)}\n\n${startHeading(resumedAt)}\n- more`,
    );
  });

  // Only a note the user types starts the timer. Replaying a pending edit
  // on load or merging a synced note goes through updateTodoNote, which
  // must never start anything; a Someday task stays parked either way.
  it('does not auto-start when a note is replayed through updateTodoNote', () => {
    let state = createInitialState();
    state = addTodo(state, 'Replayed on load', START);
    const todoId = state.todos[0].id;

    state = updateTodoNote(state, todoId, '- typed before reload', START);

    expect(state.todos[0].activeStartedAt).toBeNull();
    expect(state.todos[0].firstStartedAt).toBeNull();
    expect(state.todos[0].note).toBe(`${startHeading(START)}\n- typed before reload`);
  });

  it('does not auto-start or unpark a Someday task when its note is typed', () => {
    let state = createInitialState();
    state = addTodo(state, 'Parked idea', START);
    const todoId = state.todos[0].id;
    state = setTodoSomeday(state, todoId, START);

    state = updateTodoNoteFromEditor(state, todoId, '- a thought', LATER_NOTE);

    expect(state.todos[0].somedayAt).toBe(START.toISOString());
    expect(state.todos[0].activeStartedAt).toBeNull();
    expect(state.todos[0].note).toBe(`${startHeading(LATER_NOTE)}\n- a thought`);
  });

  it('files a typed note under the fresh session on a legacy note instead of the old stamps', () => {
    const legacy = '@ 2026-06-08 10:00\n- a\n\n@ 2026-06-08 10:03\n- b';
    let state = createInitialState();
    state = addTodo(state, 'Old note', START);
    const todoId = state.todos[0].id;
    state = { ...state, todos: state.todos.map((todo) => ({ ...todo, note: legacy })) };

    state = updateTodoNoteFromEditor(state, todoId, '- a\n- b\n- c', LATER_NOTE);

    expect(state.todos[0].activeStartedAt).toBe(LATER_NOTE.toISOString());
    expect(state.todos[0].note).toBe(
      `Start: 2026-06-08 10:00\n- a\n- b\nEnd: 2026-06-08 10:03\n\n${startHeading(LATER_NOTE)}\n- c`,
    );
  });

  it('does not auto-start a completed task when its note is edited', () => {
    let state = createInitialState();
    state = addTodo(state, 'Already done', START);
    const todoId = state.todos[0].id;
    state = {
      ...state,
      todos: state.todos.map((todo) =>
        todo.id === todoId ? { ...todo, completedAt: PAUSE.toISOString() } : todo,
      ),
    };

    const next = updateTodoNoteFromEditor(state, todoId, '- leftover thought', LATER_NOTE);

    expect(next.todos[0].activeStartedAt).toBeNull();
    expect(next.todos[0].note).toContain('- leftover thought');
  });

  it('closes the open note block when the task is completed', () => {
    let state = createInitialState();
    state = addTodo(state, 'Read the book', START);
    const todoId = state.todos[0].id;
    state = startTodoTimer(state, todoId, START);
    state = updateTodoNote(state, todoId, '- chapter 1', START);
    state = completeTodo(state, todoId, PAUSE);

    expect(state.todos.find((todo) => todo.id === todoId).note).toBe(
      `${startHeading(START)}\n- chapter 1\n${endHeading(PAUSE)}`,
    );
  });
});
