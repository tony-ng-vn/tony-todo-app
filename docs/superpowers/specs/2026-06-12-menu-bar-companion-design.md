# Menu-Bar Companion Design

## Goal

Build a macOS menu-bar companion for the todo app so the user can manage open tasks without keeping a browser tab open.

The companion should feel like the menu-bar apps shown in the user's screenshots: a custom icon in the top bar, a click-to-open floating popover, and fast access to the work that is still open.

## Product Scope

The first version is a compact task manager, not just a shortcut.

In scope:

- Show ongoing tasks first.
- Show open tasks below ongoing tasks.
- Add a new task from the popover.
- Start and stop task timers.
- Finish tasks.
- Open and edit task details in a compact view.
- Edit title, note, progress label, timing, and delete where the main app already supports it.
- Include an "Open full app" action for the full dashboard.
- Use a custom menu-bar icon.

Out of scope for the first version:

- Rebuilding the full desktop dashboard inside the popover.
- Native macOS data storage separate from the web app.
- App Store packaging, notarization, auto-updates, or login item setup.
- Full account/auth migration.

## Recommended Approach

Create a dedicated SvelteKit `/menubar` route and load it inside a small macOS menu-bar shell.

The `/menubar` route should reuse the existing todo domain modules:

- `src/todoStore.js`
- `src/todoRemote.js`
- `src/todoPersistence.js`
- `src/insforgeClient.js`

The menu-bar route should not duplicate todo business logic. It should only provide a tighter layout and interaction model for the popover.

For the native shell, start with Electron because this repo is already JavaScript/Svelte and the first goal is fast local usability. Electron can create a tray item and a frameless popover window that loads either the local dev URL or the deployed Vercel `/menubar` URL.

## User Experience

The menu-bar icon appears in the macOS top bar. Clicking it opens a popover roughly 380-460px wide and 520-680px tall.

The popover layout:

1. Header
   - App icon/title.
   - Sync state.
   - Open task count.
   - "Open full app" icon button.

2. Quick add
   - Single-line input.
   - Enter creates a task.

3. Ongoing section
   - Running task rows appear first.
   - Each row shows title, elapsed time, stop button, finish button, and details affordance.

4. Open section
   - Open tasks appear below ongoing tasks.
   - Each row shows title, optional progress label/latest note signal, start button, finish button, and details affordance.

5. Compact detail view
   - Opens inline under the selected task row.
   - Allows editing title, note, progress label, timing fields, and delete.
   - Keeps controls dense and touch/click friendly.

The full app remains the place for daily summaries, broad recap review, drag ordering, and richer layout.

## Data Flow

The menu-bar route should follow the same local/remote behavior as the main app:

1. Load local state from `todoPersistence`.
2. If InsForge env vars are configured and `?local=1` is absent, hydrate from InsForge.
3. Apply mutations with `todoStore`.
4. Save local state immediately.
5. Sync remote mutations with `todoRemote`.

The likely risk is client identity. The current app uses a browser-local `client_id`, so an Electron shell and a normal browser may not automatically share the same task set. The implementation should make this explicit.

First-version behavior:

- Load the deployed Vercel `/menubar` URL in Electron so it uses the web runtime and remote InsForge behavior.
- Add a visible "copy/connect client id" flow if local Electron storage creates a separate task set during implementation.
- Avoid introducing full auth in this slice.

## Native Shell

Electron shell responsibilities:

- Create tray/menu-bar icon.
- Toggle a frameless popover window on icon click.
- Position the popover below the tray icon.
- Hide the popover when it loses focus.
- Load the deployed `/menubar` URL by default.
- In development, load the local Vite dev server `/menubar` URL.
- Provide a Quit action in a fallback context menu if needed.

The shell should not own todo state.

## Visual Direction

Match the existing glass design system:

- translucent surfaces
- blurred backdrops
- soft inset highlights
- restrained borders
- hidden native scrollbars

The menu-bar route should be denser than the main app and avoid nested floating cards. The custom icon should be simple enough to read at menu-bar size and work in light/dark menu bars.

## Testing

Add or extend tests in small slices:

- Unit coverage for any extracted shared page logic.
- Playwright smoke for `/menubar?local=1`.
- Smoke assertions for quick add, start timer, stop timer, finish task, and opening compact details.
- Build verification with `npm run build`.

Electron shell verification can be manual at first:

- app launches
- icon appears in menu bar
- click opens popover
- outside click hides popover
- "Open full app" opens the deployed app

## Implementation Notes

When implementing this spec, keep a running `implementation-notes.md` entry with decisions not covered here, tradeoffs, and anything that changes during execution.

## Detail Interaction Decision

Compact details open inline under the selected row. This is simpler than a second pane and keeps the popover predictable at menu-bar size.
