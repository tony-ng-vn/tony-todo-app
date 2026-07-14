# PRD v2.0 (Finalized): Done Log -> "Thread", the open-loop assistant

**Status:** Finalized v2.0, supersedes the draft PRD in bond_feature_research_and_prd.md (v1.0)
**Date:** 2026-07-13
**Inputs:** (1) Bond feature audit + draft PRD v1.0, (2) adversarially verified deep research on Bond's public reception (95-agent sweep of HN, Product Hunt, Reddit, X, YC, blogs, run 2026-07-13), (3) technical audit of the current Done Log codebase.
**Working name:** "Thread" is kept as the working name; pick a final name that is uniquely searchable (see Risk R8).

---

## 0. What changed from the v1.0 draft, and why

The v1.0 draft assumed we could learn from Bond's user complaints.
The deep research found that, as of July 2026, there is almost no independent public record of Bond at all:

- Zero Hacker News threads under any plausible name, verified exhaustively against the Algolia index.
- A #1-of-the-day Product Hunt launch (June 11, 2026, 804 upvotes, 188 comments) that produced exactly 2 rating-only reviews with no written text.
- No comments on the YC launch page, no user feedback on the company X account, no verifiable churn reports, accuracy complaints, or pricing pushback anywhere.
- Every positive signal on record (10+ hours/week saved, "pays for itself in a day", six testimonials) is vendor-authored marketing.
- Verifiers flagged internal tension in Bond's privacy story: "runs inside your infra, data never leaves your walls" sits awkwardly against processing through third-party AI model providers, and "SOC II provided by Probo" names a compliance-automation vendor, not necessarily a completed attestation.

This absence changes the strategy in five concrete ways:

1. **The category is unproven, not crowded.** Nobody has publicly validated that AI open-loop capture retains users. We must treat trust and retention as the primary experiments, not features to copy.
2. **Launch buzz is not adoption.** 804 upvotes converting to 2 reviews is a warning: a network-mobilized launch proves nothing. Distribution must come from a wedge people describe to each other, not from a launch spike.
3. **There are no known complaints to fix, so we compete on structural trust instead.** Evidence on every task, visible confidence, and a public autonomy policy become the differentiators, because Bond documents none of them.
4. **Pricing is wide open.** The only pricing signal in the market is Bond's own $99/seat/mo (annual, framed as 50%-off beta against a $199 list) with a $199 paid first-month trial. A paid $199 trial for an unproven category is a friction we can undercut.
5. **The 188 unanalyzed Product Hunt comments and Bond's post-trial retention are open intelligence questions.** Re-check them in 3 months (see Section 12).

Everything in v1.0 that was already right is kept: the open-loop object model, evidence-first design, confidence thresholds, autonomy tiers, and the capture -> state -> prioritization -> drafting -> execution sequencing.

---

## 1. Product summary

Thread turns the exhaust of a founder's work (email, calendar, meeting notes) into a short, trustworthy daily list of open loops: commitments made, replies owed, decisions pending, and work waiting on other people.

Every item shows its evidence.
Nothing sends without approval.
The product's job is to reduce the number of unresolved obligations occupying the user's attention, not to generate tasks.

**One-line value proposition:** Know what needs you, what is waiting on others, and see the receipts for every item.

Thread is built as an evolution of the existing Done Log app, not a rewrite.
Done Log's local-first architecture, timer data, and completion-recap UI remain the shell; the open-loop engine is layered underneath (Section 9).

---

## 2. The wedge (the single most important decision)

v1.0 left the wedge as an open question. Decision:

> **MVP wedge: an evidence-backed follow-up tracker for Gmail + Google Calendar + Granola.**
> It captures what you promised, what others promised you, and drafts the follow-up that closes each loop.

Why this wedge:

- **It attacks the documented gap.** The one substantive competitor critique the research surfaced (get-alfred.ai comparison) claims Bond focuses on cross-team PM/CRM visibility, "not your inbox", and "does not triage email, draft replies, or handle follow-ups". Email and meeting follow-through is the underserved surface.
- **It is verifiable by the user in week one.** "You told Sarah you'd send the deck by Friday, here's the email" is checkable; "here are your company's top priorities" is not. Trust compounds from checkable claims.
- **Waiting-on-others is the emotional hook.** Tracking what other people owe you has a lower false-positive cost than inferring your own duties: a stale waiting item is annoying, a wrong "you must do this" destroys trust.
- **Three integrations, not six.** Gmail, Google Calendar, and Granola cover the primary persona's commitment surface. Slack moves to P1 (Section 8): it doubles ingestion volume and noise before the extraction quality is proven, and it is the hardest source to do well.

Explicitly deferred from MVP: Slack, Linear/Jira/Notion, chat interface, routines, autonomous sending, team seats, org-wide company brain, dashboards, CRM updates.

