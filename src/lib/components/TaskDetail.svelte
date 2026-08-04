<script>
  import { tick } from 'svelte';
  import CalendarPicker from './CalendarPicker.svelte';
  import { linkifyText } from '../../linkify.js';
  import { expandTodoCommand, parseNoteTodos, toggleNoteTodo } from '../../noteTodos.js';
  import { formatTaskTimestamp, getDefaultTaskStartTimestamp } from '../../todoStore.js';

  export let selectedTask = null;
  export let noteDraft = '';
  export let noteSaveStatus = 'saved';
  export let selectedTaskSessions = [];
  export let selectedTaskTimeSegments = [];
  export let onClose;
  export let onNoteInput;
  export let onDetailTitleCommit;
  export let onProgressiveChange;
  export let onProgressInput;
  export let onCompletedTimingChange;
  export let onDueDateChange;
  export let onDeleteTask;
  export let formatDuration;
  export let completedTime;
  export let detailMeta;

  let activeDetailTaskId = null;
  let editingDetailTitle = false;
  let timingDraftTaskId = null;
  let timingDraftStart = '';
  let timingDraftEnd = '';
  let timingError = '';

  $: noteTodos = parseNoteTodos(noteDraft);

  $: if (selectedTask?.id !== activeDetailTaskId) {
    activeDetailTaskId = selectedTask?.id ?? null;
    editingDetailTitle = false;
  }

  $: if (selectedTask?.id !== timingDraftTaskId) {
    timingDraftTaskId = selectedTask?.id ?? null;
    timingDraftStart = completedStartValue(selectedTask);
    timingDraftEnd = completedEndValue(selectedTask);
    timingError = '';
  }

  async function startDetailTitleEdit() {
    editingDetailTitle = true;
    await tick();
    document.querySelector('#detail-title-input')?.focus();
    document.querySelector('#detail-title-input')?.select();
  }

  function commitDetailTitle(todoId, title) {
    editingDetailTitle = false;
    onDetailTitleCommit(todoId, title);
  }

  function completedStartValue(todo) {
    return toDateTimeLocalValue(getDefaultTaskStartTimestamp(todo));
  }

  function completedEndValue(todo) {
    return todo?.completedAt ? toDateTimeLocalValue(todo.completedAt) : '';
  }

  function completedDateValue(todo) {
    return todo?.completedAt ? toDateValue(todo.completedAt) : '';
  }

  function dueDateValue(todo) {
    return todo?.dueDate ? toDateValue(todo.dueDate) : '';
  }

  function handleDueDateInput(event) {
    onDueDateChange?.(selectedTask.id, event.currentTarget.value);
  }

  async function handleDoneDateChange(value) {
    if (!selectedTask?.completedAt || !value) {
      return;
    }

    const endTime = (timingDraftEnd || completedEndValue(selectedTask)).split('T')[1];
    if (!endTime) {
      return;
    }

    timingDraftEnd = `${value}T${endTime}`;
    await saveTimingDraft();
  }

  async function handleTimingChange(field, value) {
    if (!selectedTask?.id) {
      return;
    }

    if (field === 'start') {
      timingDraftStart = value;
    } else {
      timingDraftEnd = value;
    }
    timingError = '';

    await saveTimingDraft();
  }

  async function saveTimingDraft() {
    const startedAt = timingDraftStart;
    const completedAt = timingDraftEnd;

    if (!startedAt || !completedAt) {
      return;
    }

    const start = new Date(startedAt);
    const end = new Date(completedAt);
    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      start.getTime() >= end.getTime()
    ) {
      timingError = 'Start time must be before end time.';
      return;
    }

    const result = await onCompletedTimingChange?.(selectedTask.id, startedAt, completedAt);
    if (result?.ok === false) {
      timingError = result.error ?? 'The task timing could not be updated.';
    }
  }

  async function handleNoteTextareaInput(event) {
    const textarea = event.currentTarget;
    const expanded = expandTodoCommand(textarea.value, textarea.selectionStart ?? textarea.value.length);
    onNoteInput(expanded.value);

    if (expanded.changed) {
      await tick();
      textarea.setSelectionRange(expanded.cursor, expanded.cursor);
    }
  }

  async function handleTextareaKeydown(event, onInput) {
    if (event.key !== 'Tab' || event.shiftKey) {
      return;
    }

    event.preventDefault();
    const textarea = event.currentTarget;
    const selectionStart = textarea.selectionStart ?? textarea.value.length;
    const selectionEnd = textarea.selectionEnd ?? selectionStart;
    const nextValue = `${textarea.value.slice(0, selectionStart)}\t${textarea.value.slice(selectionEnd)}`;
    onInput(nextValue);

    await tick();
    textarea.setSelectionRange(selectionStart + 1, selectionStart + 1);
  }

  function handleNoteTextareaKeydown(event) {
    return handleTextareaKeydown(event, onNoteInput);
  }

  function handleProgressTextareaKeydown(event) {
    return handleTextareaKeydown(event, (nextValue) => onProgressInput(selectedTask.id, nextValue));
  }

  function handleTodoToggle(item) {
    onNoteInput(toggleNoteTodo(noteDraft, item.lineIndex));
  }

  function toDateTimeLocalValue(dateLike) {
    const date = new Date(dateLike);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return `${toDateValue(date)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  function toDateValue(dateLike) {
    const date = new Date(dateLike);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
</script>

{#if selectedTask}
<aside class="task-detail" id="task-detail" aria-labelledby="detail-heading">
  <div class="detail-header">
    <div>
      <p class="eyebrow">Task page</p>
      <h2 id="detail-heading">Details</h2>
    </div>
    <div class="detail-window-actions">
      <button
          type="button"
          class="detail-delete-task"
          aria-label={`Delete ${selectedTask.title}`}
          on:click={() => onDeleteTask(selectedTask.id)}
        >
          Delete
        </button>
      <button type="button" class="detail-close" id="detail-close" aria-label="Close task details" on:click={onClose}>Close</button>
    </div>
  </div>
    <label class="detail-title-label" for={editingDetailTitle ? 'detail-title-input' : undefined}>Task name</label>
    {#if editingDetailTitle}
      <input
        id="detail-title-input"
        class="detail-title-input"
        type="text"
        value={selectedTask.title}
        aria-label={`Edit ${selectedTask.title} title`}
        on:keydown={(event) => {
          if (event.key === 'Enter') {
            event.currentTarget.blur();
          }
          if (event.key === 'Escape') {
            editingDetailTitle = false;
          }
        }}
        on:focusout={(event) => commitDetailTitle(selectedTask.id, event.currentTarget.value)}
      />
    {:else}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="detail-title-display"
        title="Double-click to rename"
        on:dblclick={startDetailTitleEdit}
      >
        {@html linkifyText(selectedTask.title)}
      </div>
    {/if}
    <label class="progress-toggle">
      <input
        type="checkbox"
        checked={selectedTask.isProgressive}
        on:change={(event) => onProgressiveChange(selectedTask.id, event.currentTarget.checked)}
      />
      <span>
        <strong>Progressive task</strong>
        <small>Log today's session and keep this task open.</small>
      </span>
    </label>
    {#if selectedTask.isProgressive}
      <label class="detail-note-label" for="progress-label">Today progress</label>
      <textarea
        id="progress-label"
        class="progress-input"
        placeholder="pages 41-52, Chapter 4, lesson 2"
        value={selectedTask.progressLabel ?? ''}
        on:input={(event) => onProgressInput(selectedTask.id, event.currentTarget.value)}
        on:keydown={handleProgressTextareaKeydown}
      ></textarea>
    {/if}
    <div class="detail-note-row">
      <label class="detail-note-label" for="detail-note">Notes</label>
      <span aria-live="polite">
        {noteSaveStatus === 'saving'
          ? 'Saving details...'
          : noteSaveStatus === 'error'
            ? 'Saved locally - sync failed'
            : 'Details saved automatically'}
      </span>
    </div>
    <textarea
      id="detail-note"
      class="detail-note"
      placeholder="Add context, links, or reminders for this task."
      value={noteDraft}
      on:input={handleNoteTextareaInput}
      on:keydown={handleNoteTextareaKeydown}
    ></textarea>
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
    <p class="detail-meta" id="detail-meta">{detailMeta(selectedTask)}</p>
    {#if !selectedTask.completedAt}
      <dl class="detail-timeline" aria-label="Task start and end time">
        <div>
          <dt>Started</dt>
          <dd>
            {#if selectedTask.firstStartedAt}
              <time datetime={selectedTask.firstStartedAt}>{formatTaskTimestamp(selectedTask.firstStartedAt)}</time>
            {:else}
              Not recorded
            {/if}
          </dd>
        </div>
        <div>
          <dt>Ended</dt>
          <dd>{selectedTask.activeStartedAt ? 'In progress' : 'Not finished'}</dd>
        </div>
      </dl>
    {/if}
    <label class="detail-due-date">
      <span>Due date</span>
      <input
        type="date"
        class="detail-due-input"
        aria-label="Task due date"
        value={dueDateValue(selectedTask)}
        on:change={handleDueDateInput}
      />
    </label>
    <div class="detail-timing-controls" aria-label="Task timing">
      {#if selectedTask.completedAt}
        <label>
          <span>Done date</span>
          <CalendarPicker
            triggerClass="detail-done-date-picker"
            label="Change task done date"
            value={completedDateValue(selectedTask)}
            onChange={handleDoneDateChange}
          />
        </label>
      {/if}
      <label>
        <span>Start time</span>
        {#if !selectedTask.firstStartedAt}
          <small class="detail-start-missing">Defaults to creation time</small>
        {/if}
        <CalendarPicker
          mode="datetime"
          triggerClass="detail-start-picker"
          label="Change task start time"
          value={timingDraftStart}
          onChange={(nextValue) => handleTimingChange('start', nextValue)}
        />
      </label>
      <label>
        <span>End time</span>
        <CalendarPicker
          mode="datetime"
          triggerClass="detail-end-picker"
          label="Change task end time"
          value={timingDraftEnd}
          onChange={(nextValue) => handleTimingChange('end', nextValue)}
        />
      </label>
      {#if timingError}
        <p class="detail-timing-error" role="alert" aria-live="polite">{timingError}</p>
      {/if}
    </div>
    <div class="time-segment-history" aria-label="Time segments">
      <h3>Time segments</h3>
      {#if selectedTaskTimeSegments.length}
        <ol>
          {#each selectedTaskTimeSegments as segment, index (`${segment.startedAt}-${segment.endedAt}-${index}`)}
            <li class="time-segment-item">
              <span>Segment {index + 1}</span>
              <div>
                <time datetime={segment.startedAt}>{formatTaskTimestamp(segment.startedAt)}</time>
                <small>to</small>
                <time datetime={segment.endedAt}>{formatTaskTimestamp(segment.endedAt)}</time>
              </div>
              <strong>{formatDuration(segment.durationSeconds)}</strong>
            </li>
          {/each}
        </ol>
      {:else}
        <p>No completed time segments yet.</p>
      {/if}
    </div>
    {#if selectedTask.isProgressive}
      <div class="session-history" aria-label="Progress sessions">
        <h3>Sessions</h3>
        {#if selectedTaskSessions.length}
          <ol>
            {#each selectedTaskSessions as session (session.id)}
              <li>
                <time datetime={session.completedAt}>{completedTime(session.completedAt)}</time>
                <span>{session.progressLabel || 'Session logged'}</span>
                <small>{formatDuration(session.trackedSeconds)}</small>
              </li>
            {/each}
          </ol>
        {:else}
          <p>No sessions logged yet.</p>
        {/if}
      </div>
    {/if}
</aside>
{/if}
