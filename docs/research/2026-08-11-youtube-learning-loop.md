# YouTube learning loop research

Date: 2026-08-11.

Status: This is a research recommendation, not an implementation decision.

## Executive conclusion

The idea is feasible, and it fits the direction of Tony To-do and Fuzzy Brain unusually well.

The important change is to frame it as a learning loop rather than an automatic transcript-ingestion pipeline.

Tony To-do should record that a video was deliberately finished, open a short live teach-back, and remain the calendar history and later entry point.

Fuzzy Brain should store the video as unratified evidence and accept only Tony's approved, own-word takeaways into the ratified brain.

The app should not depend on scraping YouTube transcripts because YouTube does not provide an official transcript-download API for arbitrary videos that a viewer watches.

The clean product loop is therefore:

1. Tony adds or shares a YouTube video into Tony To-do.
2. Tony watches it and marks it finished, or finishes it inside a future embedded player.
3. The completion creates or finds a source episode and begins one short teach-back.
4. The system uses only an authorized transcript, a creator-provided transcript, Tony's highlights, or Tony's own recollection as source material.
5. The system clearly separates what the speaker said, what the model inferred, and what Tony personally took away.
6. Tony approves, edits, or rejects each proposed takeaway one at a time.
7. Only Tony's approved own-word takeaways enter Fuzzy Brain, with a pointer back to the video evidence.
8. Fuzzy Brain later resurfaces a useful takeaway naturally when it is relevant, rather than building a review backlog.

This is more valuable than a generic YouTube summarizer because the durable object is not the summary.

The durable object is what the video changed in Tony, connected to the original source and available when a future task makes it useful.

## Why this fits the systems that already exist

Tony To-do already has the right event boundary.

Its completion handler records `completedAt`, saves the state, and persists the finished task through the remote todo path, which makes completion a concrete integration seam rather than a guessed browser event.

The relevant code is in [the page completion handler](../../src/routes/+page.svelte) and [the remote todo adapter](../../src/todoRemote.js).

The calendar is already generated from completion timestamps, so a completed video can appear in the existing history without turning the calendar into a document database.

Fuzzy Brain already has almost the exact knowledge ritual this feature needs.

Its [digest-article skill](../../../fuzzy-brain/.claude/skills/digest-article/SKILL.md) treats a source as evidence rather than brain truth, teaches it back live, accepts only Tony's own-word takeaways, requires approval, and never auto-links.

Its [evidence schema](../../../fuzzy-brain/scripts/schema.sql) already separates sources, episodes, and evidence from the ratified nodes and edges.

Its [digital-brain master plan](../../../fuzzy-brain/docs/superpowers/specs/2026-07-13-digital-brain-master-plan.md) explicitly rejects review dashboards, queues, and memory inboxes in favor of one proposal at a time and occasional spaced resurfacing in a natural moment.

The best design is therefore an extension of `digest-article` into a source-neutral `digest-media` or a sibling `digest-youtube` routine, not a second knowledge architecture inside Tony To-do.

## The product boundary

The system needs three clearly different layers.

### Layer 1: Tony To-do is the activity history and doorway

Tony To-do should know that the item was a YouTube video, when Tony planned it, and when Tony finished it.

The completed calendar item should show a small learning state such as `Not reflected`, `Evidence captured`, or `Takeaways approved`.

Opening that item should resume the associated source conversation or show the source evidence and approved takeaways.

Tony To-do should not hold the full transcript, embeddings, or graph relationships in the todo record.

### Layer 2: Fuzzy Brain's evidence store holds what the source said

The video should become one source episode with the URL, capture time, completion time, transcript origin, and any lawful transcript or user-created excerpts.

Evidence remains unratified source material even when the speaker sounds authoritative.

An AI summary should also remain an evidence-layer convenience because it is a model's read of the source, not Tony's belief.

### Layer 3: Fuzzy Brain's ratified core holds what happened to Tony

Only Tony's own-word takeaways, approved readable drafts, and explicitly approved connections should become nodes or edges.

Zero takeaways should remain a valid outcome because some videos are enjoyable or informative without changing anything durable.

This split prevents the digital brain from filling with thousands of polished summaries that Tony never internalized and may not agree with.

## What YouTube officially makes possible

### A finished task is a reliable immediate trigger

