# Phase 5. Projects workspace section

Back: [overview](overview.md)

## Goal

Projects has its own tab.
Tony can open a project, add a note, delete it, or turn it into a task.

## Changes

`src/viewModes.js` adds `{ id: 'projects', label: 'Projects' }`.
A `ProjectsPanel.svelte` lists `getProjectTodos`.
`+page.svelte` routes the view.
Promote sets `kind` to `'task'` and leaves Stall empty.
Workspace tab tests update.

## Data structures

View mode `'projects'`.
Promote is `kind: 'task'` with `somedayAt: null`.

## Verification

Static: `viewModes.test.js` and store promote tests.

Runtime: open Projects, capture an idea, promote it, confirm it appears on Today.
