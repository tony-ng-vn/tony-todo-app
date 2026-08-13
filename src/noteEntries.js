// Notes are stored as text with "@ YYYY-MM-DD HH:mm" stamp headers, one per
// bullet (list item) or free-text line. Every stampable unit keeps its own
// time, tracked by matching text identity rather than array position, so
// reordering or editing bullets does not steal or smear timestamps.
import { dateAtSanFranciscoTime, getSanFranciscoDateTimeParts } from './sanFranciscoTime.js';

const NOTE_STAMP_PATTERN = /^@ (\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2})\s*$/;
const LIST_MARKER_PATTERN = /^(?:[-*+]|\d+[.)])(?:[\t ]+([\s\S]*))?$/;
const CHECKBOX_PATTERN = /^\[[ xX]\](?:[\t ]+([\s\S]*))?$/;
const SIMILARITY_THRESHOLD = 0.5;
const TOKEN_MATCH_RATIO = 0.75;

export function formatNoteAtLocal(date) {
  const parts = getSanFranciscoDateTimeParts(new Date(date));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

export function parseNoteEntries(note) {
  const raw = String(note ?? '').replace(/\s+$/, '');
  if (!raw) {
    return [];
  }

  return splitIntoStampedChunks(raw).flatMap((chunk) => splitChunkIntoUnits(chunk.text, chunk.at));
}

// nextNote is normally plain editor text (no "@ " headers), but existing
// callers build it by appending fresh text onto the previous stored note, so
// units that already carry a header from parsing pass through unchanged;
// only unstamped units go through identity matching against previousNote.
export function applyTodoNote(previousNote, nextNote, now = new Date()) {
  const nextEntries = parseNoteEntries(nextNote);
  if (nextEntries.length === 0) {
    return '';
  }

  const previousUnits = parseNoteEntries(previousNote).map((entry, index) => ({
    entry,
    index,
    normalized: normalizeUnitText(entry.text),
    used: false,
  }));

  const resolved = new Array(nextEntries.length).fill(null);
  const pending = [];
  nextEntries.forEach((entry, index) => {
    if (entry.at) {
      resolved[index] = entry;
      return;
    }
    pending.push({ entry, index, normalized: normalizeUnitText(entry.text) });
  });

  matchUniquePairs(pending, previousUnits, resolved);
  matchFirstAvailableByText(pending, previousUnits, resolved);
  matchBySimilarity(pending, previousUnits, resolved);

  for (const item of pending) {
    if (resolved[item.index]) {
      continue;
    }
    resolved[item.index] = { at: now.toISOString(), text: item.entry.text };
  }

  return serializeNoteEntries(resolved);
}

// Editor draft with no "@ " headers and no blank separators between bullets,
// so applyTodoNote can re-match this text against the stored note by identity.
export function stripNoteStampsForEditor(storedNote) {
  return parseNoteEntries(storedNote)
    .map((entry) => entry.text)
    .join('\n');
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
    resolved[item.index] = { at: match.entry.at, text: item.entry.text };
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
    resolved[item.index] = { at: match.entry.at, text: item.entry.text };
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
    resolved[item.index] = { at: best.entry.at, text: item.entry.text };
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

// Groups lines by "@ " header, same shape as the pre-bullet-granularity
// parser: a header flushes the current chunk and starts a new one, so a
// header line can never itself become unit text.
function splitIntoStampedChunks(raw) {
  const chunks = [];
  let current = { at: null, lines: [] };

  function flush() {
    const text = current.lines.join('\n').replace(/^\n+|\n+$/g, '');
    if (current.at || text.trim()) {
      chunks.push({ at: current.at, text });
    }
    current = { at: null, lines: [] };
  }

  for (const line of raw.split('\n')) {
    const match = line.match(NOTE_STAMP_PATTERN);
    if (match) {
      flush();
      current.at = dateAtSanFranciscoTime(match[1], Number(match[2]) * 60 + Number(match[3])).toISOString();
      continue;
    }
    current.lines.push(line);
  }

  flush();
  return chunks;
}

// Within one chunk, blank lines still delimit paragraphs; only the first
// paragraph inherits the chunk's header stamp (matches legacy behavior for
// free text). Every non-blank line in a paragraph is its own unit - the fix
// for bullets that used to share one stamp per chunk.
function splitChunkIntoUnits(text, at) {
  const paragraphs = text.split(/\n{2,}/).map((paragraph) => paragraph.replace(/^\n+|\n+$/g, ''));

  const units = [];
  paragraphs.forEach((paragraph, paragraphIndex) => {
    const paragraphAt = paragraphIndex === 0 ? at : null;
    for (const line of paragraph.split('\n')) {
      if (!line.trim()) {
        continue;
      }
      if (!normalizeUnitText(line)) {
        // marker-only bullet ("- "): never stamped, never persisted
        continue;
      }
      units.push({ at: paragraphAt, text: line });
    }
  });

  return units;
}

function serializeNoteEntries(entries) {
  return entries
    .filter((entry) => entry && entry.text.trim())
    .map((entry) => (entry.at ? `@ ${formatNoteAtLocal(entry.at)}\n${entry.text}` : entry.text))
    .join('\n\n');
}
