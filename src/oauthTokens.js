// Generic, provider-agnostic OAuth token lifecycle logic (Google, Slack,
// or anything else that issues an access token with an expiry). Kept
// separate from any specific provider's API so it's verifiable without
// real credentials -- the actual Gmail/Calendar API calls are deferred
// until real OAuth credentials exist to test against (see
// docs/google-oauth-setup.md).
const DEFAULT_BUFFER_SECONDS = 300;

export function isTokenExpired(expiresAt, now = new Date()) {
  if (!expiresAt) {
    return true;
  }
  return new Date(expiresAt).getTime() <= now.getTime();
}

export function needsRefresh(expiresAt, now = new Date(), { bufferSeconds = DEFAULT_BUFFER_SECONDS } = {}) {
  if (!expiresAt) {
    return true;
  }
  const secondsLeft = secondsUntilExpiry(expiresAt, now);
  return secondsLeft <= bufferSeconds;
}

export function secondsUntilExpiry(expiresAt, now = new Date()) {
  if (!expiresAt) {
    return null;
  }
  return Math.round((new Date(expiresAt).getTime() - now.getTime()) / 1000);
}
