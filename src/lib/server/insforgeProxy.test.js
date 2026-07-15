import { describe, expect, it } from 'vitest';
import { stripCookieDomain } from './insforgeProxy.js';

describe('stripCookieDomain', () => {
  it('removes a Domain attribute so the cookie becomes host-only', () => {
    const input = 'insforge_refresh=abc123; Domain=y26ze9je.us-east.insforge.app; Path=/; HttpOnly; Secure; SameSite=None';
    const result = stripCookieDomain(input);
    expect(result).not.toMatch(/Domain=/i);
    expect(result).toContain('insforge_refresh=abc123');
    expect(result).toContain('HttpOnly');
    expect(result).toContain('Secure');
    expect(result).toContain('SameSite=None');
  });

  it('is case-insensitive about the Domain attribute name', () => {
    const input = 'token=x; domain=example.com; Path=/';
    expect(stripCookieDomain(input)).toBe('token=x; Path=/');
  });

  it('leaves cookies without a Domain attribute unchanged', () => {
    const input = 'token=x; Path=/; HttpOnly';
    expect(stripCookieDomain(input)).toBe(input);
  });

  it('only strips the Domain attribute, not the cookie value', () => {
    const input = 'session=Domain=weird; Domain=example.com';
    // The cookie value legitimately contains "Domain=" text; only the
    // attribute (introduced by "; Domain=") should be removed.
    expect(stripCookieDomain(input)).toBe('session=Domain=weird');
  });
});
