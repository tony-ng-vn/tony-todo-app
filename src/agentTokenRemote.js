import {
  DEFAULT_AGENT_KEY_NAME,
  isAgentAccessToken,
  normalizeAgentKeyName,
} from './agentSetup.js';

export async function loadAgentToken(client, userId) {
  if (!userId) {
    return null;
  }

  const { data, error } = await client.database
    .from('agent_tokens')
    .select('token, name')
    .eq('user_id', userId)
    .limit(1);

  throwIfError(error);
  const row = data?.[0];
  if (!isAgentAccessToken(row?.token)) {
    return null;
  }

  return {
    token: row.token,
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

  const existing = await loadAgentToken(client, userId);
  if (existing) {
    const { error } = await client.database
      .from('agent_tokens')
      .update({ token, name: keyName, created_at: new Date().toISOString() })
      .eq('user_id', userId);
    throwIfError(error);
    return { token, name: keyName };
  }

  const { error } = await client.database.from('agent_tokens').insert([
    {
      user_id: userId,
      token,
      name: keyName,
    },
  ]);
  throwIfError(error);
  return { token, name: keyName };
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
