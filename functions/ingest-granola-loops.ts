// Real Granola -> open-loop ingestion, per docs/PRD.md Sections 4, 32.
//
// Pulls new meeting notes from Granola's public API, asks an LLM to extract
// commitments/requests/follow-ups, scores and routes each candidate, dedupes
// against existing loops, and writes evidence + todos rows.
//
// Priority scoring, priority labeling, confidence routing, and dedup mirror
// src/loopPriority.js / src/loopDedup.js exactly (kept in sync by hand: this
// function deploys as a single file, so it cannot import the app's src/
// modules directly). If those formulas change, update both places.
import { createAdminClient, createClient } from 'npm:@insforge/sdk';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const GRANOLA_BASE_URL = 'https://public-api.granola.ai/v1';
const DEFAULT_LOOKBACK_DAYS = 30;
const TRANSCRIPT_CHAR_LIMIT = 8000;

const PRIORITY_WEIGHTS = {
  urgency: 0.3,
  responsibility: 0.25,
  counterpartyStakes: 0.2,
  staleness: 0.15,
  effortLeverage: 0.1,
};

const PRIORITY_THRESHOLDS = [
  { label: 'P0', min: 85 },
  { label: 'P1', min: 65 },
  { label: 'P2', min: 40 },
  { label: 'P3', min: 0 },
];

function scorePriority(components) {
  let score = 0;
  for (const key of Object.keys(PRIORITY_WEIGHTS)) {
    const value = Number(components[key] ?? 0);
    score += Math.max(0, Math.min(100, value)) * PRIORITY_WEIGHTS[key];
  }
  return Math.round(score * 100) / 100;
}

function labelForScore(score) {
  return PRIORITY_THRESHOLDS.find((threshold) => score >= threshold.min).label;
}

function routeByConfidence(confidence) {
  if (confidence >= 0.85) return 'focus';
  if (confidence >= 0.6) return 'inbox';
  return 'hidden';
}

