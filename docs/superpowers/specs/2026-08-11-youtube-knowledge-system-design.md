# YouTube knowledge system design

Date: 2026-08-11.

Status: design proposal for Tony to approve, not an implementation decision.

This builds on [the research doc](../../research/2026-08-11-youtube-learning-loop.md) and replaces its capture-time emphasis after two direction changes from Tony.

## What Tony decided

First, transcripts come from Tony pasting them, not from automation.
Videos finished on the phone wait in a visible section in the app until he pastes their transcript later on the computer.

Second, the system does not push a teach-back at completion time.
Tony remembers a video fine right after watching it.
The value is later: the system brings the right knowledge back at the right moment, whether or not he still remembers it, and it offers a random-review surface for browsing what he has collected.

That flips the architecture from a learning ritual into a capture-and-recall system.
Capture must be nearly free.
Recall quality is the product.

## Design principles

1. Capture is cheap and mechanical; meaning-making is optional and can happen months later.
2. The brain (fuzzy-brain) is the one knowledge home; anything knowledge-shaped stored in Tony To-do is a disposable cache that can be regenerated.
3. Machine output never becomes brain truth; extracted cards and transcript spans are always labeled as what a source said, per the fuzzy-brain master plan.
4. Ratification happens on use, in conversation, one proposal at a time; there is never a review queue for meaning.
5. The waiting-for-transcript list is a mechanical chore queue, which is allowed; a memory review queue is not, and none is built.
6. Every resurfaced item carries provenance: video title, channel, link, and a timestamp when one exists.

## System overview

```
  Tony To-do app (SvelteKit, Vercel, phone + desktop)
    - detects a YouTube URL in a task
    - task completion creates a watch item
    - Knowledge panel: waiting-for-transcript list, paste box, random card
          |
          v
  InsForge (cloud backend for the app)
    - watch_items: capture buffer and pipeline state
    - knowledge_cards: extracted cards for display (disposable cache)
    - extract-video-knowledge function: OpenRouter extraction at paste time
          |
          v  (pulled hourly by the Mac)
  fuzzy-brain sweep (scripts/sweep-watch-items.mjs, runs inside fusion-sync)
    - lands transcript as one episode + offset-anchored evidence spans
    - Tony's optional notes become speaker "tony" spans
    - writes brain_episode_id back to InsForge
          |
          v
  fuzzy-brain (cloud Postgres: evidence store + ratified core)
    - recall.mjs searches spans alongside all other evidence
    - MCP server surfaces recall in agent work sessions
    - ratification stays conversational, one proposal at a time
```

The story in one paragraph.
Tony adds or finishes a task that contains a YouTube link, and the app quietly creates a watch item.
When he pastes the transcript, a cloud function extracts a handful of knowledge cards for the app to show, and within the hour the Mac's existing fusion-sync job lands the full transcript in the brain's evidence store, chunked into searchable spans with embeddings.
From then on the knowledge resurfaces three ways: agent sessions recall it when a task touches the same ground, the Knowledge panel deals a random card when Tony feels like browsing, and later phases add quiet task-side suggestions and a weekly recap.
Nothing becomes brain truth until a conversation proposes it and Tony approves it in his own words.

## Component responsibilities

### Tony To-do app

The app knows a task was a video, when it was finished, and where its transcript and evidence stand.
It renders the Knowledge panel and the paste flow.
It never stores embeddings, graph relationships, or brain truth, and it never writes to the brain database.

### InsForge backend

InsForge holds the two new tables and runs the extraction function.
It is the transit point between the phone-usable app and the Mac-driven brain sweep.
Everything in it is either pipeline state or regenerable display data.

### Fuzzy Brain

The brain owns the durable knowledge: the transcript as an immutable episode, evidence spans with provenance, and any eventually ratified takeaways.
All brain writes go through `scripts/brain.mjs`, per its AGENTS.md rule 4; the sweep script shells that CLI exactly like the existing `sweep-clippings.mjs` does.

## Data model

### InsForge: watch_items

One row per video Tony chose to watch through the app.

