<script>
  import { updated } from '$app/state';
  import { onDestroy, onMount, tick } from 'svelte';
  import '../../styles.css';
  import AuthGate from '../../lib/components/AuthGate.svelte';
  import FloatingTaskNote from '../../lib/components/FloatingTaskNote.svelte';
  import MenubarTaskRow from '../../lib/components/MenubarTaskRow.svelte';
  import ThemeToggle from '../../lib/components/ThemeToggle.svelte';
  import {
    applyThemeMode,
    loadThemeMode,
    nextThemeMode,
    THEME_STORAGE_KEY,
  } from '../../theme.js';
  import {
    addTodo,
    createInitialState,
    deleteTodo,
    findDuplicateTodo,
    getActiveTodos,
    getOpenTodoSections,
    getCompletedTodoSections,
    getProgressSessions,
    getSomedayTodos,
    logProgressSession,
    pauseTodoTimer,
    partitionTaskFlowTodos,
    restoreTodoFromSomeday,
    setTodoDueDate,
    setTodoProgressive,
    setTodoSomeday,
    startTodoTimer,
    updateTodoTimeSegments,
    updateTodoNote,
    updateTodoProgress,
    updateTodoTitle,
  } from '../../todoStore.js';
  import { getCurrentUser, signInWithPassword, signOut, signUp } from '../../auth.js';
  import { insforge, isInsForgeConfigured } from '../../insforgeClient.js';
  import {
    loadLocalState,
    reconcileRemoteState,
    saveLocalState as writeLocalState,
    TODO_STORAGE_KEY,
  } from '../../todoPersistence.js';
  import {
    clearNoteEdits,
    createDebouncedSaveQueue,
    getPendingNoteEdits,
    loadRemoteAfterNoteFlush,
    markNoteEditSynced,
    preservePendingNotesDuringLoad,
    readNoteEdit,
    recordNoteEdit,
    snapshotNoteEdits,
    withNoteSaveLock,
  } from '../../noteAutosave.js';
  import {
    completeRemoteTodo,
    deleteRemoteTodo,
    insertRemoteTodo,
    loadRemoteTodos,
    logRemoteProgressSession,
    updateRemoteTodoDueDate,
    updateRemoteTodoNote,
    updateRemoteTodoProgress,
    updateRemoteTodoTimer,
    updateRemoteTodoTitle,
    updateRemoteTodoWorkflow,
  } from '../../todoRemote.js';

  const TIMER_FIELDS = ['firstStartedAt', 'activeStartedAt', 'trackedSeconds', 'timeSegments'];
  const TIMING_FIELDS = [
    'firstStartedAt',
    'activeStartedAt',
    'completedAt',
    'trackedSeconds',
    'timeSegments',
  ];
  const UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000;

  let state = createInitialState();
  let syncMessage = 'Connecting';
  let useRemote = false;
  let authChecked = false;
  let authUser = null;
  let authMode = 'sign-in';
  let authEmail = '';
  let authPassword = '';
  let authError = '';
  let authLoading = false;
  let titleDraft = '';
  let floatingNoteId = null;
  let standaloneNoteId = null;
  let isNativeHost = false;
  let isLegacyNativeHost = false;
  let themeMode = 'light';
  let expandedTaskId = null;
  let noteSaveStatuses = {};
  let liveTimer = null;
  let refreshInFlight = false;
  let updateInFlight = false;
  let updateCheckInFlight = false;
  let updateAvailable = false;
  let updateCheckTimer = null;
  const noteAutosave = createDebouncedSaveQueue(saveNoteToRemote);

  $: pendingTodos = getActiveTodos(state).map((todo) => ({
    ...todo,
    latestProgressSession: getProgressSessions(state, todo.id)[0] ?? null,
  }));
  $: pendingTodoGroups = partitionTaskFlowTodos(pendingTodos, new Date());
  $: ongoingTodos = pendingTodoGroups.ongoing;
  $: pausedTodos = pendingTodoGroups.paused;
  $: openTodoSections = getOpenTodoSections(pendingTodoGroups.scheduled, new Date());
  $: todayOpenSection = openTodoSections.find((section) => section.isToday) ?? null;
  $: datedOpenSections = openTodoSections.filter((section) => !section.isToday);
  $: openTodos = openTodoSections.flatMap((section) => section.items);
  $: somedayTodos = getSomedayTodos(state);
  $: completedTodoSections = getCompletedTodoSections(state, new Date());
  $: floatingNoteTodo = floatingNoteId ? findTodo(floatingNoteId) : null;
  $: standaloneNoteTodo = standaloneNoteId ? findTodo(standaloneNoteId) : null;

  onMount(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const requestedNoteId = searchParams.get('note');
    isNativeHost = Boolean(window.__doneLogNativeHost);
    isLegacyNativeHost =
      !isNativeHost && Boolean(window.webkit) && !navigator.userAgent.includes('Safari/');
    standaloneNoteId = requestedNoteId;
    useRemote = isInsForgeConfigured && !searchParams.has('local');
    syncMessage = useRemote ? 'Connecting' : 'Local only';
    state = loadLocalState();
    queuePendingNoteSaves();
    themeMode = loadThemeMode();
    applyThemeMode(themeMode);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('storage', handleStorageChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    updateCheckTimer = window.setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);
    void checkForUpdate();
    initializeAuth();
  });

  onDestroy(() => {
    window.clearInterval(liveTimer);
    window.clearInterval(updateCheckTimer);
    void noteAutosave.flushAll().catch(() => {});
    window.removeEventListener('focus', handleWindowFocus);
    window.removeEventListener('storage', handleStorageChange);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  });

  $: {
    window.clearInterval(liveTimer);
    if (state.todos.some((todo) => todo.activeStartedAt && !todo.completedAt)) {
      liveTimer = window.setInterval(() => {
        state = { ...state };
      }, 1000);
    }
  }

  async function initializeAuth() {
    if (!useRemote) {
      authChecked = true;
      return;
    }

    try {
      const result = await getCurrentUser(insforge);
      authUser = result.user;
      authChecked = true;

      if (authUser) {
        await hydrateRemoteTodos();
      } else {
        syncMessage = 'Sign in to sync';
      }
    } catch (error) {
      authChecked = true;
      syncMessage = `Offline cache: ${error.message}`;
    }
  }

  function handleWindowFocus() {
    refreshFromSource();
    void checkForUpdate();
  }

  function handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
      refreshFromSource();
      void checkForUpdate();
    }
  }

  function handleStorageChange(event) {
    if (event.key === THEME_STORAGE_KEY) {
      themeMode = loadThemeMode();
      applyThemeMode(themeMode);
      return;
    }

    if (event.key !== TODO_STORAGE_KEY) {
      return;
    }

    state = loadLocalState();
    renderSyncStatus();
  }

  async function checkForUpdate() {
    if (updateAvailable || updateCheckInFlight) {
      return;
    }

    updateCheckInFlight = true;
    try {
      updateAvailable = await updated.check();
    } finally {
      updateCheckInFlight = false;
    }
  }

  async function refreshFromSource() {
    if (refreshInFlight) {
      return;
    }

    refreshInFlight = true;
    try {
      if (useRemote && authUser) {
        await hydrateRemoteTodos();
      } else if (!useRemote) {
        state = loadLocalState();
        renderSyncStatus();
      }
    } finally {
      refreshInFlight = false;
    }
  }

  async function handleManualUpdate() {
    if (updateInFlight) {
      return;
    }

    updateInFlight = true;
    syncMessage = 'Updating Done Log';
    try {
      await noteAutosave.flushAll();
    } catch {
      // Pending notes remain in local storage and retry after the reload.
    }

    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set('updated', Date.now().toString());
    window.location.replace(nextUrl);
  }

  async function handleAuthSubmit({ email, password, mode }) {
    authError = '';
    authLoading = true;

    try {
      const action = mode === 'sign-up' ? signUp : signInWithPassword;
      const result = await action(insforge, { email, password });

      if (result.error) {
        authError = result.error.message;
        return;
      }

      if (mode === 'sign-up' && result.requireEmailVerification) {
        authError = 'Check your email to verify your account, then sign in.';
        authMode = 'sign-in';
        return;
      }

      authUser = result.user;
      authEmail = '';
      authPassword = '';
      await hydrateRemoteTodos();
    } catch (error) {
      authError = error.message ?? 'Something went wrong. Please try again.';
    } finally {
      authLoading = false;
    }
  }

  function handleAuthToggleMode(nextMode) {
    authMode = nextMode;
    authError = '';
  }

  async function handleSignOut() {
    await noteAutosave.flushAll().catch(() => {});
    await signOut(insforge);
    authUser = null;
    state = createInitialState();
    saveLocalState(state);
    syncMessage = 'Signed out';
  }

  async function hydrateRemoteTodos() {
    queuePendingNoteSaves();
    syncMessage = 'Loading cloud';
    const noteEditsAtLoad = snapshotNoteEdits(state.todos.map((todo) => todo.id));

    try {
      const remoteTodos = await loadRemoteAfterNoteFlush(
        () => noteAutosave.flushAll(),
        () => loadRemoteTodos(insforge, authUser.id),
      );
      const todoIds = new Set([...state.todos, ...remoteTodos].map((todo) => todo.id));
      const merged = preservePendingNotesDuringLoad(
        reconcileRemoteState(state, remoteTodos),
        noteEditsAtLoad,
        snapshotNoteEdits([...todoIds]),
      );
      clearNoteEdits(merged.staleEditIds ?? []);
      state = { todos: merged.todos };
      saveLocalState(state);
      renderSyncStatus();
    } catch (error) {
      syncMessage = `Offline cache: ${error.message}`;
    }
  }

  async function handleAdd() {
    const duplicate = findDuplicateTodo(state, titleDraft);
    if (duplicate) {
      syncMessage = `Duplicate task: "${duplicate.title}" is already open`;
      return;
    }

    const existingIds = new Set(state.todos.map((todo) => todo.id));
    const createdAt = new Date();
    state = addTodo(state, titleDraft, createdAt);
    const createdTodo = state.todos.find((todo) => !existingIds.has(todo.id));

    if (!createdTodo) {
      return;
    }

    titleDraft = '';
    saveLocalState(state);
    await syncRemoteChange('Saving', () => persistNewTodo(createdTodo));
  }

  async function handleTimerAction(action, todoId) {
    const beforeTodos = state.todos;
    state = action === 'pause' ? pauseTodoTimer(state, todoId) : startTodoTimer(state, todoId);
    const changedTodos = getChangedTodos(beforeTodos, state.todos, TIMER_FIELDS);
    saveLocalState(state);
    if (action === 'start') {
      await revealTodo(todoId);
    }
    await syncRemoteChange('Saving time', () =>
      Promise.all(changedTodos.map((todo) => persistTodoTimer(todo))),
    );
  }

  async function revealTodo(todoId) {
    await tick();
    const row = document.querySelector(`[data-menubar-id="${CSS.escape(todoId)}"]`);
    row?.scrollIntoView({
      block: 'nearest',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  }

  async function handleComplete(todoId) {
    const beforeTodos = state.todos;
    const beforeTodo = findTodo(todoId);
    state = logProgressSession(state, todoId);
    const afterTodo = findTodo(todoId);
    const createdTodo = state.todos.find((todo) => !beforeTodos.some((before) => before.id === todo.id));
    saveLocalState(state);

    if (beforeTodo?.isProgressive) {
      await syncRemoteChange('Saving session', () => persistProgressSession(afterTodo, createdTodo));
      return;
    }

    if (expandedTaskId === todoId) {
      expandedTaskId = null;
    }
    await syncRemoteChange('Saving', () => persistCompletedTodo(afterTodo));
  }

  async function handleTitleCommit(todoId, title) {
    const before = findTodo(todoId);
    const duplicate = findDuplicateTodo(state, title, { excludeTodoId: todoId });
    if (duplicate) {
      syncMessage = `Duplicate task: "${duplicate.title}" is already open`;
      return;
    }

    state = updateTodoTitle(state, todoId, title);
    const after = findTodo(todoId);
    saveLocalState(state);

    if (!before || !after || before.title === after.title) {
      renderSyncStatus();
      return;
    }

    await syncRemoteChange('Saving title', () => persistTodoTitle(after));
  }

  function handleNoteInput(todoId, note) {
    const edit = recordNoteEdit(todoId, note);
    state = updateTodoNote(loadLocalState(), todoId, note);
    saveLocalState(state);
    setNoteSaveStatus(todoId, 'saving');
    noteAutosave.schedule(todoId, edit);
  }

  async function saveNoteToRemote(todoId, edit) {
    if (!useRemote) {
      markNoteEditSynced(todoId, edit.revision);
      setNoteSaveStatus(todoId, 'saved');
      return;
    }

    if (!authUser) {
      throw new Error('Not signed in');
    }

    await withNoteSaveLock(todoId, async () => {
      const currentEdit = readNoteEdit(todoId);
      if (!currentEdit || currentEdit.revision !== edit.revision) {
        if (currentEdit) {
          state = updateTodoNote(state, todoId, currentEdit.note);
          setNoteSaveStatus(
            todoId,
            currentEdit.syncedRevision === currentEdit.revision ? 'saved' : 'saving',
          );
        }
        return;
      }

      const todo = findTodo(todoId);
      if (!todo) {
        return;
      }

      const saved = await syncRemoteChange('Saving note', () =>
        persistTodoNote({ ...todo, note: edit.note }),
      );
      if (saved) {
        markNoteEditSynced(todoId, edit.revision);
      }
      if (readNoteEdit(todoId)?.revision === edit.revision) {
        setNoteSaveStatus(todoId, saved ? 'saved' : 'error');
      }
      if (!saved) {
        throw new Error('Note sync failed');
      }
    });
  }

  function queuePendingNoteSaves() {
    let changed = false;

    for (const { todo, edit } of getPendingNoteEdits(state.todos)) {
      if (todo.note !== edit.note) {
        state = updateTodoNote(state, todo.id, edit.note);
        changed = true;
      }

      setNoteSaveStatus(todo.id, 'saving');
      noteAutosave.schedule(todo.id, edit);
    }

    if (changed) {
      saveLocalState(state);
    }
  }

  function saveLocalState(nextState) {
    let mergedState = nextState;
    for (const { todo, edit } of getPendingNoteEdits(nextState.todos)) {
      if (todo.note !== edit.note) {
        mergedState = updateTodoNote(mergedState, todo.id, edit.note);
      }
    }
    state = mergedState;
    writeLocalState(mergedState);
  }

  function setNoteSaveStatus(todoId, status) {
    noteSaveStatuses = { ...noteSaveStatuses, [todoId]: status };
  }

  async function handleProgressiveChange(todoId, isProgressive) {
    state = setTodoProgressive(state, todoId, isProgressive);
    const todo = findTodo(todoId);
    saveLocalState(state);
    await syncRemoteChange('Saving progress', () => persistTodoProgress(todo));
  }

  async function handleProgressCommit(todoId, progressLabel) {
    const before = findTodo(todoId);
    state = updateTodoProgress(state, todoId, progressLabel);
    const after = findTodo(todoId);
    saveLocalState(state);

    if (!before || !after || before.progressLabel === after.progressLabel) {
      renderSyncStatus();
      return;
    }

    await syncRemoteChange('Saving progress', () => persistTodoProgress(after));
  }

  async function handleDueDateChange(todoId, value) {
    const before = findTodo(todoId);
    const dueDate = value ? new Date(`${value}T00:00:00`) : null;
    const nextDueDate = dueDate && !Number.isNaN(dueDate.getTime()) ? dueDate.toISOString() : null;
    state = setTodoDueDate(state, todoId, nextDueDate);
    const after = findTodo(todoId);
    saveLocalState(state);

    if (!before || !after || before.dueDate === after.dueDate) {
      renderSyncStatus();
      return;
    }

    await syncRemoteChange('Saving due date', () => persistTodoDueDate(after));
  }

  async function handleSomedayChange(todoId, moveToSomeday) {
    const before = findTodo(todoId);
    state = moveToSomeday
      ? setTodoSomeday(state, todoId)
      : restoreTodoFromSomeday(state, todoId);
    const after = findTodo(todoId);

    if (!before || !after || before.somedayAt === after.somedayAt) {
      renderSyncStatus();
      return;
    }

    expandedTaskId = null;
    saveLocalState(state);
    await syncRemoteChange(moveToSomeday ? 'Moving to Stall' : 'Returning to active tasks', () =>
      persistTodoWorkflow(after),
    );
  }

  async function handleTimingChange(todoId, segments) {
    const beforeTodos = state.todos;
    state = updateTodoTimeSegments(state, todoId, segments);
    const changedTodos = getChangedTodos(beforeTodos, state.todos, TIMING_FIELDS);

    if (changedTodos.length === 0) {
      renderSyncStatus();
      return;
    }

    saveLocalState(state);
    await syncRemoteChange('Saving timing', () =>
      Promise.all(changedTodos.map((todo) => persistCompletedTodo(todo))),
    );
  }

  async function handleDelete(todoId) {
    const deletedIds = state.todos
      .filter((todo) => todo.id === todoId || todo.parentTaskId === todoId)
      .map((todo) => todo.id);

    state = deleteTodo(state, todoId);
    expandedTaskId = null;
    saveLocalState(state);
    await syncRemoteChange('Deleting task', () =>
      Promise.all(deletedIds.map((deletedId) => persistDeletedTodo(deletedId))),
    );
  }

  function toggleDetails(todoId) {
    expandedTaskId = expandedTaskId === todoId ? null : todoId;
  }

  function openFloatingNote(todo) {
    if (isLegacyNativeHost) {
      floatingNoteId = todo.id;
      return;
    }

    const noteUrl = new URL(window.location.href);
    noteUrl.searchParams.set('note', todo.id);
    noteUrl.searchParams.delete('updated');
    const noteWindow = window.open(
      noteUrl,
      `done-log-note-${todo.id}`,
      'popup,width=360,height=440,resizable=yes',
    );
    noteWindow?.focus();
  }

  function closeFloatingNote() {
    floatingNoteId = null;
  }

  function toggleThemeMode() {
    themeMode = nextThemeMode(themeMode);
    applyThemeMode(themeMode);
  }

  async function syncRemoteChange(message, action) {
    if (!useRemote || !authUser) {
      renderSyncStatus();
      return true;
    }

    syncMessage = message;
    try {
      await action();
      renderSyncStatus();
      return true;
    } catch (error) {
      syncMessage = `Offline cache: ${error.message}`;
      return false;
    }
  }

  async function persistNewTodo(todo) {
    if (!useRemote || !authUser || !todo) return;
    await insertRemoteTodo(insforge, authUser.id, todo);
  }

  async function persistCompletedTodo(todo) {
    if (!useRemote || !authUser || !todo) return;
    await completeRemoteTodo(insforge, authUser.id, todo);
  }

  async function persistTodoTimer(todo) {
    if (!useRemote || !authUser || !todo) return;
    await updateRemoteTodoTimer(insforge, authUser.id, todo);
  }

  async function persistTodoWorkflow(todo) {
    if (!useRemote || !authUser || !todo) return;
    await updateRemoteTodoWorkflow(insforge, authUser.id, todo);
  }

  async function persistProgressSession(parent, session) {
    if (!useRemote || !authUser || !parent || !session) return;
    await logRemoteProgressSession(insforge, parent, session);
  }

  async function persistTodoTitle(todo) {
    if (!useRemote || !authUser || !todo) return;
    await updateRemoteTodoTitle(insforge, authUser.id, todo);
  }

  async function persistTodoNote(todo) {
    if (!useRemote || !authUser || !todo) return;
    await updateRemoteTodoNote(insforge, authUser.id, todo);
  }

  async function persistTodoProgress(todo) {
    if (!useRemote || !authUser || !todo) return;
    await updateRemoteTodoProgress(insforge, authUser.id, todo);
  }

  async function persistTodoDueDate(todo) {
    if (!useRemote || !authUser || !todo) return;
    await updateRemoteTodoDueDate(insforge, authUser.id, todo);
  }

  async function persistDeletedTodo(todoId) {
    if (!useRemote || !authUser) return;
    await deleteRemoteTodo(insforge, authUser.id, todoId);
  }

  function renderSyncStatus() {
    syncMessage = useRemote ? `Cloud synced: ${state.todos.length}` : 'Local only';
  }

  function findTodo(todoId) {
    return state.todos.find((todo) => todo.id === todoId);
  }

  function getChangedTodos(beforeTodos, afterTodos, fields) {
    const beforeById = new Map(beforeTodos.map((todo) => [todo.id, todo]));
    return afterTodos.filter((todo) => {
      const before = beforeById.get(todo.id);
      return before && fields.some((field) => before[field] !== todo[field]);
    });
  }

</script>

{#if !authChecked}
  <main class="menubar-loading" aria-label="Loading Done Log">Connecting...</main>
{:else if useRemote && !authUser}
  <AuthGate
    mode={authMode}
    bind:email={authEmail}
    bind:password={authPassword}
    error={authError}
    loading={authLoading}
    onSubmit={handleAuthSubmit}
    onToggleMode={handleAuthToggleMode}
  />
{:else if standaloneNoteId && standaloneNoteTodo}
  <FloatingTaskNote
    todo={standaloneNoteTodo}
    noteSaveStatus={noteSaveStatuses[standaloneNoteTodo.id] ?? 'saved'}
    onNoteInput={handleNoteInput}
  />
{:else if standaloneNoteId}
  <main class="menubar-loading" aria-label="Task note unavailable">This task is no longer available.</main>
{:else}
  <main class="menubar-shell" aria-label="Done Log menu bar companion">
    <header class="menubar-header">
      <div>
        <p class="menubar-eyebrow">Menu bar</p>
        <h1 class="menubar-heading">Done Log</h1>
      </div>
      <div class="menubar-header-actions">
        <ThemeToggle {themeMode} onToggle={toggleThemeMode} compact={true} />
        <button
          type="button"
          class="menubar-update"
          class:is-available={updateAvailable}
          disabled={updateInFlight}
          aria-live="polite"
          aria-label={updateAvailable ? 'Update available for Done Log' : 'Check for Done Log updates'}
          title={updateAvailable
            ? 'A newer Done Log is ready to load'
            : 'Check for and load the latest Done Log'}
          on:click={handleManualUpdate}
        >
          {updateInFlight ? 'Updating' : updateAvailable ? 'Update available' : 'Update'}
        </button>
        <a
          class="menubar-open-full"
          href="/"
          target="_blank"
          rel="noreferrer"
          aria-label="Open full app"
          title="Open full app"
        >
          Open full app
        </a>
        {#if useRemote && authUser}
          <button type="button" class="menubar-sign-out" on:click={handleSignOut}>Sign out</button>
        {/if}
      </div>
      <output class="menubar-sync" aria-live="polite">{syncMessage}</output>
      <span class="menubar-count">{pendingTodos.length} open</span>
    </header>

    <form class="menubar-quick-add" on:submit|preventDefault={handleAdd}>
      <label class="sr-only" for="menubar-quick-add">Add task</label>
      <input
        id="menubar-quick-add"
        type="text"
        bind:value={titleDraft}
        autocomplete="off"
        placeholder="Add a task and press Enter"
      />
      <button type="submit">Add</button>
    </form>

    <div class="menubar-task-list">
      <section data-menubar-section="ongoing" aria-labelledby="menubar-ongoing-heading">
        <div class="menubar-section-heading">
          <h2 id="menubar-ongoing-heading">Ongoing</h2>
          <span>{ongoingTodos.length} running</span>
        </div>
        <div class="menubar-section-list">
          {#each ongoingTodos as todo (todo.id)}
            {@render taskRow(todo)}
          {:else}
            <p class="menubar-empty">No timers are running.</p>
          {/each}
        </div>
      </section>

      <section data-menubar-section="ready" aria-labelledby="menubar-ready-heading">
        <div class="menubar-section-heading">
          <h2 id="menubar-ready-heading">Today</h2>
          <span>{todayOpenSection?.items.length ?? 0} tasks</span>
        </div>
        <div class="menubar-date-groups">
          {#if todayOpenSection}
            <div
              class="menubar-date-group"
              data-menubar-date-group={todayOpenSection.id}
              data-menubar-is-today="true"
            >
              <div class="menubar-date-heading">
                <h3>{todayOpenSection.label}</h3>
                <span>{todayOpenSection.items.length}</span>
              </div>
              <div class="menubar-section-list">
                {#each todayOpenSection.items as todo (todo.id)}
                  {@render taskRow(todo)}
                {/each}
              </div>
            </div>
          {:else}
            <p class="menubar-empty">Nothing ready for today.</p>
          {/if}
        </div>
      </section>

      <section data-menubar-section="paused" aria-labelledby="menubar-paused-heading">
        <div class="menubar-section-heading">
          <h2 id="menubar-paused-heading">Paused</h2>
          <span>{pausedTodos.length} paused</span>
        </div>
        <div class="menubar-section-list">
          {#each pausedTodos as todo (todo.id)}
            {@render taskRow(todo)}
          {:else}
            <p class="menubar-empty">No paused tasks.</p>
          {/each}
        </div>
      </section>

      {#if datedOpenSections.length}
        <section data-menubar-section="dated-ready" aria-labelledby="menubar-dated-ready-heading">
          <div class="menubar-section-heading">
            <h2 id="menubar-dated-ready-heading">Other dates</h2>
            <span>{datedOpenSections.reduce((count, section) => count + section.items.length, 0)} ready</span>
          </div>
          <div class="menubar-date-groups">
            {#each datedOpenSections as section (section.id)}
              <div
                class="menubar-date-group"
                data-menubar-date-group={section.id}
                data-menubar-is-today="false"
              >
                <div class="menubar-date-heading">
                  <h3>{section.label}</h3>
                  <span>{section.items.length}</span>
                </div>
                <div class="menubar-section-list">
                  {#each section.items as todo (todo.id)}
                    {@render taskRow(todo)}
                  {/each}
                </div>
              </div>
            {/each}
          </div>
        </section>
      {/if}

      {#if somedayTodos.length}
        <section data-menubar-section="someday" aria-labelledby="menubar-someday-heading">
          <div class="menubar-section-heading">
            <h2 id="menubar-someday-heading">Stall</h2>
            <span>{somedayTodos.length} parked</span>
          </div>
          <div class="menubar-section-list">
            {#each somedayTodos as todo (todo.id)}
              {@render taskRow(todo)}
            {/each}
          </div>
        </section>
      {/if}

      {#if completedTodoSections.length}
        <section data-menubar-section="finished" aria-labelledby="menubar-finished-heading">
          <div class="menubar-section-heading">
            <h2 id="menubar-finished-heading">Finished</h2>
            <span>{completedTodoSections.reduce((count, section) => count + section.items.length, 0)} done</span>
          </div>
          <div class="menubar-date-groups">
            {#each completedTodoSections as section (section.id)}
              <div
                class="menubar-date-group"
                data-menubar-completed-date-group={section.id}
              >
                <div class="menubar-date-heading">
                  <h3>{section.label}</h3>
                  <span>{section.items.length}</span>
                </div>
                <div class="menubar-section-list">
                  {#each section.items as todo (todo.id)}
                    {@render taskRow(todo)}
                  {/each}
                </div>
              </div>
            {/each}
          </div>
        </section>
      {/if}
    </div>

    {#if floatingNoteTodo}
      <FloatingTaskNote
        todo={floatingNoteTodo}
        noteSaveStatus={noteSaveStatuses[floatingNoteTodo.id] ?? 'saved'}
        onNoteInput={handleNoteInput}
        onClose={closeFloatingNote}
        presentation="overlay"
      />
    {/if}
  </main>
{/if}

{#snippet taskRow(todo)}
  <MenubarTaskRow
    {todo}
    expanded={expandedTaskId === todo.id}
    onToggleDetails={toggleDetails}
    onTimerAction={handleTimerAction}
    onComplete={handleComplete}
    onTitleCommit={handleTitleCommit}
    onNoteInput={handleNoteInput}
    onOpenNote={openFloatingNote}
    noteSaveStatus={noteSaveStatuses[todo.id] ?? 'saved'}
    onProgressiveChange={handleProgressiveChange}
    onProgressCommit={handleProgressCommit}
    onDueDateChange={handleDueDateChange}
    onSomedayChange={handleSomedayChange}
    onTimingChange={handleTimingChange}
    onDelete={handleDelete}
  />
{/snippet}

<style>
  :global(html),
  :global(body) {
    min-width: 320px;
    overflow: hidden;
  }

  :global(*) {
    scrollbar-width: none;
  }

  :global(*::-webkit-scrollbar) {
    width: 0;
    height: 0;
    display: none;
  }

  .menubar-loading {
    display: grid;
    place-items: center;
    width: 100%;
    height: 100dvh;
    color: var(--subtle);
    font-size: 13px;
  }

  .menubar-shell {
    width: 100%;
    height: 100dvh;
    overflow-x: hidden;
    overflow-y: auto;
    padding: 16px;
    background: var(--workspace-surface);
    backdrop-filter: blur(28px) saturate(1.18);
    -webkit-backdrop-filter: blur(28px) saturate(1.18);
  }

  .menubar-header {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px 12px;
    align-items: start;
  }

  .menubar-eyebrow {
    margin: 0 0 2px;
    color: var(--subtle);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .menubar-heading {
    margin: 0;
    color: var(--strong);
    font-size: 20px;
    font-weight: 650;
    letter-spacing: -0.02em;
  }

  .menubar-header-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 5px;
  }

  .menubar-open-full,
  .menubar-update,
  .menubar-sign-out {
    display: inline-flex;
    align-items: center;
    min-height: 32px;
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 0 9px;
    background: var(--surface-strong);
    color: var(--strong);
    font-size: 11px;
    font-weight: 600;
    text-decoration: none;
    transition:
      background-color var(--motion-hover) ease,
      border-color var(--motion-hover) ease,
      color var(--motion-hover) ease,
      transform var(--motion-press) var(--ease-out);
  }

  .menubar-open-full:active,
  .menubar-update:active,
  .menubar-sign-out:active,
  .menubar-quick-add button:active {
    transform: scale(0.97);
  }

  .menubar-update:disabled {
    cursor: wait;
    opacity: 0.68;
  }

  .menubar-update.is-available {
    border-color: transparent;
    background: var(--button-bg);
    color: var(--button-fg);
    box-shadow: var(--shadow-raised);
  }

  .menubar-sync,
  .menubar-count {
    color: var(--subtle);
    font-size: 11px;
  }

  .menubar-count {
    justify-self: end;
  }

  .menubar-quick-add {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 7px;
    margin-top: 14px;
    padding: 6px;
    border: 1px solid var(--border);
    border-radius: 13px;
    background: var(--surface);
    box-shadow: inset 0 1px 0 var(--inset-highlight);
  }

  .menubar-quick-add input {
    min-width: 0;
    min-height: 39px;
    border: 0;
    border-radius: 9px;
    padding: 0 10px;
    background: transparent;
    color: var(--strong);
    font-size: 13px;
  }

  .menubar-quick-add button {
    min-width: 52px;
    min-height: 39px;
    border-radius: 9px;
    background: var(--button-bg);
    color: var(--button-fg);
    font-size: 12px;
    font-weight: 600;
    transition:
      opacity var(--motion-hover) ease,
      transform var(--motion-press) var(--ease-out);
  }

  @media (hover: hover) and (pointer: fine) {
    .menubar-open-full:hover,
    .menubar-update:hover,
    .menubar-sign-out:hover {
      border-color: var(--subtle);
      background: var(--block-hover);
    }

    .menubar-quick-add button:hover {
      opacity: 0.86;
    }
  }

  .menubar-quick-add input:focus-visible,
  .menubar-quick-add button:focus-visible,
  .menubar-update:focus-visible,
  .menubar-open-full:focus-visible,
  .menubar-sign-out:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 1px;
  }

  .menubar-task-list {
    display: grid;
    gap: 16px;
    margin-top: 17px;
    padding-bottom: 16px;
  }

  .menubar-section-heading {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 7px;
  }

  .menubar-section-heading h2 {
    margin: 0;
    color: var(--default);
    font-size: 11px;
    font-weight: 650;
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }

  .menubar-section-heading span {
    color: var(--subtle);
    font-size: 10px;
  }

  .menubar-section-list {
    display: grid;
    gap: 7px;
  }

  .menubar-date-groups {
    display: grid;
    gap: 12px;
  }

  .menubar-date-group {
    display: grid;
    gap: 6px;
  }

  .menubar-date-heading {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    padding: 0 2px;
  }

  .menubar-date-heading h3 {
    margin: 0;
    color: var(--subtle);
    font-size: 11px;
    font-weight: 600;
  }

  .menubar-date-heading span {
    color: var(--subtle);
    font-size: 10px;
  }

  .menubar-empty {
    margin: 0;
    padding: 16px;
    border: 1px dashed var(--border);
    border-radius: 12px;
    color: var(--subtle);
    font-size: 12px;
    text-align: center;
  }

  @media (prefers-reduced-motion: reduce) {
    .menubar-shell {
      scroll-behavior: auto;
    }
  }
</style>
