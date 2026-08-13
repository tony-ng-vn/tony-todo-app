# Phase 4. Composer kind control

Back: [overview](overview.md)

## Goal

The same new-item form can save a task or a project.

## Changes

`TaskPanel.svelte` (and the +page submit handler) add a Task / Project control.
Submit calls `addTodo` with `{ kind }`.
Project submit skips due-date assignment.
Glass styling matches the existing input row.

## Data structures

Draft state `composerKind: TodoKind`, default `'task'`.
Reset to `'task'` after submit.

## Verification

Static: store tests for `addTodo(..., { kind: 'project' })`.

Runtime: `control-ui` plus `npm run test:ui`.
Create a project from the form and confirm it is absent from Today.