- `id` uuid primary key.
- `user_id` uuid, RLS `user_id = auth.uid()` like the existing tables.
- `todo_id` text, matching the client-generated `todos.id` type.
- `video_id` text, parsed from the URL.
- `url` text, the canonical watch URL.
- `title`, `channel`, `thumbnail_url` text, filled from YouTube's keyless oEmbed endpoint.
- `state` text check in `awaiting_transcript`, `captured`, `extracted`, `skipped`; default `awaiting_transcript`.
- `transcript` text, the pasted transcript after normalization.
- `notes` text, Tony's optional own-words notes from the paste form.
- `completed_at` timestamptz, copied from the todo completion.
- `transcript_pasted_at` timestamptz.
- `brain_episode_id` uuid and `brain_ingested_at` timestamptz, written back by the sweep.
- `created_at`, `updated_at` timestamptz.
- Unique on `(user_id, video_id)`.

Brain landing is tracked by `brain_episode_id` rather than a fifth state because extraction and brain ingestion are parallel consumers of the transcript, not sequential steps.
`skipped` records that Tony declined a transcript for this video, so it stops appearing in the waiting list.

### InsForge: knowledge_cards

The extracted, displayable units.
This table is a cache: cards can be deleted and re-extracted at any time, which is why they carry `extractor_version` like the existing `evidence` table does.

- `id` uuid primary key.
- `user_id` uuid with the same RLS.
- `watch_item_id` uuid referencing `watch_items`.
- `video_id` text.
- `kind` text check in `claim`, `technique`, `tool`, `action`, `quote`.
- `body` text, the card itself, written from the transcript.
- `excerpt` text, a short verbatim transcript quote backing the card.
- `timecode_seconds` integer nullable, derived from the transcript's timestamp markers.
- `deep_link` text, `https://youtu.be/<id>?t=<seconds>` when a timecode exists.
- `topics` text array for phase-3 matching.
- `status` text check in `active`, `kept`, `archived`; default `active`.
- `surfaced_count` integer default 0 and `last_surfaced_at` timestamptz, for random rotation.
- `extractor_version` text, `created_at` timestamptz.

### InsForge: audit_log addition

`audit_log.action_type` has a CHECK constraint that currently allows exactly `loop_created` and `draft_generated`, and `SettingsPanel.svelte` maps exactly those labels.
The extraction function logs a new `video_knowledge_extracted` action, so the migration widens the CHECK and the label map gains one entry.

### Fuzzy Brain: source, episode, spans

No schema change.
The sweep creates one source with `kind: "youtube"` and `label: "watch"` via the existing `ensureSource` helper, alongside the existing `clipping/digest` and session sources.

Each video becomes one episode.
`source_locator` is the canonical `https://youtu.be/<videoId>`, which makes the existing unique index on `(source_id, source_locator)` the dedupe: landing the same video twice is a duplicate-key result that means already captured, exactly as the digest-article skill treats it.
`raw` is a small header (title, channel, URL, watched date) followed by the normalized transcript with inline `[H:MM:SS]` markers, then a `Tony's notes` section when notes exist.
`occurred_at` is the watch completion time.

Evidence spans chunk the transcript at timestamp-marker boundaries into spans of roughly 500 to 1500 characters, merging tiny blocks, with exact character offsets into `raw` computed the same way `session-parser.mjs` and `sweep-clippings.mjs` do.
Transcript spans carry no speaker.
Notes spans carry `speaker: "tony"`, which matters because `recall.mjs` boosts Tony-attributed evidence by 1.2x, so the optional notes box quietly makes his own words the most findable part of every video.
The sensitive-pattern scrub runs before rendering, matching the ingestion order both existing ingesters enforce so offsets stay exact.

The brain schema has no media-timecode column, and none is added now.
Timestamps live inline in span text and in app-side deep links; an additive nullable column can be proposed later once this source has shipped and proves the signal, which is the repo's ADR discipline.

## The capture flow

### Detecting a video task

`src/linkify.js` already labels youtube.com and youtu.be links, so it gains a `parseYouTubeVideoId(url)` helper handling `watch?v=`, `youtu.be/`, `shorts/`, `live/`, and `embed/` forms with extra query parameters.
A todo whose title or note contains a YouTube URL is a video task.

### Completion hook

`handleComplete` in `src/routes/+page.svelte` is the seam, as the research doc already established.
After the existing completion cue fires, a video task creates or updates the watch item through the remote layer, following the `todoRemote.js` pattern of narrow writes.
On desktop the completion cue can offer one quiet `Add transcript` action; ignoring it costs nothing and the item just sits in the waiting section.
Completing the same video's task again updates `completed_at` on the existing row rather than creating a duplicate.

