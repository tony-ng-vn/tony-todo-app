import { createInitialState } from './todoStore.js';

const STORAGE_KEY = 'done-log-state';
const CLIENT_ID_KEY = 'done-log-client-id';

export function loadLocalState(storage = localStorage) {
  try {
    const stored = storage.getItem(STORAGE_KEY);
    return stored ? createInitialState(JSON.parse(stored).todos ?? []) : createInitialState();
  } catch {
    return createInitialState();
  }
}

export function saveLocalState(state, storage = localStorage) {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function reconcileRemoteState(_cachedState, remoteTodos) {
  return createInitialState(remoteTodos);
}

export function getStoredClientId(storage = localStorage) {
  try {
    const value = storage.getItem(CLIENT_ID_KEY);
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

export function localTodosNeedingUpload(localTodos, remoteTodos) {
  if (!Array.isArray(localTodos) || localTodos.length === 0) {
    return [];
  }

  const remoteIds = new Set((remoteTodos ?? []).map((todo) => todo.id));
  return localTodos.filter((todo) => todo?.id && !remoteIds.has(todo.id));
}
