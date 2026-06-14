<script>
  import { tick } from 'svelte';
  import CalendarPicker from './CalendarPicker.svelte';
  import { linkifyText } from '../../linkify.js';

  export let selectedTask = null;
  export let noteDraft = '';
  export let selectedTaskSessions = [];
  export let onClose;
  export let onNoteInput;
  export let onNoteSave;
  export let onNoteTodoToggle;
  export let onDetailTitleCommit;
  export let onProgressiveChange;
  export let onProgressInput;
  export let onCompletedDateChange;
  export let onCompletedTimingChange;
  export let onDeleteTask;
  export let formatDuration;
  export let completedTime;
  export let detailMeta;

  let activeDetailTaskId = null;
  let editingDetailTitle = false;

  $: noteTodos = parseNoteTodos(noteDraft);

  $: if (selectedTask?.id !== activeDetailTaskId) {
    activeDetailTaskId = selectedTask?.id ?? null;
    editingDetailTitle = false;
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
    if (!todo?.completedAt) {
      return '';
    }

    if (todo.firstStartedAt) {
      return toDateTimeLocalValue(todo.firstStartedAt);
    }

    const completedAt = new Date(todo.completedAt);
    if (Number.isNaN(completedAt.getTime())) {
      return '';
    }

    return toDateTimeLocalValue(new Date(completedAt.getTime() - Number(todo.trackedSeconds ?? 0) * 1000));
  }

  function completedEndValue(todo) {
    return todo?.completedAt ? toDateTimeLocalValue(todo.completedAt) : '';
  }

  function completedDateValue(todo) {
    return todo?.completedAt ? toDateValue(todo.completedAt) : '';
  }

  function completedTimeValue(todo) {
    const dateTimeValue = completedEndValue(todo);
    return dateTimeValue ? dateTimeValue.split('T')[1] : '';
  }

  function handleDoneDateChange(value) {
    if (!selectedTask?.completedAt || !value) {
      return;
    }

    onCompletedDateChange(selectedTask.id, value, completedTimeValue(selectedTask));
  }

  function handleTimingChange(field, value) {
    if (!selectedTask?.completedAt) {
      return;
    }

    const startedAt = field === 'start' ? value : completedStartValue(selectedTask);
    const completedAt = field === 'end' ? value : completedEndValue(selectedTask);

    if (!startedAt || !completedAt) {
      return;
    }

    onCompletedTimingChange(selectedTask.id, startedAt, completedAt);
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

  async function handleNoteTextareaKeydown(event) {
    if (event.key !== 'Tab') {
      return;
    }

    event.preventDefault();
    const textarea = event.currentTarget;
    const selectionStart = textarea.selectionStart ?? textarea.value.length;
    const selectionEnd = textarea.selectionEnd ?? selectionStart;
    const nextValue = `${textarea.value.slice(0, selectionStart)}\t${textarea.value.slice(selectionEnd)}`;
    onNoteInput(nextValue);

    await tick();
    textarea.setSelectionRange(selectionStart + 1, selectionStart + 1);
  }

  function parseNoteTodos(note) {
    return note
      .split('\n')
      .map((line, index) => {
        const match = line.match(/^-\s+\[( |x|X)\]\s+(.*)$/);
        return match
          ? {
              lineIndex: index,
              done: match[1].toLowerCase() === 'x',
              label: match[2],
            }
          : null;
      })
      .filter(Boolean);
  }

  function handleTodoToggle(item) {
    const lines = noteDraft.split('\n');
    const marker = item.done ? ' ' : 'x';
    lines[item.lineIndex] = `- [${marker}] ${item.label}`;
    onNoteTodoToggle(selectedTask.id, lines.join('\n'));
  }

  function expandTodoCommand(value, cursor) {
    const lineStart = value.lastIndexOf('\n', Math.max(0, cursor - 1)) + 1;
    const lineEndIndex = value.indexOf('\n', cursor);
    const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
    const line = value.slice(lineStart, lineEnd);
    const match = line.match(/^\/todo(?:\s+)?(.*)$/);

    if (!match) {
      return { value, cursor, changed: false };
    }

    const replacement = `- [ ] ${match[1] ?? ''}`;
    return {
      value: `${value.slice(0, lineStart)}${replacement}${value.slice(lineEnd)}`,
      cursor: lineStart + replacement.length,
      changed: true,
    };
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
          class="detail-save-note"
          disabled={noteDraft === (selectedTask.note ?? '')}
          on:click={() => onNoteSave(selectedTask.id, noteDraft)}
        >
          Save
        </button>
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
      <input
        id="progress-label"
        class="progress-input"
        type="text"
        placeholder="pages 41-52, Chapter 4, lesson 2"
        value={selectedTask.progressLabel ?? ''}
        on:input={(event) => onProgressInput(selectedTask.id, event.currentTarget.value)}
      />
    {/if}
    <div class="detail-note-row">
      <label class="detail-note-label" for="detail-note">Notes</label>
      <span>{noteDraft === (selectedTask.note ?? '') ? 'Details saved' : 'Unsaved details'}</span>
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
            <span class="note-todo-checkbox" aria-hidden="true">{item.done ? '✓' : ''}</span>
            <span>{item.label}</span>
          </button>
        {/each}
      </div>
    {/if}
    <p class="detail-meta" id="detail-meta">{detailMeta(selectedTask)}</p>
    {#if selectedTask.completedAt}
      <div class="detail-timing-controls" aria-label="Task timing">
        <label>
          <span>Done date</span>
          <CalendarPicker
            triggerClass="detail-done-date-picker"
            label="Change task done date"
            value={completedDateValue(selectedTask)}
            onChange={handleDoneDateChange}
          />
        </label>
        <label>
          <span>Start time</span>
          <CalendarPicker
            mode="datetime"
            triggerClass="detail-start-picker"
            label="Change task start time"
            value={completedStartValue(selectedTask)}
            onChange={(nextValue) => handleTimingChange('start', nextValue)}
          />
        </label>
        <label>
          <span>End time</span>
          <CalendarPicker
            mode="datetime"
            triggerClass="detail-end-picker"
            label="Change task end time"
            value={completedEndValue(selectedTask)}
            onChange={(nextValue) => handleTimingChange('end', nextValue)}
          />
        </label>
      </div>
    {/if}
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
