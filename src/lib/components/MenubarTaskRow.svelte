<script>
  import { tick } from 'svelte';
  import { getStandaloneWebUrl, shortenLinksText } from '../../linkify.js';
  import { expandTodoCommand, parseNoteTodos, toggleNoteTodo } from '../../noteTodos.js';
  import { getTextareaCaretRestore, getTextareaKeyEdit } from '../../textareaEditing.js';
  import {
    formatDueDate,
    formatDuration,
    formatTaskTimestamp,
    getEditableTaskTimeSegments,
    getElapsedSeconds,
    stripNoteStampsForEditor,
  } from '../../todoStore.js';
  import CalendarPicker from './CalendarPicker.svelte';
  import { iconCheck, iconDetails, iconPage, iconPause, iconPlay, iconX } from './icons.js';
  import MenubarLinkTitle from './MenubarLinkTitle.svelte';

  export let todo;
  export let expanded = false;
  export let onToggleDetails;
  export let onTimerAction;
  export let onComplete;
  export let onTitleCommit;
  export let onNoteInput;
  export let onOpenNote;
  export let noteSaveStatus = 'saved';
  export let onProgressiveChange;
  export let onProgressCommit;
  export let onDueDateChange;
  export let onSomedayChange;
  export let onTimingChange;
  export let onDelete;

  let draftTodoId = null;
  let noteDraft = '';
  let progressDraft = '';
  let sourceNote = '';
  let sourceProgress = '';
  let timingBlocksDraft = [];
  let sourceTimingBlocks = '';
  let timingError = '';

  $: {
    const nextNote = todo.note ?? '';
    const nextProgress = todo.progressLabel ?? '';

    if (todo.id !== draftTodoId) {
      draftTodoId = todo.id;
      sourceNote = nextNote;
      sourceProgress = nextProgress;
      noteDraft = stripNoteStampsForEditor(nextNote);
      progressDraft = nextProgress;
      sourceTimingBlocks = timingBlocksSource(todo);
      timingBlocksDraft = timingBlocksForTodo(todo);
      timingError = '';
    } else {
      if (nextNote !== sourceNote) {
        sourceNote = nextNote;
        noteDraft = stripNoteStampsForEditor(nextNote);
      }

      if (nextProgress !== sourceProgress) {
        sourceProgress = nextProgress;
        progressDraft = nextProgress;
      }

      const nextTimingBlocks = timingBlocksSource(todo);
      if (nextTimingBlocks !== sourceTimingBlocks) {
        sourceTimingBlocks = nextTimingBlocks;
        timingBlocksDraft = timingBlocksForTodo(todo);
      }
    }
  }

  $: isRunning = Boolean(todo.activeStartedAt);
  $: isCompleted = Boolean(todo.completedAt);
  $: isSomeday = Boolean(todo.somedayAt && !todo.completedAt);
  $: isPaused = Boolean(
    todo.firstStartedAt && !todo.activeStartedAt && !todo.completedAt && !todo.somedayAt,
  );
  $: taskUrl = getStandaloneWebUrl(todo.title);
  $: duration = formatDuration(getElapsedSeconds(todo));
  $: timingBlocksTotal = timingBlocksDraft.reduce((total, block) => {
    const start = new Date(block.startedAt);
    const end = new Date(block.endedAt);
    return Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end
      ? total
      : total + Math.floor((end.getTime() - start.getTime()) / 1000);
  }, 0);
  $: noteTodos = parseNoteTodos(noteDraft);

  function dueDateValue(dueDate) {
    if (!dueDate) {
      return '';
    }

    const date = new Date(dueDate);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function dateTimeLocalValue(timestamp) {
    if (!timestamp) {
      return '';
    }

    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  function timingBlocksSource(item) {
    return JSON.stringify({
      timeSegments: item.timeSegments ?? [],
      firstStartedAt: item.firstStartedAt ?? null,
      activeStartedAt: item.activeStartedAt ?? null,
      createdAt: item.createdAt ?? null,
      completedAt: item.completedAt ?? null,
    });
  }

  function timingBlocksForTodo(item) {
    return getEditableTaskTimeSegments(item).map((segment) => ({
      startedAt: dateTimeLocalValue(segment.startedAt),
      endedAt: dateTimeLocalValue(segment.endedAt),
    }));
  }

  function handleTimingInput(index, field, value) {
    timingBlocksDraft = timingBlocksDraft.map((block, blockIndex) =>
      blockIndex === index ? { ...block, [field]: value } : block,
    );

    timingError = validateTiming();
    if (!timingError) {
      onTimingChange(todo.id, timingBlocksDraft);
    }
  }

  function handleToggleDetails() {
    if (!expanded) {
      sourceTimingBlocks = timingBlocksSource(todo);
      timingBlocksDraft = timingBlocksForTodo(todo);
      timingError = '';
    }
    onToggleDetails(todo.id);
  }

  function validateTiming() {
    for (const block of timingBlocksDraft) {
      if (!block.startedAt || !block.endedAt) {
        return 'Choose both a start and end time in each block.';
      }

      const start = new Date(block.startedAt);
      const end = new Date(block.endedAt);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return 'Enter valid start and end times.';
      }

      if (start.getTime() >= end.getTime()) {
        return 'Start must be before end in each block.';
      }
    }

    return '';
  }

  function addTimeBlock() {
    timingBlocksDraft = [...timingBlocksDraft, { startedAt: '', endedAt: '' }];
    timingError = '';
  }

  function removeTimeBlock(index) {
    if (timingBlocksDraft.length <= 1) {
      return;
    }
    timingBlocksDraft = timingBlocksDraft.filter((_, blockIndex) => blockIndex !== index);
    timingError = validateTiming();
    if (!timingError) {
      onTimingChange(todo.id, timingBlocksDraft);
    }
  }

  function handleTitleKeydown(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.currentTarget.blur();
    }
  }

  function handleTextareaKeydown(event, updateDraft) {
    if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    const textarea = event.currentTarget;
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? start;
    const edit = getTextareaKeyEdit({
      value: textarea.value,
      selectionStart: start,
      selectionEnd: end,
      key: event.key,
      shiftKey: event.shiftKey,
    });
    if (!edit) {
      return;
    }

    event.preventDefault();
    const restoreCaret = getTextareaCaretRestore(textarea);
    updateDraft(edit.value);

    requestAnimationFrame(() => restoreCaret(edit.cursor));
  }

  function updateNoteDraft(nextNote) {
    noteDraft = nextNote;
    onNoteInput(todo.id, nextNote);
  }

  async function handleNoteTextareaInput(event) {
    const textarea = event.currentTarget;
    const restoreCaret = getTextareaCaretRestore(textarea);
    const expanded = expandTodoCommand(
      textarea.value,
      textarea.selectionStart ?? textarea.value.length,
    );
    updateNoteDraft(expanded.value);

    await tick();
    restoreCaret(expanded.cursor);
  }

  function handleTodoToggle(item) {
    updateNoteDraft(toggleNoteTodo(noteDraft, item.lineIndex));
  }
