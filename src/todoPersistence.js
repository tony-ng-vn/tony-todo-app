import { createInitialState } from './todoStore.js';

const STORAGE_KEY = 'done-log-state';

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
