import { isAgentAccessToken } from './agentSetup.js';

export async function loadAgentToken(client, userId) {
  if (!userId) {
    return null;
  }

  const { data, error } = await client.database
    .from('agent_tokens')
    .select('token')
    .eq('user_id', userId)
    .limit(1);

  throwIfError(error);
  const token = data?.[0]?.token ?? null;
  return isAgentAccessToken(token) ? token : null;
}

export async function saveAgentToken(client, userId, token) {
  if (!userId) {
    throw new Error('You must be signed in to create an agent key.');
  }
  if (!isAgentAccessToken(token)) {
    throw new Error('That agent key is not valid.');
  }

  const existing = await loadAgentToken(client, userId);
  if (existing) {
    const { error } = await client.database
      .from('agent_tokens')
      .update({ token, created_at: new Date().toISOString() })
      .eq('user_id', userId);
    throwIfError(error);
    return;
  }

  const { error } = await client.database.from('agent_tokens').insert([
    {
      user_id: userId,
      token,
    },
  ]);
  throwIfError(error);
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
