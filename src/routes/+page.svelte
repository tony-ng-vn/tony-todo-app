<script>
  import { onDestroy, onMount, tick } from 'svelte';
  import '../styles.css';
  import FlowRail from '../lib/components/FlowRail.svelte';
  import LottieAnimation from '../lib/components/LottieAnimation.svelte';
  import AddTaskOverlay from '../lib/components/AddTaskOverlay.svelte';
  import AuthGate from '../lib/components/AuthGate.svelte';
  import BoardPanel from '../lib/components/BoardPanel.svelte';
  import CalendarPanel from '../lib/components/CalendarPanel.svelte';
  import InboxPanel from '../lib/components/InboxPanel.svelte';
  import WaitingPanel from '../lib/components/WaitingPanel.svelte';
  import {
    applyThemeMode,
    loadThemeMode,
    nextThemeMode,
    THEME_STORAGE_KEY,
  } from '../theme.js';
  import HistoryPanel from '../lib/components/HistoryPanel.svelte';
  import MeetingsPanel from '../lib/components/MeetingsPanel.svelte';
  import ProjectsPanel from '../lib/components/ProjectsPanel.svelte';
  import SettingsPanel from '../lib/components/SettingsPanel.svelte';
  import SummaryPanel from '../lib/components/SummaryPanel.svelte';
  import TaskDetail from '../lib/components/TaskDetail.svelte';
  import TaskPanel from '../lib/components/TaskPanel.svelte';
  import FeedbackSdkWidget from '$lib/components/FeedbackSdkWidget.svelte';
  import {
    addTodo,
    archivePriorDaySessions,
    completeTodo,
    createInitialState,
    deleteTodo,
    dueDateInputToIso,
    failTodo,
    findDuplicateTodo,
    formatDayKey,
    formatDuration,
    getActiveTodos,
    getBoardColumns,
    getCalendarMonth,
    getDaySummary,
    getElapsedSeconds,
    getMillisecondsUntilNextDay,
    getOpenTodoSections,
    getProgressSessions,
    getProjectTodos,
    filterTodoSections,
    filterTodosBySearch,
    findOverflowSearchMatches,
    moveCompletedTodoToSummaryBucket,
    moveTodoToBoardColumn,
    pauseTodoTimer,
    partitionTaskFlowTodos,
    promoteTodoToTask,
    reopenTodo,
    restoreTodoFromSomeday,
    setTodoDueDate,
    setTodoPhoto,
    setTodoSomeday,
    startTodoTimer,
    updateTodoTimeSegments,
    updateTodoCompletedAt,
    updateTodoNote,
    updateTodoNoteFromEditor,
    updateTodoTitle,
    stripNoteStampsForEditor,
  } from '../todoStore.js';
  import { insforge, isInsForgeConfigured } from '../insforgeClient.js';
  import { isNewTaskShortcut } from '../newTaskShortcut.js';
  import { getCurrentUser, signInWithPassword, signOut, signUp } from '../auth.js';
  import {
    completeRemoteTodo,
    deleteRemoteTodo,
    insertRemoteProgressSession,
    insertRemoteTodo,
    loadRemoteTodos,
    updateRemoteTodoCompletion,
    updateRemoteTodoDueDate,
    updateRemoteTodoNote,
    updateRemoteTodoPhoto,
    updateRemoteTodoTimer,
    updateRemoteTodoTitle,
    updateRemoteTodoWorkflow,
  } from '../todoRemote.js';
  import { loadLocalState, reconcileRemoteState, saveLocalState, TODO_STORAGE_KEY } from '../todoPersistence.js';
  import {
    LOCAL_TASK_PHOTO_KEY,
    cleanupTodoPhotos,
    readFileAsDataUrl,
    removeTaskPhotoObject,
    uploadTaskPhoto,
    validateTaskPhoto,
  } from '../todoPhoto.js';
  import {
    clearNoteEdits,
    createDebouncedSaveQueue,
    getPendingNoteEdits,
    loadRemoteAfterNoteFlush,
    markNoteEditSynced,
    preservePendingNotesDuringLoad,
    readNoteEdit,
    recordNoteEdit,
    resolveSelectedNoteDraft,
    snapshotNoteEdits,
    withNoteSaveLock,
  } from '../noteAutosave.js';
  import { normalizeViewMode } from '../viewModes.js';
  import { requestNativeUpdate } from '../appUpdate.js';
  import {
    acceptLoop,
    dismissLoop,
    loadAuditLog,
    loadDismissedLoops,
    loadInboxLoops,
    loadMeetings,
    loadSyncStatus,
    loadWaitingLoops,
    restoreLoop,
    snoozeLoop,
  } from '../loopRemote.js';

  const TIMER_SYNC_FIELDS = ['firstStartedAt', 'activeStartedAt', 'trackedSeconds', 'timeSegments'];
  const COMPLETION_SYNC_FIELDS = ['completedAt'];
  const ARCHIVE_SYNC_FIELDS = [...TIMER_SYNC_FIELDS, ...COMPLETION_SYNC_FIELDS];
  const VIEW_STORAGE_KEY = 'done-log-view';

  let state = createInitialState();
  let selectedDay = formatDayKey(new Date());
  let boardDueFilter = 'all';
  let calendarYear = new Date().getFullYear();
  let calendarMonth = new Date().getMonth();
  let syncMessage = 'Local only';
  let useRemote = false;
  let authUser = null;
  let authChecked = false;
  let authMode = 'sign-in';
  let authEmail = '';
  let authPassword = '';
  let authError = '';
  let authLoading = false;
  let composerOpen = false;
  let composerError = '';
  let taskSearchQuery = '';
  let titleDraft = '';
  let composerKind = 'task';
  let dueDateDraft = formatDayKey(new Date());
  let selectedTaskId = null;
  let photoBusy = false;
  let photoError = '';
  let editingTaskId = null;
  let noteDraft = '';
  let noteSaveStatuses = {};
  let newlyAddedTodoId = null;
  let liveTimer = null;
  let dayRolloverTimer = null;
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
  let auditLogEntries = [];
  let draftingLoopId = null;
  let draftsByLoopId = {};
  let checkingForLoops = false;
  let checkStatus = '';
  let currentDayKey = formatDayKey(new Date());
  let refreshInFlight = false;
  let hasNativeUpdater = false;
  const noteAutosave = createDebouncedSaveQueue(saveNoteToRemote);

  $: pendingTodos = getActiveTodos(state);
  $: pendingViewTodos = withLatestProgressSession(pendingTodos);
  $: pendingTodoGroups = partitionTaskFlowTodos(
    pendingViewTodos,
    new Date(`${currentDayKey}T00:00:00`),
  );
  $: ongoingTodos = filterTodosBySearch(pendingTodoGroups.ongoing, taskSearchQuery);
  $: pausedTodos = filterTodosBySearch(pendingTodoGroups.paused, taskSearchQuery);
  $: openTodos = filterTodosBySearch(pendingTodoGroups.scheduled, taskSearchQuery);
  $: openTodoSections = getOpenTodoSections(openTodos, new Date(`${currentDayKey}T00:00:00`));
  $: summary = filterTodoSections(getDaySummary(state, selectedDay), taskSearchQuery);
  $: boardColumns = getBoardColumns(state, { dayKey: selectedDay, dueFilter: boardDueFilter });
  $: projectTodos = getProjectTodos(state);
  $: searchMatches = findOverflowSearchMatches(
    state.todos,
    [...ongoingTodos, ...pausedTodos, ...openTodos, ...summary.flatMap((section) => section.items)],
    taskSearchQuery,
  );
  $: calendarMonthData = getCalendarMonth(state, { year: calendarYear, month: calendarMonth });
  $: completedToday = summary.reduce(
    (total, section) => total + section.items.filter((item) => item.outcome !== 'failed').length,
    0,
  );
  $: selectedTask = state.todos.find((todo) => todo.id === selectedTaskId);
  $: selectedNoteSaveStatus = noteSaveStatuses[selectedTaskId] ?? 'saved';
  $: selectedTaskSessions = selectedTaskId ? getProgressSessions(state, selectedTaskId) : [];


  onMount(() => {
    hasNativeUpdater = Boolean(
      window.__doneLogNativeUpdater && window.webkit?.messageHandlers?.doneLogUpdater,
    );
    useRemote = isInsForgeConfigured && !new URLSearchParams(window.location.search).has('local');
    syncMessage = useRemote ? 'Connecting' : 'Local only';
    state = archivePriorDaySessions(loadLocalState());
    saveLocalState(state);
    queuePendingNoteSaves();
    themeMode = loadThemeMode();
    viewMode = loadViewMode();
    applyThemeMode(themeMode);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('storage', handleStorageChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    scheduleSelectedDayRefresh();
    initializeAuth();
  });

  onDestroy(() => {
    window.clearInterval(liveTimer);
    window.clearTimeout(dayRolloverTimer);
    window.clearTimeout(titleSaveTimer);
    window.clearTimeout(completionCueTimer);
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

  // resolveSelectedNoteDraft strips task.note and edit.note internally, so
  // it can pass selectedTask straight through here.
  $: {
    const nextDraft = resolveSelectedNoteDraft({
      task: selectedTask,
      noteDraftTaskId,
      noteDraft,
      edit: selectedTaskId ? readNoteEdit(selectedTaskId) : null,
    });
    noteDraftTaskId = nextDraft.noteDraftTaskId;
    noteDraft = nextDraft.noteDraft;
  }

  function openComposer(kind = 'task') {
    composerKind = kind === 'project' ? 'project' : 'task';
    if (!titleDraft.trim()) {
      dueDateDraft = formatDayKey(new Date());
    }
    composerError = '';
    composerOpen = true;
  }

  function closeComposer() {
    composerOpen = false;
  }

  function handleWorkspaceKeydown(event) {
    if (!isNewTaskShortcut(event) || (useRemote && authChecked && !authUser)) {
      return;
    }

    event.preventDefault();
    if (composerOpen) {
      document.getElementById('overlay-todo-title')?.focus();
      return;
    }
    openComposer(viewMode === 'projects' ? 'project' : 'task');
  }

  async function handleSubmit() {
    const duplicate = findDuplicateTodo(state, titleDraft);
    if (duplicate) {
      composerError = `That is already open as "${duplicate.title}".`;
      syncMessage = `Duplicate task: "${duplicate.title}" is already open`;
      return;
    }

    const existingIds = new Set(state.todos.map((todo) => todo.id));
    const kind = composerKind === 'project' ? 'project' : 'task';
    state = addTodo(state, titleDraft, new Date(), {
      kind,
      dueDate: kind === 'project' ? null : dueDateInputToIso(dueDateDraft || formatDayKey(new Date())),
    });
    const createdTodo = state.todos.find((todo) => !existingIds.has(todo.id));

    if (!createdTodo) {
      return;
    }

    composerError = '';
    newlyAddedTodoId = createdTodo.id;
    titleDraft = '';
    composerKind = 'task';
    dueDateDraft = formatDayKey(new Date());
    composerOpen = false;
    saveLocalState(state);
    window.setTimeout(() => {
      if (newlyAddedTodoId === createdTodo.id) {
        newlyAddedTodoId = null;
      }
    }, 700);

    if (kind === 'project') {
      setViewMode('projects');
    }

    await syncRemoteChange('Saving', () => persistNewTodo(createdTodo));
  }

  function withLatestProgressSession(todos) {
    return todos.map((todo) => ({
      ...todo,
      latestProgressSession: getProgressSessions(state, todo.id)[0] ?? null,
    }));
  }

  async function handleComplete(todoId) {
    const beforeTodos = state.todos;
    state = completeTodo(state, todoId);
    const completedTodo = findTodo(todoId);

    triggerCompletionCue(completedTodo);
    if (selectedTaskId === todoId) {
      selectedTaskId = null;
    }
    selectedDay = completedTodo?.completedAt
      ? formatDayKey(new Date(completedTodo.completedAt))
      : formatDayKey(new Date());
    saveLocalState(state);

    await syncRemoteChange('Saving', () => persistArchivedTodos(beforeTodos, state.todos));
  }

  async function handleFail(todoId) {
    const beforeTodos = state.todos;
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
    selectedDay = failedTodo?.completedAt
      ? formatDayKey(new Date(failedTodo.completedAt))
      : formatDayKey(new Date());
    saveLocalState(state);
    await syncRemoteChange('Saving failed task', () => persistArchivedTodos(beforeTodos, state.todos));
  }

  async function handleTimerAction(action, todoId) {
    const beforeTodos = state.todos;
    state = action === 'pause' ? pauseTodoTimer(state, todoId) : startTodoTimer(state, todoId);
    saveLocalState(state);
    if (action === 'start') {
      await revealTodo(todoId);
    }
    await syncRemoteChange('Saving time', () => persistArchivedTodos(beforeTodos, state.todos));
  }

  async function revealTodo(todoId) {
    await tick();
    const row = document.querySelector(`[data-todo-id="${CSS.escape(todoId)}"]`);
    if (!row) {
      return;
    }

    row.scrollIntoView({
      block: 'nearest',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
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
    const duplicate = findDuplicateTodo(state, title, { excludeTodoId: todoId });
    if (duplicate) {
      syncMessage = `Duplicate task: "${duplicate.title}" is already open`;
      return;
    }

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

  // dateValue is a YYYY-MM-DD string from the detail sheet's date input, or ''
  // to clear the due date.
  async function handleDueDateChange(todoId, dateValue) {
    const before = findTodo(todoId);
    const nextDueDate = dueDateInputToIso(dateValue);
    state = setTodoDueDate(state, todoId, nextDueDate);
    saveLocalState(state);
    const after = findTodo(todoId);

    if (!before || !after || before.dueDate === after.dueDate) {
      renderRemoteStatus();
      return;
    }

    await syncRemoteChange('Saving due date', () => persistTodoDueDate(after));
  }

  async function handleTaskPhotoSelect(todoId, file) {
    const before = findTodo(todoId);
    if (!before) {
      return { ok: false, error: 'That task is no longer available.' };
    }

    const check = validateTaskPhoto(file);
    if (!check.ok) {
      photoError = check.error;
      return { ok: false, error: check.error };
    }

    photoBusy = true;
    photoError = '';

    try {
      if (useRemote && authUser) {
        const { data, error } = await uploadTaskPhoto(insforge, {
          userId: authUser.id,
          todo: before,
          file,
        });
        if (error) {
          throw error;
        }
        state = setTodoPhoto(state, todoId, data);
        saveLocalState(state);
        await syncRemoteChange('Saving photo', () => persistTodoPhoto(findTodo(todoId)));
      } else {
        const photoUrl = await readFileAsDataUrl(file);
        state = setTodoPhoto(state, todoId, { photoUrl, photoKey: LOCAL_TASK_PHOTO_KEY });
        saveLocalState(state);
        renderRemoteStatus();
      }
      return { ok: true };
    } catch (error) {
      photoError = error.message || 'The photo could not be saved.';
      return { ok: false, error: photoError };
    } finally {
      photoBusy = false;
    }
  }

  async function handleTaskPhotoRemove(todoId) {
    const before = findTodo(todoId);
    if (!before) {
      return;
    }

    photoBusy = true;
    photoError = '';

    try {
      if (useRemote && authUser) {
        const { error } = await removeTaskPhotoObject(insforge, before.photoKey);
        if (error) {
          throw error;
        }
      }
      state = setTodoPhoto(state, todoId, { photoUrl: null, photoKey: null });
      saveLocalState(state);
      await syncRemoteChange('Removing photo', () => persistTodoPhoto(findTodo(todoId)));
    } catch (error) {
      photoError = error.message || 'The photo could not be removed.';
    } finally {
      photoBusy = false;
    }
  }

  async function handleSomedayChange(todoId, moveToSomeday) {
    const before = findTodo(todoId);
    state = moveToSomeday
      ? setTodoSomeday(state, todoId)
      : restoreTodoFromSomeday(state, todoId);
    const after = findTodo(todoId);

    if (!before || !after || before.somedayAt === after.somedayAt) {
      renderRemoteStatus();
      return;
    }

    saveLocalState(state);
    await syncRemoteChange(moveToSomeday ? 'Moving to Stall' : 'Returning to active tasks', () =>
      persistTodoWorkflow(after),
    );
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
  }

  function closeTask() {
    selectedTaskId = null;
    noteDraftTaskId = null;
  }

  function toggleThemeMode() {
    themeMode = nextThemeMode(themeMode);
    applyThemeMode(themeMode);
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

    state = archivePriorDaySessions(loadLocalState());
    saveLocalState(state);
  }

  function handleWindowFocus() {
    syncSelectedDayToToday();
    void refreshFromSource();
  }

  function handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
      syncSelectedDayToToday();
      void refreshFromSource();
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
      }
    } finally {
      refreshInFlight = false;
    }
  }

  function setViewMode(nextViewMode) {
    viewMode = normalizeViewMode(nextViewMode);
    localStorage.setItem(VIEW_STORAGE_KEY, viewMode);
    draggedBoardTodoId = null;
    dropTargetColumnId = null;
  }

  function shiftCalendarMonth(delta) {
    const next = new Date(calendarYear, calendarMonth + delta, 1);
    calendarYear = next.getFullYear();
    calendarMonth = next.getMonth();
  }

  function goToCurrentMonth() {
    const now = new Date();
    calendarYear = now.getFullYear();
    calendarMonth = now.getMonth();
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
    const createdTodos = getCreatedTodos(beforeTodos, state.todos);
    const changedWorkflowTodos = getTodosWithChangedFields(beforeTodos, state.todos, [
      ...TIMER_SYNC_FIELDS,
      ...COMPLETION_SYNC_FIELDS,
      'somedayAt',
    ]);

    if (
      beforeTodo &&
      afterTodo &&
      beforeTodo.completedAt === afterTodo.completedAt &&
      beforeTodo.somedayAt === afterTodo.somedayAt &&
      beforeTodo.activeStartedAt === afterTodo.activeStartedAt &&
      beforeTodo.trackedSeconds === afterTodo.trackedSeconds &&
      createdTodos.length === 0
    ) {
      return;
    }

    if (columnId === 'done') {
      const completedTodo = afterTodo;
      triggerCompletionCue(completedTodo);
      if (selectedTaskId === todoId) {
        selectedTaskId = null;
      }
      selectedDay = completedTodo?.completedAt
        ? formatDayKey(new Date(completedTodo.completedAt))
        : formatDayKey(new Date());
    }

    saveLocalState(state);

    if (createdTodos.length > 0 || changedWorkflowTodos.length > 0) {
      await syncRemoteChange('Saving task state', async () => {
        await persistArchivedSessions(createdTodos);
        await Promise.all(changedWorkflowTodos.map((todo) => persistTodoWorkflow(todo)));
      });
    }
  }

  async function handleCreateTaskInColumn(columnId, title) {
    const duplicate = findDuplicateTodo(state, title);
    if (duplicate) {
      syncMessage = `Duplicate task: "${duplicate.title}" is already open`;
      return false;
    }

    const existingIds = new Set(state.todos.map((todo) => todo.id));
    state = addTodo(state, title, new Date(), { dueDate: dueDateInputToIso(selectedDay) });

    if (columnId === 'in_progress' || columnId === 'stall' || columnId === 'done') {
      const created = state.todos.find((todo) => !existingIds.has(todo.id));
      if (created) {
        state = moveTodoToBoardColumn(state, created.id, columnId);
      }
    }

    const createdTodo = state.todos.find((todo) => !existingIds.has(todo.id));
    if (!createdTodo) {
      return false;
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
      selectedDay = createdTodo?.completedAt
        ? formatDayKey(new Date(createdTodo.completedAt))
        : formatDayKey(new Date());
      await syncRemoteChange('Saving', () => persistNewTodo(createdTodo));
      return true;
    }

    await syncRemoteChange('Saving', () => persistNewTodo(createdTodo));
    return true;
  }

  function syncSelectedDayToToday() {
    const today = formatDayKey(new Date());
    currentDayKey = today;
    if (selectedDay !== today) {
      selectedDay = today;
    }
    const previous = state;
    state = archivePriorDaySessions(state);
    if (state !== previous) {
      saveLocalState(state);
      void syncRemoteChange('Saving sessions', () => persistArchivedTodos(previous.todos, state.todos));
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
    if (!todo) {
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
    const beforeTodos = state.todos;
    state = updateTodoNoteFromEditor(state, selectedTaskId, nextNote);
    // The first typed note can start the timer (and archive prior days); the
    // note autosave only carries the note text, so those rows need their own sync.
    const timerChanged =
      getCreatedTodos(beforeTodos, state.todos).length > 0 ||
      getTodosWithChangedFields(beforeTodos, state.todos, ARCHIVE_SYNC_FIELDS).length > 0;
    saveLocalState(state);
    const edit = recordNoteEdit(selectedTaskId, nextNote);
    setNoteSaveStatus(selectedTaskId, 'saving');
    noteAutosave.schedule(selectedTaskId, edit);
    if (timerChanged) {
      void syncRemoteChange('Saving time', () => persistArchivedTodos(beforeTodos, state.todos));
    }
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
          // Defensive: a pending edit recorded before this fix could still
          // carry raw "@ " stamps, so strip before it reaches the store or
          // an open textarea.
          const draft = stripNoteStampsForEditor(currentEdit.note);
          state = updateTodoNote(state, todoId, draft);
          if (selectedTaskId === todoId) {
            noteDraft = draft;
          }
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
        persistTodoNote(todo),
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
        const draft = stripNoteStampsForEditor(edit.note);
        state = updateTodoNote(state, todo.id, draft);
        if (selectedTaskId === todo.id) {
          noteDraft = draft;
        }
        changed = true;
      }

      setNoteSaveStatus(todo.id, 'saving');
      noteAutosave.schedule(todo.id, edit);
    }

    if (changed) {
      saveLocalState(state);
    }
  }

  function setNoteSaveStatus(todoId, status) {
    noteSaveStatuses = { ...noteSaveStatuses, [todoId]: status };
  }

  function handleDetailTitleCommit(todoId, title) {
    window.clearTimeout(titleSaveTimer);
    titleSaveTimer = window.setTimeout(() => {
      commitTodoTitle(todoId, title);
    }, 0);
  }

  async function handleCompletedAtChange(todoId, dateValue, timeValue, { allowBeforeStart = false } = {}) {
    if (!dateValue || !timeValue) {
      return { ok: false, error: 'Choose a valid end date and time.' };
    }

    const completedAt = new Date(`${dateValue}T${timeValue}`);
    if (Number.isNaN(completedAt.getTime())) {
      return { ok: false, error: 'Choose a valid end date and time.' };
    }

    if (!allowBeforeStart) {
      const todo = findTodo(todoId);
      const startedAt = todo?.firstStartedAt ? new Date(todo.firstStartedAt) : null;
      if (startedAt && !Number.isNaN(startedAt.getTime()) && startedAt >= completedAt) {
        return { ok: false, error: 'End time must be after start time.' };
      }
    }

    const beforeTodos = state.todos;
    state = updateTodoCompletedAt(state, todoId, completedAt);
    const changedTodos = getCompletionChangedTodos(beforeTodos, state.todos);

    if (changedTodos.length === 0) {
      return { ok: false, error: 'The finish time could not be updated.' };
    }

    selectedDay = formatDayKey(completedAt);
    saveLocalState(state);
    await syncRemoteChange('Saving finish time', () => persistCompletionChangedTodos(changedTodos));
    return { ok: true };
  }

  async function handleTimeSegmentsChange(todoId, segments) {
    if (
      !segments.length ||
      segments.some(({ startedAt, endedAt }) => {
        const start = new Date(startedAt);
        const end = new Date(endedAt);
        return Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end;
      })
    ) {
      return { ok: false, error: 'Start time must be before end time in each block.' };
    }

    const beforeTodos = state.todos;
    const nextState = updateTodoTimeSegments(state, todoId, segments);
    const changedTodos = getTodosWithChangedFields(beforeTodos, nextState.todos, [
      ...TIMER_SYNC_FIELDS,
      ...COMPLETION_SYNC_FIELDS,
    ]);
    const createdTodos = getCreatedTodos(beforeTodos, nextState.todos);
    const deletedTodos = getRemovedTodos(beforeTodos, nextState.todos);
    const updatedTodo = nextState.todos.find((todo) => todo.id === todoId);

    if (
      !updatedTodo ||
      (changedTodos.length === 0 && createdTodos.length === 0 && deletedTodos.length === 0)
    ) {
      return { ok: false, error: 'This task timing could not be updated.' };
    }

    state = nextState;

    if (updatedTodo?.completedAt) {
      selectedDay = formatDayKey(new Date(updatedTodo.completedAt));
    }

    saveLocalState(state);
    await syncRemoteChange('Saving time', () => persistEditedTimeSegments(beforeTodos, state.todos));
    return { ok: true };
  }

  async function handleSummaryCompletedTimeChange(todoId, timeValue) {
    const todo = findTodo(todoId);
    if (!todo?.completedAt) {
      return { ok: false, error: 'The finish time could not be updated.' };
    }

    const completedAt = new Date(todo.completedAt);
    const dateValue = `${completedAt.getFullYear()}-${String(completedAt.getMonth() + 1).padStart(2, '0')}-${String(completedAt.getDate()).padStart(2, '0')}`;
    return handleCompletedAtChange(todoId, dateValue, timeValue);
  }

  async function handleDeleteTask(todoId) {
    const deletedTodos = state.todos.filter((todo) => todo.id === todoId || todo.parentTaskId === todoId);
    const deletedIds = deletedTodos.map((todo) => todo.id);

    if (deletedIds.length === 0) {
      return;
    }

    state = deleteTodo(state, todoId);
    if (selectedTaskId === todoId || deletedIds.includes(selectedTaskId)) {
      selectedTaskId = null;
    }
    saveLocalState(state);
    await syncRemoteChange('Deleting task', async () => {
      if (useRemote && authUser) {
        await cleanupTodoPhotos(insforge, deletedTodos);
      }
      await persistDeletedTodos(deletedIds);
    });
  }

  async function handlePromoteProject(todoId) {
    const before = findTodo(todoId);
    if (!before || before.kind !== 'project') {
      return;
    }

    state = promoteTodoToTask(state, todoId);
    const after = findTodo(todoId);
    saveLocalState(state);
    setViewMode('flow');
    await syncRemoteChange('Moving to tasks', () => persistTodoWorkflow(after));
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
    await noteAutosave.flushAll().catch(() => {});
    await signOut(insforge);
    authUser = null;
    state = createInitialState();
    saveLocalState(state);
    syncMessage = 'Signed out';
  }

  async function handleCheckForUpdates() {
    try {
      await noteAutosave.flushAll();
    } catch {
      // Pending notes remain in local storage and retry after the update check.
    }
    requestNativeUpdate(window);
  }

  async function hydrateRemoteTodos() {
    if (!useRemote || !authUser) {
      return;
    }

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
      const beforeTodos = merged.todos;
      state = archivePriorDaySessions({ todos: merged.todos });
      saveLocalState(state);
      await persistArchivedTodos(beforeTodos, state.todos);
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

    try {
      auditLogEntries = await loadAuditLog(insforge, authUser.id);
    } catch {
      auditLogEntries = [];
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
      // Refresh so Settings' audit log picks up the draft_generated entry
      // the function just wrote, without waiting for an unrelated action.
      await loadLoopSurfaces();
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
      return true;
    } catch (error) {
      showOfflineCache(error);
      return false;
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

  async function persistTodoDueDate(todo) {
    if (!useRemote || !authUser || !todo) return;
    await updateRemoteTodoDueDate(insforge, authUser.id, todo);
  }

  async function persistTodoPhoto(todo) {
    if (!useRemote || !authUser || !todo) return;
    await updateRemoteTodoPhoto(insforge, authUser.id, todo);
  }

  async function persistTodoTimer(todo) {
    if (!useRemote || !authUser || !todo) return;
    await updateRemoteTodoTimer(insforge, authUser.id, todo);
  }

  async function persistTodoWorkflow(todo) {
    if (!useRemote || !authUser || !todo) return;
    await updateRemoteTodoWorkflow(insforge, authUser.id, todo);
  }

  async function persistArchivedSessions(sessions) {
    if (!useRemote || !authUser) return;
    await Promise.all(
      sessions.map((session) => insertRemoteProgressSession(insforge, authUser.id, session)),
    );
  }

  async function persistArchivedTodos(beforeTodos, afterTodos) {
    await persistArchivedSessions(getCreatedTodos(beforeTodos, afterTodos));
    const changedTodos = getTodosWithChangedFields(beforeTodos, afterTodos, ARCHIVE_SYNC_FIELDS);
    await Promise.all(
      changedTodos.map((todo) => (todo.completedAt ? persistCompletedTodo(todo) : persistTodoTimer(todo))),
    );
  }

  async function persistEditedTimeSegments(beforeTodos, afterTodos) {
    await persistArchivedTodos(beforeTodos, afterTodos);
    const deletedTodos = getRemovedTodos(beforeTodos, afterTodos);
    if (useRemote && authUser) {
      await cleanupTodoPhotos(insforge, deletedTodos);
    }
    await persistDeletedTodos(deletedTodos.map((todo) => todo.id));
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

  function loadViewMode() {
    return normalizeViewMode(localStorage.getItem(VIEW_STORAGE_KEY));
  }

  function findTodo(todoId) {
    return state.todos.find((todo) => todo.id === todoId);
  }

  function getCreatedTodos(beforeTodos, afterTodos) {
    const beforeIds = new Set(beforeTodos.map((todo) => todo.id));
    return afterTodos.filter((todo) => !beforeIds.has(todo.id));
  }

  function getRemovedTodos(beforeTodos, afterTodos) {
    const afterIds = new Set(afterTodos.map((todo) => todo.id));
    return beforeTodos.filter((todo) => !afterIds.has(todo.id));
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

<svelte:window on:keydown={handleWorkspaceKeydown} />

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
  class:is-board-view={viewMode === 'projects' || viewMode === 'board' || viewMode === 'calendar' || viewMode === 'inbox' || viewMode === 'waiting' || viewMode === 'history' || viewMode === 'meetings' || viewMode === 'settings'}
  aria-label="Daymark todo app"
>
  {#if viewMode === 'projects'}
    <ProjectsPanel
      projects={projectTodos}
      inboxCount={inboxLoops.length}
      waitingCount={waitingLoops.length}
      onOpenComposer={openComposer}
      onOpenTask={openTask}
      onPromote={handlePromoteProject}
      onDelete={handleDeleteTask}
      onViewChange={setViewMode}
    />
  {:else if viewMode === 'board'}
    <BoardPanel
      {syncMessage}
      columns={boardColumns}
      {selectedDay}
      dueFilter={boardDueFilter}
      onDueFilterChange={(value) => (boardDueFilter = value)}
      {themeMode}
      {newlyAddedTodoId}
      {draggedBoardTodoId}
      {dropTargetColumnId}
      inboxCount={inboxLoops.length}
      waitingCount={waitingLoops.length}
      showSignOut={useRemote && Boolean(authUser)}
      onSignOut={handleSignOut}
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
  {:else if viewMode === 'calendar'}
    <CalendarPanel
      monthLabel={calendarMonthData.monthLabel}
      weeks={calendarMonthData.weeks}
      inboxCount={inboxLoops.length}
      waitingCount={waitingLoops.length}
      onViewChange={setViewMode}
      onPrevMonth={() => shiftCalendarMonth(-1)}
      onNextMonth={() => shiftCalendarMonth(1)}
      onToday={goToCurrentMonth}
      onOpenTask={openTask}
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
      auditLog={auditLogEntries}
      userEmail={authUser?.email ?? ''}
      inboxCount={inboxLoops.length}
      waitingCount={waitingLoops.length}
      showSignOut={useRemote && Boolean(authUser)}
      onSignOut={handleSignOut}
      onViewChange={setViewMode}
      insforge={useRemote ? insforge : null}
      userId={authUser?.id ?? null}
    />
  {:else}
    <TaskPanel
      {syncMessage}
      {ongoingTodos}
      {pausedTodos}
      {openTodoSections}
      bind:searchQuery={taskSearchQuery}
      {searchMatches}
      {editingTaskId}
      {newlyAddedTodoId}
      {draggedSummaryId}
      {isOpenDropTarget}
      {themeMode}
      {viewMode}
      inboxCount={inboxLoops.length}
      waitingCount={waitingLoops.length}
      onOpenComposer={openComposer}
      composerOpen={composerOpen}
      onStartTitleEdit={startTitleEdit}
      onTitleKeydown={handleTitleKeydown}
      onCommitTitleEdit={commitTitleEdit}
      onTimerAction={handleTimerAction}
      onOpenTask={openTask}
      onComplete={handleComplete}
      onDeleteTask={handleDeleteTask}
      onFail={handleFail}
      onOpenListDragOver={handleOpenListDragOver}
      onOpenListDrop={handleOpenListDrop}
      onToggleTheme={toggleThemeMode}
      onViewChange={setViewMode}
      showSignOut={useRemote && Boolean(authUser)}
      showNativeUpdate={hasNativeUpdater}
      onSignOut={handleSignOut}
      onCheckForUpdates={handleCheckForUpdates}
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
      searchActive={Boolean(taskSearchQuery.trim())}
    />
  {/if}

  <TaskDetail
    {selectedTask}
    {selectedTaskSessions}
    bind:noteDraft
    noteSaveStatus={selectedNoteSaveStatus}
    onClose={closeTask}
    onNoteInput={handleNoteInput}
    onDetailTitleCommit={handleDetailTitleCommit}
    onTimeSegmentsChange={handleTimeSegmentsChange}
    onCompletedAtChange={handleCompletedAtChange}
    onDueDateChange={handleDueDateChange}
    onSomedayChange={handleSomedayChange}
    onDeleteTask={handleDeleteTask}
    onPhotoSelect={handleTaskPhotoSelect}
    onPhotoRemove={handleTaskPhotoRemove}
    {photoBusy}
    {photoError}
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

  <AddTaskOverlay
    bind:open={composerOpen}
    bind:title={titleDraft}
    bind:kind={composerKind}
    bind:dueDate={dueDateDraft}
    bind:error={composerError}
    onClose={closeComposer}
    onSubmit={handleSubmit}
  />

  <div class="workspace-feedback">
    <FeedbackSdkWidget theme={themeMode === 'dark' ? 'dark' : 'light'} />
  </div>
</main>
{/if}
