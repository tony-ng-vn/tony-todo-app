import { describe, expect, it } from 'vitest';
import { getTextareaKeyEdit } from './textareaEditing.js';

describe('textarea editing', () => {
  it('inserts a tab at the current selection', () => {
    expect(
      getTextareaKeyEdit({
        value: 'BeforeAfter',
        selectionStart: 6,
        selectionEnd: 6,
        key: 'Tab',
      }),
    ).toEqual({ value: 'Before\tAfter', cursor: 7 });
  });

  it('preserves tab indentation on the next line', () => {
    const value = '- Parent\n\t- Child';

    expect(
      getTextareaKeyEdit({
        value,
        selectionStart: value.length,
        selectionEnd: value.length,
        key: 'Enter',
      }),
    ).toEqual({ value: '- Parent\n\t- Child\n\t', cursor: value.length + 2 });
  });

  it('preserves space indentation on the next line', () => {
    const value = 'Parent\n    Child';

    expect(
      getTextareaKeyEdit({
        value,
        selectionStart: value.length,
        selectionEnd: value.length,
        key: 'Enter',
      }),
    ).toEqual({ value: 'Parent\n    Child\n    ', cursor: value.length + 5 });
  });

  it('uses native key behavior when there is no indentation to preserve', () => {
    expect(
      getTextareaKeyEdit({
        value: 'Plain line',
        selectionStart: 10,
        selectionEnd: 10,
        key: 'Enter',
      }),
    ).toBeNull();

    expect(
      getTextareaKeyEdit({
        value: 'Indented',
        selectionStart: 8,
        selectionEnd: 8,
        key: 'Tab',
        shiftKey: true,
      }),
    ).toBeNull();
  });
});
