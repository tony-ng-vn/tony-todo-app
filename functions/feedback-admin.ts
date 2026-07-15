// Owner-only access to the feedback list. Regular users can submit feedback
// (a plain RLS insert from the app), but reading and triaging the full list
// is restricted to the owner here, so the dashboard is never visible to
// ordinary users.
//
// Auth mirrors the other functions: a shared secret for internal/agent use
// (INGEST_FUNCTION_TOKEN), or a real user's session token whose verified
// email must match FEEDBACK_OWNER_EMAIL. Ownership is derived from the
// verified token/secret, never trusted from the request body.
import { createAdminClient, createClient } from 'npm:@insforge/sdk';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const VALID_STATUSES = ['new', 'in_progress', 'done'];

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

  let isOwner = isTrustedInternalCaller;
  if (!isOwner && providedToken) {
    const ownerEmail = Deno.env.get('FEEDBACK_OWNER_EMAIL');
    const userClient = createClient({
      baseUrl: Deno.env.get('INSFORGE_BASE_URL'),
      accessToken: providedToken,
    });
    const { data } = await userClient.auth.getCurrentUser();
    const email = data?.user?.email ?? null;
    isOwner = Boolean(ownerEmail) && email === ownerEmail;
  }

  if (!isOwner) {
    return json({ error: 'Forbidden' }, 403);
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // handled by the action check below
  }

  const admin = createAdminClient({
    baseUrl: Deno.env.get('INSFORGE_BASE_URL'),
    apiKey: Deno.env.get('API_KEY'),
  });

  const action = body?.action ?? 'list';

  if (action === 'list') {
    const { data, error } = await admin.database
      .from('feedback')
      .select('id, user_id, category, message, page_context, status, created_at, updated_at')
      .order('created_at', { ascending: false });
    if (error) {
      return json({ error: error.message ?? 'Could not load feedback' }, 500);
    }
    return json({ feedback: data ?? [] }, 200);
  }

  if (action === 'update-status') {
    const id = body?.id ?? null;
    const status = body?.status ?? null;
    if (!id || !VALID_STATUSES.includes(status)) {
      return json({ error: 'id and a valid status are required' }, 400);
    }
    const { data, error } = await admin.database
      .from('feedback')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, user_id, category, message, page_context, status, created_at, updated_at');
    if (error) {
      return json({ error: error.message ?? 'Could not update feedback' }, 500);
    }
    return json({ feedback: Array.isArray(data) ? data[0] : data }, 200);
  }

  return json({ error: `Unknown action: ${action}` }, 400);
}

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
