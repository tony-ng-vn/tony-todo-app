<script>
  import { tick } from 'svelte';
  import CalendarPicker from './CalendarPicker.svelte';
  import RichNoteTextarea from './RichNoteTextarea.svelte';
  import TaskPhotoField from './TaskPhotoField.svelte';
  import { linkifyText } from '../../linkify.js';
  import { expandTodoCommand, parseNoteTodos, toggleNoteTodo } from '../../noteTodos.js';
  import { getTextareaCaretRestore, getTextareaKeyEdit } from '../../textareaEditing.js';
  import {
    formatTaskTimestamp,
    getEditableTaskTimeSegments,
  } from '../../todoStore.js';

  export let selectedTask = null;
  export let noteDraft = '';
  export let noteSaveStatus = 'saved';
  export let selectedTaskSessions = [];
  export let onClose;
  export let onNoteInput;
  export let onDetailTitleCommit;
  export let onTimeSegmentsChange;
  export let onCompletedAtChange;
  export let onDueDateChange;
  export let onSomedayChange;
  export let onDeleteTask;
  export let onPhotoSelect;
  export let onPhotoRemove;
  export let photoBusy = false;
  export let photoError = '';
  export let formatDuration;
  export let completedTime;
  export let detailMeta;

  let activeDetailTaskId = null;
  let editingDetailTitle = false;
  let timingDraftTaskId = null;
  let timingDraftSource = '';
  let timingDraftBlocks = [];
  let timingError = '';

  $: noteTodos = parseNoteTodos(noteDraft);

  $: if (selectedTask?.id !== activeDetailTaskId) {
    activeDetailTaskId = selectedTask?.id ?? null;
    editingDetailTitle = false;
  }

  $: {
    const nextTimingSource = timingSource(selectedTask);
    if (selectedTask?.id !== timingDraftTaskId || nextTimingSource !== timingDraftSource) {
      timingDraftTaskId = selectedTask?.id ?? null;
      timingDraftSource = nextTimingSource;
      timingDraftBlocks = timingBlocksForTask(selectedTask);
      timingError = '';
    }
  }

  $: timingDraftTotal = timingDraftBlocks.reduce((total, block) => {
    const start = new Date(block.startedAt);
    const end = new Date(block.endedAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
      return total;
    }
    return total + Math.floor((end.getTime() - start.getTime()) / 1000);
  }, 0);

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

  function timingSource(todo) {
    return JSON.stringify({
      timeSegments: todo?.timeSegments ?? [],
      firstStartedAt: todo?.firstStartedAt ?? null,
      activeStartedAt: todo?.activeStartedAt ?? null,
      createdAt: todo?.createdAt ?? null,
      completedAt: todo?.completedAt ?? null,
    });
  }

  function timingBlocksForTask(todo) {
    return getEditableTaskTimeSegments(todo).map((segment) => ({
      startedAt: toDateTimeLocalValue(segment.startedAt),
      endedAt: toDateTimeLocalValue(segment.endedAt),
    }));
  }

  function completedDateValue(todo) {
    return todo?.completedAt ? toDateValue(todo.completedAt) : '';
  }

  function dueDateValue(todo) {
    return todo?.dueDate ? toDateValue(todo.dueDate) : '';
  }

  function handleDueDateInput(value) {
    onDueDateChange?.(selectedTask.id, value);
  }

  async function handleDoneDateChange(value) {
    if (!selectedTask?.completedAt || !value) {
      return;
    }

    const completedAt = new Date(selectedTask.completedAt);
    if (Number.isNaN(completedAt.getTime())) {
      return;
    }

    const timeValue = `${String(completedAt.getHours()).padStart(2, '0')}:${String(completedAt.getMinutes()).padStart(2, '0')}`;
    timingError = '';
    const result = await onCompletedAtChange?.(selectedTask.id, value, timeValue, { allowBeforeStart: true });
    if (result?.ok === false) {
      timingError = result.error ?? 'The done date could not be updated.';
    }
  }

  async function handleTimingChange(index, field, value) {
    if (!selectedTask?.id) {
      return;
    }

    timingDraftBlocks = timingDraftBlocks.map((block, blockIndex) =>
      blockIndex === index ? { ...block, [field]: value } : block,
    );
    timingError = '';

    await saveTimingDrafts();
  }

  async function saveTimingDrafts() {
    if (timingDraftBlocks.some((block) => !block.startedAt || !block.endedAt)) {
      timingError = 'Choose both a start and end time in each block.';
      return;
    }

    const segments = [];
    for (const block of timingDraftBlocks) {
      const start = new Date(block.startedAt);
      const end = new Date(block.endedAt);
      if (
        Number.isNaN(start.getTime()) ||
        Number.isNaN(end.getTime()) ||
        start.getTime() >= end.getTime()
      ) {
        timingError = 'Start time must be before end time in each block.';
        return;
      }
      segments.push({ startedAt: block.startedAt, endedAt: block.endedAt });
    }

    const result = await onTimeSegmentsChange?.(selectedTask.id, segments);
    if (result?.ok === false) {
      timingError = result.error ?? 'The task timing could not be updated.';
    }
  }

  function addTimeBlock() {
    timingDraftBlocks = [...timingDraftBlocks, { startedAt: '', endedAt: '' }];
    timingError = '';
  }

  async function removeTimeBlock(index) {
    if (timingDraftBlocks.length <= 1) {
      return;
    }
    timingDraftBlocks = timingDraftBlocks.filter((_, blockIndex) => blockIndex !== index);
    timingError = '';
    await saveTimingDrafts();
  }

  async function handleNoteTextareaInput(event) {
    const textarea = event.currentTarget;
    const restoreCaret = getTextareaCaretRestore(textarea);
    const expanded = expandTodoCommand(textarea.value, textarea.selectionStart ?? textarea.value.length);
    onNoteInput(expanded.value);

    await tick();
    restoreCaret(expanded.cursor);
  }

  async function handleTextareaKeydown(event, onInput) {
    if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    const textarea = event.currentTarget;
    const selectionStart = textarea.selectionStart ?? textarea.value.length;
    const selectionEnd = textarea.selectionEnd ?? selectionStart;
    const edit = getTextareaKeyEdit({
      value: textarea.value,
      selectionStart,
      selectionEnd,
      key: event.key,
      shiftKey: event.shiftKey,
    });
    if (!edit) {
      return;
    }

    event.preventDefault();
    const restoreCaret = getTextareaCaretRestore(textarea);
    onInput(edit.value);

    await tick();
    restoreCaret(edit.cursor);
  }

  function handleNoteTextareaKeydown(event) {
    return handleTextareaKeydown(event, onNoteInput);
  }

  function handleTodoToggle(item) {
    onNoteInput(toggleNoteTodo(noteDraft, item.lineIndex));
  }

  function toDateTimeLocalValue(dateLike) {
    if (!dateLike) {
      return '';
    }

    const date = new Date(dateLike);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return `${toDateValue(date)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  function lockToVisualViewport(node) {
    if (typeof window === 'undefined') {
      return {};
    }

    const overlayQuery = window.matchMedia('(max-width: 900px), (pointer: coarse)');

    function sync() {
      const nativeHost = document.documentElement.classList.contains('is-native-host');
      if (nativeHost || !overlayQuery.matches || !window.visualViewport) {
        node.style.removeProperty('height');
        node.style.removeProperty('top');
        node.style.removeProperty('left');
        node.style.removeProperty('right');
        node.style.removeProperty('bottom');
        node.style.removeProperty('width');
        return;
      }

      const viewport = window.visualViewport;
      node.style.height = `${viewport.height}px`;
      node.style.top = `${viewport.offsetTop}px`;
      node.style.left = `${viewport.offsetLeft}px`;
      node.style.right = 'auto';
      node.style.bottom = 'auto';
      node.style.width = `${viewport.width}px`;
    }

    overlayQuery.addEventListener('change', sync);
    window.visualViewport?.addEventListener('resize', sync);
    window.visualViewport?.addEventListener('scroll', sync);
    window.addEventListener('orientationchange', sync);
    sync();

    return {
      destroy() {
        overlayQuery.removeEventListener('change', sync);
        window.visualViewport?.removeEventListener('resize', sync);
        window.visualViewport?.removeEventListener('scroll', sync);
        window.removeEventListener('orientationchange', sync);
        node.style.removeProperty('height');
        node.style.removeProperty('top');
        node.style.removeProperty('left');
        node.style.removeProperty('right');
        node.style.removeProperty('bottom');
        node.style.removeProperty('width');
      },
    };
  }

  function toDateValue(dateLike) {
    if (!dateLike) {
      return '';
    }

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
<aside
  class="task-detail"
  id="task-detail"
  aria-labelledby="detail-heading"
  use:lockToVisualViewport
>
  <div class="detail-header">
    <div>
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
  <div class="detail-body">
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
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div
        class="detail-title-display"
        title="Double-click to rename"
        role="button"
        tabindex="0"
        on:click={() => {
          if (window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 900) {
            startDetailTitleEdit();
          }
        }}
        on:dblclick={startDetailTitleEdit}
        on:keydown={(event) => event.key === 'Enter' && startDetailTitleEdit()}
      >
        {@html linkifyText(selectedTask.title)}
      </div>
    {/if}
    {#if !selectedTask.completedAt}
      <div class:someday-active={selectedTask.somedayAt} class="detail-someday-state">
        <span>
          <strong>{selectedTask.somedayAt ? 'Stall' : 'Active task'}</strong>
          <small>
            {selectedTask.somedayAt
              ? 'Paused with no return date. It stays out of your active task list.'
              : 'Move this out of your active list until you choose to return to it.'}
          </small>
        </span>
        <button
          type="button"
          class="detail-someday-button"
          on:click={() => onSomedayChange(selectedTask.id, !selectedTask.somedayAt)}
        >
          {selectedTask.somedayAt ? 'Return to active' : 'Move to Stall'}
        </button>
      </div>
    {/if}
    <div class="detail-notes">
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
      <div class="detail-note-shell">
        <RichNoteTextarea
          id="detail-note"
          variant="detail"
          rows="4"
          placeholder="Add context, links, or reminders for this task."
          value={noteDraft}
          onInput={handleNoteTextareaInput}
          onKeydown={handleNoteTextareaKeydown}
        />
      </div>
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
    </div>
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
      <CalendarPicker
        triggerClass="detail-due-picker"
        label="Task due date"
        allowClear={true}
        value={dueDateValue(selectedTask)}
        onChange={handleDueDateInput}
      />
    </label>
    <TaskPhotoField
      todo={selectedTask}
      busy={photoBusy}
      error={photoError}
      onSelect={onPhotoSelect}
      onRemove={onPhotoRemove}
    />
    <div class="detail-timing-controls time-segment-history" aria-label="Time blocks">
      {#if selectedTask.completedAt}
        <label class="detail-done-date-control">
          <span>Done date</span>
          <CalendarPicker
            triggerClass="detail-done-date-picker"
            label="Change task done date"
            value={completedDateValue(selectedTask)}
            onChange={handleDoneDateChange}
          />
        </label>
      {/if}
      <div class="time-block-heading">
        <div>
          <h3>Time blocks</h3>
          <small>Add separate work periods to accumulate time.</small>
        </div>
        <strong aria-live="polite">Total {formatDuration(timingDraftTotal)}</strong>
      </div>
      <ol class="time-block-list">
        {#each timingDraftBlocks as block, index (index)}
          <li class="time-block-item">
            <div class="time-block-title">
              <strong>Block {index + 1}</strong>
              {#if timingDraftBlocks.length > 1}
                <button
                  type="button"
                  class="time-block-remove"
                  aria-label={`Remove time block ${index + 1}`}
                  on:click={() => removeTimeBlock(index)}
                >
                  Remove
                </button>
              {/if}
            </div>
            <label>
              <span>Start time</span>
              <CalendarPicker
                mode="datetime"
                triggerClass={index === 0 ? 'detail-start-picker' : 'time-block-start-picker'}
                label={`Change start time for block ${index + 1}`}
                value={block.startedAt}
                onChange={(nextValue) => handleTimingChange(index, 'startedAt', nextValue)}
              />
            </label>
            <label>
              <span>End time</span>
              <CalendarPicker
                mode="datetime"
                triggerClass={index === 0 ? 'detail-end-picker' : 'time-block-end-picker'}
                label={`Change end time for block ${index + 1}`}
                value={block.endedAt}
                onChange={(nextValue) => handleTimingChange(index, 'endedAt', nextValue)}
              />
            </label>
            {#if index === 0 && !selectedTask.firstStartedAt}
              <small class="detail-start-missing">Defaults to creation time</small>
            {/if}
            {#if block.startedAt && block.endedAt}
              <small class="time-block-duration">
                {formatDuration(
                  Math.max(
                    0,
                    Math.floor((new Date(block.endedAt) - new Date(block.startedAt)) / 1000),
                  ),
                )}
              </small>
            {/if}
          </li>
        {/each}
      </ol>
      <button type="button" class="time-block-add" on:click={addTimeBlock}>Add time block</button>
      {#if timingError}
        <p class="detail-timing-error" role="alert" aria-live="polite">{timingError}</p>
      {/if}
    </div>
    {#if selectedTaskSessions.length}
      <div class="session-history" aria-label="Progress sessions">
        <h3>Sessions</h3>
        <ol>
          {#each selectedTaskSessions as session (session.id)}
            <li>
              <time datetime={session.completedAt}>{completedTime(session.completedAt)}</time>
              <span>{session.progressLabel || 'Session'}</span>
              <small>{formatDuration(session.trackedSeconds)}</small>
            </li>
          {/each}
        </ol>
      </div>
    {/if}
  </div>
</aside>
{/if}
