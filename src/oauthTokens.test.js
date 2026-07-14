import { describe, expect, it } from 'vitest';
import { isTokenExpired, needsRefresh, secondsUntilExpiry } from './oauthTokens.js';

describe('isTokenExpired', () => {
  it('returns true when expiresAt is in the past', () => {
    expect(isTokenExpired('2026-07-13T10:00:00.000Z', new Date('2026-07-13T10:00:01.000Z'))).toBe(true);
  });

  it('returns false when expiresAt is in the future', () => {
    expect(isTokenExpired('2026-07-13T10:00:00.000Z', new Date('2026-07-13T09:59:59.000Z'))).toBe(false);
  });

  it('returns true when expiresAt is null (no known expiry treated as expired)', () => {
    expect(isTokenExpired(null, new Date('2026-07-13T10:00:00.000Z'))).toBe(true);
  });
});

describe('needsRefresh', () => {
  it('returns true when within the default 5 minute buffer of expiry', () => {
    expect(needsRefresh('2026-07-13T10:05:00.000Z', new Date('2026-07-13T10:01:00.000Z'))).toBe(true);
  });

  it('returns false when well before the buffer window', () => {
    expect(needsRefresh('2026-07-13T10:30:00.000Z', new Date('2026-07-13T10:01:00.000Z'))).toBe(false);
  });

  it('respects a custom buffer', () => {
    expect(
      needsRefresh('2026-07-13T10:10:00.000Z', new Date('2026-07-13T10:01:00.000Z'), { bufferSeconds: 60 }),
    ).toBe(false);
    expect(
      needsRefresh('2026-07-13T10:01:30.000Z', new Date('2026-07-13T10:01:00.000Z'), { bufferSeconds: 60 }),
    ).toBe(true);
  });

  it('returns true for a null expiry', () => {
    expect(needsRefresh(null, new Date('2026-07-13T10:00:00.000Z'))).toBe(true);
  });
});

describe('secondsUntilExpiry', () => {
  it('returns a positive count for a future expiry', () => {
    expect(secondsUntilExpiry('2026-07-13T10:01:00.000Z', new Date('2026-07-13T10:00:00.000Z'))).toBe(60);
  });

  it('returns a negative count for a past expiry', () => {
    expect(secondsUntilExpiry('2026-07-13T09:59:00.000Z', new Date('2026-07-13T10:00:00.000Z'))).toBe(-60);
  });

  it('returns null when expiresAt is null', () => {
    expect(secondsUntilExpiry(null, new Date('2026-07-13T10:00:00.000Z'))).toBeNull();
  });
});
