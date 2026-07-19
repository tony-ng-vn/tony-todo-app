// One-time reclaim of pre-auth todos that still have user_id IS NULL.
// Those rows were created under the old anonymous client_id scope and are
// invisible to signed-in users because RLS requires user_id = auth.uid().
//
// Auth: the caller's session token. Ownership is always the verified user;
// never trust a user_id from the body.
//
// Modes:
//   1. clientId provided: reassign orphans with that client_id.
//   2. no clientId, and the caller's email matches FEEDBACK_OWNER_EMAIL:
//      reassign every remaining orphan (solo-owner recovery path).
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
  if (!providedToken) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const userClient = createClient({
    baseUrl: Deno.env.get('INSFORGE_BASE_URL'),
    accessToken: providedToken,
  });
  const { data: userData, error: userError } = await userClient.auth.getCurrentUser();
  const user = userData?.user ?? null;
  if (userError || !user?.id) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let body: { clientId?: string } = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine
  }

  const clientId = typeof body.clientId === 'string' ? body.clientId.trim() : '';
  const ownerEmail = Deno.env.get('FEEDBACK_OWNER_EMAIL') ?? '';
  const isOwnerEmail = Boolean(ownerEmail) && user.email === ownerEmail;

  if (!clientId && !isOwnerEmail) {
    return json(
      {
        error:
          'clientId is required unless the signed-in account is the project owner.',
      },
      400,
    );
  }

  const admin = createAdminClient({
    baseUrl: Deno.env.get('INSFORGE_BASE_URL'),
    apiKey: Deno.env.get('API_KEY'),
  });

  let query = admin.database
    .from('todos')
    .update({ user_id: user.id, updated_at: new Date().toISOString() })
    .is('user_id', null);

  if (clientId) {
    query = query.eq('client_id', clientId);
  }

  const { data, error } = await query.select('id');
  if (error) {
    return json({ error: error.message ?? 'Could not reclaim todos' }, 500);
  }

  return json({ claimed: (data ?? []).length, ids: (data ?? []).map((row) => row.id) }, 200);
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
