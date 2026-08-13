import { describe, expect, it } from 'vitest';
import { getTextareaKeyEdit, textareaScrollTopForCursor } from './textareaEditing.js';

describe('textarea caret follow', () => {
  it('scrolls down when enter grows the note past the visible range', () => {
    const value = `${'x\n'.repeat(40)}- `;
    expect(
      textareaScrollTopForCursor({
        value,
        cursor: value.length,
        scrollTop: 500,
        clientHeight: 200,
        lineHeight: 20,
        paddingTop: 0,
        paddingBottom: 0,
      }),
    ).toBe(620);
  });

  it('keeps scroll when the caret is already visible', () => {
    expect(
      textareaScrollTopForCursor({
        value: '- item\n- ',
        cursor: 9,
        scrollTop: 0,
        clientHeight: 278,
        lineHeight: 20,
        paddingTop: 14,
        paddingBottom: 14,
      }),
    ).toBe(0);
  });

  it('scrolls up when the caret moves above the visible range', () => {
    expect(
      textareaScrollTopForCursor({
        value: 'top\n\n\n\n\n\n\nbottom',
        cursor: 0,
        scrollTop: 200,
        clientHeight: 80,
        lineHeight: 20,
        paddingTop: 0,
        paddingBottom: 0,
      }),
    ).toBe(0);
  });
});

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

  it('preserves tab indentation while continuing a nested list', () => {
    const value = '- Parent\n\t- Child';

    expect(
      getTextareaKeyEdit({
        value,
        selectionStart: value.length,
        selectionEnd: value.length,
        key: 'Enter',
      }),
    ).toEqual({ value: '- Parent\n\t- Child\n\t- ', cursor: value.length + 4 });
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

  it('continues bullet, checkbox, and numbered lists on enter', () => {
    const bullet = '- First item';
    expect(
      getTextareaKeyEdit({
        value: bullet,
        selectionStart: bullet.length,
        selectionEnd: bullet.length,
        key: 'Enter',
      }),
    ).toEqual({ value: '- First item\n- ', cursor: 15 });

    const checkbox = '- [x] Finished item';
    expect(
      getTextareaKeyEdit({
        value: checkbox,
        selectionStart: checkbox.length,
        selectionEnd: checkbox.length,
        key: 'Enter',
      }),
    ).toEqual({ value: '- [x] Finished item\n- [ ] ', cursor: 26 });

    const numbered = '8. Eighth item';
    expect(
      getTextareaKeyEdit({
        value: numbered,
        selectionStart: numbered.length,
        selectionEnd: numbered.length,
        key: 'Enter',
      }),
    ).toEqual({ value: '8. Eighth item\n9. ', cursor: 18 });
  });

  it('continues a list when enter splits an item', () => {
    const value = '- First and second';
    const cursor = value.indexOf(' and');

    expect(
      getTextareaKeyEdit({
        value,
        selectionStart: cursor,
        selectionEnd: cursor,
        key: 'Enter',
      }),
    ).toEqual({ value: '- First\n-  and second', cursor: 10 });
  });

  it('indents and outdents the current list item with tab and shift tab', () => {
    const value = '- Parent\n- Child';

    expect(
      getTextareaKeyEdit({
        value,
        selectionStart: value.length,
        selectionEnd: value.length,
        key: 'Tab',
      }),
    ).toEqual({ value: '- Parent\n\t- Child', cursor: value.length + 1 });

    const nested = '- Parent\n\t- Child';
    expect(
      getTextareaKeyEdit({
        value: nested,
        selectionStart: nested.length,
        selectionEnd: nested.length,
        key: 'Tab',
        shiftKey: true,
      }),
    ).toEqual({ value: '- Parent\n- Child', cursor: nested.length - 1 });
  });

  it('outdents an empty nested list item before ending the list', () => {
    const nested = '- Parent\n\t- ';
    expect(
      getTextareaKeyEdit({
        value: nested,
        selectionStart: nested.length,
        selectionEnd: nested.length,
        key: 'Enter',
      }),
    ).toEqual({ value: '- Parent\n- ', cursor: nested.length - 1 });

    const topLevel = '- Parent\n- ';
    expect(
      getTextareaKeyEdit({
        value: topLevel,
        selectionStart: topLevel.length,
        selectionEnd: topLevel.length,
        key: 'Enter',
      }),
    ).toEqual({ value: '- Parent\n', cursor: 9 });
  });

  it('ends empty checkbox items even when they have no trailing space', () => {
    for (const value of ['- [x]', '- [ ]']) {
      expect(
        getTextareaKeyEdit({
          value,
          selectionStart: value.length,
          selectionEnd: value.length,
          key: 'Enter',
        }),
      ).toEqual({ value: '', cursor: 0 });
    }
  });

  it('uses native shift enter behavior instead of creating another list item', () => {
    const value = '- First item';

    expect(
      getTextareaKeyEdit({
        value,
        selectionStart: value.length,
        selectionEnd: value.length,
        key: 'Enter',
        shiftKey: true,
      }),
    ).toBeNull();
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
