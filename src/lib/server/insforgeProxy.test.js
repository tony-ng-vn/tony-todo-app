import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createProxyResponse,
  proxyUpstreamErrorResponse,
  stripCookieDomain,
} from './insforgeProxy.js';

describe('createProxyResponse', () => {
  it('preserves a response body from the backend', async () => {
    const backendResponse = new Response('saved', {
      status: 200,
      headers: { 'content-type': 'text/plain' },
    });

    const response = await createProxyResponse(backendResponse);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/plain');
    expect(await response.text()).toBe('saved');
  });

  it.each([204, 205, 304])(
    'forwards a bodyless %i response without creating an invalid body',
    async (status) => {
      const backendResponse = new Response(null, {
        status,
        headers: { 'x-backend': 'insforge' },
      });

      const response = await createProxyResponse(backendResponse);

      expect(response.status).toBe(status);
      expect(response.body).toBeNull();
      expect(response.headers.get('x-backend')).toBe('insforge');
    },
  );

  it('drops compression metadata after the upstream body is decoded', async () => {
    const backendResponse = new Response('saved', {
      status: 200,
      headers: {
        'content-type': 'text/plain',
        'content-encoding': 'gzip',
        'content-length': '5',
      },
    });

    const response = await createProxyResponse(backendResponse);

    expect(response.headers.get('content-encoding')).toBeNull();
    expect(response.headers.get('content-length')).toBeNull();
    expect(await response.text()).toBe('saved');
  });
});

describe('proxyUpstreamErrorResponse', () => {
  it('turns a failed upstream fetch into a 502 without leaking diagnostics', async () => {
    const error = new TypeError('fetch failed');
    error.cause = new Error('getaddrinfo ENOTFOUND');
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = proxyUpstreamErrorResponse(error);
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body).toEqual({
      error: 'BAD_GATEWAY',
      message: 'Could not reach the backend',
    });
    expect(log).toHaveBeenCalledWith(
      'InsForge proxy could not reach the backend:',
      'getaddrinfo ENOTFOUND',
    );
    log.mockRestore();
  });
});

describe('proxyToInsForge', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('returns a 502 JSON body when the upstream fetch rejects', async () => {
    vi.stubEnv('VITE_INSFORGE_URL', 'https://backend.example');
    vi.resetModules();
    const { proxyToInsForge } = await import('./insforgeProxy.js');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed');
      }),
    );
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await proxyToInsForge({
      request: new Request('https://app.example/api/auth/sessions', { method: 'GET' }),
      url: new URL('https://app.example/api/auth/sessions'),
    });
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body).toEqual({
      error: 'BAD_GATEWAY',
      message: 'Could not reach the backend',
    });
    log.mockRestore();
  });
});

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
