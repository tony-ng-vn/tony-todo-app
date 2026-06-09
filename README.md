# Todo Day Summary

A focused todo app for tracking what is open now and what was finished today. Open tasks stay in a quiet work queue; completed tasks move into a daily recap grouped by time of day, with completion time and tracked duration preserved.

The app is a small Vite + vanilla JavaScript frontend backed by InsForge Postgres when configured. Without InsForge env vars, or when opened with `?local=1`, it runs from browser `localStorage`.

## Features

- Add open tasks and mark them done.
- Daily recap grouped into Morning, Lunch, Afternoon, Evening, and Late night.
- Start, pause, and resume task timers; completing a running task finalizes its duration.
- One active timer at a time; starting another task pauses the current one.
- Task detail sheet with notes.
- Double-click task titles to rename them.
- Drag completed tasks inside a day recap to reorder them.
- `http` and `https` URLs in task titles render as external links.
- Browser-local cache first, with optional InsForge cloud sync by `client_id`.

## Backend

This project is linked to the InsForge project **Todo App** at:

```text
https://y26ze9je.us-east.insforge.app
```

The frontend uses `@insforge/sdk` from [src/insforgeClient.js](src/insforgeClient.js). Configure Vite public env vars locally:

```bash
VITE_INSFORGE_URL=https://y26ze9je.us-east.insforge.app
VITE_INSFORGE_ANON_KEY=<anon key>
```

Get the anon key from InsForge instead of hardcoding it:

```bash
npx @insforge/cli whoami
npx @insforge/cli current
npx @insforge/cli secrets get ANON_KEY
```

Keep `.env` and `.env.local` out of commits. The app stores a generated `done-log-client-id` in browser `localStorage` and scopes all remote rows by that value. Real user auth is not implemented yet.

## Local Development

Install dependencies:

```bash
npm install
```

Start the Vite dev server:

```bash
npm run dev
```

The dev server binds to `127.0.0.1`. To force local-only mode even when InsForge env vars are present, add `?local=1` to the URL.

## Checks

Run unit tests:

```bash
npm test
```

Build the app:

```bash
npm run build
```

Run the Playwright UI smoke check:

```bash
npm run dev
UI_SMOKE_URL=http://127.0.0.1:5173/ npm run test:ui
```

`test:ui` appends `?local=1`, seeds local storage, and checks mobile/desktop overflow, target sizing, contrast, button motion, and the main glass layout. If Vite chooses a different port, update `UI_SMOKE_URL`.

## Migrations

Migration files live in [migrations](migrations):

- `20260608192447_create-todos-table.sql` creates `public.todos`, client scoping, completion timestamps, and indexes.
- `20260608195454_add-task-details.sql` adds notes and planned Notion sync metadata.
- `20260609014730_add-task-timers.sql` adds timer fields and the active-timer index.

Inspect and apply migrations with the InsForge CLI:

```bash
npx @insforge/cli db migrations list
npx @insforge/cli db migrations up --all
```

For new schema changes, create migration files with:

```bash
npx @insforge/cli db migrations new <migration-name>
```

Applied migrations are history; avoid editing files that have already been applied remotely.

## Current Caveats

- There is no authentication UI yet. Data is scoped by a browser-generated `client_id`, so clearing local storage creates a new task scope.
- Offline writes update local storage first, but there is no conflict resolution or retry queue beyond the next normal sync path.
- Reordering completed tasks rewrites their `completed_at` values in one-minute increments so the chosen order persists.
- Notion sync is only planned. The schema has fields for Notion metadata, but import/export behavior is not implemented.
- Timer elapsed time is capped per active segment in the store logic to avoid runaway values.
- No RLS policy files are present in this repo; verify backend security policy state in InsForge before exposing shared or authenticated data.
