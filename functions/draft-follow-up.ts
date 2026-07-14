// Real drafting for the Waiting view's "Draft follow-up" button, per
// docs/PRD.md FR-10 and Tier 1 of the autonomy model (Section 33): may
// create a reversible draft, but must never send anything. This function
// only returns text -- there is no email/Slack API call anywhere in it.
//
// Auth mirrors functions/ingest-granola-loops.ts: a shared secret for
// internal/testing use (explicit ownerUserId), or a real user's session
// token (ownerUserId derived from the verified token, never from the
// client-supplied body).
import { createAdminClient, createClient } from 'npm:@insforge/sdk';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Use POST' }, 405);
  }

  const providedToken = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  const expectedToken = Deno.env.get('INGEST_FUNCTION_TOKEN');
  const isTrustedInternalCaller = Boolean(expectedToken) && providedToken === expectedToken;

  let verifiedUserId = null;
  if (!isTrustedInternalCaller && providedToken) {
    const userClient = createClient({
      baseUrl: Deno.env.get('INSFORGE_BASE_URL'),
      accessToken: providedToken,
    });
    const { data } = await userClient.auth.getCurrentUser();
    verifiedUserId = data?.user?.id ?? null;
  }

  if (!isTrustedInternalCaller && !verifiedUserId) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let body = {};
  try {
    body = await req.json();
  } catch {
    // empty body handled below by the loopId check
  }

  const ownerUserId = isTrustedInternalCaller ? ((body as any).ownerUserId ?? null) : verifiedUserId;
  const loopId = (body as any).loopId ?? null;

  if (!ownerUserId || !loopId) {
    return json({ error: 'loopId is required (and ownerUserId, for the shared-secret path)' }, 400);
  }

  const openRouterKey = Deno.env.get('OPENROUTER_API_KEY');
  if (!openRouterKey) {
    return json({ error: 'OPENROUTER_API_KEY is not configured' }, 500);
  }

  const client = createAdminClient({
    baseUrl: Deno.env.get('INSFORGE_BASE_URL'),
    apiKey: Deno.env.get('API_KEY'),
  });

  // .eq('user_id', ownerUserId) is the ownership check: a caller can only
  // ever draft for a loop that belongs to them, never an arbitrary id.
  const { data: todos, error: todoError } = await client.database
    .from('todos')
    .select('id,title,loop_type,why_priority')
    .eq('id', loopId)
    .eq('user_id', ownerUserId);
  if (todoError) {
    return json({ error: `Failed to load loop: ${todoError.message}` }, 500);
  }
  const loop = todos?.[0];
  if (!loop) {
    return json({ error: 'Loop not found' }, 404);
  }

  const { data: evidenceRows, error: evidenceError } = await client.database
    .from('evidence')
    .select('source_app,author,excerpt')
    .eq('todo_id', loopId)
    .eq('user_id', ownerUserId);
  if (evidenceError) {
    return json({ error: `Failed to load evidence: ${evidenceError.message}` }, 500);
  }
  const evidence = evidenceRows?.[0] ?? null;

  try {
    const draft = await draftFollowUp(openRouterKey, loop, evidence);
    return json({ draft }, 200);
  } catch (error) {
    return json({ error: error.message }, 500);
  }
}

async function draftFollowUp(openRouterKey, loop, evidence) {
  const prompt = `Draft a short, polite follow-up message about this open commitment.
Title: ${loop.title}
Type: ${loop.loop_type ?? 'follow-up'}
Why it matters: ${loop.why_priority ?? 'not specified'}
Counterparty: ${evidence?.author ?? 'unknown'}
Original context (${evidence?.source_app ?? 'unknown source'}): "${evidence?.excerpt ?? 'no additional context'}"

Return ONLY the message text, ready to send as-is (no subject line, no preamble, no markdown). Keep it under 80 words and match a professional but warm tone.`;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openRouterKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-haiku-4.5',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter drafting failed: ${response.status}`);
  }

  const payload = await response.json();
  return (payload.choices?.[0]?.message?.content ?? '').trim();
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
