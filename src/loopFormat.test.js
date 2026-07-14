import { describe, expect, it } from 'vitest';
import { formatLoopAge } from './loopFormat.js';

describe('formatLoopAge', () => {
  it('formats same-day loops as "today"', () => {
    expect(formatLoopAge('2026-07-13T09:00:00.000Z', new Date('2026-07-13T18:00:00.000Z'))).toBe('today');
  });

  it('formats a loop from yesterday as "1 day"', () => {
    expect(formatLoopAge('2026-07-12T09:00:00.000Z', new Date('2026-07-13T09:00:00.000Z'))).toBe('1 day');
  });

  it('pluralizes multi-day ages', () => {
    expect(formatLoopAge('2026-07-08T09:00:00.000Z', new Date('2026-07-13T09:00:00.000Z'))).toBe('5 days');
  });
});
