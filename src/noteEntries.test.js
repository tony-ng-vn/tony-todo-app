import { describe, expect, it } from 'vitest';
import { dateAtSanFranciscoTime } from './sanFranciscoTime.js';
import {
  applyTodoNote,
  formatNoteAtLocal,
  parseNoteEntries,
  stripNoteStampsForEditor,
} from './noteEntries.js';

describe('parseNoteEntries', () => {
  it('splits multiple bullets under one legacy header into separate entries sharing that stamp', () => {
    const at = dateAtSanFranciscoTime('2026-08-13', 10 * 60 + 48).toISOString();

    expect(parseNoteEntries('@ 2026-08-13 10:48\n- a\n- b')).toEqual([
      { at, text: '- a' },
      { at, text: '- b' },
    ]);
  });

  it('parses two blank-line-separated stamped blocks into two entries with their own times', () => {
    const first = dateAtSanFranciscoTime('2026-06-08', 8 * 60).toISOString();
    const second = dateAtSanFranciscoTime('2026-06-08', 8 * 60 + 12).toISOString();

    expect(
      parseNoteEntries('@ 2026-06-08 08:00\nLeft voicemail\n\n@ 2026-06-08 08:12\nWaiting on callback'),
    ).toEqual([
      { at: first, text: 'Left voicemail' },
      { at: second, text: 'Waiting on callback' },
    ]);
  });

  it('parses unstamped text into one unstamped entry', () => {
    expect(parseNoteEntries('Ask about the deadline.')).toEqual([
      { at: null, text: 'Ask about the deadline.' },
    ]);
  });

  it('parses empty input to an empty list', () => {
    expect(parseNoteEntries('')).toEqual([]);
  });

  it('splits multiple unstamped bullets into separate unstamped entries', () => {
    expect(parseNoteEntries('- alpha\n- beta')).toEqual([
      { at: null, text: '- alpha' },
      { at: null, text: '- beta' },
    ]);
  });

  it('treats numbered and checkbox list items as their own units', () => {
    const at = dateAtSanFranciscoTime('2026-08-13', 9 * 60).toISOString();

    expect(parseNoteEntries('@ 2026-08-13 09:00\n1. First\n- [ ] Second')).toEqual([
      { at, text: '1. First' },
      { at, text: '- [ ] Second' },
    ]);
  });

  it('does not inherit a header stamp across a blank line to a later paragraph', () => {
    const at = dateAtSanFranciscoTime('2026-06-08', 8 * 60).toISOString();

    expect(parseNoteEntries('@ 2026-06-08 08:00\n- a\n- b\n\n- c')).toEqual([
      { at, text: '- a' },
      { at, text: '- b' },
      { at: null, text: '- c' },
    ]);
  });

  it('keeps marker-only units as unstamped entries in document order, even under a header', () => {
    const at = dateAtSanFranciscoTime('2026-08-13', 10 * 60).toISOString();

    expect(parseNoteEntries('@ 2026-08-13 10:00\n- a\n- \n- [ ]\n-')).toEqual([
      { at, text: '- a' },
      { at: null, text: '- ' },
      { at: null, text: '- [ ]' },
      { at: null, text: '-' },
    ]);
  });
});

