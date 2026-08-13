export const AGENT_TODOS_URL = 'https://y26ze9je.us-east.insforge.app/functions/agent-todos';
export const AGENT_TOKEN_PATTERN = /^dlg_[0-9a-f]{64}$/;

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

export function maskAgentToken(token) {
  if (!isAgentAccessToken(token)) {
    return '';
  }
  return `dlg_••••${token.slice(-4)}`;
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
    '{"command":"daySummary"}',
    '{"command":"daySummary","day":"YYYY-MM-DD"}',
  ].join('\n');
}

function defaultRandomBytes(size) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytes;
}
