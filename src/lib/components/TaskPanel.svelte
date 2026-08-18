<script>
  import { flip } from 'svelte/animate';
  import {
    formatDuration,
    formatDueDate,
    formatTaskTimestamp,
    getElapsedSeconds,
  } from '../../todoStore.js';
  import { rollUp, searchFlip } from '../motion/rollUp.js';
  import { isApplePlatform, newTaskShortcutLabel } from '../../newTaskShortcut.js';
  import { linkifyText } from '../../linkify.js';
  import { iconCheck, iconPage, iconPause, iconPlay, iconSearch, iconTrash, iconX } from './icons.js';
  import ThemeToggle from './ThemeToggle.svelte';
  import WorkspaceTabs from './WorkspaceTabs.svelte';

  export let syncMessage = 'Local only';
  export let ongoingTodos = [];
  export let pausedTodos = [];
  export let openTodoSections = [];
  export let searchQuery = '';
  export let searchMatches = [];
  export let editingTaskId = null;
  export let newlyAddedTodoId = null;
  export let draggedSummaryId = null;
  export let isOpenDropTarget = false;
  export let themeMode = 'light';
  export let viewMode = 'flow';
  export let inboxCount = 0;
  export let waitingCount = 0;
  export let onOpenComposer;
  export let composerOpen = false;
  export let onStartTitleEdit;
  export let onTitleKeydown;
  export let onCommitTitleEdit;
  export let onTimerAction;
  export let onOpenTask;
  export let onComplete;
  export let onDeleteTask;
  export let onFail;
  export let onOpenListDragOver;
  export let onOpenListDrop;
  export let onToggleTheme;
  export let onViewChange;
  export let showSignOut = false;
  export let onSignOut;

  $: todayOpenSection = openTodoSections.find((section) => section.isToday);
  $: datedOpenSections = openTodoSections.filter((section) => !section.isToday);
  $: isSearching = Boolean(searchQuery.trim());
  $: hasVisibleTasks =
    ongoingTodos.length > 0 ||
    pausedTodos.length > 0 ||
    openTodoSections.length > 0 ||
    searchMatches.length > 0;
  $: visibleMatchCount =
    ongoingTodos.length +
    pausedTodos.length +
    openTodoSections.reduce((count, section) => count + section.items.length, 0) +
    searchMatches.length;

  function taskRowState(todo) {
    if (todo.activeStartedAt) {
      return 'running';
    }
    return todo.firstStartedAt && !todo.completedAt ? 'paused' : 'ready';
  }

  // The <li> itself stays inline in each list because animate:flip must sit
  // directly under a keyed each block; only its attributes are shared here.
  function taskRowAttributes(todo, state, isNew) {
    return {
      'data-todo-id': todo.id,
      'data-task-state': state,
      class: ['todo-item', state !== 'ready' && `is-${state}`, isNew && 'is-new-block']
        .filter(Boolean)
        .join(' '),
    };
  }

  function handleTaskTitleClick(event, todoId) {
    if (event.target.closest('a')) {
      return;
    }
    if (window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 900) {
      onOpenTask(todoId);
    }
  }
</script>

<section
  class="task-panel"
  class:is-open-drop-target={isOpenDropTarget}
  aria-labelledby="task-heading"
  on:dragover={onOpenListDragOver}
  on:drop={onOpenListDrop}
