import { describe, expect, it } from 'vitest';
import { findDuplicateLoop } from './loopDedup.js';

const baseExisting = {
  id: 'loop-1',
  loopType: 'follow-up',
  counterpartyPersonId: 'person-1',
  createdAt: '2026-07-13T10:00:00.000Z',
  evidence: [{ sourceApp: 'gmail', sourceObjectId: 'msg-123' }],
};

describe('findDuplicateLoop', () => {
  it('matches on identical source evidence regardless of other fields', () => {
    const candidate = {
      loopType: 'promise',
      counterpartyPersonId: 'person-2',
      createdAt: '2026-08-01T00:00:00.000Z',
      evidence: [{ sourceApp: 'gmail', sourceObjectId: 'msg-123' }],
    };

    expect(findDuplicateLoop(candidate, [baseExisting])).toBe('loop-1');
  });

  it('matches on same counterparty, same type, within the time window', () => {
    const candidate = {
      loopType: 'follow-up',
      counterpartyPersonId: 'person-1',
      createdAt: '2026-07-13T14:00:00.000Z',
      evidence: [{ sourceApp: 'slack', sourceObjectId: 'thread-999' }],
    };

    expect(findDuplicateLoop(candidate, [baseExisting])).toBe('loop-1');
  });

  it('does not match the same counterparty and type outside the time window', () => {
    const candidate = {
      loopType: 'follow-up',
      counterpartyPersonId: 'person-1',
      createdAt: '2026-07-20T14:00:00.000Z',
      evidence: [{ sourceApp: 'slack', sourceObjectId: 'thread-999' }],
    };

    expect(findDuplicateLoop(candidate, [baseExisting])).toBeNull();
  });

  it('does not match the same counterparty with a different loop type', () => {
    const candidate = {
      loopType: 'decision',
      counterpartyPersonId: 'person-1',
      createdAt: '2026-07-13T11:00:00.000Z',
      evidence: [{ sourceApp: 'slack', sourceObjectId: 'thread-999' }],
    };

    expect(findDuplicateLoop(candidate, [baseExisting])).toBeNull();
  });

  it('does not match an unrelated candidate', () => {
    const candidate = {
      loopType: 'promise',
      counterpartyPersonId: 'person-9',
      createdAt: '2026-07-13T10:05:00.000Z',
      evidence: [{ sourceApp: 'gmail', sourceObjectId: 'msg-999' }],
    };

    expect(findDuplicateLoop(candidate, [baseExisting])).toBeNull();
  });

  it('respects a custom time window', () => {
    const candidate = {
      loopType: 'follow-up',
      counterpartyPersonId: 'person-1',
      createdAt: '2026-07-13T10:30:00.000Z',
      evidence: [{ sourceApp: 'slack', sourceObjectId: 'thread-999' }],
    };

    expect(findDuplicateLoop(candidate, [baseExisting], { windowMs: 10 * 60 * 1000 })).toBeNull();
  });

  it('returns null when there are no existing loops', () => {
    const candidate = {
      loopType: 'follow-up',
      counterpartyPersonId: 'person-1',
      createdAt: '2026-07-13T10:00:00.000Z',
      evidence: [{ sourceApp: 'gmail', sourceObjectId: 'msg-123' }],
    };

    expect(findDuplicateLoop(candidate, [])).toBeNull();
  });
});
