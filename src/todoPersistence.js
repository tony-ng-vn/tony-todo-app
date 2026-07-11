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

export function getOrCreateClientId(storage = localStorage, createId = () => crypto.randomUUID()) {
  const existing = storage.getItem(CLIENT_ID_KEY);
  if (existing) {
    return existing;
  }

  const clientId = createId();
  storage.setItem(CLIENT_ID_KEY, clientId);
  return clientId;
}
