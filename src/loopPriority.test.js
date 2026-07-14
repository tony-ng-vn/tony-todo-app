import { describe, expect, it } from 'vitest';
import { labelForScore, routeByConfidence, scorePriority } from './loopPriority.js';

describe('scorePriority', () => {
  it('weights urgency at 0.30, responsibility at 0.25, counterparty stakes at 0.20, staleness at 0.15, effort leverage at 0.10', () => {
    expect(
      scorePriority({
        urgency: 100,
        responsibility: 0,
        counterpartyStakes: 0,
        staleness: 0,
        effortLeverage: 0,
      }),
    ).toBe(30);

    expect(
      scorePriority({
        urgency: 0,
        responsibility: 100,
        counterpartyStakes: 0,
        staleness: 0,
        effortLeverage: 0,
      }),
    ).toBe(25);

    expect(
      scorePriority({
        urgency: 0,
        responsibility: 0,
        counterpartyStakes: 100,
        staleness: 0,
        effortLeverage: 0,
      }),
    ).toBe(20);

    expect(
      scorePriority({
        urgency: 0,
        responsibility: 0,
        counterpartyStakes: 0,
        staleness: 100,
        effortLeverage: 0,
      }),
    ).toBe(15);

    expect(
      scorePriority({
        urgency: 0,
        responsibility: 0,
        counterpartyStakes: 0,
        staleness: 0,
        effortLeverage: 100,
      }),
    ).toBe(10);
  });

  it('sums weighted components for a mixed input', () => {
    expect(
      scorePriority({
        urgency: 80,
        responsibility: 60,
        counterpartyStakes: 40,
        staleness: 20,
        effortLeverage: 100,
      }),
    ).toBe(24 + 15 + 8 + 3 + 10);
  });

  it('rejects a component outside the 0-100 range', () => {
    expect(() =>
      scorePriority({
        urgency: 150,
        responsibility: 0,
        counterpartyStakes: 0,
        staleness: 0,
        effortLeverage: 0,
      }),
    ).toThrow(RangeError);
  });

  it('rejects a missing component', () => {
    expect(() =>
      scorePriority({
        urgency: 50,
        responsibility: 50,
        counterpartyStakes: 50,
        staleness: 50,
      }),
    ).toThrow(RangeError);
  });
});

describe('labelForScore', () => {
  it('labels 85 and above as P0', () => {
    expect(labelForScore(85)).toBe('P0');
    expect(labelForScore(100)).toBe('P0');
  });

  it('labels 65-84 as P1', () => {
    expect(labelForScore(65)).toBe('P1');
    expect(labelForScore(84)).toBe('P1');
  });

  it('labels 40-64 as P2', () => {
    expect(labelForScore(40)).toBe('P2');
    expect(labelForScore(64)).toBe('P2');
  });

  it('labels below 40 as P3', () => {
    expect(labelForScore(39)).toBe('P3');
    expect(labelForScore(0)).toBe('P3');
  });
});

describe('routeByConfidence', () => {
  it('routes 0.85 and above to focus', () => {
    expect(routeByConfidence(0.85)).toBe('focus');
    expect(routeByConfidence(1)).toBe('focus');
  });

  it('routes 0.60-0.84 to inbox', () => {
    expect(routeByConfidence(0.6)).toBe('inbox');
    expect(routeByConfidence(0.84)).toBe('inbox');
  });

  it('routes below 0.60 to hidden', () => {
    expect(routeByConfidence(0.59)).toBe('hidden');
    expect(routeByConfidence(0)).toBe('hidden');
  });

  it('rejects a confidence outside 0-1', () => {
    expect(() => routeByConfidence(1.5)).toThrow(RangeError);
    expect(() => routeByConfidence(-0.1)).toThrow(RangeError);
  });
});