### The waiting section and paste flow

A new `knowledge` tab joins `WORKSPACE_TABS` in `src/viewModes.js`, with the panel checklist the codebase already follows: registry entry, view branch, the hand-maintained `is-board-view` class chain, and a `KnowledgePanel.svelte` modeled on `AgendaPanel.svelte`.
The menubar app imports no view registry, so it needs zero changes.

The panel's top section lists watch items in `awaiting_transcript` with title, channel, thumbnail, and watched date.
Each row expands to a paste box plus an optional `your notes` box, with a `skip transcript` action.
On save the app normalizes the transcript, stores it on the watch item, sets `captured`, and calls the extraction function.

### Transcript normalization

Pasting from YouTube's own transcript panel produces alternating timestamp and text lines, so the normalizer detects timestamp-only lines (`M:SS`, `MM:SS`, `H:MM:SS`) and folds them into inline `[H:MM:SS]` markers ahead of their text.
Plain prose without timestamps is accepted as-is.
This is a pure function in the store layer with unit tests, since parsing pasted text is exactly the kind of logic that breaks quietly.

## Extraction

The `extract-video-knowledge` InsForge function follows `functions/ingest-granola-loops.ts`, the existing template: verified user token or shared secret, OpenRouter call with `temperature: 0`, a transcript character limit, and inserts plus an `audit_log` row.
The client invokes it through `insforge.getHttpClient().post('/functions/...')`, since the SDK's `functions.invoke` derives the wrong host in this app.

The prompt asks for three to ten cards, each typed, grounded in a verbatim excerpt, and stamped with the nearest timestamp marker.
`anthropic/claude-haiku-4.5` is the starting model because the Granola function already proves that path; the `extractor_version` stamp means a better model later can re-extract everything without ceremony.
The UI always presents cards as what the video said, never as what Tony learned, keeping the epistemic line the whole system depends on.

## Landing in the brain

A new `scripts/sweep-watch-items.mjs` in the fuzzy-brain repo mirrors `sweep-clippings.mjs`: an inbox of user-chosen items becomes episodes and spans, with no allowlist because pasting a transcript is itself the admission decision.
It reads watch items with a transcript and no `brain_episode_id` from InsForge over authenticated REST, using a key stored in fuzzy-brain's `.env.local`, lands each as episode plus spans through `lib/brain-cli.mjs`, and writes `brain_episode_id` back.
`fusion-sync.mjs` gains it as a step, so the existing hourly launchd job picks it up and the existing `embed-sweep` fills embeddings in the same cycle.

The pasted-transcript scars the brain already carries, the 64MB exec buffer, the 200k-character FTS cap, and the 4000-character embedding head cap, exist precisely because pasted transcripts already flowed through this system, so span chunking at 500 to 1500 characters keeps each span fully searchable and fully embedded.

Fuzzy-brain changes carry their own changelog and version bump under that repo's rule 8.

## Recall surfaces

### Agent work sessions

This is the highest-value moment and the cheapest to enable.
The brain's MCP server already exposes `recall` with epistemic states and provenance, but it is registered only in Codex's config, not Claude Code's.
Registering it for Claude Code means any working session can surface `[evidence, unratified]` video spans with channel, date, and inline timestamps whenever a task touches ground a video covered, which is exactly Tony's "bring it up at the right moment, whether I remember it or not."

### Random review card

The Knowledge panel's second section deals one card at a time from `active` cards, weighted so never-surfaced cards come up first and recently surfaced ones cool down, using `surfaced_count` and `last_surfaced_at`.
Actions: open the video at the timestamp, show another, keep, archive.
Keep marks the card `kept`, which both pins it in the panel and gives future brain conversations a shortlist to propose from.
The surface is pull-only: no badge, no due count, no streak.

### Task-context suggestions (phase 3)

When a task is open, the app can show at most one dismissible suggestion when its title and note overlap strongly with card topics.
Weak matches stay silent, because noisy suggestions train Tony to ignore the feature.
Keyword and topic overlap is enough for the first version; embedding search inside InsForge is an open question below.

### Weekly recap (phase 3)

A small panel section summarizing the week: videos finished, cards kept, one resurfaced older card.
Reading it is a second retrieval pass in disguise, which is the spaced repetition the research supports, without a schedule or an obligation.

