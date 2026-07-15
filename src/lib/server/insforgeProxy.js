// Same-origin reverse proxy to the InsForge backend.
//
// Why this exists: the frontend is served from one domain (e.g. Vercel) and
// the InsForge backend from another. InsForge keeps a session alive with an
// httpOnly refresh cookie, but across different domains that cookie is
// third-party and modern browsers drop it -- so the user is signed out on
// every visit. Routing backend calls through this same-origin proxy makes the
// refresh cookie first-party, so it persists.
//
// The client points the SDK at its own origin; the SDK's `/api/*` and
// `/functions/*` requests land here and get forwarded to the real backend. We
// strip the `Domain` attribute from any Set-Cookie so the cookie is scoped to
// this app's origin regardless of how the backend sets it.

const BACKEND_URL = (import.meta.env.VITE_INSFORGE_URL ?? '').replace(/\/$/, '');

// Hop-by-hop headers must not be forwarded (RFC 7230), plus host which we rewrite.
const STRIP_REQUEST_HEADERS = new Set([
  'host',
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'content-length',
]);

export function stripCookieDomain(setCookieValue) {
  // Remove `; Domain=...` so the cookie becomes host-only for the app origin.
  return setCookieValue.replace(/;\s*Domain=[^;]+/i, '');
}

export async function proxyToInsForge({ request, url }) {
  if (!BACKEND_URL) {
    return new Response('InsForge backend URL is not configured', { status: 500 });
  }

  const targetUrl = BACKEND_URL + url.pathname + url.search;

  const headers = new Headers();
  for (const [key, value] of request.headers) {
    if (!STRIP_REQUEST_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  }

  const init = {
    method: request.method,
    headers,
    redirect: 'manual',
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.arrayBuffer();
  }

  const backendResponse = await fetch(targetUrl, init);

  const responseHeaders = new Headers();
  for (const [key, value] of backendResponse.headers) {
    // Set-Cookie is handled separately below so multiple cookies survive.
    if (key.toLowerCase() !== 'set-cookie') {
      responseHeaders.set(key, value);
    }
  }

  // getSetCookie() returns each Set-Cookie header individually (Node 18+/undici).
  const setCookies = backendResponse.headers.getSetCookie?.() ?? [];
  for (const cookie of setCookies) {
    responseHeaders.append('set-cookie', stripCookieDomain(cookie));
  }

  const body = await backendResponse.arrayBuffer();
  return new Response(body, {
    status: backendResponse.status,
    statusText: backendResponse.statusText,
    headers: responseHeaders,
  });
}
