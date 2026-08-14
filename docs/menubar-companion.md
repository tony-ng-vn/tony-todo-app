# macOS Menu Bar Companion

The macOS app opens the complete Daymark experience in a native window and keeps a compact companion available from the menu bar.
The compact surface runs at `/menubar`.
It supports quick capture, ongoing and open task lists, timer controls, normal completion, progressive session logging, and inline task details.

## Install

Install Daymark in Applications:

```bash
npm run menubar:install
```

The installer builds and signs `/Applications/Daymark.app` without opening it or enabling launch at login.
If `/Applications/Done Log.app` is still installed with the production bundle identity, the installer moves you onto Daymark.app instead.
Open the app yourself when you are ready.
Use the menu-bar context menu to enable Launch at Login if you want it to return automatically after the next login.
Open Daymark later from Applications or Spotlight to show the full native window.
Right-click the menu bar icon to turn Launch at Login on or off, open the full window, or quit.

## Run Locally

The native shell requires macOS 14 or newer and the Xcode command line tools.
Run `xcode-select --install` if Swift is not already available.

Install dependencies and start SvelteKit on the port used by the native development script:

```bash
npm install
npm run dev -- --port 5176
```

In another terminal, start the native shell:

```bash
npm run menubar:dev
```

The development command opens `http://127.0.0.1:5176/menubar?local=1`.
Local mode stores data in the native WebKit profile and does not connect to InsForge.
`npm run menubar` and `menubar:dev` run a separate "Daymark Local" identity.
They do not quit or replace `/Applications/Daymark.app`.
Use `npm run menubar:install` only when you intend to update the installed production app.
Development and smoke commands always run a signed app bundle so macOS keeps a stable identity instead of registering temporary Swift build executables.

## Run Against the Deployed App

Start the shell without a local override:

```bash
npm run menubar
```

The first run compiles the small Swift host.
The command remains open while the menu bar app is running, and Control+C quits it.
The default URL is `https://daymark.inhavens.com/menubar`.
The native WebKit profile has its own authentication session, so sign in once inside the popover to use the same account-backed task set as the full app.

Set `DONE_LOG_MENUBAR_URL` to test another deployment:

```bash
DONE_LOG_MENUBAR_URL=https://example.com/menubar npm run menubar
```

## Behavior

- Click the tray icon to show or hide the popover.
- Click outside the popover to hide it.
- Open Daymark from Spotlight, Applications, or the menu-bar context menu to show the root app in a resizable native window.
- Use the standard Mac window controls to move, resize, minimize, zoom, and enter full screen.
- Task notes open in the same dark native chrome as the full window, with the system traffic lights over the page instead of a separate white title bar.
- Opening a task note from the menu-bar list shows only that floating note. Drag the note header to move it.
- Double-click the traffic-light area or an empty header to fill the usable screen, subject to the macOS Desktop & Dock title-bar preference.
- Use the standard File, Edit, View, and Window menus and their usual keyboard shortcuts.
- Close the full window to return to menu-bar-only mode.
- Right-click the tray icon to control launch at login, open the full app, or quit the shell.
- Ongoing tasks appear before open tasks.
- Starting a timer does not pause other running tasks because the current app supports parallel timers.
- Finishing a normal task moves it to the recap.
- Logging a progressive task creates a completed session while keeping its parent open.
- Inline details support title, note, progressive mode, current progress, due date, and delete.
- Completed-task timing edits remain in the full app because the companion only lists ongoing and open tasks.
- Note and progress text areas accept Tab as indentation.

## Verification

With the development server running on port 5176, run:

```bash
npm test
UI_SMOKE_URL=http://127.0.0.1:5176 npm run test:ui
npm run test:menubar
npm run test:native-menubar
npm run menubar:check
npm run menubar:bundle
npm run build
```

For the manual native check:

1. Run `npm run menubar:dev`.
2. Confirm the checkmark circle is visible in the macOS menu bar.
3. Click the Daymark tray icon and confirm the popover appears below it.
4. Add a task and confirm it appears under Open.
5. Start and pause the task.
6. Expand the task, edit its fields, and confirm the note saves automatically.
7. Click outside the popover and confirm it hides.
8. Reopen it and confirm the task state remains.
9. Open Daymark from Spotlight and confirm the full root app opens in a resizable native window.
10. Double-click the traffic-light area or an empty header and confirm the window fills the usable screen, then double-click again to restore it.
11. Open a task note from the menu-bar list and confirm only the floating note appears, that dragging its header moves the window, and that it uses the same dark chrome with no white system title bar.
12. Confirm Command+M minimizes, Window > Zoom works, and Control+Command+F enters and exits full screen.
13. Right-click the tray icon and confirm Launch at Login, Open Daymark, and Quit are available.