function findDuplicateLoop(candidate, existingLoops, windowMs = 24 * 60 * 60 * 1000) {
  const exactMatch = existingLoops.find((existing) =>
    existing.evidence?.some(
      (e) => e.source_app === 'granola' && e.source_object_id === candidate.sourceObjectId,
    ),
  );
  if (exactMatch) return exactMatch.id;

  const candidateTime = new Date(candidate.createdAt).getTime();
  const probableMatch = existingLoops.find((existing) => {
    if (existing.loop_type !== candidate.loopType) return false;
    if (existing.counterparty_person_id !== candidate.counterpartyPersonId) return false;
    return Math.abs(candidateTime - new Date(existing.created_at).getTime()) <= windowMs;
  });
  return probableMatch?.id ?? null;
}

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Use POST' }, 405);
  }

  // This function reads private Granola content and writes with an admin
  // (RLS-bypassing) client, so it must never be callable by an
  // unauthenticated caller -- even a dryRun response would leak extracted
  // meeting content. Two caller types are trusted, each resolving
  // ownerUserId differently:
  //   1. The shared secret (schedule/internal use): the caller declares
  //      ownerUserId explicitly in the body.
  //   2. A real signed-in user's own access token (the app's "check for
  //      new loops" button, via client.functions.invoke which forwards it
  //      automatically): ownerUserId is derived from the verified token
  //      and any client-supplied ownerUserId is ignored, so a user can
  //      never trigger ingestion into someone else's account.
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
    // empty/absent body is fine, all fields are optional
  }

  const ownerUserId = isTrustedInternalCaller ? ((body as any).ownerUserId ?? null) : verifiedUserId;
  // A signed-in user hitting this always wants real results, not a preview
  // they can't act on; the internal/schedule caller defaults to safe
  // (dryRun) unless it explicitly opts into writing.
  const dryRun = Boolean((body as any).dryRun ?? isTrustedInternalCaller);
  const sourceFilter = (body as any).source ?? 'both';
  // Write mode does two extra existing-loop queries plus per-candidate
  // inserts on top of the Granola + LLM calls dry-run already does, so it
  // needs a smaller default to stay under the gateway's response timeout
  // (observed: 5 notes with real writes -> 504, even though the work
  // completed server-side after the client gave up).
  const maxNotes = Number((body as any).maxNotes ?? (dryRun ? 5 : 3));

  if (!dryRun && !ownerUserId) {
    return json({ error: 'ownerUserId is required unless dryRun is true' }, 400);
  }

  const client = createAdminClient({
    baseUrl: Deno.env.get('INSFORGE_BASE_URL'),
    apiKey: Deno.env.get('API_KEY'),
  });

  const sources = [];
  if (sourceFilter === 'both' || sourceFilter === 'personal') {
    const key = Deno.env.get('GRANOLA_PERSONAL_API_KEY');
    if (key) sources.push({ name: 'granola-personal', apiKey: key });
  }
  if (sourceFilter === 'both' || sourceFilter === 'workspace') {
    const key = Deno.env.get('GRANOLA_WORKSPACE_API_KEY');
    if (key) sources.push({ name: 'granola-workspace', apiKey: key });
  }

  if (sources.length === 0) {
    return json({ error: 'No Granola API keys configured for the requested source(s)' }, 400);
  }

  const openRouterKey = Deno.env.get('OPENROUTER_API_KEY');
  if (!openRouterKey) {
    return json({ error: 'OPENROUTER_API_KEY is not configured' }, 500);
  }

  const results = {
    notesProcessed: 0,
    loopsCreated: [],
    candidates: [],
    skippedDuplicates: 0,
    errors: [],
    hasMore: false,
  };

  let existingLoops = [];
  if (!dryRun) {
    const { data: todosData, error: todosError } = await client.database
      .from('todos')
      .select('id,loop_type,counterparty_person_id,created_at')
      .eq('user_id', ownerUserId);
    if (todosError) {
      return json({ error: `Failed to load existing loops: ${todosError.message}` }, 500);
    }

    const { data: evidenceData, error: evidenceError } = await client.database
      .from('evidence')
      .select('todo_id,source_app,source_object_id')
      .eq('user_id', ownerUserId)
      .eq('source_app', 'granola');
    if (evidenceError) {
      return json({ error: `Failed to load existing evidence: ${evidenceError.message}` }, 500);
    }

    const evidenceByTodoId = new Map();
    for (const row of evidenceData ?? []) {
      const list = evidenceByTodoId.get(row.todo_id) ?? [];
      list.push({ source_app: row.source_app, source_object_id: row.source_object_id });
      evidenceByTodoId.set(row.todo_id, list);
    }

    existingLoops = (todosData ?? []).map((todo) => ({
      ...todo,
      evidence: evidenceByTodoId.get(todo.id) ?? [],
    }));
  }

  for (const source of sources) {
    try {
      const sinceIso = await resolveSinceTimestamp(client, dryRun, ownerUserId, source.name);
      const allNotes = await listNewNotes(source.apiKey, sinceIso);
      const notes = allNotes.slice(0, maxNotes);
      if (allNotes.length > notes.length) {
        results.hasMore = true;
      }
      let maxCreatedAt = sinceIso;

      for (const noteSummary of notes) {
        let note;
        try {
          note = await getNoteWithTranscript(source.apiKey, noteSummary.id);
        } catch (error) {
          results.errors.push(`${source.name}: ${error.message}`);
          continue;
        }

        results.notesProcessed += 1;
        if (note.created_at && (!maxCreatedAt || note.created_at > maxCreatedAt)) {
          maxCreatedAt = note.created_at;
        }

        const candidates = await extractLoopCandidates(openRouterKey, note);
        // Structural signal only -- never log meeting titles/content here,
        // this function processes private Granola notes.
        console.log(`[ingest-granola-loops] processed note id=${note.id} candidates=${candidates.length}`);

        for (const candidate of candidates) {
          const priorityScore = scorePriority(candidate);
          const priorityLabel = labelForScore(priorityScore);
          const surface = routeByConfidence(candidate.confidence);
          if (surface === 'hidden') continue;

          const enriched = {
            ...candidate,
            sourceObjectId: note.id,
            createdAt: note.created_at ?? new Date().toISOString(),
          };

          if (dryRun) {
            results.candidates.push({ ...enriched, priorityScore, priorityLabel, surface });
            continue;
          }

          const duplicateId = findDuplicateLoop(enriched, existingLoops);
          if (duplicateId) {
            results.skippedDuplicates += 1;
            continue;
          }

          const todoId = `${Date.now()}-${slugify(candidate.title)}`;
          const { error: insertError } = await client.database.from('todos').insert([
            {
              id: todoId,
              user_id: ownerUserId,
              title: candidate.title,
              created_at: enriched.createdAt,
              note: '',
              source: 'granola',
              loop_type: candidate.loopType,
              confidence: candidate.confidence,
              priority_label: priorityLabel,
              priority_score: priorityScore,
              loop_status: surface === 'focus' ? 'accepted' : 'inbox',
              due_source: candidate.dueDate ? 'inferred' : null,
              why_priority: candidate.whyPriority ?? null,
            },
          ]);

          if (insertError) {
            results.errors.push(`Insert failed for "${candidate.title}": ${insertError.message}`);
            continue;
          }

          const { error: evidenceError } = await client.database.from('evidence').insert([
            {
              user_id: ownerUserId,
              todo_id: todoId,
              source_app: 'granola',
              source_object_id: note.id,
              source_title: note.title ?? null,
              author: noteOwnerName(note.owner),
              occurred_at: enriched.createdAt,
              excerpt: candidate.evidenceExcerpt ?? note.summary ?? '',
              extractor_version: 'ingest-granola-loops-v1',
            },
          ]);

          if (evidenceError) {
            results.errors.push(`Evidence insert failed for "${candidate.title}": ${evidenceError.message}`);
          }

          await client.database.from('audit_log').insert([
            {
              user_id: ownerUserId,
              action_type: 'loop_created',
              loop_id: todoId,
              model: 'anthropic/claude-haiku-4.5',
              summary: `Created "${candidate.title}" (${priorityLabel}) from a Granola meeting.`,
            },
          ]);

          results.loopsCreated.push({ id: todoId, title: candidate.title, priorityLabel });
          existingLoops.push({
            id: todoId,
            loop_type: candidate.loopType,
            counterparty_person_id: null,
            created_at: enriched.createdAt,
            evidence: [{ source_app: 'granola', source_object_id: note.id }],
          });
        }
      }

      if (!dryRun && maxCreatedAt) {
        await client.database
          .from('ingestion_cursor')
          .upsert(
            [{ user_id: ownerUserId, source: source.name, last_synced_at: maxCreatedAt, updated_at: new Date().toISOString() }],
            { onConflict: 'user_id,source' },
          );
      }
    } catch (error) {
      results.errors.push(`${source.name}: ${error.message}`);
    }
  }

  return json(results, 200);
}

