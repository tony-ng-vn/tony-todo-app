<script>
  import { formatDuration, getElapsedSeconds } from '../../todoStore.js';
  import { linkifyText } from '../../linkify.js';
  import { iconCheck, iconMoon, iconPage, iconPause, iconPlay, iconSun, iconX } from './icons.js';

  export let syncMessage = 'Local only';
  export let ongoingTodos = [];
  export let openTodoSections = [];
  export let openCount = 0;
  export let titleDraft = '';
  export let draftTitle = '';
  export let editingTaskId = null;
  export let newlyAddedTodoId = null;
  export let draggedSummaryId = null;
  export let isOpenDropTarget = false;
  export let themeMode = 'light';
  export let viewMode = 'flow';
  export let inboxCount = 0;
  export let waitingCount = 0;
  export let onSubmit;
  export let onDraftInput;
  export let onStartTitleEdit;
  export let onTitleKeydown;
  export let onCommitTitleEdit;
  export let onTimerAction;
  export let onOpenTask;
  export let onComplete;
  export let onFail;
  export let onOpenListDragOver;
  export let onOpenListDrop;
  export let onToggleTheme;
  export let onViewChange;
  export let showSignOut = false;
  export let onSignOut;
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
      <p class="eyebrow">Done Log</p>
      <h1 id="task-heading">Today</h1>
      <p class="panel-note">A quiet workspace for the next thing, and proof of what already moved.</p>
    </div>
    <div class="header-actions">
      <output class="sync-status" id="sync-status" aria-live="polite">{syncMessage}</output>
      <button
        type="button"
        class="theme-toggle"
        on:click={onToggleTheme}
        aria-label={`Switch to ${themeMode === 'dark' ? 'light' : 'dark'} mode`}
      >
        {@html themeMode === 'dark' ? iconSun() : iconMoon()}
        <span>{themeMode === 'dark' ? 'Light' : 'Dark'}</span>
      </button>
      {#if showSignOut}
        <button type="button" class="sign-out-button" on:click={onSignOut}>Sign out</button>
      {/if}
    </div>
  </div>

  <div class="view-toggle" role="group" aria-label="Workspace view">
    <button
      type="button"
      class="view-toggle-button"
      class:is-active={viewMode === 'flow'}
      aria-current={viewMode === 'flow' ? 'page' : undefined}
      on:click={() => onViewChange?.('flow')}
    >
      Flow
    </button>
    <button type="button" class="view-toggle-button" on:click={() => onViewChange?.('board')}>
      Board
    </button>
    <button type="button" class="view-toggle-button" on:click={() => onViewChange?.('inbox')}>
      Inbox{inboxCount ? ` (${inboxCount})` : ''}
    </button>
    <button type="button" class="view-toggle-button" on:click={() => onViewChange?.('waiting')}>
      Waiting{waitingCount ? ` (${waitingCount})` : ''}
    </button>
    <button type="button" class="view-toggle-button" on:click={() => onViewChange?.('history')}>
      History
    </button>
    <button type="button" class="view-toggle-button" on:click={() => onViewChange?.('meetings')}>
      Meetings
    </button>
    <button type="button" class="view-toggle-button" on:click={() => onViewChange?.('settings')}>
      Settings
    </button>
  </div>

  <form class="new-task-form" id="new-task-form" on:submit|preventDefault={onSubmit}>
    <label for="todo-title">New task</label>
    <div class="input-row">
      <input
        id="todo-title"
        name="title"
        type="text"
        autocomplete="off"
        placeholder="+ Add task and press Enter"
        bind:value={titleDraft}
        on:input={onDraftInput}
      />
      <button type="submit">Add</button>
    </div>
  </form>

  <ul class="todo-list" id="todo-list">
    {#if ongoingTodos.length}
      <li class="task-list-section" aria-labelledby="ongoing-heading">
        <div class="section-heading">
          <h2 id="ongoing-heading">Ongoing</h2>
          <span class="section-count">{ongoingTodos.length} running</span>
        </div>
        <ol class="task-section-list">
          {#each ongoingTodos as todo (todo.id)}
            {@render taskRow(todo)}
          {/each}
        </ol>
      </li>
    {/if}

    {#each openTodoSections as section, index (section.id)}
      <li class="task-list-section" aria-labelledby={`open-${section.id}-heading`}>
        <div class="section-heading">
          <h2 id={`open-${section.id}-heading`}>{section.label}</h2>
          <span class="section-count" id={index === 0 ? 'open-count' : undefined}>
            {draggedSummaryId && index === 0 ? 'Drop to reopen' : `${section.items.length} open`}
          </span>
        </div>
        <ol class="task-section-list">
          {#each section.items as todo (todo.id)}
            {@render taskRow(todo)}
          {/each}
        </ol>
      </li>
    {/each}

    {#if draftTitle}
      <li class="block-insertion-cue" aria-live="polite">
        <span class="block-insertion-line" aria-hidden="true"></span>
        <span class="block-insertion-label">New block lands here</span>
      </li>
    {/if}

    {#if openCount === 0}
      <li class="empty-state">No open tasks. Add one when the next thing appears.</li>
    {/if}
  </ul>
</section>

{#snippet taskRow(todo)}
  {@const isRunning = Boolean(todo.activeStartedAt)}
  {@const elapsedSeconds = getElapsedSeconds(todo)}
  {@const latestSession = todo.latestProgressSession}
  {@const timerAction = isRunning ? 'pause' : 'start'}
  {@const timerText = isRunning ? 'Stop' : 'Start'}
  <li data-todo-id={todo.id} class:is-running={isRunning} class:is-new-block={newlyAddedTodoId === todo.id} class="todo-item">
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
          on:dblclick={() => onStartTitleEdit(todo.id)}
          on:keydown={(event) => event.key === 'Enter' && onStartTitleEdit(todo.id)}
        >
          {@html linkifyText(todo.title)}
        </span>
      {/if}
      <span class:is-live={isRunning} class="task-duration" data-timer-label={todo.id}>
        {#if todo.isProgressive}
          {isRunning ? 'Tracking session' : 'Session'} {formatDuration(elapsedSeconds)}
        {:else}
          {isRunning ? 'Tracking' : 'Duration'} {formatDuration(elapsedSeconds)}
        {/if}
      </span>
      {#if todo.isProgressive}
        <span class="task-progress-label">
          {todo.progressLabel || 'Add session note in task page'}
          {#if latestSession}
            · last {formatDuration(latestSession.trackedSeconds)}
          {/if}
        </span>
      {/if}
    </div>
    <div class="task-actions">
      <button type="button" class="timer-button" title={`${timerText} timer`} on:click={() => onTimerAction(timerAction, todo.id)} aria-label={`${timerText} ${todo.title} timer`}>
        {@html isRunning ? iconPause() : iconPlay()}
        <span class="timer-button-label">{timerText}</span>
      </button>
      <button type="button" class="open-task-button" on:click={(event) => onOpenTask(todo.id, event.currentTarget)} aria-label={`Open ${todo.title} details`}>
        {@html iconPage()}
        <span>Open</span>
      </button>
      <button type="button" on:click={() => onComplete(todo.id)} aria-label={todo.isProgressive ? `Log ${todo.title} session` : `Mark ${todo.title} done`}>
        {@html iconCheck()}
        <span>{todo.isProgressive ? 'Log session' : 'Done'}</span>
      </button>
      <button type="button" class="fail-task-button" on:click={() => onFail(todo.id)} aria-label={`Mark ${todo.title} failed`}>
        {@html iconX()}
        <span>Fail</span>
      </button>
    </div>
  </li>
{/snippet}
