# Phase 3. Stall rename

Back: [overview](overview.md)

## Goal

The board column that parks an ongoing task is called Stall.
User-facing Someday copy is gone.

## Changes

`BOARD_COLUMNS` uses `id: 'stall'` and `label: 'Stall'`.
`getBoardColumnId` and `moveTodoToBoardColumn` follow that id.
Tests and Board UI copy update.
Keep the `someday_at` column and `somedayAt` field.

## Data structures

Board column id `stall` derived from `somedayAt`.
No schema rename.

## Verification

Static: `todoStore.test.js` board column tests.

Runtime: drag or move a task into Stall on the board in the browser.
