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
    formatDayKey,
    formatDuration,
    getDaySummary,
    getElapsedSeconds,
    moveCompletedTodoToSummaryBucket,
    getPendingTodos,
    pauseTodoTimer,
    startTodoTimer,
    updateTodoNote,
    updateTodoTitle,
  } from '../todoStore.js';
  import { insforge, isInsForgeConfigured } from '../insforgeClient.js';
  import {
    completeRemoteTodo,
    insertRemoteTodo,
    loadRemoteTodos,
    updateRemoteTodoCompletion,
    updateRemoteTodoNote,
    updateRemoteTodoTimer,
    updateRemoteTodoTitle,
  } from '../todoRemote.js';

  const STORAGE_KEY = 'done-log-state';
  const CLIENT_ID_KEY = 'done-log-client-id';

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
  let noteSaveTimer = null;
  let draggedSummaryId = null;
  let dropTargetId = null;
  let dropTargetBucket = null;
  let completionCue = null;
  let completionCueTimer = null;

  $: pendingTodos = getPendingTodos(state);
  $: summary = getDaySummary(state, selectedDay);
  $: completedToday = summary.reduce((total, section) => total + section.items.length, 0);
  $: selectedTask = findTodo(selectedTaskId);

  onMount(() => {
    useRemote = isInsForgeConfigured && !new URLSearchParams(window.location.search).has('local');
    syncMessage = useRemote ? 'Connecting' : 'Local only';
    clientId = getClientId();
    state = loadState();
    hydrateRemoteTodos();
  });

  onDestroy(() => {
    window.clearInterval(liveTimer);
    window.clearTimeout(noteSaveTimer);
    window.clearTimeout(completionCueTimer);
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
    if (selectedTask && noteDraft !== (selectedTask.note ?? '')) {
      noteDraft = selectedTask.note ?? '';
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
    saveState(state);
    syncMessage = 'Saving';
    window.setTimeout(() => {
      if (newlyAddedTodoId === createdTodo.id) {
        newlyAddedTodoId = null;
      }
    }, 700);

    try {
      await persistNewTodo(createdTodo);
      renderRemoteStatus();
    } catch (error) {
      syncMessage = `Offline cache: ${error.message}`;
    }
  }

  function handleDraftInput() {
    draftTitle = titleDraft.trim();
  }

  async function handleComplete(todoId) {
    state = completeTodo(state, todoId);
    const completedTodo = findTodo(todoId);
    triggerCompletionCue(completedTodo);
    if (selectedTaskId === todoId) {
      selectedTaskId = null;
    }
    selectedDay = formatDayKey(new Date());
    saveState(state);
    syncMessage = 'Saving';

    try {
      await persistCompletedTodo(completedTodo);
      renderRemoteStatus();
    } catch (error) {
      syncMessage = `Offline cache: ${error.message}`;
    }
  }

  async function handleTimerAction(action, todoId) {
    const beforeTodos = state.todos;
    state = action === 'pause' ? pauseTodoTimer(state, todoId) : startTodoTimer(state, todoId);
    const changedTodos = getTimerChangedTodos(beforeTodos, state.todos);
    saveState(state);
    syncMessage = 'Saving time';

    try {
      await Promise.all(changedTodos.map((todo) => persistTodoTimer(todo)));
      renderRemoteStatus();
    } catch (error) {
      syncMessage = `Offline cache: ${error.message}`;
    }
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

    const before = findTodo(todoId);
    state = updateTodoTitle(state, todoId, title);
    editingTaskId = null;
    saveState(state);
    syncMessage = 'Saving title';
    const after = findTodo(todoId);

    if (!before || !after || before.title === after.title) {
      renderRemoteStatus();
      return;
    }

    try {
      await persistTodoTitle(after);
      renderRemoteStatus();
    } catch (error) {
      syncMessage = `Offline cache: ${error.message}`;
    }
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

  function handleNoteInput() {
    if (!selectedTaskId) {
      return;
    }

    state = updateTodoNote(state, selectedTaskId, noteDraft);
    saveState(state);
    syncMessage = 'Saving note';
    window.clearTimeout(noteSaveTimer);
    noteSaveTimer = window.setTimeout(async () => {
      const todo = findTodo(selectedTaskId);
      try {
        await persistTodoNote(todo);
        renderRemoteStatus();
      } catch (error) {
        syncMessage = `Offline cache: ${error.message}`;
      }
    }, 450);
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

    saveState(state);
    syncMessage = 'Saving order';
    try {
      await persistCompletionChangedTodos(changedTodos);
      renderRemoteStatus();
    } catch (error) {
      syncMessage = `Offline cache: ${error.message}`;
    }
  }

  function loadState() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? createInitialState(JSON.parse(stored).todos ?? []) : createInitialState();
    } catch {
      return createInitialState();
    }
  }

  function saveState(nextState) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
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
      saveState(state);
      renderRemoteStatus(remoteTodos.length);
    } catch (error) {
      syncMessage = `Offline cache: ${error.message}`;
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

  async function persistTodoTimer(todo) {
    if (!useRemote || !todo) return;
    await updateRemoteTodoTimer(insforge, clientId, todo);
  }

  async function persistCompletionChangedTodos(todosToUpdate) {
    if (!useRemote) return;
    await Promise.all(todosToUpdate.map((todo) => updateRemoteTodoCompletion(insforge, clientId, todo)));
  }

  function renderRemoteStatus(count = state.todos.length) {
    syncMessage = useRemote ? `Cloud synced: ${count}` : 'Local only';
  }

  function getClientId() {
    const existing = localStorage.getItem(CLIENT_ID_KEY);
    if (existing) {
      return existing;
    }

    const nextClientId = crypto.randomUUID();
    localStorage.setItem(CLIENT_ID_KEY, nextClientId);
    return nextClientId;
  }

  function findTodo(todoId) {
    return state.todos.find((todo) => todo.id === todoId);
  }

  function getTimerChangedTodos(beforeTodos, afterTodos) {
    const beforeById = new Map(beforeTodos.map((todo) => [todo.id, todo]));
    return afterTodos.filter((todo) => {
      const before = beforeById.get(todo.id);
      return (
        before &&
        (before.firstStartedAt !== todo.firstStartedAt ||
          before.activeStartedAt !== todo.activeStartedAt ||
          before.trackedSeconds !== todo.trackedSeconds)
      );
    });
  }

  function getCompletionChangedTodos(beforeTodos, afterTodos) {
    const beforeById = new Map(beforeTodos.map((todo) => [todo.id, todo]));
    return afterTodos.filter((todo) => beforeById.get(todo.id)?.completedAt !== todo.completedAt);
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
    {pendingTodos}
    bind:titleDraft
    {draftTitle}
    {editingTaskId}
    {newlyAddedTodoId}
    onSubmit={handleSubmit}
    onDraftInput={handleDraftInput}
    onStartTitleEdit={startTitleEdit}
    onTitleKeydown={handleTitleKeydown}
    onCommitTitleEdit={commitTitleEdit}
    onTimerAction={handleTimerAction}
    onOpenTask={openTask}
    onComplete={handleComplete}
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
    {completedTime}
  />

  <TaskDetail
    {selectedTask}
    bind:noteDraft
    onClose={closeTask}
    onNoteInput={handleNoteInput}
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