async function resolveSinceTimestamp(client, dryRun, ownerUserId, sourceName) {
  if (dryRun) {
    return new Date(Date.now() - DEFAULT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
  }

  const { data } = await client.database
    .from('ingestion_cursor')
    .select('last_synced_at')
    .eq('user_id', ownerUserId)
    .eq('source', sourceName)
    .maybeSingle();

  return data?.last_synced_at ?? new Date(Date.now() - DEFAULT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

async function listNewNotes(apiKey, sinceIso) {
  const notes = [];
  let cursor: string | undefined;

  do {
    const url = new URL(`${GRANOLA_BASE_URL}/notes`);
    url.searchParams.set('created_after', sinceIso);
    if (cursor) url.searchParams.set('cursor', cursor);

    const response = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Granola /notes failed: ${response.status} ${errorBody.slice(0, 300)}`);
    }
    const payload = await response.json();
    notes.push(...(payload.notes ?? []));
    cursor = payload.hasMore ? payload.cursor : undefined;
  } while (cursor);

  return notes;
}

async function getNoteWithTranscript(apiKey, noteId) {
  const response = await fetch(`${GRANOLA_BASE_URL}/notes/${noteId}?include=transcript`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Granola /notes/${noteId} failed: ${response.status} ${errorBody.slice(0, 300)}`);
  }
  return response.json();
}

async function extractLoopCandidates(openRouterKey, note) {
  const transcriptText = Array.isArray(note.transcript)
    ? note.transcript.map((line) => line.text).join('\n').slice(0, TRANSCRIPT_CHAR_LIMIT)
    : '';

  const prompt = buildExtractionPrompt(note, transcriptText);

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openRouterKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-haiku-4.5',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.log(`[ingest-granola-loops] OpenRouter error ${response.status}: ${errorBody.slice(0, 500)}`);
    throw new Error(`OpenRouter extraction failed: ${response.status}`);
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content ?? '[]';
  return parseCandidates(content);
}

function buildExtractionPrompt(note, transcriptText) {
  return `You extract open loops (commitments, requests, decisions, follow-ups) from a meeting.
Title: ${note.title ?? 'Untitled meeting'}
Summary: ${note.summary ?? '(no summary)'}
Transcript excerpt:
${transcriptText || '(no transcript available)'}

Return ONLY a JSON array (no prose, no markdown fences). Each item:
{
  "title": short action-oriented string,
  "loopType": one of "promise" | "request" | "waiting" | "approval" | "decision" | "follow-up",
  "confidence": number 0-1, how sure you are this is a real open loop,
  "urgency": number 0-100,
  "responsibility": number 0-100 (100 = the meeting owner is personally blocking this),
  "counterpartyStakes": number 0-100 (higher for investors/VIPs/high-stakes counterparties),
  "staleness": number 0-100 (0 if brand new),
  "effortLeverage": number 0-100 (higher = high impact for low effort),
  "whyPriority": one short sentence,
  "evidenceExcerpt": a short verbatim quote supporting this loop,
  "dueDate": ISO date string or null
}
Return an empty array if there is nothing worth tracking. Do not invent loops not supported by the transcript or summary.`;
}

// Mirrors src/loopExtraction.js's parseLoopCandidates (tested there; this
// function is deployed as a single file and cannot import it directly).
function parseCandidates(content) {
  try {
    const cleaned = content.trim().replace(/^```json\s*|```$/g, '');
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Granola's /notes owner field is an object ({name, email, ...}), not a
// string -- stringifying it directly would store a JSON blob in the
// text `author` column instead of a readable name.
function noteOwnerName(owner) {
  if (!owner) return null;
  if (typeof owner === 'string') return owner;
  return owner.name ?? owner.email ?? null;
}

// Mirrors src/todoStore.js's createTodoId slug logic (tested there).
function slugify(title) {
  const slug = String(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'loop';
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
