// Reclaim pre-auth todos that still have user_id IS NULL.
// Those rows were created under the old anonymous client_id scope and are
// invisible to signed-in users because RLS requires user_id = auth.uid().
//
// Auth: the caller's session token. Ownership is always the verified user;
// never trust a user_id from the body. Only rows matching the provided
// client_id are reassigned -- never a global orphan claim.
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
  if (!clientId) {
    // No browser client_id means nothing to reclaim on this device.
    return json({ claimed: 0, ids: [] }, 200);
  }

  const admin = createAdminClient({
    baseUrl: Deno.env.get('INSFORGE_BASE_URL'),
    apiKey: Deno.env.get('API_KEY'),
  });

  const { data, error } = await admin.database
    .from('todos')
    .update({ user_id: user.id, updated_at: new Date().toISOString() })
    .is('user_id', null)
    .eq('client_id', clientId)
    .select('id');

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
