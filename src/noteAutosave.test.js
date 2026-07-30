import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createDebouncedSaveQueue,
  getPendingNoteEdits,
  markNoteEditSynced,
  preservePendingNotesDuringLoad,
  readNoteEdit,
  recordNoteEdit,
  snapshotNoteEdits,
  withNoteSaveLock,
} from './noteAutosave.js';

describe('createDebouncedSaveQueue', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('saves only the latest value after typing stops', async () => {
    vi.useFakeTimers();
    const save = vi.fn().mockResolvedValue(undefined);
    const queue = createDebouncedSaveQueue(save, { delay: 600 });

    queue.schedule('task-1', 'first');
    await vi.advanceTimersByTimeAsync(400);
    queue.schedule('task-1', 'latest');
    await vi.advanceTimersByTimeAsync(599);

    expect(save).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);

    expect(save).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledWith('task-1', 'latest');
  });

  it('serializes saves so an older request cannot finish after a newer request', async () => {
    vi.useFakeTimers();
    let finishFirstSave;
    const firstSave = new Promise((resolve) => {
      finishFirstSave = resolve;
    });
    const save = vi.fn().mockReturnValueOnce(firstSave).mockResolvedValue(undefined);
    const queue = createDebouncedSaveQueue(save, { delay: 600 });

    queue.schedule('task-1', 'first');
    await vi.advanceTimersByTimeAsync(600);
    queue.schedule('task-1', 'latest');
    await vi.advanceTimersByTimeAsync(600);

    expect(save).toHaveBeenCalledTimes(1);

    finishFirstSave();
    await firstSave;
    await vi.runAllTimersAsync();

    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenNthCalledWith(2, 'task-1', 'latest');
  });

  it('flushes pending saves without waiting for the debounce', async () => {
    vi.useFakeTimers();
    const save = vi.fn().mockResolvedValue(undefined);
    const queue = createDebouncedSaveQueue(save, { delay: 600 });

    queue.schedule('task-1', 'one');
    queue.schedule('task-2', 'two');
    await queue.flushAll();

    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenCalledWith('task-1', 'one');
    expect(save).toHaveBeenCalledWith('task-2', 'two');
  });

  it('keeps a failed value pending so a later flush can retry it', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    const queue = createDebouncedSaveQueue(save, { delay: 600 });

    queue.schedule('task-1', 'keep me');
    await expect(queue.flush('task-1')).rejects.toThrow('offline');
    await queue.flush('task-1');

    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith('task-1', 'keep me');
  });
});

describe('shared note edit state', () => {
  function createStorage() {
    const values = new Map();
    return {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    };
  }

  it('records pending edits and marks only the current revision as synced', () => {
    const storage = createStorage();
    const first = recordNoteEdit('task-1', 'first', storage, () => 'revision-1');
    recordNoteEdit('task-1', 'latest', storage, () => 'revision-2');

    markNoteEditSynced('task-1', first.revision, storage);
    expect(readNoteEdit('task-1', storage).syncedRevision).toBeNull();

    markNoteEditSynced('task-1', 'revision-2', storage);
    expect(readNoteEdit('task-1', storage).syncedRevision).toBe('revision-2');
  });

  it('keeps shared edits that were pending or changed while remote data loaded', () => {
    const remoteState = {
      todos: [
        { id: 'task-1', note: 'remote stale while saving' },
        { id: 'task-2', note: 'remote stale during load' },
        { id: 'task-3', note: 'remote current' },
      ],
    };
    const editsAtLoad = {
      'task-1': { note: 'pending before load', revision: '1', syncedRevision: null },
      'task-2': { note: 'old edit', revision: '2', syncedRevision: '2' },
      'task-3': { note: 'already synced', revision: '3', syncedRevision: '3' },
    };
    const currentEdits = {
      ...editsAtLoad,
      'task-1': { note: 'pending before load', revision: '1', syncedRevision: '1' },
      'task-2': { note: 'typed during load', revision: '4', syncedRevision: null },
    };

    const result = preservePendingNotesDuringLoad(remoteState, editsAtLoad, currentEdits);

    expect(result.todos).toEqual([
      { id: 'task-1', note: 'pending before load' },
      { id: 'task-2', note: 'typed during load' },
      { id: 'task-3', note: 'remote current' },
    ]);
  });

  it('snapshots shared edits and uses one browser-wide lock name per task', async () => {
    const storage = createStorage();
    recordNoteEdit('task-1', 'one', storage, () => 'revision-1');
    const locks = { request: vi.fn((_name, action) => action()) };
    const action = vi.fn().mockResolvedValue('saved');

    expect(snapshotNoteEdits(['task-1', 'missing'], storage)).toEqual({
      'task-1': { note: 'one', revision: 'revision-1', syncedRevision: null },
    });
    await expect(withNoteSaveLock('task-1', action, locks)).resolves.toBe('saved');
    expect(locks.request).toHaveBeenCalledWith('done-log-note-save:task-1', action);
  });

  it('returns only todos with an unsynced shared edit', () => {
    const storage = createStorage();
    recordNoteEdit('task-1', 'pending', storage, () => 'revision-1');
    recordNoteEdit('task-2', 'synced', storage, () => 'revision-2');
    markNoteEditSynced('task-2', 'revision-2', storage);

    expect(
      getPendingNoteEdits(
        [
          { id: 'task-1', note: 'stale local value' },
          { id: 'task-2', note: 'synced' },
          { id: 'task-3', note: 'never edited' },
        ],
        storage,
      ),
    ).toEqual([
      {
        todo: { id: 'task-1', note: 'stale local value' },
        edit: { note: 'pending', revision: 'revision-1', syncedRevision: null },
      },
    ]);
  });
});
