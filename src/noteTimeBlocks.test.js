import { beforeEach, describe, expect, it } from 'vitest';
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
  createInitialState,
  logProgressSession,
  pauseTodoTimer,
  resetNoteBurstBaselines,
  setTodoProgressive,
  startTodoTimer,
  updateTodoNote,
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
      `${startHeading(START)}\n${endHeading(PAUSE)}\n${startHeading(RESUME)}`,
    );
  });

  it('parses Start/End blocks and treats body lines as notes under the Start time', () => {
    const note = [
      startHeading(START),
      '- first',
      '- second',
      endHeading(PAUSE),
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

  it('hides Start/End headings in the editor draft', () => {
    const stored = [
      startHeading(START),
      '- first',
      '- second',
      endHeading(PAUSE),
      startHeading(RESUME),
      '- third',
    ].join('\n');

    expect(stripNoteStampsForEditor(stored)).toBe('- first\n- second\n- third');
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

  it('opens a new time block for notes added after End', () => {
    const closed = `${startHeading(START)}\n- first\n${endHeading(PAUSE)}`;
    const next = applyTodoNote(closed, '- first\n- second', RESUME);

    expect(next).toBe(
      `${startHeading(START)}\n- first\n${endHeading(PAUSE)}\n${startHeading(RESUME)}\n- second`,
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

  it('auto-starts a new task when the first note arrives without a Start click', () => {
    let state = createInitialState();
    state = addTodo(state, 'Brand new note', START);
    const todoId = state.todos[0].id;

    state = updateTodoNote(state, todoId, '- forgot to press start', START);

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

    state = updateTodoNote(state, todoId, '- outline\n- next session', RESUME);

    expect(state.todos[0].activeStartedAt).toBe(RESUME.toISOString());
    expect(state.todos[0].note).toBe(
      `${startHeading(START)}\n- outline\n${endHeading(PAUSE)}\n${startHeading(RESUME)}\n- next session`,
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
        startHeading(RESUME),
        '- second session',
        endHeading(SECOND_PAUSE),
      ].join('\n'),
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

    const next = updateTodoNote(state, todoId, '- leftover thought', LATER_NOTE);

    expect(next.todos[0].activeStartedAt).toBeNull();
    expect(next.todos[0].note).toContain('- leftover thought');
  });

  it('closes the open note block when a progressive session is logged', () => {
    let state = createInitialState();
    state = addTodo(state, 'Read the book', START);
    const todoId = state.todos[0].id;
    state = setTodoProgressive(state, todoId, true);
    state = startTodoTimer(state, todoId, START);
    state = updateTodoNote(state, todoId, '- chapter 1', START);
    state = logProgressSession(state, todoId, PAUSE);

    expect(state.todos.find((todo) => todo.id === todoId).note).toBe(
      `${startHeading(START)}\n- chapter 1\n${endHeading(PAUSE)}`,
    );
  });
});
