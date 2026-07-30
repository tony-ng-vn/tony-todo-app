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
- Edit title, note, progress label, due date, and delete where the main app already supports it.
- Keep completed-task timing edits in the full app because the companion only lists ongoing and open tasks.
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

For the native shell, use a small Swift executable with AppKit and WebKit.
This follows Quill's single-binary `NSStatusItem` pattern and loads either the local development URL or the deployed Vercel `/menubar` URL in an `NSPopover`.

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
   - Allows editing title, note, progress label, due date, progressive mode, and delete.
   - Leaves completed-task timing edits in the full app because completed tasks are not listed here.
   - Keeps controls dense and touch/click friendly.

The full app remains the place for daily summaries, broad recap review, drag ordering, and richer layout.

## Data Flow

The menu-bar route should follow the same local/remote behavior as the main app:

1. Load local state from `todoPersistence`.
2. If InsForge env vars are configured and `?local=1` is absent, hydrate from InsForge.
3. Apply mutations with `todoStore`.
4. Save local state immediately.
5. Sync remote mutations with `todoRemote`.

The browser and native WebKit shell keep separate authentication sessions, but both use the same account-scoped `user_id` task set after sign-in.

First-version behavior:

- Load the deployed Vercel `/menubar` URL in WebKit so it uses the web runtime and remote InsForge behavior.
- Reuse the current account authentication UI and require one sign-in inside the native WebKit profile.
- Refresh from the authoritative cloud task set whenever the popover regains focus.

## Native Shell

Native Swift shell responsibilities:

- Create an AppKit `NSStatusItem` with a template SF Symbol.
- Toggle an `NSPopover` on icon click.
- Anchor the popover below the status item.
- Use transient popover behavior so it hides when it loses focus.
- Load the deployed `/menubar` URL by default.
- In development, load the local Vite dev server `/menubar` URL.
- Package the native host as `/Applications/Done Log.app`.
- Register the app with the macOS launch-at-login service.
- Provide Launch at Login, Open Done Log, and Quit actions in the right-click context menu.

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

Native shell verification includes Swift unit tests, an app-bundle build, a process smoke check, and a manual interaction pass:

- app launches
- icon appears in menu bar
- click opens popover
- outside click hides popover
- "Open full app" opens the deployed app
- the installed app runs without an attached terminal
- launch at login can be enabled and disabled

## Implementation Notes

When implementing this spec, keep a running `implementation-notes.md` entry with decisions not covered here, tradeoffs, and anything that changes during execution.

## Detail Interaction Decision

Compact details open inline under the selected row. This is simpler than a second pane and keeps the popover predictable at menu-bar size.