</script>

{#snippet taskMetadata()}
  <span class="menubar-task-meta">
    {isCompleted ? 'Finished' : isRunning ? 'Tracking' : 'Duration'} {duration}
    {#if todo.dueDate} - due {formatDueDate(todo.dueDate)}{/if}
  </span>
  {#if todo.firstStartedAt}
    <span class="menubar-task-started">
      Started{' '}<time datetime={todo.firstStartedAt}>{formatTaskTimestamp(todo.firstStartedAt)}</time>
    </span>
  {/if}
  {#if todo.progressLabel}
    <span class="menubar-task-progress">{todo.progressLabel}</span>
  {/if}
{/snippet}

<article
  class:is-running={isRunning}
  class:is-paused={isPaused}
  class:is-someday={isSomeday}
  class:is-expanded={expanded}
  class="menubar-task"
  data-menubar-id={todo.id}
>
  <div class="menubar-task-summary">
    <span class="menubar-task-dot" aria-hidden="true"></span>
    {#if taskUrl}
      <div class="menubar-details-toggle">
        <span class="menubar-task-title-row">
          <MenubarLinkTitle url={taskUrl} fallbackTitle={shortenLinksText(todo.title)} />
          {#if isPaused}<span class="menubar-paused-badge">Paused</span>{/if}
          {#if isSomeday}<span class="menubar-someday-badge">Stall</span>{/if}
        </span>
        {@render taskMetadata()}
      </div>
    {:else}
      <button
        type="button"
        class="menubar-details-toggle"
        aria-expanded={expanded}
        on:click={handleToggleDetails}
      >
        <span class="menubar-task-title-row">
          <span class="menubar-task-title">{shortenLinksText(todo.title)}</span>
          {#if isPaused}<span class="menubar-paused-badge">Paused</span>{/if}
          {#if isSomeday}<span class="menubar-someday-badge">Stall</span>{/if}
        </span>
        {@render taskMetadata()}
      </button>
    {/if}
    <div class="menubar-task-actions">
      <button
        type="button"
        class="menubar-icon-button menubar-open-note"
        aria-label={`Open note for ${todo.title}`}
        title="Open note"
        on:click={() => onOpenNote(todo)}
      >
        {@html iconPage()}
      </button>
      {#if taskUrl}
        <button
          type="button"
          class="menubar-icon-button"
          aria-label={`Open ${todo.title} task details`}
          title="Task details"
          aria-expanded={expanded}
          on:click={handleToggleDetails}
        >
          {@html iconDetails()}
        </button>
      {/if}
      {#if !isCompleted && !isSomeday}
        <button
          type="button"
          class:menubar-pause={isRunning}
          class:menubar-start={!isRunning}
          class="menubar-icon-button"
          aria-label={`${isRunning ? 'Pause' : 'Start'} ${todo.title}`}
          title={isRunning ? 'Pause' : 'Start'}
          on:click={() => onTimerAction(isRunning ? 'pause' : 'start', todo.id)}
        >
          {@html isRunning ? iconPause() : iconPlay()}
        </button>
        <button
          type="button"
          class="menubar-icon-button menubar-finish"
          aria-label={`${todo.isProgressive ? 'Log progress for' : 'Finish'} ${todo.title}`}
          title={todo.isProgressive ? 'Log progress' : 'Finish'}
          on:click={() => onComplete(todo.id)}
        >
          {@html iconCheck()}
        </button>
      {/if}
    </div>
  </div>

  {#if expanded}
    <div class="menubar-task-details" data-menubar-details={todo.id}>
      <label>
        <span>Title</span>
        <input
          class="menubar-title-input"
          type="text"
          value={todo.title}
          on:keydown={handleTitleKeydown}
          on:focusout={(event) => onTitleCommit(todo.id, event.currentTarget.value)}
        />
      </label>

      <label>
        <span>Note</span>
        <textarea
          class="menubar-note-input"
          value={noteDraft}
          rows="3"
          on:input={handleNoteTextareaInput}
          on:keydown={(event) => handleTextareaKeydown(event, updateNoteDraft)}
        ></textarea>
      </label>
      {#if noteTodos.length}
        <div class="note-todo-list" aria-label="Note todos">
          {#each noteTodos as item (item.lineIndex)}
            <button
              type="button"
              class:is-done={item.done}
              class="note-todo-item"
              on:click={() => handleTodoToggle(item)}
              aria-pressed={item.done}
            >
              <span class="note-todo-checkbox" aria-hidden="true"></span>
              <span>{item.label}</span>
            </button>
          {/each}
        </div>
      {/if}
      <span class="menubar-note-save-status" aria-live="polite">
        {noteSaveStatus === 'saving'
          ? 'Saving note...'
          : noteSaveStatus === 'error'
            ? 'Saved locally - sync failed'
            : 'Note saved automatically'}
      </span>

      <label class="menubar-progressive-toggle">
        <input
          type="checkbox"
          checked={todo.isProgressive}
          on:change={(event) => onProgressiveChange(todo.id, event.currentTarget.checked)}
        />
        <span>Progressive task</span>
      </label>

      {#if todo.isProgressive}
        <label>
          <span>Current progress</span>
          <textarea
            class="menubar-progress-input"
            bind:value={progressDraft}
            rows="2"
            on:keydown={(event) => handleTextareaKeydown(event, (value) => (progressDraft = value))}
            on:focusout={() => onProgressCommit(todo.id, progressDraft)}
          ></textarea>
        </label>
      {/if}

      <label>
        <span>Due date</span>
        <CalendarPicker
          triggerClass="menubar-calendar-trigger"
          label={`Due date for ${todo.title}`}
          allowClear={true}
          value={dueDateValue(todo.dueDate)}
          onChange={(nextDate) => onDueDateChange(todo.id, nextDate)}
        />
      </label>

      {#if !isCompleted}
        <div class="menubar-someday-state">
          <span>
            <strong>{isSomeday ? 'Stall' : 'Active task'}</strong>
            <small>{isSomeday ? 'Paused with no return date.' : 'Keep this for a possible future return.'}</small>
          </span>
          <button type="button" on:click={() => onSomedayChange(todo.id, !isSomeday)}>
            {isSomeday ? 'Return to active' : 'Move to Stall'}
          </button>
        </div>
      {/if}

      <div class="menubar-timing-controls" aria-label="Task timing">
        <div class="menubar-timing-heading">
          <div>
            <strong>Time blocks</strong>
            <small>{isCompleted ? 'Update or add recorded work periods.' : 'Saving timing finishes this task.'}</small>
          </div>
          <strong aria-live="polite">Total {formatDuration(timingBlocksTotal)}</strong>
        </div>
        <ol class="menubar-time-block-list">
          {#each timingBlocksDraft as block, index (index)}
            <li class="menubar-time-block">
              <div class="menubar-time-block-title">
                <strong>Block {index + 1}</strong>
                {#if timingBlocksDraft.length > 1}
                  <button
                    type="button"
                    aria-label={`Remove time block ${index + 1} for ${todo.title}`}
                    on:click={() => removeTimeBlock(index)}
                  >
                    Remove
                  </button>
                {/if}
              </div>
              <label>
                <span>Start</span>
                <CalendarPicker
                  mode="datetime"
                  triggerClass="menubar-calendar-trigger"
                  value={block.startedAt}
                  label={`Start time for ${todo.title} block ${index + 1}`}
                  invalid={Boolean(timingError)}
                  describedBy={timingError ? `menubar-timing-error-${todo.id}` : undefined}
                  onChange={(nextValue) => handleTimingInput(index, 'startedAt', nextValue)}
                />
              </label>
              <label>
                <span>End</span>
                <CalendarPicker
                  mode="datetime"
                  triggerClass="menubar-calendar-trigger"
                  value={block.endedAt}
                  label={`End time for ${todo.title} block ${index + 1}`}
                  invalid={Boolean(timingError)}
                  describedBy={timingError ? `menubar-timing-error-${todo.id}` : undefined}
                  onChange={(nextValue) => handleTimingInput(index, 'endedAt', nextValue)}
                />
              </label>
            </li>
          {/each}
        </ol>
        <button type="button" class="menubar-add-time-block" on:click={addTimeBlock}>
          Add time block
        </button>
        {#if timingError}
          <p class="menubar-timing-error" id={`menubar-timing-error-${todo.id}`} role="alert">
            {timingError}
          </p>
        {/if}
      </div>

      <div class="menubar-detail-footer">
        <span>{isRunning ? `Live ${duration}` : `Tracked ${duration}`}</span>
        <button type="button" class="menubar-delete" on:click={() => onDelete(todo.id)}>
          {@html iconX()}
          Delete
        </button>
      </div>
    </div>
  {/if}
</article>

<style>
  .menubar-task {
    overflow: hidden;
    border: 1px solid var(--block-border);
    border-radius: 14px;
    background: var(--block-surface);
    box-shadow: inset 0 1px 0 var(--inset-highlight);
    transition:
      border-color var(--motion-hover) ease,
      background-color var(--motion-hover) ease;
  }

  .menubar-task.is-running {
    border-color: color-mix(in srgb, var(--board-in-progress) 32%, var(--block-border));
    background: var(--block-running);
  }

  .menubar-task.is-paused {
    border-color: color-mix(in srgb, var(--board-paused) 32%, var(--block-border));
    background: color-mix(in srgb, var(--board-paused-surface) 56%, var(--block-surface));
  }

  .menubar-task.is-someday {
    border-color: color-mix(in srgb, var(--board-someday) 32%, var(--block-border));
    background: color-mix(in srgb, var(--board-someday-surface) 56%, var(--block-surface));
  }

  .menubar-task-summary {
    display: grid;
    grid-template-columns: 6px minmax(0, 1fr) auto;
    gap: 9px;
    align-items: center;
    min-height: 64px;
    padding: 8px 9px 8px 11px;
  }

  .menubar-task-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--subtle);
  }

  .is-running .menubar-task-dot {
    background: var(--board-in-progress);
    box-shadow: 0 0 0 4px var(--board-in-progress-soft);
  }

  .is-paused .menubar-task-dot {
    background: var(--board-paused);
    box-shadow: 0 0 0 4px var(--board-paused-soft);
  }

  .is-someday .menubar-task-dot {
    background: var(--board-someday);
  }

  .menubar-details-toggle {
    display: grid;
    gap: 2px;
    min-width: 0;
    padding: 3px 0;
    background: transparent;
    color: inherit;
    text-align: left;
  }

  .menubar-task-title,
  .menubar-task-meta,
  .menubar-task-started,
  .menubar-task-progress {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .menubar-task-title-row {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .menubar-task-title {
    color: var(--strong);
    font-size: 13px;
    font-weight: 600;
  }

  .menubar-paused-badge,
  .menubar-someday-badge {
    flex: 0 0 auto;
    padding: 1px 5px;
    border: 1px solid var(--board-paused-soft);
    border-radius: 999px;
    background: var(--board-paused-surface);
    color: var(--board-paused);
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .menubar-someday-badge {
    border-color: var(--board-someday-soft);
    background: var(--board-someday-surface);
    color: var(--board-someday);
  }

  .menubar-task-meta,
  .menubar-task-started,
  .menubar-task-progress {
    color: var(--subtle);
    font-size: 11px;
  }

  .menubar-task-progress {
    color: var(--default);
  }

  .menubar-task-actions {
    display: flex;
    gap: 5px;
  }

  .menubar-icon-button {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--surface-strong);
    color: var(--strong);
    transition:
      background-color var(--motion-hover) ease,
      transform var(--motion-press) var(--ease-out);
  }

  .menubar-icon-button:hover {
    background: var(--block-hover);
  }

  .menubar-icon-button:active {
    transform: scale(0.96);
  }

  .menubar-icon-button :global(.nucleo-icon),
  .menubar-delete :global(.nucleo-icon) {
    width: 15px;
    height: 15px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.35;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .menubar-task-details {
    display: grid;
    gap: 10px;
    padding: 12px;
    border-top: 1px solid var(--border);
    background: color-mix(in srgb, var(--surface-strong) 68%, transparent);
    animation: panel-enter var(--motion-reveal) var(--ease-out);
  }

  .menubar-task-details label {
    display: grid;
    gap: 5px;
    color: var(--subtle);
    font-size: 11px;
    font-weight: 500;
  }

  .menubar-task-details input[type='text'],
  .menubar-task-details textarea {
    width: 100%;
    min-width: 0;
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 9px 10px;
    background: var(--field-surface);
    color: var(--strong);
    font-size: 13px;
    line-height: 1.4;
  }

  .menubar-task-details input[type='text'],
  .menubar-task-details :global(.menubar-calendar-trigger) {
    min-height: 38px;
  }

  .menubar-task-details :global(.menubar-calendar-trigger) {
    border-radius: 10px;
    padding: 9px 10px;
    background: var(--field-surface);
    font-size: 13px;
    line-height: 1.4;
  }

  .menubar-task-details textarea {
    resize: vertical;
  }

  .menubar-task-details input:focus-visible,
  .menubar-task-details :global(.menubar-calendar-trigger:focus-visible),
  .menubar-task-details textarea:focus-visible,
  .note-todo-item:focus-visible,
  .menubar-details-toggle:focus-visible,
  .menubar-icon-button:focus-visible,
  .menubar-delete:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 1px;
  }

  .menubar-someday-state {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 10px;
    align-items: center;
    padding: 10px;
    border: 1px solid var(--board-someday-soft);
    border-radius: 10px;
    background: var(--board-someday-surface);
  }

  .menubar-someday-state > span {
    display: grid;
    gap: 2px;
  }

  .menubar-someday-state strong {
    color: var(--strong);
    font-size: 12px;
  }

  .menubar-someday-state small {
    color: var(--subtle);
    font-size: 11px;
  }

  .menubar-someday-state button {
    min-height: 34px;
    padding: 0 10px;
    border: 1px solid var(--board-someday-soft);
    border-radius: 9px;
    background: var(--surface-strong);
    color: var(--strong);
    font: inherit;
    font-weight: 500;
    white-space: nowrap;
  }

  .menubar-someday-state button:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 1px;
  }

  .menubar-timing-controls {
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
    padding-top: 2px;
  }

  .menubar-timing-heading,
  .menubar-timing-error {
    grid-column: 1 / -1;
  }

  .menubar-timing-heading {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 8px;
  }

  .menubar-timing-heading > div {
    display: grid;
    gap: 2px;
  }

  .menubar-timing-heading strong {
    color: var(--default);
    font-size: 11px;
  }

  .menubar-timing-heading small {
    color: var(--subtle);
    font-size: 10px;
  }

  .menubar-timing-heading > strong:last-child {
    color: var(--strong);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .menubar-time-block-list {
    display: grid;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .menubar-time-block {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 8px;
    padding: 9px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--block-surface);
  }

  .menubar-time-block-title {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .menubar-time-block-title strong {
    color: var(--default);
    font-size: 10px;
  }

  .menubar-time-block-title button,
  .menubar-add-time-block {
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--field-surface);
    color: var(--default);
    font: inherit;
    cursor: pointer;
  }

  .menubar-time-block-title button {
    padding: 3px 7px;
    font-size: 10px;
  }

  .menubar-add-time-block {
    justify-self: start;
    min-height: 30px;
    padding: 0 10px;
    font-size: 11px;
    font-weight: 600;
  }

  .menubar-timing-error {
    margin: 0;
    color: var(--danger, #d85c52);
    font-size: 10px;
  }

  .menubar-note-save-status {
    color: var(--subtle);
    font-size: 11px;
    font-weight: 500;
  }

  .menubar-progressive-toggle {
    grid-template-columns: auto 1fr;
    align-items: center;
  }

  .menubar-progressive-toggle input {
    width: 16px;
    height: 16px;
    accent-color: var(--strong);
  }

  .menubar-detail-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    color: var(--subtle);
    font-size: 11px;
  }

  .menubar-delete {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-height: 34px;
    border-radius: 9px;
    padding: 0 10px;
    background: transparent;
    color: #b0463c;
    font-size: 12px;
  }

  @media (prefers-reduced-motion: reduce) {
    .menubar-task-details {
      animation: reduced-fade var(--motion-hover) ease;
    }
  }
</style>