describe('applyTodoNote bullet matching', () => {
  const first = new Date('2026-06-08T15:00:00.000Z');
  const later = new Date('2026-06-08T15:05:00.000Z');
  const now = new Date('2026-06-08T16:00:00.000Z');

  it('stamps only the newly added bullet when one is appended after an existing bullet', () => {
    const stored = applyTodoNote('', '- Call the vet', first);

    const next = applyTodoNote(stored, '- Call the vet\n- Buy dog food', now);

    expect(parseNoteEntries(next)).toEqual([
      { at: first.toISOString(), text: '- Call the vet' },
      { at: first.toISOString(), text: '- Buy dog food' },
    ]);
  });

  it('keeps the old time for a typo fix in a long bullet', () => {
    const stored = applyTodoNote('', '- Remember to pick up the dry cleaning before it closes', first);

    const next = applyTodoNote(stored, '- Remember to pick up the dry cleaning before it close', now);

    expect(parseNoteEntries(next)).toEqual([
      { at: first.toISOString(), text: '- Remember to pick up the dry cleaning before it close' },
    ]);
  });

  it('keeps the old time for a typo fix in a short two-token bullet', () => {
    const stored = applyTodoNote('', '- Cal mom', first);

    const next = applyTodoNote(stored, '- Call mom', now);

    expect(parseNoteEntries(next)).toEqual([{ at: first.toISOString(), text: '- Call mom' }]);
  });

  it('keeps the old time for a single-token typo', () => {
    const stored = applyTodoNote('', '- todo', first);

    const next = applyTodoNote(stored, '- todos', now);

    expect(parseNoteEntries(next)).toEqual([{ at: first.toISOString(), text: '- todos' }]);
  });

  it('keeps each original time when swapping the order of two dashes', () => {
    let stored = applyTodoNote('', '- Buy milk', first);
    stored = applyTodoNote(stored, '- Buy milk\n- Walk the dog', later);

    const next = applyTodoNote(stored, '- Walk the dog\n- Buy milk', now);

    expect(parseNoteEntries(next)).toEqual([
      { at: first.toISOString(), text: '- Walk the dog' },
      { at: first.toISOString(), text: '- Buy milk' },
    ]);
  });

  it('keeps the time when a bullet gets tab-indented', () => {
    const stored = applyTodoNote('', '- Water the plants', first);

    const next = applyTodoNote(stored, '\t- Water the plants', now);

    expect(parseNoteEntries(next)).toEqual([{ at: first.toISOString(), text: '\t- Water the plants' }]);
  });

  it('keeps the time when toggling a checkbox', () => {
    const stored = applyTodoNote('', '- [ ] Pack snacks', first);

    const next = applyTodoNote(stored, '- [x] Pack snacks', now);

    expect(parseNoteEntries(next)).toEqual([{ at: first.toISOString(), text: '- [x] Pack snacks' }]);
  });

  it('gives the first half of a split bullet the old time and the second half now, by document order', () => {
    const stored = applyTodoNote('', '- hello world', first);

    const next = applyTodoNote(stored, '- hello\n- world', now);

    expect(parseNoteEntries(next)).toEqual([
      { at: first.toISOString(), text: '- hello' },
      { at: first.toISOString(), text: '- world' },
    ]);
  });

  it('mints a new time when similarity is below threshold', () => {
    const stored = applyTodoNote('', '- a note', first);

    const next = applyTodoNote(stored, '- b note', now);

    expect(parseNoteEntries(next)).toEqual([{ at: first.toISOString(), text: '- b note' }]);
  });

  it('mints a new time when the replacement bullet reads too differently', () => {
    const stored = applyTodoNote('', '- Getting lunch now', first);

    const next = applyTodoNote(stored, '- Not getting lunch yet', now);

    expect(parseNoteEntries(next)).toEqual([{ at: first.toISOString(), text: '- Not getting lunch yet' }]);
  });

  // Enter-on-dash creates a fresh "- " line under the caret; the surviving
  // structural line must round-trip verbatim (including its trailing space)
  // or a reactive reseed from storage erases what the user just typed.
  it('keeps a trailing empty bullet as a bare unstamped line with its trailing space intact', () => {
    const stored = applyTodoNote('', '- a', first);

    const next = applyTodoNote(stored, '- a\n- ', now);

    expect(parseNoteEntries(next)).toEqual([
      { at: first.toISOString(), text: '- a' },
      { at: null, text: '- ' },
    ]);
    expect(next).toBe(`Start: ${formatNoteAtLocal(first)}\n- a\n- `);
    expect(stripNoteStampsForEditor(next)).toBe('- a\n- ');
  });

  it('keeps a middle empty dash between two real bullets through a strip-and-reapply round trip', () => {
    const stored = applyTodoNote('', '- a\n- \n- b', first);

    expect(parseNoteEntries(stored)).toEqual([
      { at: first.toISOString(), text: '- a' },
      { at: null, text: '- ' },
      { at: first.toISOString(), text: '- b' },
    ]);

    const stripped = stripNoteStampsForEditor(stored);
    expect(stripped).toBe('- a\n- \n- b');

    const next = applyTodoNote(stored, stripped, now);

    expect(parseNoteEntries(next)).toEqual([
      { at: first.toISOString(), text: '- a' },
      { at: null, text: '- ' },
      { at: first.toISOString(), text: '- b' },
    ]);
  });

  it('stores a note that is only an empty bullet as the bare line itself, never wiped to empty', () => {
    const stored = applyTodoNote('', '- ', now);

    expect(stored).toBe('- ');
    expect(parseNoteEntries(stored)).toEqual([{ at: null, text: '- ' }]);
    expect(stripNoteStampsForEditor(stored)).toBe('- ');
  });

  it('does not let an empty unit steal a stamp or corrupt matching with NaN', () => {
    const stored = applyTodoNote('', '- Call the vet', first);

    const withEmpty = applyTodoNote(stored, '- \n- Call the vet', now);
    const withoutEmpty = applyTodoNote(stored, '- Call the vet', now);

    expect(withEmpty).not.toContain('NaN');
    const emptyEntry = parseNoteEntries(withEmpty).find((entry) => entry.text === '- ');
    const realEntry = parseNoteEntries(withEmpty).find((entry) => entry.text === '- Call the vet');

    expect(emptyEntry.at).toBeNull();
    expect(realEntry.at).toBe(parseNoteEntries(withoutEmpty)[0].at);
  });

  it('keeps remaining dashes times when one dash is deleted', () => {
    let stored = applyTodoNote('', '- Buy milk', first);
    stored = applyTodoNote(stored, '- Buy milk\n- Walk the dog', later);

    const next = applyTodoNote(stored, '- Buy milk', now);

    expect(parseNoteEntries(next)).toEqual([{ at: first.toISOString(), text: '- Buy milk' }]);
  });

  it('rewrites a legacy multi-dash chunk as one closed session without minting new times', () => {
    const legacyAt = dateAtSanFranciscoTime('2026-06-08', 8 * 60).toISOString();
    const legacyStored = '@ 2026-06-08 08:00\n- a\n- b\n- c';

    const next = applyTodoNote(legacyStored, legacyStored, now);

    expect(parseNoteEntries(next)).toEqual([
      { at: legacyAt, text: '- a' },
      { at: legacyAt, text: '- b' },
      { at: legacyAt, text: '- c' },
    ]);
    expect(next).toBe(`Start: ${formatNoteAtLocal(legacyAt)}\n- a\n- b\n- c\nEnd: ${formatNoteAtLocal(legacyAt)}`);
  });

  // Legacy notes carry one "@" header per bullet. Consecutive headers are one
  // closed block: the first edit rewrites them as a single session running
  // from the first stamp to the last, and new text opens a fresh session at
  // now instead of being filed under the old stamps.
  it('rewrites a run of per-bullet legacy stamps as one closed session and files new text under now', () => {
    const firstStamp = dateAtSanFranciscoTime('2026-06-08', 10 * 60).toISOString();
    const lastStamp = dateAtSanFranciscoTime('2026-06-08', 10 * 60 + 7).toISOString();
    const legacyStored = '@ 2026-06-08 10:00\n- a\n\n@ 2026-06-08 10:03\n- b\n\n@ 2026-06-08 10:07\n- c';

    const next = applyTodoNote(legacyStored, '- a\n- b\n- c\n- d', now);

    expect(next).toBe(
      `Start: ${formatNoteAtLocal(firstStamp)}\n- a\n- b\n- c\nEnd: ${formatNoteAtLocal(lastStamp)}\n\nStart: ${formatNoteAtLocal(now)}\n- d`,
    );
    expect(parseNoteEntries(next)).toEqual([
      { at: firstStamp, text: '- a' },
      { at: firstStamp, text: '- b' },
      { at: firstStamp, text: '- c' },
      { at: now.toISOString(), text: '- d' },
    ]);
  });

  it('keeps already-correct per-bullet notes byte-identical on parse and reapply', () => {
    const stored = `Start: ${formatNoteAtLocal(first)}\n- Buy milk\n\nStart: ${formatNoteAtLocal(later)}\n- Walk the dog`;

    expect(applyTodoNote(stored, stored, now)).toBe(stored);
  });

  it('round trips through stripNoteStampsForEditor without minting new times', () => {
    let stored = applyTodoNote('', '- Buy milk', first);
    stored = applyTodoNote(stored, '- Buy milk\n- Walk the dog', later);

    const stripped = stripNoteStampsForEditor(stored);
    const next = applyTodoNote(stored, stripped, now);

    expect(next).toBe(stored);
  });

  // Regression: nextNote built by appending fresh text onto the previous
  // stored note (the appendNote flow) carries the untouched bullet through
  // as a pass-through entry (it already has its header). Passes A-D must not
  // also hand that same previous-side bullet to a similar new bullet, or the
  // still-present original loses its claim on its own time.
  it('does not let a newly appended similar bullet steal the still-present original bullet\'s time', () => {
    const stored = applyTodoNote('', '- call mom', first);

    const next = applyTodoNote(stored, `${stored}\n\n- call mom later tonight`, now);

    expect(parseNoteEntries(next)).toEqual([
      { at: first.toISOString(), text: '- call mom' },
      { at: first.toISOString(), text: '- call mom later tonight' },
    ]);
  });

  it('does not let an appended duplicate bullet steal the still-present original bullet\'s time', () => {
    const stored = applyTodoNote('', '- call bank', first);

    const next = applyTodoNote(stored, `${stored}\n\n- call bank`, now);

    expect(parseNoteEntries(next)).toEqual([
      { at: first.toISOString(), text: '- call bank' },
      { at: first.toISOString(), text: '- call bank' },
    ]);
  });

  // splitChunkIntoUnits only stamps paragraph 0 of a legacy chunk; a later
  // paragraph parses as at: null. Matching such a unit must not carry that
  // null forward forever - only an empty structural line is allowed to stay
  // unstamped.
  it('stamps a matched legacy-unstamped unit instead of leaving it unstamped forever', () => {
    const stored = `@ ${formatNoteAtLocal(first)}\n- a\n\n- b`;

    expect(parseNoteEntries(stored)).toEqual([
      { at: first.toISOString(), text: '- a' },
      { at: null, text: '- b' },
    ]);

    const next = applyTodoNote(stored, '- a\n- b', now);

    expect(parseNoteEntries(next)).toEqual([
      { at: first.toISOString(), text: '- a' },
      { at: first.toISOString(), text: '- b' },
    ]);
    expect(next).toBe(`Start: ${formatNoteAtLocal(first)}\n- a\n- b\nEnd: ${formatNoteAtLocal(first)}`);
  });

  it('still serializes an empty structural bullet bare while backfilling a legacy-unstamped unit', () => {
    const stored = `@ ${formatNoteAtLocal(first)}\n- a\n\n- b`;

    const next = applyTodoNote(stored, '- a\n- b\n- ', now);

    expect(parseNoteEntries(next)).toEqual([
      { at: first.toISOString(), text: '- a' },
      { at: first.toISOString(), text: '- b' },
      { at: null, text: '- ' },
    ]);
  });
});

describe('stripNoteStampsForEditor', () => {
  it('returns a tight list of bullet lines with no stamps or blank separators', () => {
    const stored = '@ 2026-06-08 08:00\n- Buy milk\n\n@ 2026-06-08 08:05\n- Walk the dog';

    expect(stripNoteStampsForEditor(stored)).toBe('- Buy milk\n- Walk the dog');
  });
});