Tony marking the item finished is the strongest first trigger because it is deliberate, already implemented, cross-device through the app, and semantically means what the product needs.

The trigger also avoids confusing `opened`, `played`, `watched for thirty seconds`, and `finished`.

### An embedded player can produce an exact ended event

If Tony later watches a video inside Tony To-do, the official YouTube IFrame Player API emits `onStateChange` with state `0` when playback ends.

That event can create a precise completion suggestion without inspecting YouTube's private page internals.

Some videos cannot be embedded because the owner disables embedding, so manual completion must remain available.

The official player behavior is documented in the [YouTube IFrame Player API reference](https://developers.google.com/youtube/iframe_api_reference).

### The normal YouTube Data API does not provide watch history

The standard YouTube Data API explicitly returns `watchHistoryNotAccessible` when a client tries to retrieve the watch-history playlist.

Its activity feed reports channel and user actions such as uploads, ratings, and subscriptions, but it is not a watched-or-completed-video feed.

YouTube push notifications report channel uploads and title or description changes, not a viewer finishing a video.

These boundaries are documented in [playlistItems.list](https://developers.google.com/youtube/v3/docs/playlistItems/list), [activities.list](https://developers.google.com/youtube/v3/docs/activities/list), and the [push notification guide](https://developers.google.com/youtube/v3/guides/push_notifications).

### Google Data Portability can provide a daily history backfill

Google's Data Portability API can export `myactivity.youtube` records with timestamps, YouTube URLs, titles such as `Watched...`, and channel details.

Time-based access permits a new export after 24 hours under a 30-day or 180-day consent period.

The export is an archive job that can take minutes, hours, or longer, so it is a batch reconciliation tool rather than a completion webhook.

The exported activity does not document a percent-watched or finished field, so the app must not silently reinterpret `Watched...` as `Finished`.

A production app must be approved by Google, request the minimum scopes, provide explicit consent and deletion controls, and may need a security assessment for restricted scopes.

The official details are in the [My Activity schema](https://developers.google.com/data-portability/schema-reference/my_activity), [time-based access guide](https://developers.google.com/data-portability/user-guide/time-based), and [Data Portability policy](https://developers.google.com/data-portability/policy).

This integration is promising for a later daily prompt such as `YouTube recorded these three watched videos yesterday; which ones did you actually finish?`.

It is too heavy and too imprecise to be the first version.

### Google Takeout can support manual historical import

Google Takeout supports one-time exports and scheduled archives every two months.

It can help Tony import older watch activity or audit gaps, but it is not useful for an immediate after-video flow.

Google documents the archive cadence and sharing model in [Google Takeout help](https://support.google.com/accounts/answer/3024190).

## Transcript acquisition is the central constraint

### The official caption API is mainly for owned or managed videos

`captions.list` requires OAuth, costs 50 quota units, and returns caption-track metadata rather than the caption text.

`captions.download` returns the caption file, costs 200 quota units, and explicitly requires the authorized user to have permission to edit the video.

That path is useful for Tony's own uploads or videos managed by an authorized content owner, but it does not solve arbitrary public videos that Tony watches.

The official limits are documented in [captions.list](https://developers.google.com/youtube/v3/docs/captions/list) and [captions.download](https://developers.google.com/youtube/v3/docs/captions/download).

### YouTube has a viewer transcript but no documented public export endpoint

YouTube lets a viewer open `Show transcript` for a video that has captions and jump to a timestamp by selecting a transcript line.

The official help page documents viewing and navigation, but it does not document an API for exporting arbitrary viewer transcripts.

The viewer feature is described in [YouTube's transcript help](https://support.google.com/youtube/answer/15930243).

### Automated scraping is not a sound product foundation

YouTube's Terms define Content to include text such as scripts, restrict reproduction and downloading except when the service or rights holders authorize it, and prohibit automated access such as scrapers without prior written permission.

The YouTube Developer Policies also prohibit undocumented API access and scraping, restrict content storage, impose refresh or deletion rules on most stored API data, and broadly constrain derived data from API data.

Those policies do not mean that all private note-taking is forbidden.

They do mean that a production feature that silently scrapes and stores every public transcript is not an officially supported foundation and needs rights and legal review before it is considered.

The current terms are in [YouTube's Terms of Service](https://www.youtube.com/t/terms) and [YouTube's Developer Policies](https://developers.google.com/youtube/terms/developer-policies).

### Full transcript storage also creates a copyright question

United States fair use is a case-specific four-factor inquiry, not a fixed word count or a blanket exception for education.

Transformative use, the nature of the source, the amount copied, and market effect all matter.

The product should therefore prefer Tony's own notes, short attributed excerpts, and source links over permanent copies of full third-party transcripts unless the transcript is licensed or authorized.

The U.S. Copyright Office explains the four factors in its [Fair Use Index](https://copyright.gov/fair-use/).

This document is product research rather than legal advice, and a public or commercial rollout should receive qualified legal review.

## Recommended transcript ladder

The product should try source paths in a fixed, visible order and record which path was used.

1. The app should use an owner-authorized caption download when Tony owns or manages the video.
2. The app should accept a creator-published or otherwise licensed transcript when its use terms permit processing and storage.
3. The app should accept a transcript or excerpt Tony deliberately provides after confirming that he is authorized to use it.
4. The app should capture Tony's timestamped highlights while he watches through an approved viewing surface.
5. The app should run a reflection-only teach-back when no transcript is available.

A third-party transcript service may be considered only after it documents its source, rights, retention, privacy, and deletion terms contractually.

The fact that another product displays YouTube transcripts does not prove that its acquisition method is available or acceptable for this app.

Local speech recognition is appropriate only when Tony has an authorized audio or video file, such as his own recording.

Downloading audio from another person's YouTube video merely to transcribe it would reintroduce the same platform and rights problem.

## Recommended live experience

### Capture before or during the watch

On web and desktop, Tony can paste a YouTube URL into the task note or use a narrowly scoped browser extension that sends only the canonical URL, title, and an explicit `Save to Tony To-do` action.

A Chrome extension can request only YouTube host access, and Chrome documents that host and content-script permissions are visible to the user and can be granted optionally.

The official permission model is described in [Chrome's extension permission guide](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions).

The extension should not read the transcript or broad browsing history.

On iPhone, a Tony To-do Share Extension can accept the YouTube URL from the system share sheet.

Apple's official Share Extension model is designed for user-initiated sharing from another app and lets the extension preview, validate, and annotate the shared content.

The platform behavior is described in [Apple's Share Extension guide](https://developer.apple.com/library/archive/documentation/General/Conceptual/ExtensibilityPG/Share.html).

iOS Shortcuts can trigger when an app opens or closes, but Apple does not document a YouTube playback-ended trigger.

Closing YouTube is therefore too noisy to mean that a specific video was finished.

Apple documents the available app trigger as `Is Opened` or `Is Closed` in the [Shortcuts setting-trigger guide](https://support.apple.com/guide/shortcuts/apde31e9638b/ios).

### Start the teach-back at completion

After the completion animation, Tony To-do should offer one calm action such as `Reflect on this video`.

The system should first ask Tony to recall the main idea without showing an AI summary.

It should then ask one or two questions that turn passive recognition into active retrieval, such as `What is the one idea you would use?` and `What changed your mind?`.

Only after Tony answers should the source or AI draft fill gaps, correct attribution, or offer overlooked points.

Repeated retrieval after initial learning produced substantially better delayed recall than repeated study in a controlled experiment reported by [Karpicke and Roediger](https://doi.org/10.1126/science.1152408).

Spacing also matters, but the useful interval depends on the desired retention period rather than one universal schedule, as shown in the primary study by [Cepeda and colleagues](https://pubmed.ncbi.nlm.nih.gov/19076480/).

The product should start with a modest default such as one later resurfacing and learn from Tony's response instead of claiming that `1, 7, 30 days` is scientifically optimal for every idea.

### Preserve epistemic footing in every draft

Each proposed item should have one visible type such as `The speaker claims`, `Tony noticed`, `Possible action`, `Open question`, or `Model inference`.

Every source-dependent item should link to the video and a timestamp or transcript span when one exists.

The system should never convert `the speaker said X` into `X is true` without independent verification.

For consequential factual claims, the review can offer a separate `Verify this` action that searches primary sources and preserves the result as distinct evidence.

### Ratify in conversation rather than a queue

The AI should propose one candidate takeaway at a time.

Tony should be able to keep it in his own words, edit it, reject it, or leave it only as evidence.

The system may draft a neutral readable version, but Tony must see and approve both his verbatim raw statement and the readable version before a brain write.

Connections to existing nodes should be suggestions with a typed reason, and Tony should approve each connection separately.

Ignoring a proposal should not create a red badge, an overdue review, or a guilt-producing backlog.

An unanswered high-value candidate may return once later in a relevant conversation, as the Fuzzy Brain master plan already specifies.

## Why a gallery should not become the main review system

A YouTube gallery is visually attractive, and products such as Readwise, Glasp, Recall, and Matter prove that people value a browsable library.

The risk is that a gallery becomes another saved-content graveyard whose unread review count grows faster than Tony's attention.

The existing Fuzzy Brain architecture deliberately rejects that pattern.

If a gallery is built, it should be an evidence browser and source history, not a queue Tony is expected to clear.

Each card can show the thumbnail, title, watched date, evidence availability, approved takeaways, and the last useful resurfacing.

The calendar remains the chronological view, the evidence browser remains the source view, and conversation remains the meaning-making view.

## How later recall should work

Proactive recall should search only approved takeaways when it is claiming something about Tony's knowledge, beliefs, or intentions.

It may also retrieve unratified video evidence, but it must label that material as something a source said rather than something Tony believes.

When Tony starts a relevant task, the system can say `A takeaway you approved from this video may help because it addresses the same problem.`.

The suggestion should include the approved takeaway, the reason it matched, the source title, and a timestamped link.

It should offer to use the idea, open the source, or dismiss it.

Weak matches should stay silent because noisy proactive recall trains the user to ignore the feature.

The system should not claim `You learned X` merely because a transcript or AI summary contains X.

## Suggested conceptual records

The implementation should reuse Fuzzy Brain's existing source, episode, and evidence model instead of creating a competing transcript store in Tony To-do.

Tony To-do needs only a stable link from a todo to the corresponding Fuzzy Brain episode and its current reflection state.

The source episode should record the canonical video URL, video ID, source title and channel snapshot, capture method, watched time, completion time, transcript origin, rights basis, and any artifact-expiry rule.

Each evidence span should record exact text when allowed, its speaker, start and end timestamps, acquisition method, and ingestion time.

Each model-generated proposal should record its source span IDs, prompt or extractor version, creation time, and epistemic label.

Each approved takeaway should preserve Tony's immutable raw words, the readable version he approved, the source URL, the evidence episode ID, and the ratification time.

This provenance lets a future answer move from a claim back through Tony's takeaway to the exact source moment.

## Privacy and security requirements

Watch history can reveal health concerns, politics, religion, relationships, finances, and other intimate interests.

The product should capture only videos Tony explicitly saves or approves, rather than silently collecting his entire browser history.

Any Data Portability import should explain exactly what will be copied, why it is useful, how long it is retained, which AI providers receive it, and how Tony can delete or export it.

OAuth tokens and imported archives should be encrypted at rest, and all transfers should use HTTPS.

The Data Portability policy explicitly requires clear in-context consent, minimum necessary scopes, secure handling, and deletion help.

Transcript processing should be local when practical or limited to the smallest necessary excerpts sent to a disclosed model provider.

The system should keep a visible ingestion receipt that states what was stored in evidence, what was sent to a model, what became a ratified node, and what connections were approved.

Deleting the Tony To-do calendar item should not silently destroy brain evidence, and deleting brain evidence should require a separate, clearly scoped action that respects Fuzzy Brain's own retention rules.

## Product landscape and transferable lessons

### Readwise Reader

Readwise Reader lets a user save a YouTube URL, watch beside a synchronized transcript, navigate by transcript fragments, and create timestamped highlights and notes.

Readwise then resurfaces highlights through a Daily Review with frequency controls and keep, discard, or mastery actions.

The transferable lesson is to keep the source and timestamp next to the selected idea, then make later review active rather than simply replaying a summary.

The official workflows are documented in [Readwise's YouTube guide](https://docs.readwise.io/reader/docs/faqs/videos) and [Readwise's review guide](https://docs.readwise.io/readwise/docs/faqs/reviewing-highlights).

### Recall

Recall markets a loop that saves and summarizes content, links it into a knowledge graph, quizzes it with spaced repetition, and can surface related saved knowledge while the user browses.

The transferable lesson is the end-to-end connection from capture to later application.

The caution is that Tony's architecture requires human ratification and evidence footing that a generic automatic knowledge graph does not prove.

Recall's current product pattern is described on its [official overview](https://www.recall.it/about).

### Glasp

Glasp puts a transcript and AI summary next to YouTube, lets the user highlight transcript text and add notes, preserves timestamps, and supports later chat over saved highlights.

The transferable lesson is that a selected timestamped highlight is a better knowledge seed than an unreviewed full-video summary.

Glasp documents the workflow in its [official YouTube summary guide](https://glasp.co/youtube-summary) and [product introduction](https://blog.glasp.co/welcome-to-glasp/).

### Matter

Matter presents YouTube and podcast media as synchronized text that can be highlighted, tagged, searched, and synchronized to another knowledge system.

The transferable lesson is to let the source remain playable while the user captures the exact moment that mattered.

Matter describes this pattern on its [official site](https://www.getmatter.com/) and in its [Audio Highlights update](https://www.getmatter.com/updates/audio-highlights).

These first-party product pages verify visible workflow patterns, but they do not establish how each vendor obtains YouTube transcripts or whether that mechanism can be copied.

## Recommended delivery sequence

### Phase 0: Prove the ritual without transcript automation

The first version should recognize a YouTube URL in a task title or note and attach a `Reflect on this video` action after completion.

The reflection should run the existing Fuzzy Brain digest ritual with Tony's own recall, optional timestamped highlights, explicit approval, and zero automatic links.

The completion should remain visible in the calendar and link to the resulting source episode.

Success means Tony actually completes the teach-back and approves at least some useful takeaways without feeling that he has been assigned homework.

### Phase 1: Add the YouTube evidence source

Fuzzy Brain should gain a YouTube source kind and an episode adapter that stores URL-level provenance and the transcript origin.

The implementation should support reflection-only episodes first, creator-provided transcripts second, and owner-authorized captions where applicable.

The system should deduplicate by canonical video ID so sharing the same video twice resumes the existing evidence instead of producing duplicate brain material.

### Phase 2: Add one-tap capture surfaces

The iPhone share extension should add a video task with the canonical URL.

A desktop browser extension should do the same with minimal optional host permission and no transcript scraping.

An in-app embedded player can later offer exact ended-event completion where embedding is allowed.

### Phase 3: Add spaced, contextual resurfacing

Fuzzy Brain should occasionally resurface one unratified candidate or approved takeaway in a natural conversation when there is a strong relevance match.

Tony To-do can show a single contextual suggestion beside a task, but it should not create a review inbox.

The system should measure whether suggestions are opened, used, dismissed, or approved and should become quieter when matches are weak.

### Phase 4: Evaluate daily YouTube activity backfill

Only after the manual loop proves valuable should the product pursue Google Data Portability verification and a daily `Which of these did you finish?` reconciliation.

This phase adds high privacy, security, consent, and operational cost, while still lacking a percent-complete signal.

It should not block the product's core learning loop.

## Success measures

The primary metric should be the percentage of finished video tasks that produce at least one takeaway Tony still finds useful later.

The product should also measure teach-back completion rate, approved proposals per session, rejection rate, time spent reviewing, resurfacing-open rate, and task-assist usage.

The system should separately count videos that become evidence with zero ratified takeaways because that is a healthy outcome rather than a failure.

A qualitative kill condition should remain explicit: if the loop feels like a backlog, creates guilt, or produces generic summaries that Tony does not recognize as his thinking, the design has failed even if capture volume is high.

## Final recommendation

Build the first version around Tony's explicit completion action and the existing Fuzzy Brain `digest-article` ritual.

Extend that ritual to video evidence, let the calendar remain the historical spine and entry point, and make a short live teach-back the moment where learning becomes durable.

Do not make arbitrary transcript scraping, passive watch surveillance, a YouTube review queue, or automatic Fuzzy Brain writes part of the foundation.

The defensible and personally useful product is not `every video becomes knowledge automatically`.

It is `every chosen video can become evidence, and the few ideas that truly change Tony can become approved memory with proof`.
