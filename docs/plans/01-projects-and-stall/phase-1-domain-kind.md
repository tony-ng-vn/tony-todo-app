# Phase 1. Domain kind

Back: [overview](overview.md)

## Goal

Every in-memory todo has `kind: 'task' | 'project'`.
Task lists used by Today and the board ignore projects.

## Changes

`src/todoCommands.js` owns `normalizeTodo`, `addTodo`, and pending-list filters.
`src/todoStore.js` exposes `getProjectTodos`.
`src/todoStore.test.js` and `src/todoCommands.test.js` cover defaults and exclusion.

## Data structures

`TodoKind = 'task' | 'project'`.
`normalizeTodo` defaults missing kind to `'task'`.
A project never contributes `somedayAt`.

## Verification

Static: vitest for store and commands.

Runtime: n/a. No UI yet.
