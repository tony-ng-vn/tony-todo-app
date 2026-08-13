export const AGENT_TODOS_URL = 'https://y26ze9je.us-east.insforge.app/functions/agent-todos';
export const AGENT_TOKEN_PATTERN = /^dlg_[0-9a-f]{64}$/;
export const AGENT_KEY_NAME_MAX = 40;
export const DEFAULT_AGENT_KEY_NAME = 'Agent key';

export function createAgentToken(randomBytes = defaultRandomBytes) {
  const bytes = randomBytes(32);
  if (!(bytes instanceof Uint8Array) || bytes.length !== 32) {
    throw new Error('Agent key generation needs 32 random bytes.');
  }
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `dlg_${hex}`;
}

export function isAgentAccessToken(value) {
  return typeof value === 'string' && AGENT_TOKEN_PATTERN.test(value);
}

export function normalizeAgentKeyName(value) {
  const name = String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!name) {
    throw new Error('Name the key so you can tell it apart later.');
  }
  if (name.length > AGENT_KEY_NAME_MAX) {
    throw new Error(`Keep the name to ${AGENT_KEY_NAME_MAX} characters.`);
  }
  return name;
}

export function buildAgentSetupPrompt({ token, url = AGENT_TODOS_URL } = {}) {
  if (!isAgentAccessToken(token)) {
    throw new Error('Create an agent key before copying setup.');
  }

  return [
    'Use this to read and update my Done Log.',
    '',
    `POST ${url}`,
    `Authorization: Bearer ${token}`,
    'Content-Type: application/json',
    '',
    'The key is already tied to my account. Do not send ownerUserId.',
    '',
    'Commands (JSON body):',
    '{"command":"list"}',
    '{"command":"create","title":"..."}',
    '{"command":"complete","id":"..."}',
    '{"command":"complete","title":"..."}',
    '{"command":"appendNote","id":"...","text":"..."}',
    '{"command":"daySummary"}',
    '{"command":"daySummary","day":"YYYY-MM-DD"}',
    '',
    'list returns now, nowLocal, and each task notes[] with at, atLocal, and text.',
    'Blank lines start a new dated note. Times are America/Los_Angeles.',
  ].join('\n');
}

function defaultRandomBytes(size) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytes;
}

export async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value)));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

// The hash is what gets stored; the plaintext key is shown once and gone.
export async function hashAgentToken(token) {
  if (!isAgentAccessToken(token)) {
    throw new Error('That agent key is not valid.');
  }
  return sha256Hex(token);
}
