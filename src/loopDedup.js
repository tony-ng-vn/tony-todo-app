// PRD FR-5: duplicate references to the same open loop must merge into one
// canonical object. Two heuristics, cheapest and most certain first:
//   1. Identical evidence (same source app + object id) is always the same
//      loop, no matter what else differs.
//   2. Same counterparty and loop type within a short window is *probably*
//      the same commitment surfacing in a second channel (e.g. a Slack
//      thread about the same follow-up already captured from Gmail).
const DEFAULT_WINDOW_MS = 24 * 60 * 60 * 1000;

export function findDuplicateLoop(candidate, existingLoops, { windowMs = DEFAULT_WINDOW_MS } = {}) {
  const exactMatch = existingLoops.find((existing) => hasMatchingEvidence(candidate, existing));
  if (exactMatch) {
    return exactMatch.id;
  }

  const candidateTime = new Date(candidate.createdAt).getTime();
  const probableMatch = existingLoops.find((existing) => {
    if (existing.loopType !== candidate.loopType) {
      return false;
    }
    if (existing.counterpartyPersonId !== candidate.counterpartyPersonId) {
      return false;
    }
    return Math.abs(candidateTime - new Date(existing.createdAt).getTime()) <= windowMs;
  });

  return probableMatch?.id ?? null;
}

function hasMatchingEvidence(candidate, existing) {
  return candidate.evidence.some((candidateEvidence) =>
    existing.evidence.some(
      (existingEvidence) =>
        existingEvidence.sourceApp === candidateEvidence.sourceApp &&
        existingEvidence.sourceObjectId === candidateEvidence.sourceObjectId,
    ),
  );
}
