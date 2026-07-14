<script>
  import { onDestroy, onMount, tick } from 'svelte';
  import '../styles.css';
  import FlowRail from '../lib/components/FlowRail.svelte';
  import LottieAnimation from '../lib/components/LottieAnimation.svelte';
  import AuthGate from '../lib/components/AuthGate.svelte';
  import BoardPanel from '../lib/components/BoardPanel.svelte';
  import InboxPanel from '../lib/components/InboxPanel.svelte';
  import WaitingPanel from '../lib/components/WaitingPanel.svelte';
  import HistoryPanel from '../lib/components/HistoryPanel.svelte';
  import MeetingsPanel from '../lib/components/MeetingsPanel.svelte';
  import SettingsPanel from '../lib/components/SettingsPanel.svelte';
  import SummaryPanel from '../lib/components/SummaryPanel.svelte';
  import TaskDetail from '../lib/components/TaskDetail.svelte';
  import TaskPanel from '../lib/components/TaskPanel.svelte';
  import {
    addTodo,
    createInitialState,
    deleteTodo,
    failTodo,
    formatDayKey,
    formatDuration,
    getBoardColumns,
    getDaySummary,
    getElapsedSeconds,
    getMillisecondsUntilNextDay,
    getOpenTodoSections,
    getProgressSessions,
    logProgressSession,
    moveCompletedTodoToSummaryBucket,
    moveTodoToBoardColumn,
    getPendingTodos,
    pauseTodoTimer,
    reopenTodo,
    setTodoProgressive,
    startTodoTimer,
    updateCompletedTodoTiming,
    updateTodoCompletedAt,
    updateTodoNote,
    updateTodoProgress,
    updateTodoTitle,
  } from '../todoStore.js';
  import { insforge, isInsForgeConfigured } from '../insforgeClient.js';
  import { getCurrentUser, signInWithPassword, signOut, signUp } from '../auth.js';
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
  import { loadLocalState, reconcileRemoteState, saveLocalState } from '../todoPersistence.js';
  import {
    acceptLoop,
    dismissLoop,
    loadDismissedLoops,
    loadInboxLoops,
    loadMeetings,
    loadSyncStatus,
    loadWaitingLoops,
    restoreLoop,
    snoozeLoop,
  } from '../loopRemote.js';

  const TIMER_SYNC_FIELDS = ['firstStartedAt', 'activeStartedAt', 'trackedSeconds'];
  const COMPLETION_SYNC_FIELDS = ['completedAt'];
  const THEME_STORAGE_KEY = 'done-log-theme';
  const VIEW_STORAGE_KEY = 'done-log-view';

  let state = createInitialState();
  let selectedDay = formatDayKey(new Date());
  let syncMessage = 'Local only';
  let useRemote = false;
  let authUser = null;
  let authChecked = false;
  let authMode = 'sign-in';
  let authEmail = '';
  let authPassword = '';
  let authError = '';
  let authLoading = false;
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
  let noteDraftTaskId = null;
  let draggedSummaryId = null;
  let dropTargetId = null;
  let dropTargetBucket = null;
  let isOpenDropTarget = false;
  let draggedBoardTodoId = null;
  let dropTargetColumnId = null;
  let completionCue = null;
  let completionCueTimer = null;
  let themeMode = 'light';
  let viewMode = 'flow';
  let inboxLoops = [];
  let waitingLoops = [];
  let historyLoops = [];
  let meetings = [];
  let syncStatusList = [];
  let draftingLoopId = null;
  let draftsByLoopId = {};
  let checkingForLoops = false;
  let checkStatus = '';
  let currentDayKey = formatDayKey(new Date());

  $: pendingTodos = getPendingTodos(state);
  $: pendingViewTodos = withLatestProgressSession(pendingTodos);
  $: ongoingTodos = pendingViewTodos.filter((todo) => todo.activeStartedAt);
  $: openTodos = pendingViewTodos.filter((todo) => !todo.activeStartedAt);
  $: openTodoSections = getOpenTodoSections(openTodos, new Date(`${currentDayKey}T00:00:00`));
  $: openCount = openTodos.length;
  $: summary = getDaySummary(state, selectedDay);
  $: boardColumns = getBoardColumns(state, { dayKey: selectedDay });
  $: completedToday = summary.reduce(
    (total, section) => total + section.items.filter((item) => item.outcome !== 'failed').length,
    0,
  );
  $: selectedTask = state.todos.find((todo) => todo.id === selectedTaskId);
  $: selectedTaskSessions = selectedTaskId ? getProgressSessions(state, selectedTaskId) : [];

  onMount(() => {
    useRemote = isInsForgeConfigured && !new URLSearchParams(window.location.search).has('local');
    syncMessage = useRemote ? 'Connecting' : 'Local only';
    state = loadLocalState();
    themeMode = loadThemeMode();
    viewMode = loadViewMode();
    applyThemeMode(themeMode);
    window.addEventListener('focus', syncSelectedDayToToday);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    scheduleSelectedDayRefresh();
    initializeAuth();
  });

  onDestroy(() => {
    window.clearInterval(liveTimer);
    window.clearTimeout(dayRolloverTimer);
    window.clearTimeout(progressSaveTimer);
    window.clearTimeout(titleSaveTimer);
    window.clearTimeout(completionCueTimer);
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

  function openTask(todoId) {
    selectedTaskId = todoId;
    tick().then(() => document.querySelector('#detail-note')?.focus());
  }

  function closeTask() {
    selectedTaskId = null;
    noteDraftTaskId = null;
  }

  function toggleThemeMode() {
    themeMode = themeMode === 'dark' ? 'light' : 'dark';
    applyThemeMode(themeMode);
  }

  const VIEW_MODES = ['flow', 'board', 'inbox', 'waiting', 'history', 'meetings', 'settings'];

  function setViewMode(nextViewMode) {
    viewMode = VIEW_MODES.includes(nextViewMode) ? nextViewMode : 'flow';
    localStorage.setItem(VIEW_STORAGE_KEY, viewMode);
    draggedBoardTodoId = null;
    dropTargetColumnId = null;
  }

  function handleBoardSelectedDayChange(nextDay) {
    if (!nextDay) {
      return;
    }

    selectedDay = nextDay;
  }

  function handleBoardDragStart(event, todoId) {
    draggedBoardTodoId = todoId;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', todoId);
  }

  function handleBoardDragEnd() {
    draggedBoardTodoId = null;
    dropTargetColumnId = null;
  }

  function handleBoardDragOver(event, columnId) {
    if (!draggedBoardTodoId) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    dropTargetColumnId = columnId;
  }

  async function handleBoardDrop(event, columnId) {
    event.preventDefault();
    const todoId = draggedBoardTodoId || event.dataTransfer.getData('text/plain');
    draggedBoardTodoId = null;
    dropTargetColumnId = null;

    if (!todoId) {
      return;
    }

    await moveBoardTodo(todoId, columnId);
  }

  async function moveBoardTodo(todoId, columnId) {
    const beforeTodos = state.todos;
    const beforeTodo = findTodo(todoId);
    state = moveTodoToBoardColumn(state, todoId, columnId);
    const afterTodo = findTodo(todoId);
    const createdTodo = state.todos.find((todo) => !beforeTodos.some((before) => before.id === todo.id));
    const changedTimerTodos = getTimerChangedTodos(beforeTodos, state.todos);
    const changedCompletionTodos = getCompletionChangedTodos(beforeTodos, state.todos);

    if (
      beforeTodo &&
      afterTodo &&
      beforeTodo.completedAt === afterTodo.completedAt &&
      beforeTodo.activeStartedAt === afterTodo.activeStartedAt &&
      beforeTodo.trackedSeconds === afterTodo.trackedSeconds &&
      !createdTodo
    ) {
      return;
    }

    if (columnId === 'done') {
      const completedTodo = createdTodo ?? afterTodo;
      triggerCompletionCue(completedTodo);
      if (!beforeTodo?.isProgressive && selectedTaskId === todoId) {
        selectedTaskId = null;
      }
      selectedDay = formatDayKey(new Date());
    }

    saveLocalState(state);

    if (beforeTodo?.isProgressive && columnId === 'done') {
      await syncRemoteChange('Saving session', async () => {
        await persistTodoTimer(afterTodo);
        await persistTodoProgress(afterTodo);
        await persistNewTodo(createdTodo);
      });
      return;
    }

    if (changedCompletionTodos.length > 0) {
      await syncRemoteChange('Saving', () => persistCompletionChangedTodos(changedCompletionTodos));
      return;
    }

    if (changedTimerTodos.length > 0) {
      await syncRemoteChange('Saving time', () =>
        Promise.all(changedTimerTodos.map((todo) => persistTodoTimer(todo))),
      );
    }
  }

  async function handleCreateTaskInColumn(columnId, title) {
    const existingIds = new Set(state.todos.map((todo) => todo.id));
    state = addTodo(state, title);

    if (columnId === 'in_progress' || columnId === 'done') {
      const created = state.todos.find((todo) => !existingIds.has(todo.id));
      if (created) {
        state = moveTodoToBoardColumn(state, created.id, columnId);
      }
    }

    const createdTodo = state.todos.find((todo) => !existingIds.has(todo.id));
    if (!createdTodo) {
      return;
    }

    newlyAddedTodoId = createdTodo.id;
    saveLocalState(state);
    window.setTimeout(() => {
      if (newlyAddedTodoId === createdTodo.id) {
        newlyAddedTodoId = null;
      }
    }, 700);

    if (columnId === 'done') {
      triggerCompletionCue(createdTodo);
      selectedDay = formatDayKey(new Date());
      await syncRemoteChange('Saving', () => persistNewTodo(createdTodo));
      return;
    }

    await syncRemoteChange('Saving', () => persistNewTodo(createdTodo));
  }

  function handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
      syncSelectedDayToToday();
    }
  }

  function syncSelectedDayToToday() {
    const today = formatDayKey(new Date());
    currentDayKey = today;
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

    selectedDay = formatDayKey(completedAt);
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
    isOpenDropTarget = false;
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

  function handleOpenListDragOver(event) {
    if (!draggedSummaryId) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    dropTargetId = null;
    dropTargetBucket = null;
    isOpenDropTarget = true;
  }

  async function handleOpenListDrop(event) {
    const draggedId = event.dataTransfer.getData('text/plain');
    if (!draggedId) {
      return;
    }

    event.preventDefault();
    await reopenSummaryTodo(draggedId);
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

  async function reopenSummaryTodo(todoId) {
    const beforeTodos = state.todos;
    state = reopenTodo(state, todoId);
    const changedTodos = getCompletionChangedTodos(beforeTodos, state.todos);
    draggedSummaryId = null;
    dropTargetId = null;
    dropTargetBucket = null;
    isOpenDropTarget = false;

    if (changedTodos.length === 0) {
      return;
    }

    saveLocalState(state);
    await syncRemoteChange('Reopening task', () => persistCompletionChangedTodos(changedTodos));
  }

  async function initializeAuth() {
    if (!useRemote) {
      authChecked = true;
      return;
    }

    try {
      const { user } = await getCurrentUser(insforge);
      authUser = user;
      authChecked = true;

      if (authUser) {
        await hydrateRemoteTodos();
      } else {
        syncMessage = 'Signed out';
      }
    } catch (error) {
      authUser = null;
      authChecked = true;
      showOfflineCache(error);
    }
  }

  async function handleAuthSubmit({ email, password, mode }) {
    authError = '';
    authLoading = true;

    try {
      const authAction = mode === 'sign-up' ? signUp : signInWithPassword;
      const result = await authAction(insforge, { email, password });

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
    await signOut(insforge);
    authUser = null;
    state = createInitialState();
    saveLocalState(state);
    syncMessage = 'Signed out';
  }

  async function hydrateRemoteTodos() {
    if (!useRemote || !authUser) {
      return;
    }

    syncMessage = 'Loading cloud';

    try {
      const remoteTodos = await loadRemoteTodos(insforge, authUser.id);

      state = reconcileRemoteState(state, remoteTodos);
      saveLocalState(state);
      renderRemoteStatus(remoteTodos.length);
    } catch (error) {
      showOfflineCache(error);
    }

    await loadLoopSurfaces();
  }

  async function loadLoopSurfaces() {
    if (!useRemote || !authUser) {
      return;
    }

    try {
      inboxLoops = await loadInboxLoops(insforge, authUser.id);
    } catch {
      inboxLoops = [];
    }

    try {
      waitingLoops = await loadWaitingLoops(insforge, authUser.id);
    } catch {
      waitingLoops = [];
    }

    try {
      historyLoops = await loadDismissedLoops(insforge, authUser.id);
    } catch {
      historyLoops = [];
    }

    try {
      meetings = await loadMeetings(insforge, authUser.id);
    } catch {
      meetings = [];
    }

    try {
      syncStatusList = await loadSyncStatus(insforge, authUser.id);
    } catch {
      syncStatusList = [];
    }
  }

  async function handleAcceptLoop(loopId) {
    inboxLoops = inboxLoops.filter((loop) => loop.id !== loopId);
    try {
      await acceptLoop(insforge, authUser.id, loopId);
      await hydrateRemoteTodos();
    } catch (error) {
      showOfflineCache(error);
    }
  }

  async function handleDismissLoop(loopId) {
    inboxLoops = inboxLoops.filter((loop) => loop.id !== loopId);
    try {
      await dismissLoop(insforge, authUser.id, loopId);
      await loadLoopSurfaces();
    } catch (error) {
      showOfflineCache(error);
    }
  }

  async function handleRestoreLoop(loopId) {
    historyLoops = historyLoops.filter((loop) => loop.id !== loopId);
    try {
      await restoreLoop(insforge, authUser.id, loopId);
      await loadLoopSurfaces();
    } catch (error) {
      showOfflineCache(error);
    }
  }

  async function handleSnoozeLoop(loopId) {
    inboxLoops = inboxLoops.filter((loop) => loop.id !== loopId);
    try {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await snoozeLoop(insforge, authUser.id, loopId, tomorrow);
    } catch (error) {
      showOfflineCache(error);
    }
  }

  async function handleDraftFollowUp(loopId) {
    if (!useRemote || !authUser || draftingLoopId) return;

    draftingLoopId = loopId;

    try {
      const data = await insforge.getHttpClient().post('/functions/draft-follow-up', { loopId });
      draftsByLoopId = { ...draftsByLoopId, [loopId]: data?.draft ?? '' };
    } catch (error) {
      showOfflineCache(error);
    } finally {
      draftingLoopId = null;
    }
  }

  async function handleCheckForNewLoops() {
    if (!useRemote || !authUser || checkingForLoops) return;

    checkingForLoops = true;
    checkStatus = 'Checking Granola for new loops...';

    try {
      // insforge.functions.invoke() derives a {appKey}.functions.insforge.app
      // subhosting URL that 503s for this project, and the SDK only falls
      // back to the working proxy path on a 404 (not a 503) -- so it never
      // recovers. Going through the proxy path directly via the shared
      // HttpClient still carries the signed-in user's auth header.
      const data = await insforge.getHttpClient().post('/functions/ingest-granola-loops', { source: 'both' });

      const created = data?.loopsCreated?.length ?? 0;
      checkStatus = `Checked ${data?.notesProcessed ?? 0} meeting${data?.notesProcessed === 1 ? '' : 's'}, found ${created} new loop${created === 1 ? '' : 's'}.`;
      await loadLoopSurfaces();
    } catch (error) {
      checkStatus = `Check failed: ${error.message}`;
    } finally {
      checkingForLoops = false;
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
    if (!useRemote || !authUser) return;
    await insertRemoteTodo(insforge, authUser.id, todo);
  }

  async function persistCompletedTodo(todo) {
    if (!useRemote || !authUser || !todo) return;
    await completeRemoteTodo(insforge, authUser.id, todo);
  }

  async function persistTodoNote(todo) {
    if (!useRemote || !authUser || !todo) return;
    await updateRemoteTodoNote(insforge, authUser.id, todo);
  }

  async function persistTodoTitle(todo) {
    if (!useRemote || !authUser || !todo) return;
    await updateRemoteTodoTitle(insforge, authUser.id, todo);
  }

  async function persistTodoProgress(todo) {
    if (!useRemote || !authUser || !todo) return;
    await updateRemoteTodoProgress(insforge, authUser.id, todo);
  }

  async function persistTodoTimer(todo) {
    if (!useRemote || !authUser || !todo) return;
    await updateRemoteTodoTimer(insforge, authUser.id, todo);
  }

  async function persistCompletionChangedTodos(todosToUpdate) {
    if (!useRemote || !authUser) return;
    await Promise.all(todosToUpdate.map((todo) => updateRemoteTodoCompletion(insforge, authUser.id, todo)));
  }

  async function persistDeletedTodos(todoIds) {
    if (!useRemote || !authUser) return;
    await Promise.all(todoIds.map((todoId) => deleteRemoteTodo(insforge, authUser.id, todoId)));
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

  function loadViewMode() {
    const storedView = localStorage.getItem(VIEW_STORAGE_KEY);
    return VIEW_MODES.includes(storedView) ? storedView : 'flow';
  }

  function applyThemeMode(nextThemeMode) {
    document.documentElement.dataset.theme = nextThemeMode;
    localStorage.setItem(THEME_STORAGE_KEY, nextThemeMode);
  }

  function findTodo(todoId) {
    return state.todos.find((todo) => todo.id === todoId);
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

{#if useRemote && authChecked && !authUser}
  <AuthGate
    mode={authMode}
    bind:email={authEmail}
    bind:password={authPassword}
    error={authError}
    loading={authLoading}
    onSubmit={handleAuthSubmit}
    onToggleMode={handleAuthToggleMode}
  />
{:else}
<main
  class="workspace"
  class:has-detail={selectedTask}
  class:is-board-view={viewMode === 'board' || viewMode === 'inbox' || viewMode === 'waiting' || viewMode === 'history' || viewMode === 'meetings' || viewMode === 'settings'}
  aria-label="Done Log todo app"
>
  {#if viewMode === 'board'}
    <BoardPanel
      {syncMessage}
      columns={boardColumns}
      {selectedDay}
      {themeMode}
      {newlyAddedTodoId}
      {draggedBoardTodoId}
      {dropTargetColumnId}
      inboxCount={inboxLoops.length}
      waitingCount={waitingLoops.length}
      onToggleTheme={toggleThemeMode}
      onViewChange={setViewMode}
      onSelectedDayChange={handleBoardSelectedDayChange}
      onOpenTask={openTask}
      onBoardDragStart={handleBoardDragStart}
      onBoardDragEnd={handleBoardDragEnd}
      onBoardDragOver={handleBoardDragOver}
      onBoardDrop={handleBoardDrop}
      onCreateTaskInColumn={handleCreateTaskInColumn}
    />
  {:else if viewMode === 'inbox'}
    <InboxPanel
      loops={inboxLoops}
      waitingCount={waitingLoops.length}
      {checkingForLoops}
      {checkStatus}
      onAccept={handleAcceptLoop}
      onDismiss={handleDismissLoop}
      onSnooze={handleSnoozeLoop}
      onViewChange={setViewMode}
      onCheckForNewLoops={handleCheckForNewLoops}
    />
  {:else if viewMode === 'waiting'}
    <WaitingPanel
      loops={waitingLoops}
      inboxCount={inboxLoops.length}
      {draftingLoopId}
      {draftsByLoopId}
      onDraftFollowUp={handleDraftFollowUp}
      onViewChange={setViewMode}
    />
  {:else if viewMode === 'history'}
    <HistoryPanel
      loops={historyLoops}
      inboxCount={inboxLoops.length}
      waitingCount={waitingLoops.length}
      onRestore={handleRestoreLoop}
      onViewChange={setViewMode}
    />
  {:else if viewMode === 'meetings'}
    <MeetingsPanel
      {meetings}
      inboxCount={inboxLoops.length}
      waitingCount={waitingLoops.length}
      onViewChange={setViewMode}
    />
  {:else if viewMode === 'settings'}
    <SettingsPanel
      syncStatus={syncStatusList}
      userEmail={authUser?.email ?? ''}
      inboxCount={inboxLoops.length}
      waitingCount={waitingLoops.length}
      onViewChange={setViewMode}
    />
  {:else}
    <TaskPanel
      {syncMessage}
      {ongoingTodos}
      {openTodoSections}
      {openCount}
      bind:titleDraft
      {draftTitle}
      {editingTaskId}
      {newlyAddedTodoId}
      {draggedSummaryId}
      {isOpenDropTarget}
      {themeMode}
      {viewMode}
      inboxCount={inboxLoops.length}
      waitingCount={waitingLoops.length}
      onSubmit={handleSubmit}
      onDraftInput={handleDraftInput}
      onStartTitleEdit={startTitleEdit}
      onTitleKeydown={handleTitleKeydown}
      onCommitTitleEdit={commitTitleEdit}
      onTimerAction={handleTimerAction}
      onOpenTask={openTask}
      onComplete={handleComplete}
      onFail={handleFail}
      onOpenListDragOver={handleOpenListDragOver}
      onOpenListDrop={handleOpenListDrop}
      onToggleTheme={toggleThemeMode}
      onViewChange={setViewMode}
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
  {/if}

  <TaskDetail
    {selectedTask}
    {selectedTaskSessions}
    bind:noteDraft
    onClose={closeTask}
    onNoteInput={handleNoteInput}
    onNoteSave={handleNoteSave}
    onNoteTodoToggle={handleNoteTodoToggle}
    onDetailTitleCommit={handleDetailTitleCommit}
    onProgressiveChange={handleProgressiveChange}
    onProgressInput={handleProgressInput}
    onCompletedDateChange={handleCompletedAtChange}
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

  {#if useRemote && authUser}
    <button type="button" class="sign-out-button" on:click={handleSignOut}>Sign out</button>
  {/if}
</main>
{/if}
