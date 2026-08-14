// Extracts typed knowledge cards from a pasted video transcript, per
// docs/superpowers/specs/2026-08-11-youtube-knowledge-system-design.md.
// Cards are display cache: previous cards for the watch item are replaced
// (delete-then-insert) so re-extraction is idempotent.
//
// Auth mirrors functions/draft-follow-up.ts: a shared secret for
// internal/testing use (explicit ownerUserId), or a real user's session
// token (ownerUserId derived from the verified token, never from the
// client-supplied body).
import { createAdminClient, createClient } from 'npm:@insforge/sdk';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Keeps the OpenRouter call well under the gateway's response timeout; a
// higher-limit or chunked pass can come later behind extractor_version.
const TRANSCRIPT_CHAR_LIMIT = 60000;
const EXTRACTOR_VERSION = 'extract-video-knowledge-v3';
const EXTRACTION_MODEL = 'anthropic/claude-haiku-4.5';
const CARD_KINDS = ['claim', 'technique', 'tool', 'action', 'quote'] as const;
// Display-cache ceilings: a hostile transcript must not be able to inflate
// stored cards past what the panel would ever render.
const MAX_CARDS = 10;
const MAX_BODY_LENGTH = 400;
const MAX_EXCERPT_LENGTH = 300;
const MAX_TOPIC_LENGTH = 40;
const MAX_TOPICS = 3;

type CardKind = (typeof CARD_KINDS)[number];

interface ExtractedCard {
  kind: CardKind;
  body: string;
  excerpt: string;
  topics: string[];
}

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

  let verifiedUserId: string | null = null;
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

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // missing body handled below by the watchItemId check
  }

  const ownerUserId = isTrustedInternalCaller ? readString(body, 'ownerUserId') : verifiedUserId;
  const watchItemId = readString(body, 'watchItemId');

  if (!ownerUserId || !watchItemId) {
    return json({ error: 'watchItemId is required (and ownerUserId, for the shared-secret path)' }, 400);
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
  // ever extract a watch item that belongs to them, never an arbitrary id.
  const { data: watchItems, error: watchItemError } = await client.database
    .from('watch_items')
    .select('id,video_id,title,state,transcript')
    .eq('id', watchItemId)
    .eq('user_id', ownerUserId);
  if (watchItemError) {
    return json({ error: `Failed to load watch item: ${watchItemError.message}` }, 500);
  }
  const watchItem = watchItems?.[0];
  if (!watchItem) {
    return json({ error: 'Watch item not found' }, 404);
  }
  if (watchItem.state !== 'captured' && watchItem.state !== 'extracted') {
    return json({ error: `Cannot extract from state "${watchItem.state}"` }, 409);
  }
  const transcript = typeof watchItem.transcript === 'string' ? watchItem.transcript.trim() : '';
  if (!transcript) {
    return json({ error: 'Watch item has no transcript' }, 400);
  }

  try {
    const slicedTranscript = transcript.slice(0, TRANSCRIPT_CHAR_LIMIT);
    const cards = await extractCards(openRouterKey, watchItem.title, slicedTranscript);
    if (cards.length === 0) {
      return json({ error: 'Extraction returned no usable cards' }, 502);
    }

    // The excerpt and its timecode are both derived from the transcript
    // itself, never trusted verbatim from the model, so a quoted excerpt and
    // a deep link exist only when grounded in the transcript's own text.
    const cardRows = cards.map((card) => {
      const grounded = groundExcerpt(slicedTranscript, card.excerpt);
      return {
        user_id: ownerUserId,
        watch_item_id: watchItem.id,
        video_id: watchItem.video_id,
        kind: card.kind,
        body: card.body,
        excerpt: grounded.excerpt,
        timecode_seconds: grounded.timecodeSeconds,
        deep_link:
          grounded.timecodeSeconds === null
            ? null
            : `https://youtu.be/${watchItem.video_id}?t=${grounded.timecodeSeconds}`,
        topics: card.topics,
        status: 'active',
        extractor_version: EXTRACTOR_VERSION,
      };
    });

    const { error: deleteError } = await client.database
      .from('knowledge_cards')
      .delete()
      .eq('watch_item_id', watchItem.id)
      .eq('user_id', ownerUserId);
    if (deleteError) {
      return json({ error: `Failed to clear previous cards: ${deleteError.message}` }, 500);
    }

    const { error: insertError } = await client.database.from('knowledge_cards').insert(cardRows);
    if (insertError) {
      return json({ error: `Failed to insert cards: ${insertError.message}` }, 500);
    }

    await client.database.from('audit_log').insert([
      {
        user_id: ownerUserId,
        action_type: 'video_knowledge_extracted',
        model: EXTRACTION_MODEL,
        summary: `Extracted ${cardRows.length} knowledge cards from "${watchItem.title ?? watchItem.video_id}".`,
      },
    ]);

    const { error: stateError } = await client.database
      .from('watch_items')
      .update({ state: 'extracted', updated_at: new Date().toISOString() })
      .eq('id', watchItem.id)
      .eq('user_id', ownerUserId);
    if (stateError) {
      return json({ error: `Failed to update watch item state: ${stateError.message}` }, 500);
    }

    return json({ cards: cardRows }, 200);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Extraction failed' }, 500);
  }
}

