// Weights match PRD.md Section 7 exactly: urgency and responsibility dominate
// because a missed commitment (urgency) or a blocker you personally own
// (responsibility) matters more than who you're talking to or how old the
// loop is.
const WEIGHTS = {
  urgency: 0.3,
  responsibility: 0.25,
  counterpartyStakes: 0.2,
  staleness: 0.15,
  effortLeverage: 0.1,
};

// PRD.md does not specify numeric P0-P3 cutoffs, only qualitative
// descriptions (P0 "immediate or severe", P3 "low-impact administrative").
// These thresholds are a starting default meant to be tuned once real
// scored loops and user corrections exist.
const PRIORITY_THRESHOLDS = [
  { label: 'P0', min: 85 },
  { label: 'P1', min: 65 },
  { label: 'P2', min: 40 },
  { label: 'P3', min: 0 },
];

const CONFIDENCE_THRESHOLDS = {
  focus: 0.85,
  inbox: 0.6,
};

export function scorePriority(components) {
  let score = 0;

  for (const key of Object.keys(WEIGHTS)) {
    const value = components[key];
    if (typeof value !== 'number' || value < 0 || value > 100) {
      throw new RangeError(`${key} must be a number between 0 and 100`);
    }
    score += value * WEIGHTS[key];
  }

  return Math.round(score * 100) / 100;
}

export function labelForScore(score) {
  return PRIORITY_THRESHOLDS.find((threshold) => score >= threshold.min).label;
}

export function routeByConfidence(confidence) {
  if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
    throw new RangeError('confidence must be a number between 0 and 1');
  }

  if (confidence >= CONFIDENCE_THRESHOLDS.focus) {
    return 'focus';
  }

  if (confidence >= CONFIDENCE_THRESHOLDS.inbox) {
    return 'inbox';
  }

  return 'hidden';
}
