import { describe, expect, it } from 'vitest';
import { resolveMenubarShell } from './menubarShell.js';

const base = {
  stateLoaded: true,
  authChecked: true,
  useRemote: true,
  authUser: { id: 'user-1' },
  standaloneNoteId: null,
  hasStandaloneNoteTodo: false,
};

describe('resolveMenubarShell', () => {
  it('shows the loading shell only before the cached state is read', () => {
    expect(resolveMenubarShell({ ...base, stateLoaded: false, authChecked: false })).toBe(
      'loading',
    );
  });

  it('renders the cached app while the remote auth check is still in flight', () => {
    expect(resolveMenubarShell({ ...base, authChecked: false, authUser: null })).toBe('app');
  });

  it('swaps to the auth gate once the check resolves signed out', () => {
    expect(resolveMenubarShell({ ...base, authUser: null })).toBe('auth');
  });

  it('never gates local mode on auth', () => {
    // authChecked true + no user is the one row where remote mode would show
    // the auth gate; local mode must still render the app.
    expect(
      resolveMenubarShell({ ...base, useRemote: false, authChecked: true, authUser: null }),
    ).toBe('app');
    expect(
      resolveMenubarShell({ ...base, useRemote: false, authChecked: false, authUser: null }),
    ).toBe('app');
  });

  it('routes standalone note windows from the cache', () => {
    expect(
      resolveMenubarShell({
        ...base,
        authChecked: false,
        standaloneNoteId: 'todo-1',
        hasStandaloneNoteTodo: true,
      }),
    ).toBe('note');
    expect(
      resolveMenubarShell({ ...base, standaloneNoteId: 'todo-1', hasStandaloneNoteTodo: false }),
    ).toBe('note-missing');
  });

  it('prefers the auth gate over a note window when signed out', () => {
    expect(
      resolveMenubarShell({
        ...base,
        authUser: null,
        standaloneNoteId: 'todo-1',
        hasStandaloneNoteTodo: true,
      }),
    ).toBe('auth');
  });
});