async function extractCards(
  openRouterKey: string,
  title: string | null,
  transcript: string,
): Promise<ExtractedCard[]> {
  const prompt = buildExtractionPrompt(title, transcript);

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openRouterKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EXTRACTION_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter extraction failed: ${response.status}`);
  }

  const payload: unknown = await response.json();
  const choices = readValue(payload, 'choices');
  const message = Array.isArray(choices) ? readValue(choices[0], 'message') : null;
  const content = readString(message, 'content') ?? '[]';
  return parseCards(content);
}

function buildExtractionPrompt(title: string | null, transcript: string): string {
  return `You extract knowledge cards from one video transcript. The transcript may contain inline [H:MM:SS] timecode markers; treat them as part of the surrounding text.
Video title: ${title ?? 'Untitled video'}
Transcript:
${transcript}

Return ONLY a JSON array (no prose, no markdown fences) of 3 to 10 cards. Each card:
{
  "kind": one of "claim" | "technique" | "tool" | "action" | "quote",
  "body": one or two sentences stating what the video said, standing alone without the transcript,
  "excerpt": a short quote copied character-for-character from the transcript that grounds the card,
  "topics": 1 to 3 short lowercase topic keywords
}
Every card must be grounded in the transcript. Do not invent claims the transcript does not support.`;
}

// The model's output is untrusted: validate each card individually and drop
// malformed ones instead of failing or trusting the whole array.
function parseCards(content: string): ExtractedCard[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content.trim().replace(/^```json\s*|```$/g, ''));
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  const cards: ExtractedCard[] = [];
  for (const candidate of parsed) {
    const card = parseCard(candidate);
    if (card) {
      cards.push(card);
    }
  }
  return cards.slice(0, MAX_CARDS);
}

function parseCard(candidate: unknown): ExtractedCard | null {
  const kind = readString(candidate, 'kind');
  const body = truncate(readString(candidate, 'body')?.trim() ?? '', MAX_BODY_LENGTH);
  const excerpt = truncate(readString(candidate, 'excerpt')?.trim() ?? '', MAX_EXCERPT_LENGTH);
  if (!isCardKind(kind) || !body || !excerpt) {
    return null;
  }

  return { kind, body, excerpt, topics: readTopics(candidate) };
}

// A truncated excerpt stays a verbatim prefix, so indexOf grounding and
// timecode derivation keep working on capped text.
function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : value.slice(0, maxLength).trimEnd();
}

function isCardKind(value: string | null): value is CardKind {
  return value !== null && (CARD_KINDS as readonly string[]).includes(value);
}

interface GroundedExcerpt {
  excerpt: string;
  timecodeSeconds: number | null;
}

// Locates the excerpt in the transcript, then derives both the timecode and
// the stored excerpt from that position. Null timecode and the model's own
// excerpt when no match exists anywhere, so a deep link is never fabricated.
function groundExcerpt(transcript: string, excerpt: string): GroundedExcerpt {
  const index = locateExcerpt(transcript, excerpt);
  if (index === null) {
    return { excerpt, timecodeSeconds: null };
  }

  // Rewrite to the transcript's own characters: the model can reflow casing
  // (e.g. lowercase a sentence-leading word) while still quoting verbatim.
  return {
    excerpt: transcript.slice(index, index + excerpt.length),
    timecodeSeconds: nearestMarkerSeconds(transcript, index),
  };
}

function locateExcerpt(transcript: string, excerpt: string): number | null {
  const exactIndex = transcript.indexOf(excerpt);
  if (exactIndex !== -1) {
    return exactIndex;
  }

  const caseInsensitiveIndex = transcript.toLowerCase().indexOf(excerpt.toLowerCase());
  if (caseInsensitiveIndex === -1) {
    return null;
  }

  // toLowerCase() isn't guaranteed length-preserving for every code point
  // (e.g. U+0130), which would misalign this index; confirm the transcript
  // slice it points at actually matches before trusting it.
  const candidate = transcript.slice(caseInsensitiveIndex, caseInsensitiveIndex + excerpt.length);
  return candidate.toLowerCase() === excerpt.toLowerCase() ? caseInsensitiveIndex : null;
}

function nearestMarkerSeconds(transcript: string, position: number): number | null {
  let nearestSeconds: number | null = null;
  for (const match of transcript.matchAll(/\[(\d+):([0-5]\d):([0-5]\d)\]/g)) {
    if ((match.index ?? 0) > position) {
      break;
    }
    nearestSeconds = markerToSeconds(match);
  }
  return nearestSeconds;
}

// Mirrors src/transcript.js's marker format (tested there; functions deploy
// as single files and cannot import app modules).
function markerToSeconds(match: RegExpMatchArray): number {
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

function readTopics(candidate: unknown): string[] {
  const topics = readValue(candidate, 'topics');
  if (!Array.isArray(topics)) {
    return [];
  }

  return topics
    .filter((topic): topic is string => typeof topic === 'string')
    .map((topic) => truncate(topic.trim(), MAX_TOPIC_LENGTH))
    .filter(Boolean)
    .slice(0, MAX_TOPICS);
}

function readString(source: unknown, key: string): string | null {
  const value = readValue(source, key);
  return typeof value === 'string' ? value : null;
}

function readValue(source: unknown, key: string): unknown {
  if (typeof source !== 'object' || source === null) {
    return null;
  }

  return (source as Record<string, unknown>)[key];
}

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