---

## 3. Target user

**Primary persona: founder or executive at a 1-50 person company.**

- Lives in Gmail, Google Calendar, and a meeting-notes tool (Granola first).
- Has 20+ conversations a day and regularly loses follow-ups.
- Delegates informally (in email and meetings) with no tracking system.
- Has abandoned at least one manual task manager.

**Initial design partners:** 10-15 founders recruited personally, including the builder himself (dogfooding: the developer already uses Granola, which is why it is the launch meeting-notes provider).

**Non-targets for MVP:** enterprises, teams needing shared views, EAs managing someone else's account, consumer users.

---

## 4. Product principles (unchanged from v1.0, now load-bearing)

1. **Evidence before confidence.** No inferred item is ever shown without a quoted source excerpt and deep link.
2. **Attention, not another inbox.** The Focus list is capped at 5 must-do items; the product is measured on loops closed, not tasks created.
3. **Human control scales with consequence.** Draft-first everywhere; nothing external sends without explicit approval in MVP.
4. **Corrections are configuration.** "Not a task", "wrong owner", and "never from this sender" immediately change future behavior, and learned rules are inspectable and revocable.
5. **Least privilege by default.** Per-label Gmail scoping, per-calendar scoping, read-only until the user grants draft creation.
6. **One canonical open loop.** Duplicate references merge; merge history is kept.
7. **No employee scoring, ever.**
8. **Never claim completeness.** Show connector health and last-sync; periodically ask "did we miss anything important this week?" and log the answer as a recall metric.

---

## 5. Primary surfaces

Mapped onto the existing Done Log UI rather than invented fresh:

| Surface | What it is | Relationship to current app |
|---|---|---|
| **Focus** | Max 5 must-do items today + "quick approvals" + "at risk" | Evolves the current Flow view / TaskPanel "Today todos" |
| **Inbox** | Medium-confidence detected loops awaiting accept/dismiss | New; a review tray above the task list |
| **Waiting** | Loops owned by someone else: who, what, age, expected date | New view; reuses list components |
| **History / Recap** | Loops closed today, bucketed by time of day | The existing daily recap (SummaryPanel), unchanged concept: "what got done" |
| **Board** | Kanban of open loops by state | Existing BoardPanel; columns become loop states |
| **Evidence sheet** | Source excerpt, deep link, confidence, "why this priority" | Extends the existing TaskDetail sheet |
| **Settings** | Connectors, scopes, learned rules, autonomy, deletion | New |

Manual task creation stays.
Detected loops and manual tasks are the same object; `source` already exists in the schema (`app`, `notion`, `progress-session`) and gains `gmail`, `gcal`, `granola`.

---

## 6. Domain model

The open-loop object extends the existing `todos` table rather than replacing it.

**Loop (extends todo):**
`type` (promise | request | waiting | approval | decision | follow-up | meeting-prep | manual), `status` (suggested | active | waiting | snoozed | done | dismissed | superseded), `priority_label` (P0-P3), `priority_score` (0-100), `confidence` (0-1), `owner` (me | person_id), `counterparty_person_id`, `due_at` + `due_source` (explicit | inferred | user), `evidence_ids`, `merge_parent_id`, `next_review_at`, `resolution_summary`, `why_priority` (one sentence, always shown).

**Evidence:** source app, source object id, author, timestamp, quoted excerpt, deep link, extractor model + version.

**Person:** name, email(s), relationship (report | peer | external | investor | unknown), VIP flag, response-time history.

**Learned rule:** trigger (sender | domain | calendar | keyword), effect (suppress | boost | VIP | never-task), created-from (which correction), revocable.

Existing fields are kept and become signals: `trackedSeconds` and timer history feed effort estimates; `completedAt` time-of-day buckets feed the recap; progressive tasks continue to work as manual loops.

---

## 7. AI system

**Pipeline (per new email / calendar event / meeting note):**
normalize -> resolve people -> classify communication act -> extract commitments/requests/deadlines -> cluster into canonical loops -> reconcile state (did a reply close an existing loop?) -> score priority -> decide surface (Focus / Inbox / hidden).

**Confidence thresholds (unchanged from v1.0):**
0.85+ goes straight to Focus or Waiting; 0.60-0.84 goes to Inbox; below 0.60 is retained for clustering but never shown.

**Priority score:**
`0.30 urgency + 0.25 responsibility (am I the blocker?) + 0.20 counterparty stakes (investor/VIP) + 0.15 staleness + 0.10 effort leverage`, each normalized 0-100.
Confidence gates display; it never inflates rank.
Weights are per-user and move with corrections.

**Hard rules:**

