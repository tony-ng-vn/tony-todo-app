import { createAdminClient, createClient } from 'npm:@insforge/sdk';

import './todoCommands.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const AGENT_TODO_COLUMNS =
  'id,title,created_at,completed_at,kind,someday_at,due_date,note,source,notion_page_id,notion_database_id,notion_status,first_started_at,active_started_at,tracked_seconds,time_segments,is_progressive,parent_task_id,is_progress_session,progress_label';

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: { code: 'invalid', message: 'Use POST' } }, 405);
  }

  const providedToken = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  const expectedToken = Deno.env.get('INGEST_FUNCTION_TOKEN');
  const isTrustedInternalCaller = Boolean(expectedToken) && providedToken === expectedToken;
  const isAgentAccessToken =
    typeof providedToken === 'string' && /^dlg_[0-9a-f]{64}$/.test(providedToken);

  let agentTokenUserId = null;
  let verifiedUserId = null;
  if (!isTrustedInternalCaller && isAgentAccessToken) {
    const lookupClient = createAdminClient({
      baseUrl: Deno.env.get('INSFORGE_BASE_URL'),
      apiKey: Deno.env.get('API_KEY'),
    });
    const { data } = await lookupClient.database
      .from('agent_tokens')
      .select('user_id')
      .eq('token', providedToken)
      .limit(1);
    agentTokenUserId = data?.[0]?.user_id ?? null;
  } else if (!isTrustedInternalCaller && providedToken) {
    const userClient = createClient({
      baseUrl: Deno.env.get('INSFORGE_BASE_URL'),
      accessToken: providedToken,
    });
    const { data } = await userClient.auth.getCurrentUser();
    verifiedUserId = data?.user?.id ?? null;
  }

  if (!isTrustedInternalCaller && !agentTokenUserId && !verifiedUserId) {
    return json({ error: { code: 'unauthorized', message: 'Unauthorized' } }, 401);
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const ownerUserId = isTrustedInternalCaller
    ? (body.ownerUserId ?? null)
    : (agentTokenUserId ?? verifiedUserId);
  if (!ownerUserId || typeof ownerUserId !== 'string') {
    return json(
      { error: { code: 'invalid', message: 'ownerUserId is required for the shared-secret path' } },
      400,
    );
  }

  const parsed = parseTodoCommand(body);
  if (!parsed.ok) {
    return json({ error: parsed.error }, 400);
  }

  const client =
    isTrustedInternalCaller || agentTokenUserId
      ? createAdminClient({
          baseUrl: Deno.env.get('INSFORGE_BASE_URL'),
          apiKey: Deno.env.get('API_KEY'),
        })
      : createClient({
          baseUrl: Deno.env.get('INSFORGE_BASE_URL'),
          accessToken: providedToken,
        });

  const { data, error } = await client.database
    .from('todos')
    .select(AGENT_TODO_COLUMNS)
    .eq('user_id', ownerUserId)
    .neq('loop_status', 'inbox');

  if (error) {
    return json({ error: { code: 'internal', message: `Failed to load todos: ${error.message}` } }, 500);
  }

  const state = createInitialState((data ?? []).map(fromRemoteRecord));
  const result = runTodoCommand(state, parsed.command, new Date());
  if (!result.ok) {
    return json({ error: result.error }, statusFor(result.error.code));
  }

  try {
    await persistTodoCommand(client, ownerUserId, result.persist);
  } catch (persistError) {
    return json(
      { error: { code: 'internal', message: persistError.message ?? 'Failed to persist todo' } },
      500,
    );
  }

  return json(result.view, 200);
}

async function persistTodoCommand(client, ownerUserId, persist) {
  if (persist.kind === 'none') {
    return;
  }

  if (persist.kind === 'insert') {
    const { error } = await client.database.from('todos').insert([
      {
        ...toRemoteRecord(persist.todo, ownerUserId),
        due_date: persist.todo.dueDate,
        loop_status: 'accepted',
      },
    ]);
    if (error) {
      throw error;
    }
    return;
  }

  const { error } = await client.database
    .from('todos')
    .update({
      ...toRemoteCompletionFields(persist.todo),
      note: persist.todo.note ?? '',
      updated_at: new Date().toISOString(),
    })
    .eq('id', persist.todo.id)
    .eq('user_id', ownerUserId);

  if (error) {
    throw error;
  }
}

function statusFor(code) {
  switch (code) {
    case 'empty_title':
    case 'invalid':
      return 400;
    case 'not_found':
      return 404;
    case 'ambiguous_title':
    case 'progressive_unsupported':
      return 409;
    default:
      return 500;
  }
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
