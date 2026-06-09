<script>
  import { formatDuration, getElapsedSeconds } from '../../todoStore.js';
  import { linkifyText } from '../../linkify.js';
  import { iconCheck, iconPage, iconPause, iconPlay } from './icons.js';

  export let syncMessage = 'Local only';
  export let pendingTodos = [];
  export let titleDraft = '';
  export let draftTitle = '';
  export let editingTaskId = null;
  export let newlyAddedTodoId = null;
  export let onSubmit;
  export let onDraftInput;
  export let onStartTitleEdit;
  export let onTitleKeydown;
  export let onCommitTitleEdit;
  export let onTimerAction;
  export let onOpenTask;
  export let onComplete;
</script>

<section class="task-panel" aria-labelledby="task-heading">
  <div class="brand-row">
    <div>
      <p class="eyebrow">Done Log</p>
      <h1 id="task-heading">Today</h1>
      <p class="panel-note">A quiet workspace for the next thing, and proof of what already moved.</p>
    </div>
    <output class="sync-status" id="sync-status" aria-live="polite">{syncMessage}</output>
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
            {isRunning ? 'Tracking' : 'Duration'} {formatDuration(elapsedSeconds)}
          </span>
        </div>
        <div class="task-actions">
          <button type="button" class="timer-button" on:click={() => onTimerAction(timerAction, todo.id)} aria-label={`${timerText} ${todo.title} timer`}>
            {@html isRunning ? iconPause() : iconPlay()}
            <span>{timerText}</span>
          </button>
          <button type="button" class="open-task-button" on:click={() => onOpenTask(todo.id)} aria-label={`Open ${todo.title} details`}>
            {@html iconPage()}
            <span>Open</span>
          </button>
          <button type="button" on:click={() => onComplete(todo.id)} aria-label={`Mark ${todo.title} done`}>
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