- The LLM is never the authority on whether an external action happened; completion is confirmed via the integration (a reply observed in Gmail closes the waiting item, not the model's belief).
- Connected content is untrusted input: instructions found inside emails, docs, or notes are never executed, tool operations are allowlisted, and retrieved content is sanitized before prompting.
- Every AI action is logged with model, prompt version, sources, and approving user.

**State reconciliation is the moat.** A reply, a rescheduled meeting, or a done Linear issue (P1) must auto-close or update loops. The v1.0 metric "incorrect auto-resolution rate" is promoted to a launch-gating metric (target < 2%).

---

## 8. Autonomy model and release phases

Autonomy tiers are unchanged from v1.0 (Tier 0 read/recommend, Tier 1 drafts, Tier 2 low-risk internal, Tier 3 approval-required external, Tier 4 prohibited).
**MVP ships Tiers 0-1 only.** Granting is per action type, never global.

**Phase 0, design partners (weeks 0-8):**
Gmail + Google Calendar + Granola read-only; extraction quality validated by hand; daily Focus and Waiting views; no drafts, no notifications beyond one morning summary; weekly interviews.
Gate to Phase 1: high-confidence precision >= 85% and 5+ accepted loops per user per week.

**Phase 1, private beta (weeks 8-20):**
Gmail draft creation (Tier 1), Inbox review tray, corrections-as-rules, morning brief by email, evidence sheet polish, auth + billing.
Gate: 60% week-4 retention among activated users.

**Phase 2, paid launch:**
Slack read, one PM tool (Linear), meeting prep briefs, snooze/next-review flows, mobile-responsive review.

**Phase 3:**
Routines, Tier 2 internal actions with policy engine, team seats, chat over connected context.

Chat is deliberately Phase 3: the research shows Bond leads with chat ("Ask Donna Anything") while its trust surface is undocumented; we ship the trustworthy list first.

---

## 9. Build plan from the current codebase

The existing architecture is genuinely reusable; this is an extension, not a rewrite.

1. **Auth first.** Replace anonymous `client_id` with real InsForge auth (the schema and AGENTS.md already anticipate this). Migrate `todos` rows to `user_id`; add RLS. This blocks everything else.
2. **Schema migrations.** Extend `todos` with loop fields (Section 6); add `evidence`, `people`, `learned_rules`, `connectors` tables. Continue the existing `/migrations` pattern.
3. **Ingestion service.** A server-side worker (InsForge functions or a small Node service) handles Gmail/Calendar OAuth, incremental sync (Gmail history API, Calendar sync tokens), and Granola import. The SvelteKit SPA stays a pure client; ingestion cannot live in the browser.
4. **Extraction pipeline.** LLM calls server-side behind a gateway; store extractor version on every evidence row so precision regressions are attributable.
5. **UI evolution.** Extend `todoStore.js` reducers with loop states (the pure-function, well-tested design makes this cheap); add Inbox and Waiting views; extend TaskDetail into the evidence sheet. Keep the glass aesthetic and existing test discipline (Vitest + Playwright smoke checks).
6. **Local-first stance narrows.** Manual tasks stay optimistic local-first; detected loops are server-authoritative (they originate server-side). The existing remote-authoritative reconciliation on mount already fits this.

**Known build risk:** Google OAuth verification for restricted Gmail scopes (read + drafts) requires a security assessment and takes weeks; start the verification process at Phase 0 with test users, budget for CASA assessment before public launch.

---

## 10. Pricing

Bond's pricing ($99/seat/mo annual as "50% off beta", $199 paid first month, anchored against a $150k/yr human chief of staff) has zero independent validation and a high-friction paid trial.
Counter-position:

- **Free 14-day trial, no charge upfront.** In a category with no social proof, a $199 paid trial is a gift to us; remove the friction Bond added.
- **Individual: $39/mo monthly or $29/mo annual.** Priced for a founder's personal card, an impulse decision rather than a procurement decision.
- **Pro: $79/mo** adds Slack, PM-tool integration, routines (Phase 2+).
- **Team: later, $59/seat/mo** when shared context exists.

Rationale: v1.0 priced against executive time ($49-149); the research shows nobody has proven willingness to pay even $99 in this category (no retention or review evidence exists), so price to maximize trial volume and learning, and raise later on demonstrated retention.
Revisit after Phase 1 retention data.

---

## 11. Metrics

**North star: trusted open loops closed per weekly active user** (accepted as relevant, then completed / resolved / closed by an observed reply).

**Launch-gating quality metrics:**

- High-confidence precision >= 85% (design-partner validated)
- Incorrect auto-resolution rate < 2%
- Duplicate-loop rate < 5%
- Evidence-link coverage = 100% (hard invariant, not a target)

**Trust metrics:** acceptance rate of suggested loops, "not a task" rate trend per user (must fall over time), learned-rule revocation rate, user-reported missed commitments (weekly prompt).

**Business:** activation (3 connectors + 5 accepted loops + 1 close within 72h), week-4 retention >= 60%, trial-to-paid >= 20%.

**Anti-metrics (watched to stay low):** tasks generated per user (more is worse), notifications per day, time spent in app (this product should reduce it).

---

## 12. Risks (updated with research findings)

- **R1, false positives destroy trust (top risk, unchanged).** Mitigation: thresholds, Inbox quarantine, evidence always, one-tap corrections that become rules.
- **R2, launch buzz mistaken for demand (new, from research).** Bond's 804-upvote / 2-review gap is the cautionary tale. Mitigation: no launch-driven roadmap decisions; gates are retention-based; design partners before any public launch.
- **R3, category may not retain (new).** No public evidence exists that anyone retains in this category. Mitigation: Phase 0/1 gates are explicitly retention experiments; be willing to narrow to the Waiting-tracker alone if that is what retains.
- **R4, privacy claims must be literal (sharpened).** Bond's "never leaves your walls" tension is a lesson: publish an honest data-flow page (what is read, what is stored, which model providers process it, ZDR status, deletion timeline) from day one. Never claim more than is true.
- **R5, Google OAuth verification timeline.** See Section 9; start early.
- **R6, incumbent expansion.** Superhuman (follow-ups), Motion (prioritization), Notion AI, and meeting tools can each expand here. Moat: state reconciliation quality, correction learning, and evidence UX, not the list UI.
- **R7, prompt injection via connected content.** Mitigations in Section 7 are MVP requirements, not roadmap.
- **R8, name collision (new, from research).** "Bond" is unfindable partly because another Bond app exists; searches mis-attribute. Choose a final name with zero product-name collisions and a searchable string.
- **R9, solo-builder scope.** MVP as specified is months of work for one person. The cut line preserving the thesis: Gmail-only capture + Waiting view + evidence sheet is a shippable Phase 0; Calendar and Granola can follow inside Phase 0.

---

## 13. Decisions on v1.0's open questions

1. Medium-confidence items: separate Inbox tray, never mixed into Focus.
2. Minimum evidence to create a loop: one quoted excerpt + deep link, no exceptions.
3. Waiting-on-others as wedge: yes, co-equal with promise capture; it is the lower-risk half of the wedge.
4. Automatic internal reminders: no in MVP; draft-only until Phase 3 policy engine.
5. Private email + company Slack: MVP is personal-account only, which dissolves the question until team seats.
6. Conflicting sources: the system of record per object type wins (Gmail for replies, calendar for times, PM tool for issue state); material conflicts are surfaced, not silently resolved.
7. History depth before first brief: 30 days of Gmail + 90 days of calendar; enough for person-graph warmth without a scary first sync.
8. Goals: inferred, but confirmed in onboarding; never silently assumed.
9. Highest value / lowest trust-risk actions: follow-up drafts and meeting-prep briefs; both read-only or draft-only.
10. Buyer: the individual executive on a personal card; the company becomes the buyer only at Team tier.
11. Recall measurement: weekly "did we miss anything?" prompt + sampled review of uncaptured threads, reported as estimated recall.
12. Employee consent: out of scope until team seats; personal-account MVP reads only what the user already sees.

---

## 14. Open intelligence questions (recheck ~October 2026)

1. What do Bond's 188 Product Hunt launch comments actually contain, and did any real reviews accumulate?
2. Did Bond's $199 trial -> $99 annual conversion produce visible retention, testimonials, or churn complaints?
3. Has Bond completed a real SOC 2 attestation, and did anyone publicly challenge the "never leaves your walls" claim?
4. Did any independent user sentiment appear for the category (Bond, Motion AI features, Superhuman follow-ups) that changes the trust thesis?

---

## Appendix A: Research provenance

- Bond feature audit and draft PRD v1.0: bond_feature_research_and_prd.md (research date 2026-07-12).
- Deep research run 2026-07-13: 5 search angles, 13 sources fetched, 57 claims extracted, 25 adversarially verified (3 skeptic votes each), 21 confirmed, 4 refuted. Key confirmed absences: 0 HN threads (Algolia exhaustive), 2 rating-only PH reviews vs 804 upvotes, 0 YC launch comments, 0 independent churn/pricing/accuracy reports. Key confirmed facts: $99/seat/mo annual beta pricing with $199 paid trial month; all ROI claims vendor-authored; privacy claims self-reported with flagged tensions.
- Codebase audit 2026-07-13: SvelteKit 2 / Svelte 5 SPA, InsForge Postgres backend, local-first with remote reconciliation, pure-function domain store with tests, timers + progressive sessions + time-of-day recap, no auth, no AI, no live integrations.
