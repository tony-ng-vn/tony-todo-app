// Notes are stored as timer session blocks:
//   Start: YYYY-MM-DD HH:mm
//   - bullet
//   End: YYYY-MM-DD HH:mm
// Legacy "@ YYYY-MM-DD HH:mm" headers still parse. Editor drafts strip both
// kinds of headings; identity matching keeps bullets in their original block
// when the user reorders or edits them.
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

export function parseNoteEntries(note) {
  return flattenNoteTimeBlocks(parseNoteTimeBlocks(note)).map((entry) => ({
    at: entry.at,
    text: entry.text,
  }));
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

export function openNoteTimeBlock(note, startedAt) {
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

export function closeNoteTimeBlock(note, endedAt) {
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

export function serializeNoteTimeBlocks(blocks) {
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
export function isEmptyNoteUnitText(text) {
  return normalizeUnitText(text) === '';
}

// nextNote is normally plain editor text (no "@ " headers), but existing
// callers build it by appending fresh text onto the previous stored note, so
// units that already carry a header from parsing pass through unchanged;
// only unstamped units go through identity matching against previousNote.
export function applyTodoNote(previousNote, nextNote, now = new Date()) {
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
export function stripNoteStampsForEditor(storedNote) {
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

