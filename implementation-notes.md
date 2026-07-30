# Implementation Notes

## 2026-06-08

- The workspace was empty and not a git repository, so I chose a small Vite app with a tested vanilla JavaScript state module instead of introducing a heavier framework.
- The product model is completion-based: a todo appears in the daily summary for the day and time it was marked done, not the day it was created.
- Added a Playwright UI smoke check for touch target sizing, contrast, overflow, and button transition timing after the design review found mobile input and date-control issues.
- Redesigned the app around a synthesized Frosted Focus Rail / Glass Ledger direction: Apple-like blurred glass surfaces, Notion-like document rows, and a center progress rail that keeps completion feedback close to both the open list and recap.
- Linked the app to InsForge project `Todo App`, added a `todos` table via migration, and wired frontend persistence through `@insforge/sdk` using a browser-local `client_id` until real auth is added.
- Added task notes, a glass detail sheet, completed-task drag reordering, and Notion sync planning notes. Reordering completed tasks changes their saved `completed_at` values in minute increments so the daily recap order persists in InsForge.
- Added double-click title editing with InsForge title sync, and normalized the UI to SF Pro with the requested 12/13/14/16/18/24px size scale and gray color tokens. The exact `@nucleo/icons` npm package was unavailable, so the app uses inline 1px-stroke outline SVG icons styled to match the requested Nucleo direction.
- Made the outer workspace full-viewport, converted task and recap rows to stable grid tracks, and kept action controls fixed-size so long titles and links cannot collapse the Open button. Task titles now safely render `http` and `https` URLs as clickable external links.

## 2026-06-09

- Added task time tracking with separate `first_started_at`, `active_started_at`, and `tracked_seconds` fields so duration is independent from `completed_at`. This preserves the existing drag-to-reorder behavior, which still rewrites completion times for recap ordering.
- The UI allows one running task at a time: starting a task pauses any other active task and syncs all changed timer fields to InsForge. Completing a running task finalizes its tracked seconds before writing the completion timestamp.
- Duration labels use the requested display scale: minutes under 60 minutes, hour + minute under 24 hours, and day + hour + minute after 24 hours.
- Restyled open and completed tasks as Notion-like blocks with a title stack, timer metadata, and compact icon actions. Mobile task blocks stack actions below the title so long links remain readable.
- Added block placement feedback inspired by Notion/Craft/BlockNote patterns: typing a new task shows a thin insertion cursor where the block will land, the inserted block gets a short entrance animation, and recap drag targets show a drop cursor line before the target row.
- Migrated the frontend shell from a vanilla Vite entrypoint to SvelteKit while keeping the tested domain modules (`todoStore`, `todoRemote`, and `linkify`) intact. The page disables SSR because this app currently depends on browser `localStorage` and client-side InsForge sync state.
- Moved the empty recap Lottie files to SvelteKit's `static/lottie` asset directory. Added a narrow npm override for `cookie` so SvelteKit avoids the low-severity audit advisory from its declared transitive range.
- Recap buckets are always visible in this order: Early morning, Morning, Lunch, Evening, Night.
  Early morning runs from 00:00 until San Francisco sunrise, which is calculated locally with SunCalc and rounded to the minute.
  Morning runs from sunrise through 10:59, Lunch from 11:00 through 13:59, Evening from 14:00 through 19:59, and Night from 20:00 through 23:59.
  Dragging into a bucket rewrites only `completedAt` to that bucket's anchor minutes and leaves tracked duration unchanged.
- Wired the task completion Lottie into the actual Done action as a short-lived glass cue. The player is dynamically imported on mount so SvelteKit build does not evaluate the browser-only runtime during SSR, and the cue is skipped for `prefers-reduced-motion`.
- Refactored without behavior changes: InsForge update calls now share scoped update/error helpers, browser local persistence moved out of the Svelte page into a tested module, and the page's remote-sync flow uses one helper for saving/synced/offline-cache status handling.
- Added automatic light/dark theming via semantic CSS tokens after reviewing Apple, Atlassian, GitHub Primer, and Fluent guidance. Light mode now separates blocks from the canvas with raised paper surfaces; dark mode uses brighter elevated surfaces and softer shadows instead of inverted light colors.
- Added an explicit persisted light/dark toggle next to sync status because relying only on OS color scheme made theme switching undiscoverable.
  Tightened recap bucket spacing and aligned the rhythm labels to the actual recap buckets.
- Added progressive tasks as open parent tasks with completed session records. Logging a progressive task creates a daily recap entry with the current progress label and duration, then resets the parent timer while keeping the parent task open.

## 2026-07-30

- Added a compact `/menubar` Svelte route that reuses the existing todo domain, local cache, account auth, and backend-authoritative cloud reconciliation.
- Added a native Electron tray shell with a frameless translucent popover, click-to-toggle behavior, blur-to-hide behavior, an external full-app action, and a small right-click menu.
- The companion follows the app's current parallel-timer behavior instead of the issue's older single-timer wording.
- The companion uses the app's current account-based `user_id` sync instead of the design document's older anonymous `client_id` handoff.
- The compact route lists only ongoing and open tasks, so the full app remains responsible for the completed-task timing editor.
- Added Playwright coverage for quick capture, parallel start and pause, normal completion, progressive session logging, inline title and note edits, progress, due date, progressive toggle, delete, compact overflow, and hidden scrollbars.
- Added Swift configuration, navigation, permission, and single-instance tests plus a process smoke check that waits for the menu bar route to load.
- Replaced the raw Electron shell with a Swift `NSStatusItem`, `NSPopover`, and `WKWebView` host after Electron failed to register a visible macOS status item.
- The native host follows Quill's single-binary approach, keeps the existing `/menubar` web UI, avoids the Electron download, and verifies the status item with Swift unit and process smoke checks.
