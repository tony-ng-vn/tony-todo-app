import { describe, expect, it } from 'vitest';
import { shouldLoadWebTelemetry } from './webTelemetry.js';

describe('shouldLoadWebTelemetry', () => {
  it('loads on the public web app', () => {
    expect(shouldLoadWebTelemetry({ pathname: '/', nativeHost: false })).toBe(true);
    expect(shouldLoadWebTelemetry({ pathname: '/feedback', nativeHost: false })).toBe(true);
  });

  it('skips the menubar popover, where startup latency matters most', () => {
    expect(shouldLoadWebTelemetry({ pathname: '/menubar', nativeHost: false })).toBe(false);
    expect(shouldLoadWebTelemetry({ pathname: '/menubar/', nativeHost: false })).toBe(false);
  });

  it('skips every native host window', () => {
    expect(shouldLoadWebTelemetry({ pathname: '/', nativeHost: true })).toBe(false);
  });

  it('defaults to loading when the pathname is unknown', () => {
    expect(shouldLoadWebTelemetry({ pathname: undefined, nativeHost: false })).toBe(true);
  });
});
