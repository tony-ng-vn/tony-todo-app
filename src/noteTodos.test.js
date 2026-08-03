import { describe, expect, it } from 'vitest';
import { expandTodoCommand, parseNoteTodos, toggleNoteTodo } from './noteTodos.js';

describe('note todos', () => {
  it('expands a todo command on the active note line', () => {
    const note = 'Context\n/todo Follow up with USCIS\nMore context';
    const cursor = note.indexOf('\nMore context');

    expect(expandTodoCommand(note, cursor)).toEqual({
      value: 'Context\n- [ ] Follow up with USCIS\nMore context',
      cursor: 'Context\n- [ ] Follow up with USCIS'.length,
      changed: true,
    });
  });

  it('leaves todo text alone when it is not a line command', () => {
    const note = 'Use /todo Follow up as an example';

    expect(expandTodoCommand(note, note.length)).toEqual({
      value: note,
      cursor: note.length,
      changed: false,
    });
  });

  it('does not expand words that only start with the todo command', () => {
    const note = '/todoist Review menu bar';

    expect(expandTodoCommand(note, note.length)).toEqual({
      value: note,
      cursor: note.length,
      changed: false,
    });
  });

  it('parses and toggles note todo lines without changing surrounding notes', () => {
    const note = 'Context\n- [ ] First task\n- [X] Finished task';

    expect(parseNoteTodos(note)).toEqual([
      { lineIndex: 1, done: false, label: 'First task' },
      { lineIndex: 2, done: true, label: 'Finished task' },
    ]);
    expect(toggleNoteTodo(note, 1)).toBe('Context\n- [x] First task\n- [X] Finished task');
    expect(toggleNoteTodo(note, 2)).toBe('Context\n- [ ] First task\n- [ ] Finished task');
  });
});
