// Notes are stored as timer session blocks:
//   Start: YYYY-MM-DD HH:mm
//   - bullet
//   End: YYYY-MM-DD HH:mm
// Session headings mirror the task timer: Start/Pause/complete write them,
// every line typed in between belongs to the open session, and an edit never
// removes a session heading (an emptied session keeps its Start/End pair).
// The editor shows exactly the stored note minus its heading lines - blank
// lines inside a session are the user's and round-trip verbatim; the blank
// line between two stored blocks is cosmetic and never reaches the editor.
// Legacy "@ YYYY-MM-DD HH:mm" notes: one run of consecutive "@" chunks parses
// as a single closed block, kept verbatim by timer operations and rewritten
// as one Start/End pair (first stamp to last stamp) by the first edit.
import { dateAtSanFranciscoTime, getSanFranciscoDateTimeParts } from './sanFranciscoTime.js';

const LOCAL_TIME_PATTERN = '(\\d{4}-\\d{2}-\\d{2}) (\\d{2}):(\\d{2})';
const NOTE_STAMP_PATTERN = new RegExp(`^@ ${LOCAL_TIME_PATTERN}\\s*$`);
const START_HEADING_PATTERN = new RegExp(`^Start:\\s+${LOCAL_TIME_PATTERN}\\s*$`);
const END_HEADING_PATTERN = new RegExp(`^End:\\s+${LOCAL_TIME_PATTERN}\\s*$`);
const LIST_MARKER_PATTERN = /^(?:[-*+]|\d+[.)])(?:[\t ]+([\s\S]*))?$/;
const CHECKBOX_PATTERN = /^\[[ xX]\](?:[\t ]+([\s\S]*))?$/;
const SIMILARITY_THRESHOLD = 0.5;
const TOKEN_MATCH_RATIO = 0.75;
const NEW_BLOCK_INDEX = -1;