>
  <div class="brand-row">
    <div>
      <h1 id="task-heading">Today</h1>
    </div>
    <div class="header-actions">
      <output class="sync-status" id="sync-status" aria-live="polite">{syncMessage}</output>
      <ThemeToggle {themeMode} onToggle={onToggleTheme} />
      {#if showSignOut}
        <button type="button" class="sign-out-button" on:click={onSignOut}>Sign out</button>
      {/if}
    </div>
  </div>
  <p class="panel-note">A quiet workspace for the next thing, and proof of what already moved.</p>

  <WorkspaceTabs currentView={viewMode} {inboxCount} {waitingCount} {onViewChange} />

  <div class="task-toolbar">
    <div class="task-search" class:is-searching={isSearching}>
      <span class="task-search-icon" aria-hidden="true">{@html iconSearch()}</span>
      <label class="sr-only" for="task-search">Search tasks, projects, and notes</label>
      <input
        id="task-search"
        type="search"
        autocomplete="off"
        placeholder="Search tasks, projects, notes..."
        enterkeyhint="search"
        bind:value={searchQuery}
        aria-controls="todo-list"
        aria-describedby="task-search-status"
        on:keydown={(event) => {
          if (event.key === 'Escape' && searchQuery) {
            event.preventDefault();
            searchQuery = '';
          }
        }}
      />
      {#if isSearching}
        <div class="task-search-actions">
          <span class="task-search-count" aria-hidden="true">{visibleMatchCount}</span>
          <button
            type="button"
            class="task-search-clear"
            aria-label="Clear search"
            on:click={() => (searchQuery = '')}
          >
            {@html iconX()}
          </button>
        </div>
      {/if}
    </div>
    <button
      type="button"
      class="new-task-button"
      aria-haspopup="dialog"
      aria-expanded={composerOpen}
      aria-keyshortcuts={isApplePlatform() ? 'Meta+N' : 'Control+N'}
      on:click={() => onOpenComposer?.('task')}
    >
      New task
      <kbd>{newTaskShortcutLabel()}</kbd>
    </button>
    <output id="task-search-status" class="sr-only" aria-live="polite">
      {isSearching ? `${visibleMatchCount} matching` : ''}
    </output>
  </div>

  <ul class="todo-list" id="todo-list">
    {#if ongoingTodos.length}
      <li
        class="task-list-section"
        aria-labelledby="ongoing-heading"
        transition:rollUp={{ enabled: isSearching }}
      >
        <div class="section-heading">
          <h2 id="ongoing-heading">Ongoing</h2>
          <span class="section-count">{ongoingTodos.length} running</span>
        </div>
        <ol class="task-section-list">
          {#each ongoingTodos as todo (todo.id)}
            {@const state = taskRowState(todo)}
            <li
              {...taskRowAttributes(todo, state, newlyAddedTodoId === todo.id)}
              animate:flip={searchFlip(isSearching)}
              in:rollUp|local={{ enabled: isSearching }}
              out:rollUp|local={{ enabled: isSearching }}
            >
              {@render taskRow(todo, state)}
            </li>
          {/each}
        </ol>
      </li>
    {/if}

    {#if todayOpenSection}
      <li
        class="task-list-section"
        aria-labelledby="open-today-heading"
        transition:rollUp={{ enabled: isSearching }}
      >
        <div class="section-heading">
          <h2 id="open-today-heading">{todayOpenSection.label}</h2>
          <span class="section-count" id="open-count">
            {draggedSummaryId ? 'Drop to reopen' : `${todayOpenSection.items.length} open`}
          </span>
        </div>
        <ol class="task-section-list">
          {#each todayOpenSection.items as todo (todo.id)}
            {@const state = taskRowState(todo)}
            <li
              {...taskRowAttributes(todo, state, newlyAddedTodoId === todo.id)}
              animate:flip={searchFlip(isSearching)}
              in:rollUp|local={{ enabled: isSearching }}
              out:rollUp|local={{ enabled: isSearching }}
            >
              {@render taskRow(todo, state)}
            </li>
          {/each}
        </ol>
      </li>
    {/if}

    {#if pausedTodos.length}
      <li
        class="task-list-section paused-task-section"
        aria-labelledby="paused-heading"
        transition:rollUp={{ enabled: isSearching }}
      >
        <div class="section-heading">
          <h2 id="paused-heading">Paused</h2>
          <span class="section-count">{pausedTodos.length} paused</span>
        </div>
        <ol class="task-section-list">
          {#each pausedTodos as todo (todo.id)}
            {@const state = taskRowState(todo)}
            <li
              {...taskRowAttributes(todo, state, newlyAddedTodoId === todo.id)}
              animate:flip={searchFlip(isSearching)}
              in:rollUp|local={{ enabled: isSearching }}
              out:rollUp|local={{ enabled: isSearching }}
            >
              {@render taskRow(todo, state)}
            </li>
          {/each}
        </ol>
      </li>
    {/if}

    {#each datedOpenSections as section, index (section.id)}
      <li
        class="task-list-section"
        aria-labelledby={`open-${section.id}-heading`}
        transition:rollUp={{ enabled: isSearching }}
      >
        <div class="section-heading">
          <h2 id={`open-${section.id}-heading`}>{section.label}</h2>
          <span class="section-count" id={!todayOpenSection && index === 0 ? 'open-count' : undefined}>
            {draggedSummaryId && index === 0 ? 'Drop to reopen' : `${section.items.length} open`}
          </span>
        </div>
        <ol class="task-section-list">
          {#each section.items as todo (todo.id)}
            {@const state = taskRowState(todo)}
            <li
              {...taskRowAttributes(todo, state, newlyAddedTodoId === todo.id)}
              animate:flip={searchFlip(isSearching)}
              in:rollUp|local={{ enabled: isSearching }}
              out:rollUp|local={{ enabled: isSearching }}
            >
              {@render taskRow(todo, state)}
            </li>
          {/each}
        </ol>
      </li>
    {/each}

    {#if searchMatches.length}
      <li
        class="task-list-section"
        aria-labelledby="search-matches-heading"
        transition:rollUp={{ enabled: isSearching }}
      >
        <div class="section-heading">
          <h2 id="search-matches-heading">Also found</h2>
          <span class="section-count">{searchMatches.length}</span>
        </div>
        <ol class="task-section-list">
          {#each searchMatches as todo (todo.id)}
            <li
              class="todo-item search-match"
              animate:flip={searchFlip(isSearching)}
              in:rollUp|local={{ enabled: isSearching }}
              out:rollUp|local={{ enabled: isSearching }}
            >
              <span class="task-block-dot" aria-hidden="true"></span>
              <div class="task-content">
                <button type="button" class="search-match-title" on:click={() => onOpenTask(todo.id)}>
                  {@html linkifyText(todo.title)}
                </button>
                <span
                  class="task-state-badge"
                  class:is-project={todo.kind === 'project'}
                  class:is-done={Boolean(todo.completedAt) && todo.kind !== 'project'}
                  class:is-open={!todo.completedAt && todo.kind !== 'project'}
                >
                  {todo.kind === 'project' ? 'Project' : todo.completedAt ? 'Done' : 'Open'}
                </span>
              </div>
            </li>
          {/each}
        </ol>
      </li>
    {/if}

    {#if !hasVisibleTasks}
      <li class="empty-state">
        {#if isSearching}
          <p>Nothing matches that search.</p>
          <button type="button" class="empty-state-action" on:click={() => onOpenComposer?.('task')}>
            New task
          </button>
        {:else}
          No open tasks. Add one when the next thing appears.
        {/if}
      </li>
    {/if}
  </ul>
</section>

{#snippet taskRow(todo, state)}
  {@const isRunning = state === 'running'}
  {@const isPaused = state === 'paused'}
  {@const elapsedSeconds = getElapsedSeconds(todo)}
  {@const latestSession = todo.latestProgressSession}
  {@const timerAction = isRunning ? 'pause' : 'start'}
  {@const timerText = isRunning ? 'Pause' : 'Start'}
  <span class="task-block-dot" aria-hidden="true"></span>
  <div class="task-content">
    {#if editingTaskId === todo.id}
      <input
        class="task-title-input"
        data-title-input={todo.id}
        value={todo.title}
        aria-label={`Edit ${todo.title} title`}
        on:keydown={(event) => onTitleKeydown(event, todo.id, event.currentTarget.value)}
        on:focusout={(event) => onCommitTitleEdit(todo.id, event.currentTarget.value)}
      />
    {:else}
      <span
        class="task-title"
        data-title-id={todo.id}
        title="Double-click to rename"
        role="button"
        tabindex="0"
        on:click={(event) => handleTaskTitleClick(event, todo.id)}
        on:dblclick={() => onStartTitleEdit(todo.id)}
        on:keydown={(event) => event.key === 'Enter' && onStartTitleEdit(todo.id)}
      >
        {@html linkifyText(todo.title)}
      </span>
    {/if}
    {#if isPaused}
      <span class="task-state-badge">Paused</span>
    {/if}
    <span class:is-live={isRunning} class="task-duration" data-timer-label={todo.id}>
      {isRunning ? 'Tracking' : 'Duration'} {formatDuration(elapsedSeconds)}
    </span>
    {#if todo.firstStartedAt}
      <span class="task-timing">
        Started <time datetime={todo.firstStartedAt}>{formatTaskTimestamp(todo.firstStartedAt)}</time>
      </span>
    {/if}
    {#if todo.dueDate}
      <span class="task-due-badge" data-due-for={todo.id}>Due {formatDueDate(todo.dueDate)}</span>
    {/if}
    {#if latestSession}
      <span class="task-progress-label">
        Last session {formatDuration(latestSession.trackedSeconds)}
      </span>
    {/if}
  </div>
  <div class="task-actions">
    <button type="button" class="timer-button" title={`${timerText} timer`} on:click={() => onTimerAction(timerAction, todo.id)} aria-label={`${timerText} ${todo.title} timer`}>
      {@html isRunning ? iconPause() : iconPlay()}
      <span>{timerText}</span>
    </button>
    <button type="button" class="open-task-button" on:click={(event) => onOpenTask(todo.id, event.currentTarget)} aria-label={`Open ${todo.title} details`}>
      {@html iconPage()}
      <span>Open</span>
    </button>
    <button type="button" on:click={() => onComplete(todo.id)} aria-label={`Mark ${todo.title} done`}>
      {@html iconCheck()}
      <span>Done</span>
    </button>
    <button type="button" class="fail-task-button" on:click={() => onFail(todo.id)} aria-label={`Mark ${todo.title} failed`}>
      {@html iconX()}
      <span>Fail</span>
    </button>
    <button type="button" class="delete-task-button" title="Delete" on:click={() => onDeleteTask(todo.id)} aria-label={`Delete ${todo.title}`}>
      {@html iconTrash()}
      <span>Delete</span>
    </button>
  </div>
{/snippet}
