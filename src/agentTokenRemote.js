import {
  DEFAULT_AGENT_KEY_NAME,
  hashAgentToken,
  isAgentAccessToken,
  normalizeAgentKeyName,
} from './agentSetup.js';

const HASH_PATTERN = /^[0-9a-f]{64}$/;

export async function loadAgentToken(client, userId) {
  if (!userId) {
    return null;
  }

  const { data, error } = await client.database
    .from('agent_tokens')
    .select('token_hash, name')
    .eq('user_id', userId)
    .limit(1);

  throwIfError(error);
  const row = data?.[0];
  if (!HASH_PATTERN.test(row?.token_hash ?? '')) {
    return null;
  }

  return {
    name: row.name?.trim() || DEFAULT_AGENT_KEY_NAME,
  };
}

export async function saveAgentToken(client, userId, { token, name }) {
  if (!userId) {
    throw new Error('You must be signed in to create an agent key.');
  }
  if (!isAgentAccessToken(token)) {
    throw new Error('That agent key is not valid.');
  }
  const keyName = normalizeAgentKeyName(name);
  const tokenHash = await hashAgentToken(token);

  const existing = await loadAgentToken(client, userId);
  if (existing) {
    const { error } = await client.database
      .from('agent_tokens')
      .update({ token_hash: tokenHash, name: keyName, created_at: new Date().toISOString() })
      .eq('user_id', userId);
    throwIfError(error);
    return { name: keyName };
  }

  const { error } = await client.database.from('agent_tokens').insert([
    {
      user_id: userId,
      token_hash: tokenHash,
      name: keyName,
    },
  ]);
  throwIfError(error);
  return { name: keyName };
}

export async function deleteAgentToken(client, userId) {
  if (!userId) {
    throw new Error('You must be signed in to remove an agent key.');
  }

  const { error } = await client.database.from('agent_tokens').delete().eq('user_id', userId);
  throwIfError(error);
}

function throwIfError(error) {
  if (error) {
    throw new Error(error.message ?? 'Could not update the agent key.');
  }
}
