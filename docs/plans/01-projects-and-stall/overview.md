# Projects section and Stall rename

## Context

Tony needs a place to park project ideas that are not work yet.
Those ideas should be captured from the same write-up as a normal task.
They should land in a Projects workspace section, not on the task board.

Stall is the renamed Someday board column.
Stall is a paused ongoing task.
A project is an idea with no start date in mind.

## Scope

Included:

- A `kind` field on each todo: `task` or `project`.
- A Projects workspace tab that lists project ideas.
- A Task / Project control on the new-item form.
- Rename the Someday board column to Stall.
- Keep `someday_at` as the parked-task timestamp.
- Filter projects out of Today, Board, Calendar, and the menubar.

Excluded:

- Nested tasks under a project.
- Project due dates as a planning system.
- Converting Stall items into projects automatically.
- Agent-todo create of projects in v1.

## Constraints

The app is SvelteKit with InsForge Postgres.
Todos already use nullable timestamps for workflow (`completed_at`, `someday_at`).
RLS stays owner-scoped.
Glass UI, no visible scrollbars.
Do not commit `.env` or keys.
No CHANGELOG.md exists; do not invent one.
Bump `package.json` version only if a later phase adds a changelog the repo actually uses.

## Alternatives

**Kind column on `todos`.** One table, a `kind` check constraint, existing CRUD.
Projects reuse notes, titles, and sync.
Chosen because a project is still a captured line item, and a second table would split every remote helper.

**Separate `projects` table.** Cleaner isolation, extra RLS, extra remote module, duplicate composer.
Rejected as more machinery than the capture loop needs.

**Boolean `is_project` plus `someday_at`.** Allows a row to be both a project and a stalled task.
Rejected because that combination has no meaning.

## Applicable skills

- `insforge` for SDK mapping.
- `insforge-cli` for the migration and apply.
- `how` before each unfamiliar subsystem.
- `unslop` on PR text.
- `control-ui` plus `scripts/ui-smoke.mjs` for runtime proof.
- `playbooks/babysit.md` after the stack is open, in `drive` mode.

## Phases

1. [Domain kind](phase-1-domain-kind.md)
2. [InsForge column](phase-2-db-kind.md)
3. [Stall rename](phase-3-stall-rename.md)
4. [Composer kind](phase-4-composer-kind.md)
5. [Projects section](phase-5-projects-section.md)

## Verification

Static: `npx vitest run` on touched tests, then `npm run verify:push:web` before each PR.

Runtime: `npm run test:ui` and a local `npm run dev` pass through `control-ui` for composer and Projects.

## Implementation guidance

Run `how` over `todoCommands.js`, `todoStore.js`, and `+page.svelte` before editing them.
Name `kind` as a two-value union before writing branches.
Parse unknown remote `kind` values to `task` at the mapping boundary.
`/deslop` before commit.
`/no-comments` before review.
Do not keep `someday` as a user-facing word after phase 3.
Keep `someday_at` in Postgres.
Use `poteto-agent` for code.
Open one PR per phase, stacked, then babysit in `drive` until merge-ready.
Do not merge unless asked.
