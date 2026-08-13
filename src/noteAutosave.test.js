import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearNoteEdits,
  createDebouncedSaveQueue,
  getPendingNoteEdits,
  loadRemoteAfterNoteFlush,
  markNoteEditSynced,
  preservePendingNotesDuringLoad,
  readNoteEdit,
  recordNoteEdit,
  resolveSelectedNoteDraft,
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
      removeItem: (key) => values.delete(key),
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
    expect(result.staleEditIds).toEqual([]);
  });

  it('lets a newer cloud note replace a stale unsynced local edit', () => {
    const remoteState = {
      todos: [
        {
          id: 'task-1',
          note: 'from native',
          updatedAt: '2026-08-13T16:44:21.431Z',
        },
      ],
    };
    const staleEdit = {
      note: 'old browser draft',
      revision: '1',
      syncedRevision: null,
      editedAt: '2026-08-13T15:00:00.000Z',
    };

    const result = preservePendingNotesDuringLoad(
      remoteState,
      { 'task-1': staleEdit },
      { 'task-1': staleEdit },
    );

    expect(result.todos[0].note).toBe('from native');
    expect(result.staleEditIds).toEqual(['task-1']);
  });

  it('keeps local typing that is newer than the cloud note', () => {
    const remoteState = {
      todos: [
        {
          id: 'task-1',
          note: 'from native',
          updatedAt: '2026-08-13T16:00:00.000Z',
        },
      ],
    };
    const localEdit = {
      note: 'typed after native saved',
      revision: '1',
      syncedRevision: null,
      editedAt: '2026-08-13T16:30:00.000Z',
    };

    const result = preservePendingNotesDuringLoad(
      remoteState,
      { 'task-1': localEdit },
      { 'task-1': localEdit },
    );

    expect(result.todos[0].note).toBe('typed after native saved');
    expect(result.staleEditIds).toEqual([]);
  });

  it('treats a pending edit with no timestamp as older than a cloud note', () => {
    const remoteState = {
      todos: [
        {
          id: 'task-1',
          note: 'from native',
          updatedAt: '2026-08-13T16:44:21.431Z',
        },
      ],
    };
    const legacyEdit = {
      note: 'old browser draft',
      revision: '1',
      syncedRevision: null,
    };

    const result = preservePendingNotesDuringLoad(
      remoteState,
      { 'task-1': legacyEdit },
      { 'task-1': legacyEdit },
    );

    expect(result.todos[0].note).toBe('from native');
    expect(result.staleEditIds).toEqual(['task-1']);
  });

  it('still loads cloud todos when a pending note flush fails', async () => {
    const loadRemote = vi.fn().mockResolvedValue([{ id: 'task-1', note: 'from native' }]);

    const remoteTodos = await loadRemoteAfterNoteFlush(
      async () => {
        throw new Error('Note sync failed');
      },
      loadRemote,
    );

    expect(loadRemote).toHaveBeenCalledOnce();
    expect(remoteTodos).toEqual([{ id: 'task-1', note: 'from native' }]);
  });

  it('updates the open note draft when cloud data changes for the same task', () => {
    expect(
      resolveSelectedNoteDraft({
        task: { id: 'task-1', note: 'from native' },
        noteDraftTaskId: 'task-1',
        noteDraft: 'old browser draft',
        edit: null,
      }),
    ).toEqual({
      noteDraftTaskId: 'task-1',
      noteDraft: 'from native',
    });
  });

  it('does not clobber in-progress typing when cloud data arrives', () => {
    expect(
      resolveSelectedNoteDraft({
        task: { id: 'task-1', note: 'from native' },
        noteDraftTaskId: 'task-1',
        noteDraft: 'still typing',
        edit: { note: 'still typing', revision: '2', syncedRevision: null },
      }),
    ).toEqual({
      noteDraftTaskId: 'task-1',
      noteDraft: 'still typing',
    });
  });

  it('clears stale note edits from storage', () => {
    const storage = createStorage();
    recordNoteEdit('task-1', 'stale', storage, () => 'revision-1');
    clearNoteEdits(['task-1'], storage);
    expect(readNoteEdit('task-1', storage)).toBeNull();
  });

  it('snapshots shared edits and uses one browser-wide lock name per task', async () => {
    const storage = createStorage();
    recordNoteEdit('task-1', 'one', storage, () => 'revision-1');
    const locks = { request: vi.fn((_name, action) => action()) };
    const action = vi.fn().mockResolvedValue('saved');

    expect(snapshotNoteEdits(['task-1', 'missing'], storage)['task-1']).toMatchObject({
      note: 'one',
      revision: 'revision-1',
      syncedRevision: null,
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
        edit: expect.objectContaining({
          note: 'pending',
          revision: 'revision-1',
          syncedRevision: null,
        }),
      },
    ]);
  });
});
