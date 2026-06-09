<script>
  import { onDestroy, onMount, tick } from 'svelte';
  import '../styles.css';
  import { linkifyText } from '../linkify.js';
  import {
    addTodo,
    completeTodo,
    createInitialState,
    formatDayKey,
    formatDuration,
    getDaySummary,
    getElapsedSeconds,
    getPendingTodos,
    pauseTodoTimer,
    reorderCompletedTodosForDay,
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
  }

  function handleDragOver(event, todoId) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    dropTargetId = todoId;
  }

  async function handleDrop(event, targetId) {
    const draggedId = event.dataTransfer.getData('text/plain');
    if (!draggedId || draggedId === targetId) {
      return;
    }

    event.preventDefault();
    const summaryIds = getSummaryIdsForSelectedDay();
    const reorderedIds = moveIdBefore(summaryIds, draggedId, targetId);
    state = reorderCompletedTodosForDay(state, selectedDay, reorderedIds);
    draggedSummaryId = null;
    dropTargetId = null;
    saveState(state);
    syncMessage = 'Saving order';

    try {
      await persistReorderedTodos(reorderedIds);
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

  async function persistReorderedTodos(orderedIds) {
    if (!useRemote) return;
    const todosToUpdate = orderedIds.map((id) => findTodo(id)).filter(Boolean);
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

  function getSummaryIdsForSelectedDay() {
    return getDaySummary(state, selectedDay).flatMap((section) => section.items.map((item) => item.id));
  }

  function moveIdBefore(ids, draggedId, targetId) {
    const withoutDragged = ids.filter((id) => id !== draggedId);
    const targetIndex = withoutDragged.indexOf(targetId);
    if (targetIndex === -1) {
      return ids;
    }

    return [...withoutDragged.slice(0, targetIndex), draggedId, ...withoutDragged.slice(targetIndex)];
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

  function iconPage() {
    return `
      <svg class="nucleo-icon" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M4.5 2.5h5L12.5 5.5v8h-8z" />
        <path d="M9.5 2.5v3h3" />
        <path d="M6.25 8.25h5" />
        <path d="M6.25 10.75h4" />
      </svg>
    `;
  }

  function iconCheck() {
    return `
      <svg class="nucleo-icon" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3.25 8.25l3 3 7-7" />
      </svg>
    `;
  }

  function iconPlay() {
    return `
      <svg class="nucleo-icon" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M5.25 3.25v9.5l8-4.75z" />
      </svg>
    `;
  }

  function iconPause() {
    return `
      <svg class="nucleo-icon" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M5.25 3.5v9" />
        <path d="M10.75 3.5v9" />
      </svg>
    `;
  }
</script>

<main class="workspace" aria-label="Done Log todo app">
  <section class="task-panel" aria-labelledby="task-heading">
    <div class="brand-row">
      <div>
        <p class="eyebrow">Done Log</p>
        <h1 id="task-heading">Today</h1>
        <p class="panel-note">A quiet workspace for the next thing, and proof of what already moved.</p>
      </div>
      <output class="sync-status" id="sync-status" aria-live="polite">{syncMessage}</output>
    </div>

    <form class="new-task-form" id="new-task-form" on:submit|preventDefault={handleSubmit}>
      <label for="todo-title">New task</label>
      <div class="input-row">
        <input
          id="todo-title"
          name="title"
          type="text"
          autocomplete="off"
          placeholder="+ Add task and press Enter"
          bind:value={titleDraft}
          on:input={handleDraftInput}
        />
        <button type="submit">Add</button>
      </div>
    </form>

    <div class="section-heading">
      <h2>Open</h2>
      <span id="open-count">{pendingTodos.length} open</span>
    </div>
    <ul class="todo-list" id="todo-list">
      {#each pendingTodos as todo (todo.id)}
        {@const isRunning = Boolean(todo.activeStartedAt)}
        {@const elapsedSeconds = getElapsedSeconds(todo)}
        {@const timerAction = isRunning ? 'pause' : 'start'}
        {@const timerText = isRunning ? 'Pause' : elapsedSeconds > 0 ? 'Resume' : 'Start'}
        <li class:is-running={isRunning} class:is-new-block={newlyAddedTodoId === todo.id} class="todo-item">
          <span class="task-block-dot" aria-hidden="true"></span>
          <div class="task-content">
            {#if editingTaskId === todo.id}
              <input
                class="task-title-input"
                data-title-input={todo.id}
                value={todo.title}
                aria-label={`Edit ${todo.title} title`}
                on:keydown={(event) => handleTitleKeydown(event, todo.id, event.currentTarget.value)}
                on:focusout={(event) => commitTitleEdit(todo.id, event.currentTarget.value)}
              />
            {:else}
              <span
                class="task-title"
                data-title-id={todo.id}
                title="Double-click to rename"
                role="button"
                tabindex="0"
                on:dblclick={() => startTitleEdit(todo.id)}
                on:keydown={(event) => event.key === 'Enter' && startTitleEdit(todo.id)}
              >
                {@html linkifyText(todo.title)}
              </span>
            {/if}
            <span class:is-live={isRunning} class="task-duration" data-timer-label={todo.id}>
              {isRunning ? 'Tracking' : 'Duration'} {formatDuration(elapsedSeconds)}
            </span>
          </div>
          <div class="task-actions">
            <button type="button" class="timer-button" on:click={() => handleTimerAction(timerAction, todo.id)} aria-label={`${timerText} ${todo.title} timer`}>
              {@html isRunning ? iconPause() : iconPlay()}
              <span>{timerText}</span>
            </button>
            <button type="button" class="open-task-button" on:click={() => openTask(todo.id)} aria-label={`Open ${todo.title} details`}>
              {@html iconPage()}
              <span>Open</span>
            </button>
            <button type="button" on:click={() => handleComplete(todo.id)} aria-label={`Mark ${todo.title} done`}>
              {@html iconCheck()}
              <span>Done</span>
            </button>
          </div>
        </li>
      {/each}
      {#if draftTitle}
        <li class="block-insertion-cue" aria-live="polite">
          <span class="block-insertion-line" aria-hidden="true"></span>
          <span class="block-insertion-label">New block lands here</span>
        </li>
      {/if}
      {#if pendingTodos.length === 0}
        <li class="empty-state">No open tasks. Add one when the next thing appears.</li>
      {/if}
    </ul>
  </section>

  <div class="flow-rail" aria-label="Today progress">
    <output class="done-count" id="done-count" aria-label="Completed today">{completedToday} done today</output>
    <span class="rail-line" aria-hidden="true"></span>
    <span class="rail-caption">Done log</span>
  </div>

  <aside class="summary-panel" aria-labelledby="summary-heading">
    <div class="summary-top">
      <div>
        <p class="eyebrow">Daily ledger</p>
        <h2 id="summary-heading">Today recap</h2>
      </div>
      <input id="summary-date" type="date" bind:value={selectedDay} />
    </div>
    <div class="day-rhythm" aria-hidden="true">
      <span>Morning</span>
      <span>Lunch</span>
      <span>Afternoon</span>
      <span>Evening</span>
    </div>
    <div class="summary-list" id="summary-list">
      {#if summary.length}
        {#each summary as section (section.label)}
          <section class="summary-section" aria-label={section.label}>
            <h3>{section.label}</h3>
            <ol>
              {#each section.items as item (item.id)}
                <li
                  draggable="true"
                  data-summary-id={item.id}
                  class:is-dragging={draggedSummaryId === item.id}
                  class:is-drop-target={dropTargetId === item.id}
                  on:dragstart={(event) => handleDragStart(event, item.id)}
                  on:dragend={handleDragEnd}
                  on:dragover={(event) => handleDragOver(event, item.id)}
                  on:drop={(event) => handleDrop(event, item.id)}
                >
                  <time datetime={item.completedAt}>{completedTime(item.completedAt)}</time>
                  <div class="summary-block">
                    <span class="summary-title">{@html linkifyText(item.title)}</span>
                    <span class="summary-duration">{item.durationLabel}</span>
                  </div>
                  <button type="button" class="open-task-button" on:click={() => openTask(item.id)} aria-label={`Open ${item.title} details`}>
                    {@html iconPage()}
                    <span>Open</span>
                  </button>
                </li>
              {/each}
            </ol>
          </section>
        {/each}
      {:else}
        <div class="empty-summary">
          <strong>No finished tasks for this date.</strong>
          <span>Complete a task and it will land here automatically.</span>
        </div>
      {/if}
    </div>
  </aside>

  <aside class:is-open={selectedTask} class="task-detail" id="task-detail" aria-labelledby="detail-heading" aria-hidden={String(!selectedTask)}>
    <div class="detail-header">
      <div>
        <p class="eyebrow">Task page</p>
        <h2 id="detail-heading">Details</h2>
      </div>
      <button type="button" class="detail-close" id="detail-close" aria-label="Close task details" on:click={closeTask}>Close</button>
    </div>
    {#if selectedTask}
      <p class="detail-title" id="detail-title">{@html linkifyText(selectedTask.title)}</p>
      <label class="detail-note-label" for="detail-note">Notes</label>
      <textarea
        id="detail-note"
        class="detail-note"
        placeholder="Add context, links, or reminders for this task."
        bind:value={noteDraft}
        on:input={handleNoteInput}
      ></textarea>
      <p class="detail-meta" id="detail-meta">{detailMeta(selectedTask)}</p>
    {/if}
  </aside>
</main>