## Ratification stays conversational

The app never writes the brain, and the sweep writes only mechanical evidence.
Meaning enters the brain the only way it ever has: in conversation, one proposal at a time, in Tony's own words, with the readable version citing the video URL and evidence episode id the way digest-article already does.
An ignored proposal evaporates; the evidence row is already safe.
This is ratify-on-use: the moment knowledge proves useful in real work is the natural moment to keep it, and it costs Tony nothing when a video turns out to be entertainment.

## Decisions and alternatives

### The brain is the knowledge home; InsForge holds cache

The alternative is keeping everything in InsForge and treating the brain as optional.
That builds a second knowledge store with its own search, splits provenance, and recreates the graveyard products the master plan documents.
The cost of the chosen design is a Mac in the loop for brain landing, which the hourly fusion-sync job already absorbs.

### Extraction runs in the cloud function at paste time

The alternative is extracting during the Mac sweep.
That would keep one AI path but delays cards until the next sync and adds nothing, since cards are display cache either way.
The function path gives instant cards on any device, reuses a proven template, and lands in the existing AI audit log.

### New tables instead of reusing todos and evidence

The existing `loop_status` staging and `evidence` table almost fit, and reusing them would save a migration.
But those carry the Granola loop feature's semantics, `evidence` lacks lifecycle and rotation fields, and `todos` is the wrong place for a transcript blob.
The design reuses the patterns, excerpt, deep_link, extractor_version, narrow writes, RLS shape, in clean tables instead.

### The sweep pulls; nothing pushes into the brain

Alternatives were pushing transcripts into the iCloud clippings inbox, or giving the app a brain ingest endpoint.
File transport loses the write-back and is fragile; a remote ingest endpoint stretches the brain's two-write-paths law.
A pull with a scoped key matches how every other brain source already works.

### Transcripts come only from Tony's paste

The research doc's transcript ladder stands: no scraping, no undocumented endpoints.
Manual paste from YouTube's own transcript panel is sanctioned, takes seconds, and the waiting section absorbs the phone case.

## Privacy

Only videos Tony deliberately ran through the app are captured, never browsing history.
Transcripts sit in private stores behind auth on both sides, and the brain's sensitive-pattern scrub runs before every insert.
Deleting a watch item or card never silently deletes brain evidence; the brain's episodes are immutable by design and have their own deletion discipline.

## Delivery phases

### Phase 1: capture loop in the app

Video ID parsing in `linkify.js`, the completion hook, the two migrations, the Knowledge tab and panel with waiting list and paste flow, the transcript normalizer, and the extraction function with cards rendering.
Verification: unit tests for the parser, normalizer, and state transitions; a `knowledge-panel-smoke.mjs` following the calendar day panel smoke template; `npm test` and the production build.

### Phase 2: brain landing and session recall

The sweep script and fusion-sync step in fuzzy-brain, the `youtube/watch` source, write-back, and registering the brain MCP for Claude Code.
Verification: land a real video, then confirm `recall.mjs` returns its spans as labeled unratified evidence with provenance, and that a rewatch dedupes on the locator.

### Phase 3: resurfacing polish

Random rotation weighting, task-context suggestions, the weekly recap, oEmbed metadata backfill, and a small learning-state marker on calendar day items.

### Later, only if the loop proves itself

An embedded player with an exact ended event, an iPhone share-sheet capture path, other media kinds through the same tables, and the Data Portability backfill the research doc already scoped as heavy.

## Success and kill measures

The capture rate is the first health signal: of video tasks completed, how many get a transcript pasted within a week.
Then usage: recall hits on video evidence that Tony actually opens or uses in sessions, and kept versus archived cards.
Videos that land as evidence and never produce a kept card are a healthy outcome, not a failure.
The kill condition stays honest: if pasting stops for weeks, capture friction won; simplify to highlights-only or notes-only before adding any automation.

## Open questions

1. Where fuzzy-brain changes land: the live runtime, MCP server, and temporal layer run from the unmerged `codex/fused-brain` worktree, so the sweep must either land there or wait for a merge to main; Tony decides.
2. Whether InsForge supports vector search for phase-3 card matching, or keyword overlap stays the ceiling.
3. Whether extracted cards should eventually also land in the brain as clearly labeled machine summaries; the design starts without, since spans plus recall already cover search.
4. Tab naming: `Knowledge` is the working label.
