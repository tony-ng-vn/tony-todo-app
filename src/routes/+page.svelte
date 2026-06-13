<script>
  import { onDestroy, onMount, tick } from 'svelte';
  import '../styles.css';
  import FlowRail from '../lib/components/FlowRail.svelte';
  import LottieAnimation from '../lib/components/LottieAnimation.svelte';
  import SummaryPanel from '../lib/components/SummaryPanel.svelte';
  import TaskDetail from '../lib/components/TaskDetail.svelte';
  import TaskPanel from '../lib/components/TaskPanel.svelte';
  import {
    addTodo,
    completeTodo,
    createInitialState,
    deleteTodo,
    failTodo,
    formatDayKey,
    formatDuration,
    getDaySummary,
    getElapsedSeconds,
    getMillisecondsUntilNextDay,
    getProgressSessions,
    logProgressSession,
    moveCompletedTodoToSummaryBucket,
    getPendingTodos,
    pauseTodoTimer,
    setTodoProgressive,
    startTodoTimer,
    updateCompletedTodoTiming,
    updateTodoCompletedAt,
    updateTodoNote,
    updateTodoProgress,
    updateTodoTitle,
  } from '../todoStore.js';
  import { insforge, isInsForgeConfigured } from '../insforgeClient.js';
  import {
    completeRemoteTodo,
    deleteRemoteTodo,
    insertRemoteTodo,
    loadRemoteTodos,
    updateRemoteTodoCompletion,
    updateRemoteTodoNote,
    updateRemoteTodoProgress,
    updateRemoteTodoTimer,
    updateRemoteTodoTitle,
  } from '../todoRemote.js';
  import { getOrCreateClientId, loadLocalState, saveLocalState } from '../todoPersistence.js';

  const TIMER_SYNC_FIELDS = ['firstStartedAt', 'activeStartedAt', 'trackedSeconds'];
  const COMPLETION_SYNC_FIELDS = ['completedAt'];
  const THEME_STORAGE_KEY = 'done-log-theme';

  let state = createInitialState();
  let selectedDay = formatDayKey(new Date());
  let syncMessage = 'Local only';
  let clientId = '';
  let useRemote = false;
  let titleDraft = '';
  let draftTitle = '';
  let selectedTaskId = null;
  let editingTaskId = null;
  let noteDraft = '';
  let newlyAddedTodoId = null;
  let liveTimer = null;
  let dayRolloverTimer = null;
  let progressSaveTimer = null;
  let titleSaveTimer = null;
  let detailAnchor = null;
  let noteDraftTaskId = null;
  let draggedSummaryId = null;
  let dropTargetId = null;
  let dropTargetBucket = null;
  let completionCue = null;
  let completionCueTimer = null;
  let themeMode = 'light';

  $: pendingTodos = getPendingTodos(state);
  $: pendingViewTodos = withLatestProgressSession(pendingTodos);
  $: ongoingTodos = pendingViewTodos.filter((todo) => todo.activeStartedAt);
  $: openTodos = pendingViewTodos.filter((todo) => !todo.activeStartedAt);
  $: openCount = openTodos.length;
  $: summary = getDaySummary(state, selectedDay);
  $: completedToday = summary.reduce(
    (total, section) => total + section.items.filter((item) => item.outcome !== 'failed').length,
    0,
  );
  $: selectedTask = state.todos.find((todo) => todo.id === selectedTaskId);
  $: selectedTaskSessions = selectedTaskId ? getProgressSessions(state, selectedTaskId) : [];

  onMount(() => {
    useRemote = isInsForgeConfigured && !new URLSearchParams(window.location.search).has('local');
    syncMessage = useRemote ? 'Connecting' : 'Local only';
    clientId = getOrCreateClientId();
    state = loadLocalState();
    themeMode = loadThemeMode();
    applyThemeMode(themeMode);
    window.addEventListener('pointerdown', handleWindowPointerDown);
    window.addEventListener('focus', syncSelectedDayToToday);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    scheduleSelectedDayRefresh();
    hydrateRemoteTodos();
  });

  onDestroy(() => {
    window.clearInterval(liveTimer);
    window.clearTimeout(dayRolloverTimer);
    window.clearTimeout(progressSaveTimer);
    window.clearTimeout(titleSaveTimer);
    window.clearTimeout(completionCueTimer);
    window.removeEventListener('pointerdown', handleWindowPointerDown);
    window.removeEventListener('focus', syncSelectedDayToToday);
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

  $: {
    if (selectedTask?.id !== noteDraftTaskId) {
      noteDraftTaskId = selectedTask?.id ?? null;
      noteDraft = selectedTask?.note ?? '';
    }
  }

  async function handleSubmit() {
    const existingIds = new Set(state.todos.map((todo) => todo.id));
    state = addTodo(state, titleDraft);
    const createdTodo = state.todos.find((todo) => !existingIds.has(todo.id));

    if (!createdTodo) {
      return;
    }

    newlyAddedTodoId = createdTodo.id;
    draftTitle = '';
    titleDraft = '';
    saveLocalState(state);
    window.setTimeout(() => {
      if (newlyAddedTodoId === createdTodo.id) {
        newlyAddedTodoId = null;
      }
    }, 700);

    await syncRemoteChange('Saving', () => persistNewTodo(createdTodo));
  }

  function handleDraftInput() {
    draftTitle = titleDraft.trim();
  }

  function withLatestProgressSession(todos) {
    return todos.map((todo) => ({
      ...todo,
      latestProgressSession: getProgressSessions(state, todo.id)[0] ?? null,
    }));
  }

  async function handleComplete(todoId) {
    const beforeTodos = state.todos;
    const beforeTodo = findTodo(todoId);
    state = logProgressSession(state, todoId);
    const afterTodo = findTodo(todoId);
    const createdTodo = state.todos.find((todo) => !beforeTodos.some((before) => before.id === todo.id));
    const completedTodo = createdTodo ?? afterTodo;

    triggerCompletionCue(completedTodo);
    if (!beforeTodo?.isProgressive && selectedTaskId === todoId) {
      selectedTaskId = null;
    }
    selectedDay = formatDayKey(new Date());
    saveLocalState(state);

    if (beforeTodo?.isProgressive) {
      await syncRemoteChange('Saving session', async () => {
        await persistTodoTimer(afterTodo);
        await persistTodoProgress(afterTodo);
        await persistNewTodo(createdTodo);
      });
      return;
    }

    await syncRemoteChange('Saving', () => persistCompletedTodo(completedTodo));
  }

  async function handleFail(todoId) {
    const beforeTodo = findTodo(todoId);
    state = failTodo(state, todoId);
    const failedTodo = findTodo(todoId);

    if (!beforeTodo || !failedTodo || beforeTodo.completedAt === failedTodo.completedAt) {
      renderRemoteStatus();
      return;
    }

    if (selectedTaskId === todoId) {
      selectedTaskId = null;
    }
    selectedDay = formatDayKey(new Date());
    saveLocalState(state);
    await syncRemoteChange('Saving failed task', () => persistCompletedTodo(failedTodo));
  }

  async function handleTimerAction(action, todoId) {
    const beforeTodos = state.todos;
    state = action === 'pause' ? pauseTodoTimer(state, todoId) : startTodoTimer(state, todoId);
    const changedTodos = getTimerChangedTodos(beforeTodos, state.todos);
    saveLocalState(state);
    await syncRemoteChange('Saving time', () => Promise.all(changedTodos.map((todo) => persistTodoTimer(todo))));
  }

  async function startTitleEdit(todoId) {
    editingTaskId = todoId;
    await tick();
    document.querySelector(`[data-title-input="${CSS.escape(todoId)}"]`)?.focus();
    document.querySelector(`[data-title-input="${CSS.escape(todoId)}"]`)?.select();
  }

  async function commitTitleEdit(todoId, title) {
    if (editingTaskId !== todoId) {
      return;
    }

    editingTaskId = null;
    await commitTodoTitle(todoId, title);
  }

  async function commitTodoTitle(todoId, title) {
    const before = findTodo(todoId);
    state = updateTodoTitle(state, todoId, title);
    saveLocalState(state);
    syncMessage = 'Saving title';
    const after = findTodo(todoId);

    if (!before || !after || before.title === after.title) {
      renderRemoteStatus();
      return;
    }

    await syncRemoteChange('Saving title', () => persistTodoTitle(after));
  }

  function handleTitleKeydown(event, todoId, title) {
    if (event.key === 'Escape') {
      editingTaskId = null;
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      commitTitleEdit(todoId, title);
    }
  }

  function openTask(todoId, triggerElement = null) {
    detailAnchor = triggerElement ? rectSnapshot(triggerElement) : null;
    selectedTaskId = todoId;
    tick().then(() => document.querySelector('#detail-note')?.focus());
  }

  function closeTask() {
    selectedTaskId = null;
    detailAnchor = null;
    noteDraftTaskId = null;
  }

  function handleWindowPointerDown(event) {
    if (!selectedTaskId) {
      return;
    }

    const target = event.target;
    if (target.closest('#task-detail') || target.closest('.open-task-button') || target.closest('.calendar-popover')) {
      return;
    }

    closeTask();
  }

  function toggleThemeMode() {
    themeMode = themeMode === 'dark' ? 'light' : 'dark';
    applyThemeMode(themeMode);
  }

  function handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
      syncSelectedDayToToday();
    }
  }

  function syncSelectedDayToToday() {
    const today = formatDayKey(new Date());
    if (selectedDay !== today) {
      selectedDay = today;
    }
    scheduleSelectedDayRefresh();
  }

  function scheduleSelectedDayRefresh() {
    window.clearTimeout(dayRolloverTimer);
    dayRolloverTimer = window.setTimeout(
      syncSelectedDayToToday,
      Math.max(1000, getMillisecondsUntilNextDay(new Date())),
    );
  }

  function triggerCompletionCue(todo) {
    if (!todo || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    completionCue = {
      id: `${todo.id}-${Date.now()}`,
      title: todo.title,
    };

    window.clearTimeout(completionCueTimer);
    completionCueTimer = window.setTimeout(() => {
      completionCue = null;
    }, 1700);
  }

  function handleNoteInput(nextNote) {
    if (!selectedTaskId) {
      return;
    }

    noteDraft = nextNote;
  }

  async function handleNoteSave(todoId, nextNote) {
    const before = findTodo(todoId);
    state = updateTodoNote(state, todoId, nextNote);
    const after = findTodo(todoId);
    saveLocalState(state);

    if (!before || !after || before.note === after.note) {
      renderRemoteStatus();
      return;
    }

    await syncRemoteChange('Saving note', () => persistTodoNote(after));
  }

  async function handleNoteTodoToggle(todoId, nextNote) {
    noteDraft = nextNote;
    await handleNoteSave(todoId, nextNote);
  }

  async function handleProgressiveChange(todoId, isProgressive) {
    state = setTodoProgressive(state, todoId, isProgressive);
    const todo = findTodo(todoId);
    saveLocalState(state);
    await syncRemoteChange('Saving progress', () => persistTodoProgress(todo));
  }

  function handleProgressInput(todoId, progressLabel) {
    state = updateTodoProgress(state, todoId, progressLabel);
    saveLocalState(state);
    syncMessage = 'Saving progress';
    window.clearTimeout(progressSaveTimer);
    progressSaveTimer = window.setTimeout(async () => {
      const todo = findTodo(todoId);
      await syncRemoteChange('Saving progress', () => persistTodoProgress(todo));
    }, 450);
  }

  function handleDetailTitleCommit(todoId, title) {
    window.clearTimeout(titleSaveTimer);
    titleSaveTimer = window.setTimeout(() => {
      commitTodoTitle(todoId, title);
    }, 0);
  }

  async function handleCompletedAtChange(todoId, dateValue, timeValue) {
    if (!dateValue || !timeValue) {
      return;
    }

    const completedAt = new Date(`${dateValue}T${timeValue}`);
    if (Number.isNaN(completedAt.getTime())) {
      return;
    }

    const beforeTodos = state.todos;
    state = updateTodoCompletedAt(state, todoId, completedAt);
    const changedTodos = getCompletionChangedTodos(beforeTodos, state.todos);

    if (changedTodos.length === 0) {
      return;
    }

    saveLocalState(state);
    await syncRemoteChange('Saving finish time', () => persistCompletionChangedTodos(changedTodos));
  }

  async function handleCompletedTimingChange(todoId, startedAt, completedAt) {
    const beforeTodos = state.todos;
    state = updateCompletedTodoTiming(state, todoId, startedAt, completedAt);
    const changedTodos = getTodosWithChangedFields(beforeTodos, state.todos, [
      ...TIMER_SYNC_FIELDS,
      ...COMPLETION_SYNC_FIELDS,
    ]);
    const updatedTodo = findTodo(todoId);

    if (updatedTodo?.completedAt) {
      selectedDay = formatDayKey(new Date(updatedTodo.completedAt));
    }

    if (changedTodos.length === 0) {
      return;
    }

    saveLocalState(state);
    await syncRemoteChange('Saving time', () => persistCompletionChangedTodos(changedTodos));
  }

  async function handleSummaryCompletedTimeChange(todoId, timeValue) {
    const todo = findTodo(todoId);
    if (!todo?.completedAt) {
      return;
    }

    const completedAt = new Date(todo.completedAt);
    const dateValue = `${completedAt.getFullYear()}-${String(completedAt.getMonth() + 1).padStart(2, '0')}-${String(completedAt.getDate()).padStart(2, '0')}`;
    await handleCompletedAtChange(todoId, dateValue, timeValue);
  }

  async function handleDeleteTask(todoId) {
    const deletedIds = state.todos
      .filter((todo) => todo.id === todoId || todo.parentTaskId === todoId)
      .map((todo) => todo.id);

    if (deletedIds.length === 0) {
      return;
    }

    state = deleteTodo(state, todoId);
    if (selectedTaskId === todoId || deletedIds.includes(selectedTaskId)) {
      selectedTaskId = null;
    }
    saveLocalState(state);
    await syncRemoteChange('Deleting task', () => persistDeletedTodos(deletedIds));
  }

  function handleDragStart(event, todoId) {
    draggedSummaryId = todoId;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', todoId);
  }

  function handleDragEnd() {
    draggedSummaryId = null;
    dropTargetId = null;
    dropTargetBucket = null;
  }

  function handleDragOver(event, todoId, bucketLabel) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    dropTargetId = todoId;
    dropTargetBucket = bucketLabel;
  }

  function handleBucketDragOver(event, bucketLabel) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    dropTargetId = null;
    dropTargetBucket = bucketLabel;
  }

  async function handleDrop(event, targetId, bucketLabel) {
    const draggedId = event.dataTransfer.getData('text/plain');
    if (!draggedId || draggedId === targetId) {
      return;
    }

    event.preventDefault();
    await moveSummaryTodo(draggedId, bucketLabel, targetId);
  }

  async function handleBucketDrop(event, bucketLabel) {
    const draggedId = event.dataTransfer.getData('text/plain');
    if (!draggedId) {
      return;
    }

    event.preventDefault();
    await moveSummaryTodo(draggedId, bucketLabel);
  }

  async function moveSummaryTodo(draggedId, bucketLabel, targetId = null) {
    const beforeTodos = state.todos;
    state = moveCompletedTodoToSummaryBucket(state, selectedDay, draggedId, bucketLabel, targetId);
    const changedTodos = getCompletionChangedTodos(beforeTodos, state.todos);
    draggedSummaryId = null;
    dropTargetId = null;
    dropTargetBucket = null;

    if (changedTodos.length === 0) {
      return;
    }

    saveLocalState(state);
    await syncRemoteChange('Saving order', () => persistCompletionChangedTodos(changedTodos));
  }

  async function hydrateRemoteTodos() {
    if (!useRemote) {
      return;
    }

    syncMessage = 'Loading cloud';

    try {
      const cachedTodos = state.todos;
      const remoteTodos = await loadRemoteTodos(insforge, clientId);

      if (remoteTodos.length === 0 && cachedTodos.length > 0) {
        await Promise.all(cachedTodos.map((todo) => insertRemoteTodo(insforge, clientId, todo)));
        renderRemoteStatus(cachedTodos.length);
        return;
      }

      state = createInitialState(remoteTodos);
      saveLocalState(state);
      renderRemoteStatus(remoteTodos.length);
    } catch (error) {
      showOfflineCache(error);
    }
  }

  async function syncRemoteChange(statusMessage, syncAction) {
    syncMessage = statusMessage;

    try {
      await syncAction();
      renderRemoteStatus();
    } catch (error) {
      showOfflineCache(error);
    }
  }

  async function persistNewTodo(todo) {
    if (!useRemote) return;
    await insertRemoteTodo(insforge, clientId, todo);
  }

  async function persistCompletedTodo(todo) {
    if (!useRemote || !todo) return;
    await completeRemoteTodo(insforge, clientId, todo);
  }

  async function persistTodoNote(todo) {
    if (!useRemote || !todo) return;
    await updateRemoteTodoNote(insforge, clientId, todo);
  }

  async function persistTodoTitle(todo) {
    if (!useRemote || !todo) return;
    await updateRemoteTodoTitle(insforge, clientId, todo);
  }

  async function persistTodoProgress(todo) {
    if (!useRemote || !todo) return;
    await updateRemoteTodoProgress(insforge, clientId, todo);
  }

  async function persistTodoTimer(todo) {
    if (!useRemote || !todo) return;
    await updateRemoteTodoTimer(insforge, clientId, todo);
  }

  async function persistCompletionChangedTodos(todosToUpdate) {
    if (!useRemote) return;
    await Promise.all(todosToUpdate.map((todo) => updateRemoteTodoCompletion(insforge, clientId, todo)));
  }

  async function persistDeletedTodos(todoIds) {
    if (!useRemote) return;
    await Promise.all(todoIds.map((todoId) => deleteRemoteTodo(insforge, clientId, todoId)));
  }

  function renderRemoteStatus(count = state.todos.length) {
    syncMessage = useRemote ? `Cloud synced: ${count}` : 'Local only';
  }

  function showOfflineCache(error) {
    syncMessage = `Offline cache: ${error.message}`;
  }

  function loadThemeMode() {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === 'light' || storedTheme === 'dark') {
      return storedTheme;
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyThemeMode(nextThemeMode) {
    document.documentElement.dataset.theme = nextThemeMode;
    localStorage.setItem(THEME_STORAGE_KEY, nextThemeMode);
  }

  function findTodo(todoId) {
    return state.todos.find((todo) => todo.id === todoId);
  }

  function rectSnapshot(element) {
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    };
  }

  function getTimerChangedTodos(beforeTodos, afterTodos) {
    return getTodosWithChangedFields(beforeTodos, afterTodos, TIMER_SYNC_FIELDS);
  }

  function getCompletionChangedTodos(beforeTodos, afterTodos) {
    return getTodosWithChangedFields(beforeTodos, afterTodos, COMPLETION_SYNC_FIELDS);
  }

  function getTodosWithChangedFields(beforeTodos, afterTodos, fields) {
    const beforeById = new Map(beforeTodos.map((todo) => [todo.id, todo]));
    return afterTodos.filter((todo) => {
      const before = beforeById.get(todo.id);
      return before && fields.some((field) => before[field] !== todo[field]);
    });
  }

  function completedTime(completedAt) {
    return new Intl.DateTimeFormat([], {
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(completedAt));
  }

  function detailMeta(todo) {
    const durationText = `Duration ${formatDuration(getElapsedSeconds(todo))}`;
    const dateText = todo.completedAt
      ? `Completed ${new Intl.DateTimeFormat([], { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(todo.completedAt))}`
      : `Created ${new Intl.DateTimeFormat([], { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(todo.createdAt))}`;
    return `${dateText} · ${durationText}`;
  }
</script>

<main class="workspace" aria-label="Done Log todo app">
  <TaskPanel
    {syncMessage}
    {ongoingTodos}
    {openTodos}
    {openCount}
    bind:titleDraft
    {draftTitle}
    {editingTaskId}
    {newlyAddedTodoId}
    {themeMode}
    onSubmit={handleSubmit}
    onDraftInput={handleDraftInput}
    onStartTitleEdit={startTitleEdit}
    onTitleKeydown={handleTitleKeydown}
    onCommitTitleEdit={commitTitleEdit}
    onTimerAction={handleTimerAction}
    onOpenTask={openTask}
    onComplete={handleComplete}
    onFail={handleFail}
    onToggleTheme={toggleThemeMode}
  />

  <FlowRail {completedToday} />

  <SummaryPanel
    {summary}
    bind:selectedDay
    {draggedSummaryId}
    {dropTargetId}
    {dropTargetBucket}
    onOpenTask={openTask}
    onDragStart={handleDragStart}
    onDragEnd={handleDragEnd}
    onDragOver={handleDragOver}
    onDrop={handleDrop}
    onBucketDragOver={handleBucketDragOver}
    onBucketDrop={handleBucketDrop}
    onCompletedTimeChange={handleSummaryCompletedTimeChange}
    {completedTime}
  />

  <TaskDetail
    {selectedTask}
    {detailAnchor}
    {selectedTaskSessions}
    bind:noteDraft
    onClose={closeTask}
    onNoteInput={handleNoteInput}
    onNoteSave={handleNoteSave}
    onNoteTodoToggle={handleNoteTodoToggle}
    onDetailTitleCommit={handleDetailTitleCommit}
    onProgressiveChange={handleProgressiveChange}
    onProgressInput={handleProgressInput}
    onCompletedTimingChange={handleCompletedTimingChange}
    onDeleteTask={handleDeleteTask}
    {formatDuration}
    {completedTime}
    {detailMeta}
  />

  {#if completionCue}
    <aside class="completion-cue" aria-live="polite" aria-label={`Completed ${completionCue.title}`}>
      {#key completionCue.id}
        <LottieAnimation path="/lottie/task-complete.json" ariaLabel="Task completed" />
      {/key}
      <span>Done</span>
    </aside>
  {/if}
</main>