export function formatNoteAtLocal(date) {
  const parts = getSanFranciscoDateTimeParts(new Date(date));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

// Visible note lines only: blank lines are structure for the editor, not notes.
export function parseNoteEntries(note) {
  return flattenNoteTimeBlocks(parseNoteTimeBlocks(note))
    .filter((entry) => entry.text.trim())
    .map((entry) => ({ at: entry.at, text: entry.text }));
}

export function parseNoteTimeBlocks(note) {
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

  function finishBlock() {
    if (!current) {
      return;
    }
    // Empty lines at the end of a block only separate it from the next one;
    // a user's blank line at a session boundary is stored after the next
    // Start heading instead (see placeEmptyUnits). Whitespace-only lines are
    // content: an auto-indented "\t" line is where the caret sits.
    while (current.lines.at(-1) === '') {
      current.lines.pop();
    }
    blocks.push(current);
    current = null;
  }

  for (const line of raw.split('\n')) {
    const startAt = matchLocalHeading(line, START_HEADING_PATTERN);
    if (startAt) {
      finishBlock();
      current = { startedAt: startAt, endedAt: null, kind: 'session', lines: [] };
      continue;
    }

    const stampAt = matchLocalHeading(line, NOTE_STAMP_PATTERN);
    if (stampAt) {
      if (current?.kind === 'stamp') {
        // A run of "@" chunks is one legacy block; the inner header lines
        // stay in `lines` so the run serializes back verbatim.
        current.lines.push(line);
        current.endedAt = stampAt;
        continue;
      }
      finishBlock();
      current = { startedAt: stampAt, endedAt: stampAt, kind: 'stamp', lines: [] };
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
      finishBlock();
      continue;
    }

    if (line === '' && !current) {
      continue;
    }

    if (!current) {
      current = { startedAt: null, endedAt: null, kind: 'plain', lines: [] };
    }
    current.lines.push(line);
  }

  finishBlock();
  return blocks;
}

export function openNoteTimeBlock(note, startedAt) {
  const startedAtIso = new Date(startedAt).toISOString();
  const blocks = parseNoteTimeBlocks(note);
  const open = findOpenBlock(blocks);
  if (open) {
    if (!open.startedAt) {
      open.startedAt = startedAtIso;
      open.kind = 'session';
    }
    return serializeNoteTimeBlocks(blocks);
  }

  blocks.push({ startedAt: startedAtIso, endedAt: null, kind: 'session', lines: [] });
  return serializeNoteTimeBlocks(blocks);
}

export function closeNoteTimeBlock(note, endedAt) {
  const endedAtIso = new Date(endedAt).toISOString();
  const blocks = parseNoteTimeBlocks(note);
  const open = findOpenBlock(blocks);
  if (!open) {
    return serializeNoteTimeBlocks(blocks);
  }

  if (!open.startedAt) {
    open.startedAt = endedAtIso;
  }
  open.endedAt = endedAtIso;
  open.kind = 'session';
  return serializeNoteTimeBlocks(blocks);
}

// Agent path: text lands under the open session, or opens one at `now`.
export function appendNoteText(note, text, now = new Date()) {
  const blocks = parseNoteTimeBlocks(note);
  const lines = String(text).split('\n');
  const open = findOpenBlock(blocks);
  if (open) {
    if (!open.startedAt) {
      open.startedAt = now.toISOString();
      open.kind = 'session';
    }
    open.lines.push(...lines);
  } else {
    blocks.push({ startedAt: now.toISOString(), endedAt: null, kind: 'session', lines });
  }
  return serializeNoteTimeBlocks(blocks);
}

function serializeNoteTimeBlocks(blocks) {
  return blocks
    .map((block) => {
      const parts = [];
      if (block.kind === 'stamp') {
        parts.push(`@ ${formatNoteAtLocal(block.startedAt)}`);
      } else if (block.startedAt) {
        parts.push(`Start: ${formatNoteAtLocal(block.startedAt)}`);
      }
      parts.push(...block.lines);
      if (block.kind !== 'stamp' && block.endedAt) {
        parts.push(`End: ${formatNoteAtLocal(block.endedAt)}`);
      }
      return parts.join('\n');
    })
    .filter(Boolean)
    .join('\n\n');
}

// True for a unit with no visible content once its marker/checkbox is
// stripped ("- ", "-", "- [ ]", or a blank line). These are real structural
// units - kept in storage and in the editor - but they are never matched
// and never carry a time of their own.
export function isEmptyNoteUnitText(text) {
  return normalizeUnitText(text) === '';
}

// nextNote is normally plain editor text (no headings), but a caller may
// also pass stored text, so units that already carry a heading from parsing
// pass through unchanged; only unstamped units go through identity matching
// against previousNote.
export function applyTodoNote(previousNote, nextNote, now = new Date()) {
  const previousBlocks = parseNoteTimeBlocks(previousNote);
  const nextEntries = flattenNoteTimeBlocks(parseNoteTimeBlocks(nextNote));

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
      // Empty structural unit: placed next to its neighbors once every
      // real unit knows its block.
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
    resolved[item.index] = assignToOpenBlock(item.entry.text, previousBlocks, now);
  }

  // A unit can match a previous unit that itself has no time: a legacy "@"
  // chunk only stamps its first paragraph, and a plain (never stamped) note
  // has none at all. A non-empty unit must not stay unstamped forever, so it
  // takes its block's start when it has one and the open block (or now)
  // otherwise.
  for (let index = 0; index < resolved.length; index += 1) {
    const entry = resolved[index];
    if (!entry || entry.at || isEmptyNoteUnitText(entry.text)) {
      continue;
    }
    resolved[index] = entry.startedAt
      ? { ...entry, at: entry.startedAt }
      : assignToOpenBlock(entry.text, previousBlocks, now);
  }

  placeEmptyUnits(nextEntries, resolved, previousBlocks);

  return serializeResolvedTimeBlocks(resolved, previousBlocks);
}

// Editor draft: the stored note with every heading line removed. Blank
// lines inside a session survive; blank lines between blocks do not exist
// once parsed, so sessions read as one continuous list unless the user
// separated them.
export function stripNoteStampsForEditor(storedNote) {
  return flattenNoteTimeBlocks(parseNoteTimeBlocks(storedNote))
    .map((entry) => entry.text)
    .join('\n');
}

// A next entry that already carries a heading (parsed straight from stored
// text, e.g. the untouched part of a note passed back in whole) skips
// matching entirely and keeps its own time - but its previous-side
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

// One unit per line. Session and plain blocks keep every line verbatim
// (blank lines included, with no time of their own); a legacy stamp block
// is re-split into its "@" chunks so each bullet reports the time of the
// header it sat under.
function flattenNoteTimeBlocks(blocks) {
  return blocks.flatMap((block, blockIndex) => {
    const meta = {
      blockIndex,
      kind: block.kind,
      startedAt: block.startedAt,
      endedAt: block.endedAt,
    };

    if (block.kind === 'stamp') {
      return splitLegacyChunks(block).flatMap((chunk) =>
        splitChunkIntoUnits(chunk.text, chunk.at).map((unit) => ({ ...unit, ...meta })),
      );
    }

    return block.lines.map((line) => ({
      at: block.startedAt && !isEmptyNoteUnitText(line) ? block.startedAt : null,
      text: line,
      ...meta,
    }));
  });
}

