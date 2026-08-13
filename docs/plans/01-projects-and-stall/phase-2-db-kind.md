# Phase 2. InsForge kind column

Back: [overview](overview.md)

## Goal

Postgres stores `kind` and the app round-trips it.

## Changes

A new InsForge migration adds `todos.kind` with default `'task'` and a check constraint.
`toRemoteRecord` / `fromRemoteRecord` map `kind`.
`src/todoRemote.js` and agent-todo column lists include `kind`.
`src/todoRemote.test.js` covers both directions.
Apply with `npx -y @insforge/cli db migrations up`.

## Data structures

Column `kind text not null default 'task'` with `check (kind in ('task', 'project'))`.
Unknown or missing remote values parse to `'task'`.

## Verification

Static: vitest remote mapping tests.

Runtime: after apply, insert a project row through the client path used by tests or a one-off query that reads `kind` back.
