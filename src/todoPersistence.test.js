import { describe, expect, it } from 'vitest';
import { addTodo, createInitialState } from './todoStore.js';
import {
  getStoredClientId,
  loadLocalState,
  localTodosNeedingUpload,
  reconcileRemoteState,
  saveLocalState,
} from './todoPersistence.js';

describe('todo persistence', () => {
  it('loads todos from local storage', () => {
    let state = createInitialState();
    state = addTodo(state, 'Save this task', new Date('2026-06-08T08:00:00.000Z'));
    const storage = createMemoryStorage({
      'done-log-state': JSON.stringify(state),
    });

    expect(loadLocalState(storage)).toEqual(state);
  });

  it('falls back to an empty state when local storage is invalid', () => {
    const storage = createMemoryStorage({
      'done-log-state': '{not valid json',
    });

    expect(loadLocalState(storage)).toEqual(createInitialState());
  });

  it('saves state to local storage', () => {
    const storage = createMemoryStorage();
    const state = createInitialState([{ id: 'todo-1', title: 'Stored task' }]);

    saveLocalState(state, storage);

    expect(JSON.parse(storage.getItem('done-log-state'))).toEqual(state);
  });

  it('replaces cached todos with an empty authoritative remote snapshot', () => {
    const cachedState = createInitialState([{ id: 'todo-1', title: 'Cached task' }]);

    expect(reconcileRemoteState(cachedState, [])).toEqual(createInitialState());
  });

  it('reads the pre-auth client id used to reclaim orphaned cloud rows', () => {
    const storage = createMemoryStorage({
      'done-log-client-id': '  mac-browser-client  ',
    });

    expect(getStoredClientId(storage)).toBe('mac-browser-client');
    expect(getStoredClientId(createMemoryStorage())).toBeNull();
  });

  it('returns local todos that are missing from the remote snapshot', () => {
    const localTodos = [
      { id: 'todo-1', title: 'Already synced' },
      { id: 'todo-2', title: 'Only on this device' },
    ];
    const remoteTodos = [{ id: 'todo-1', title: 'Already synced' }];

    expect(localTodosNeedingUpload(localTodos, remoteTodos)).toEqual([
      { id: 'todo-2', title: 'Only on this device' },
    ]);
  });
});

function createMemoryStorage(initialValues = {}) {
  const values = new Map(Object.entries(initialValues));
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}
