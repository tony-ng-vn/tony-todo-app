<script>
  import {
    formatDueDate,
    formatDuration,
    formatTaskTimestamp,
    getElapsedSeconds,
  } from '../../todoStore.js';
  import { iconCheck, iconPage, iconPause, iconPlay, iconX } from './icons.js';

  export let todo;
  export let expanded = false;
  export let onToggleDetails;
  export let onTimerAction;
  export let onComplete;
  export let onTitleCommit;
  export let onNoteInput;
  export let noteSaveStatus = 'saved';
  export let onProgressiveChange;
  export let onProgressCommit;
  export let onDueDateChange;
  export let onTimingChange;
  export let onDelete;

  let draftTodoId = null;
  let noteDraft = '';
  let progressDraft = '';
  let sourceNote = '';
  let sourceProgress = '';
  let timingStartDraft = '';
  let timingEndDraft = '';
  let sourceTimingStart = '';
  let sourceTimingEnd = '';
  let timingError = '';

  $: {
    const nextNote = todo.note ?? '';
    const nextProgress = todo.progressLabel ?? '';

    if (todo.id !== draftTodoId) {
      draftTodoId = todo.id;
      sourceNote = nextNote;
      sourceProgress = nextProgress;
      noteDraft = nextNote;
      progressDraft = nextProgress;
      sourceTimingStart = dateTimeLocalValue(todo.firstStartedAt);
      sourceTimingEnd = dateTimeLocalValue(todo.completedAt);
      timingStartDraft = sourceTimingStart;
      timingEndDraft = sourceTimingEnd;
      timingError = '';
    } else {
      if (nextNote !== sourceNote) {
        sourceNote = nextNote;
        noteDraft = nextNote;
      }

      if (nextProgress !== sourceProgress) {
        sourceProgress = nextProgress;
        progressDraft = nextProgress;
      }

      const nextTimingStart = dateTimeLocalValue(todo.firstStartedAt);
      const nextTimingEnd = dateTimeLocalValue(todo.completedAt);
      if (nextTimingStart !== sourceTimingStart) {
        sourceTimingStart = nextTimingStart;
        timingStartDraft = nextTimingStart;
      }

      if (nextTimingEnd !== sourceTimingEnd) {
        sourceTimingEnd = nextTimingEnd;
        timingEndDraft = nextTimingEnd;
      }
    }
  }

  $: isRunning = Boolean(todo.activeStartedAt);
  $: isCompleted = Boolean(todo.completedAt);
  $: duration = formatDuration(getElapsedSeconds(todo));

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

  function handleTimingInput(field, value) {
    if (field === 'start') {
      timingStartDraft = value;
    } else {
      timingEndDraft = value;
    }

    timingError = validateTiming();
    if (!timingError) {
      onTimingChange(todo.id, timingStartDraft, timingEndDraft);
    }
  }

  function validateTiming() {
    if (!timingStartDraft || !timingEndDraft) {
      return 'Choose both a start and end time.';
    }

    const start = new Date(timingStartDraft);
    const end = new Date(timingEndDraft);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return 'Enter valid start and end times.';
    }

    if (start.getTime() >= end.getTime()) {
      return 'Start must be before end.';
    }

    return '';
  }

  function handleTitleKeydown(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.currentTarget.blur();
    }
  }

  function handleTextareaTab(event, updateDraft) {
    if (event.key !== 'Tab' || event.shiftKey) {
      return;
    }

    event.preventDefault();
    const textarea = event.currentTarget;
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? start;
    const nextValue = `${textarea.value.slice(0, start)}\t${textarea.value.slice(end)}`;
    updateDraft(nextValue);

    requestAnimationFrame(() => textarea.setSelectionRange(start + 1, start + 1));
  }

  function updateNoteDraft(nextNote) {
    noteDraft = nextNote;
    onNoteInput(todo.id, nextNote);
  }
</script>

<article
  class:is-running={isRunning}
  class:is-expanded={expanded}
  class="menubar-task"
  data-menubar-id={todo.id}
>
  <div class="menubar-task-summary">
    <span class="menubar-task-dot" aria-hidden="true"></span>
    <button
      type="button"
      class="menubar-details-toggle"
      aria-expanded={expanded}
      on:click={() => onToggleDetails(todo.id)}
    >
      <span class="menubar-task-title">{todo.title}</span>
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
    </button>
    {#if !isCompleted}
      <div class="menubar-task-actions">
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
      </div>
    {/if}
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
          bind:value={noteDraft}
          rows="3"
          on:input={(event) => onNoteInput(todo.id, event.currentTarget.value)}
          on:keydown={(event) => handleTextareaTab(event, updateNoteDraft)}
        ></textarea>
      </label>
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
            on:keydown={(event) => handleTextareaTab(event, (value) => (progressDraft = value))}
            on:focusout={() => onProgressCommit(todo.id, progressDraft)}
          ></textarea>
        </label>
      {/if}

      <label>
        <span>Due date</span>
        <input
          type="date"
          value={dueDateValue(todo.dueDate)}
          on:change={(event) => onDueDateChange(todo.id, event.currentTarget.value)}
        />
      </label>

      <div class="menubar-timing-controls" aria-label="Task timing">
        <div class="menubar-timing-heading">
          <strong>Start and end time</strong>
          <small>{isCompleted ? 'Update the recorded timing.' : 'Saving timing finishes this task.'}</small>
        </div>
        <label>
          <span>Start</span>
          <input
            type="datetime-local"
            value={timingStartDraft}
            aria-label={`Start time for ${todo.title}`}
            aria-invalid={Boolean(timingError)}
            aria-describedby={timingError ? `menubar-timing-error-${todo.id}` : undefined}
            on:change={(event) => handleTimingInput('start', event.currentTarget.value)}
          />
        </label>
        <label>
          <span>End</span>
          <input
            type="datetime-local"
            value={timingEndDraft}
            aria-label={`End time for ${todo.title}`}
            aria-invalid={Boolean(timingError)}
            aria-describedby={timingError ? `menubar-timing-error-${todo.id}` : undefined}
            on:change={(event) => handleTimingInput('end', event.currentTarget.value)}
          />
        </label>
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
      border-color 160ms ease,
      background-color 160ms ease;
  }

  .menubar-task.is-running {
    border-color: color-mix(in srgb, var(--board-in-progress) 32%, var(--block-border));
    background: var(--block-running);
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

  .menubar-task-title {
    color: var(--strong);
    font-size: 13px;
    font-weight: 600;
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
      background-color 160ms ease,
      transform 160ms ease;
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
  }

  .menubar-task-details label {
    display: grid;
    gap: 5px;
    color: var(--subtle);
    font-size: 11px;
    font-weight: 500;
  }

  .menubar-task-details input[type='text'],
  .menubar-task-details input[type='date'],
  .menubar-task-details input[type='datetime-local'],
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
  .menubar-task-details input[type='date'],
  .menubar-task-details input[type='datetime-local'] {
    min-height: 38px;
  }

  .menubar-task-details textarea {
    resize: vertical;
  }

  .menubar-task-details input:focus-visible,
  .menubar-task-details textarea:focus-visible,
  .menubar-details-toggle:focus-visible,
  .menubar-icon-button:focus-visible,
  .menubar-delete:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 1px;
  }

  .menubar-timing-controls {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 8px;
    padding-top: 2px;
  }

  .menubar-timing-heading,
  .menubar-timing-error {
    grid-column: 1 / -1;
  }

  .menubar-timing-heading {
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
    .menubar-task,
    .menubar-icon-button {
      transition: none;
    }
  }
</style>
