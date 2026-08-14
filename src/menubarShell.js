// The popover used to hide the cached task list behind the remote auth round
// trip, so every cold open sat on "Connecting..." for the whole request. The
// cache is read synchronously in onMount; only that one pre-mount frame keeps
// the loading shell, and the auth gate replaces content only after the check
// has actually resolved signed-out (matching the main page's behavior).
export function resolveMenubarShell({
  stateLoaded,
  authChecked,
  useRemote,
  authUser,
  standaloneNoteId,
  hasStandaloneNoteTodo,
}) {
  if (!stateLoaded) {
    return 'loading';
  }

  if (authChecked && useRemote && !authUser) {
    return 'auth';
  }

  if (standaloneNoteId) {
    return hasStandaloneNoteTodo ? 'note' : 'note-missing';
  }

  return 'app';
}
