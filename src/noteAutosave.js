export function createDebouncedSaveQueue(save, { delay = 600 } = {}) {
  const entries = new Map();

  function getEntry(key) {
    if (!entries.has(key)) {
      entries.set(key, {
        hasPendingValue: false,
        pendingValue: undefined,
        ready: false,
        timer: null,
        running: null,
      });
    }

    return entries.get(key);
  }

  function cleanup(key, entry) {
    if (!entry.hasPendingValue && !entry.timer && !entry.running) {
      entries.delete(key);
    }
  }

  function drain(key, entry) {
    if (entry.running) {
      return entry.running;
    }

    entry.running = (async () => {
      while (entry.ready && entry.hasPendingValue) {
        const value = entry.pendingValue;
        entry.ready = false;
        entry.hasPendingValue = false;
        try {
          await save(key, value);
        } catch (error) {
          if (!entry.hasPendingValue) {
            entry.pendingValue = value;
            entry.hasPendingValue = true;
          }
          throw error;
        }
      }
    })().finally(() => {
      entry.running = null;
      if (entry.ready && entry.hasPendingValue) {
        void drain(key, entry).catch(() => {});
      }
      cleanup(key, entry);
    });

    return entry.running;
  }

  function schedule(key, value) {
    const entry = getEntry(key);
    entry.pendingValue = value;
    entry.hasPendingValue = true;
    entry.ready = false;
    clearTimeout(entry.timer);
    entry.timer = setTimeout(() => {
      entry.timer = null;
      entry.ready = true;
      void drain(key, entry).catch(() => {});
    }, delay);
  }

  function flush(key) {
    const entry = entries.get(key);
    if (!entry) {
      return Promise.resolve();
    }

    clearTimeout(entry.timer);
    entry.timer = null;
    entry.ready = entry.hasPendingValue;
    return drain(key, entry);
  }

  function flushAll() {
    return Promise.all([...entries.keys()].map(flush));
  }

  return {
    flush,
    flushAll,
    schedule,
  };
}

const NOTE_EDIT_STORAGE_PREFIX = 'done-log-note-edit:';

function noteEditKey(todoId) {
  return `${NOTE_EDIT_STORAGE_PREFIX}${encodeURIComponent(todoId)}`;
}

export function readNoteEdit(todoId, storage = localStorage) {
  try {
    const edit = JSON.parse(storage.getItem(noteEditKey(todoId)));
    return edit && typeof edit.note === 'string' && typeof edit.revision === 'string' ? edit : null;
  } catch {
    return null;
  }
}

export function recordNoteEdit(
  todoId,
  note,
  storage = localStorage,
  createRevision = () =>
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
) {
  const edit = {
    note,
    revision: createRevision(),
    syncedRevision: null,
  };
  storage.setItem(noteEditKey(todoId), JSON.stringify(edit));
  return edit;
}

export function markNoteEditSynced(todoId, revision, storage = localStorage) {
  const edit = readNoteEdit(todoId, storage);
  if (!edit || edit.revision !== revision) {
    return;
  }

  storage.setItem(noteEditKey(todoId), JSON.stringify({ ...edit, syncedRevision: revision }));
}

export function snapshotNoteEdits(todoIds, storage = localStorage) {
  return Object.fromEntries(
    todoIds.map((todoId) => [todoId, readNoteEdit(todoId, storage)]).filter(([, edit]) => edit),
  );
}

export function getPendingNoteEdits(todos, storage = localStorage) {
  return todos.flatMap((todo) => {
    const edit = readNoteEdit(todo.id, storage);
    return edit && edit.syncedRevision !== edit.revision ? [{ todo, edit }] : [];
  });
}

export function preservePendingNotesDuringLoad(remoteState, editsAtLoad, currentEdits) {
  return {
    ...remoteState,
    todos: remoteState.todos.map((todo) => {
      const editAtLoad = editsAtLoad[todo.id];
      const currentEdit = currentEdits[todo.id];
      if (!currentEdit) {
        return todo;
      }

      const changedDuringLoad = currentEdit.revision !== editAtLoad?.revision;
      const pendingAtLoad = editAtLoad && editAtLoad.syncedRevision !== editAtLoad.revision;
      return changedDuringLoad || pendingAtLoad
        ? { ...todo, note: currentEdit.note }
        : todo;
    }),
  };
}

export function withNoteSaveLock(todoId, action, locks = globalThis.navigator?.locks) {
  return locks ? locks.request(`done-log-note-save:${todoId}`, action) : action();
}
