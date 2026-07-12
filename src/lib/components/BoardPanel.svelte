<script>
  import { tick } from 'svelte';
  import { linkifyText } from '../../linkify.js';
  import { iconMoon, iconPlus, iconSun } from './icons.js';

  export let syncMessage = 'Local only';
  export let columns = [];
  export let selectedDay = '';
  export let themeMode = 'light';
  export let newlyAddedTodoId = null;
  export let draggedBoardTodoId = null;
  export let dropTargetColumnId = null;
  export let onToggleTheme;
  export let onViewChange;
  export let onSelectedDayChange;
  export let onOpenTask;
  export let onBoardDragStart;
  export let onBoardDragEnd;
  export let onBoardDragOver;
  export let onBoardDrop;
  export let onCreateTaskInColumn;

  let draftingColumnId = null;
  let columnDraft = '';

  async function beginDraft(columnId) {
    draftingColumnId = columnId;
    columnDraft = '';
    await tick();
    document.querySelector(`[data-board-draft="${CSS.escape(columnId)}"]`)?.focus();
  }

  function cancelDraft() {
    draftingColumnId = null;
    columnDraft = '';
  }

  async function submitDraft(columnId) {
    const title = columnDraft.trim();
    if (!title) {
      cancelDraft();
      return;
    }

    await onCreateTaskInColumn?.(columnId, title);
    cancelDraft();
  }

  function handleDraftKeydown(event, columnId) {
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelDraft();
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      submitDraft(columnId);
    }
  }
</script>

<section class="board-panel" aria-labelledby="board-heading">
  <header class="board-header">
    <div class="board-brand">
      <p class="eyebrow">Done Log</p>
      <h1 id="board-heading">Board</h1>
      <p class="panel-note">Drag tasks across columns to start timing, then finish when you move them to Done.</p>
    </div>

    <div class="board-header-actions">
      <output class="sync-status" aria-live="polite">{syncMessage}</output>
      <label class="board-day-field">
        <span class="sr-only">Board day</span>
        <input
          type="date"
          value={selectedDay}
          on:change={(event) => onSelectedDayChange?.(event.currentTarget.value)}
        />
      </label>
      <div class="view-toggle" role="group" aria-label="Workspace view">
        <button type="button" class="view-toggle-button" on:click={() => onViewChange?.('flow')}>
          Flow
        </button>
        <button type="button" class="view-toggle-button is-active" aria-current="page">Board</button>
      </div>
      <button
        type="button"
        class="theme-toggle"
        on:click={onToggleTheme}
        aria-label={`Switch to ${themeMode === 'dark' ? 'light' : 'dark'} mode`}
      >
        {@html themeMode === 'dark' ? iconSun() : iconMoon()}
        <span>{themeMode === 'dark' ? 'Light' : 'Dark'}</span>
      </button>
    </div>
  </header>

  <div class="board-columns" role="list">
    {#each columns as column (column.id)}
      <section
        class="board-column"
        class:is-drop-target={dropTargetColumnId === column.id}
        data-column={column.id}
        role="listitem"
        aria-labelledby={`board-column-${column.id}`}
        on:dragover={(event) => onBoardDragOver?.(event, column.id)}
        on:drop={(event) => onBoardDrop?.(event, column.id)}
      >
        <div class="board-column-header">
          <span class="board-status-pill" data-status={column.id}>
            <span class="board-status-dot" aria-hidden="true"></span>
            <span id={`board-column-${column.id}`}>{column.label}</span>
          </span>
          <span class="board-column-count" data-status={column.id}>{column.items.length}</span>
        </div>

        <ul class="board-card-list">
          {#each column.items as todo (todo.id)}
            <li>
              <article
                class="board-card"
                class:is-dragging={draggedBoardTodoId === todo.id}
                class:is-newly-added={newlyAddedTodoId === todo.id}
                class:is-failed={todo.outcome === 'failed'}
                class:is-running={Boolean(todo.activeStartedAt)}
                class:is-session={todo.isProgressSession}
                draggable={!todo.isProgressSession}
                data-todo-id={todo.id}
                on:dragstart={(event) => {
                  if (todo.isProgressSession) {
                    event.preventDefault();
                    return;
                  }
                  onBoardDragStart?.(event, todo.id);
                }}
                on:dragend={onBoardDragEnd}
              >
                <button type="button" class="board-card-open" on:click={() => onOpenTask?.(todo.id)}>
                  <span class="board-card-title">{@html linkifyText(todo.title)}</span>
                  <span class="board-card-meta">
                    {#if todo.progressLabel}
                      <span class="board-card-progress">{todo.progressLabel}</span>
                    {/if}
                    {#if todo.outcome === 'failed'}
                      <span class="board-card-failed">Failed</span>
                    {/if}
                    <span class="board-card-duration" title="Time spent on this task">
                      {todo.durationLabel}
                    </span>
                  </span>
                </button>
              </article>
            </li>
          {/each}
        </ul>

        {#if draftingColumnId === column.id}
          <div class="board-draft">
            <input
              type="text"
              class="board-draft-input"
              data-board-draft={column.id}
              placeholder="Task title"
              bind:value={columnDraft}
              on:keydown={(event) => handleDraftKeydown(event, column.id)}
            />
            <div class="board-draft-actions">
              <button type="button" class="board-draft-submit" on:click={() => submitDraft(column.id)}>
                Add
              </button>
              <button type="button" class="board-draft-cancel" on:click={cancelDraft}>Cancel</button>
            </div>
          </div>
        {:else}
          <button
            type="button"
            class="board-new-task"
            data-status={column.id}
            on:click={() => beginDraft(column.id)}
          >
            {@html iconPlus()}
            <span>New task</span>
          </button>
        {/if}
      </section>
    {/each}
  </div>
</section>
