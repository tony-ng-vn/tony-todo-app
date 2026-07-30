# macOS Menu Bar Companion

The menu bar companion provides a compact Done Log surface at `/menubar`.
It supports quick capture, ongoing and open task lists, timer controls, normal completion, progressive session logging, and inline task details.

## Run Locally

Install dependencies and start SvelteKit on the port used by the Electron development script:

```bash
npm install
npm run dev -- --port 5176
```

In another terminal, start the native shell:

```bash
npm run menubar:dev
```

The development command opens `http://127.0.0.1:5176/menubar?local=1`.
Local mode stores data in the Electron browser profile and does not connect to InsForge.

## Run Against the Deployed App

Start the shell without a local override:

```bash
npm run menubar
```

The default URL is `https://tony-todo-app.vercel.app/menubar`.
The Electron browser profile has its own authentication session, so sign in once inside the popover to use the same account-backed task set as the full app.

Set `DONE_LOG_MENUBAR_URL` to test another deployment:

```bash
DONE_LOG_MENUBAR_URL=https://example.com/menubar npm run menubar
```

## Behavior

- Click the tray icon to show or hide the popover.
- Click outside the popover to hide it.
- Use Open full app to open the root app in the default browser.
- Right-click the tray icon to open the full app or quit the shell.
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
npm run test:electron
npm run menubar:check
npm run build
```

For the manual native check:

1. Run `npm run menubar:dev`.
2. Click the Done Log tray icon and confirm the popover appears below it.
3. Add a task and confirm it appears under Open.
4. Start and pause the task.
5. Expand the task, edit its fields, and save the note.
6. Click outside the popover and confirm it hides.
7. Reopen it and confirm the task state remains.
8. Use Open full app and confirm the root app opens in the default browser.
9. Right-click the tray icon and confirm Open Done Log and Quit are available.