function splitLegacyChunks(block) {
  const chunks = [{ at: block.startedAt, lines: [] }];
  for (const line of block.lines) {
    const stampAt = matchLocalHeading(line, NOTE_STAMP_PATTERN);
    if (stampAt) {
      chunks.push({ at: stampAt, lines: [] });
      continue;
    }
    chunks.at(-1).lines.push(line);
  }
  return chunks.map((chunk) => ({ at: chunk.at, text: chunk.lines.join('\n') }));
}

// The block a timer operation acts on: the last one that is still open
// (a session without End, or plain text that never had a heading). Legacy
// stamp blocks are always closed history.
function findOpenBlock(blocks) {
  const index = findOpenBlockIndex(blocks);
  return index === NEW_BLOCK_INDEX ? null : blocks[index];
}

function findOpenBlockIndex(blocks) {
  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    if (blocks[index].kind !== 'stamp' && !blocks[index].endedAt) {
      return index;
    }
  }
  return NEW_BLOCK_INDEX;
}

function copyResolvedUnit(source, text) {
  return { ...source, text };
}

function assignToOpenBlock(text, previousBlocks, now) {
  const openIndex = findOpenBlockIndex(previousBlocks);
  const openBlock = openIndex === NEW_BLOCK_INDEX ? null : previousBlocks[openIndex];
  const startedAt = openBlock?.startedAt ?? now.toISOString();
  return {
    at: startedAt,
    text,
    blockIndex: openBlock ? openIndex : NEW_BLOCK_INDEX,
    kind: 'session',
    startedAt,
    endedAt: null,
  };
}

// An empty unit sits in the block of the unit right below it (a blank line
// separating two sessions belongs to the session it introduces), else the
// last real unit above it, else the open block. A draft made only of empty
// units stays a bare plain note - it never opens a session on its own.
function placeEmptyUnits(nextEntries, resolved, previousBlocks) {
  const openIndex = findOpenBlockIndex(previousBlocks);
  const openBlock = openIndex === NEW_BLOCK_INDEX ? null : previousBlocks[openIndex];

  for (let index = resolved.length - 1; index >= 0; index -= 1) {
    if (resolved[index]) {
      continue;
    }
    const neighbor = resolved[index + 1] ?? resolved.slice(0, index).findLast(Boolean) ?? null;
    const source = neighbor ?? {
      blockIndex: openBlock ? openIndex : NEW_BLOCK_INDEX,
      kind: openBlock?.kind ?? 'plain',
      startedAt: openBlock?.startedAt ?? null,
      endedAt: null,
    };
    resolved[index] = {
      at: null,
      text: nextEntries[index].text,
      blockIndex: source.blockIndex,
      kind: source.kind,
      startedAt: source.startedAt,
      endedAt: source.endedAt,
    };
  }
}

// Consecutive units of the same block form one run; a session block that
// received no units at all still keeps its Start/End pair, in place, so the
// note's headings keep matching the timer history.
function serializeResolvedTimeBlocks(resolved, previousBlocks) {
  const runs = [];
  for (const entry of resolved) {
    const last = runs.at(-1);
    if (last && last.blockIndex === entry.blockIndex && last.startedAt === entry.startedAt) {
      last.lines.push(entry.text);
      continue;
    }
    runs.push({
      blockIndex: entry.blockIndex,
      // A legacy run rewrites as one closed session, first stamp to last.
      kind: entry.kind === 'plain' ? 'plain' : 'session',
      startedAt: entry.startedAt,
      endedAt: entry.endedAt,
      lines: [entry.text],
    });
  }

  previousBlocks.forEach((block, blockIndex) => {
    if (block.kind !== 'session' || runs.some((run) => run.blockIndex === blockIndex)) {
      return;
    }
    const empty = { blockIndex, kind: 'session', startedAt: block.startedAt, endedAt: block.endedAt, lines: [] };
    const nextRun = runs.findIndex((run) => run.blockIndex === NEW_BLOCK_INDEX || run.blockIndex > blockIndex);
    runs.splice(nextRun === -1 ? runs.length : nextRun, 0, empty);
  });

  return serializeNoteTimeBlocks(runs);
}

// Within one legacy chunk, blank lines still delimit paragraphs; only the
// first paragraph inherits the chunk's header stamp (matches how free text
// was stamped). Every non-blank line in a paragraph is its own unit; blank
// lines are dropped, as the legacy editor never showed them either. A
// marker-only line ("- ") is still a real unit (kept in document order,
// e.g. between two stamped bullets) - it just never carries a stamp.
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
