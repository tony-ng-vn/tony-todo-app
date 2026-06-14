<script>
  import { onDestroy, onMount, tick } from 'svelte';
  import CalendarPicker from './CalendarPicker.svelte';
  import { linkifyText } from '../../linkify.js';

  export let selectedTask = null;
  export let detailAnchor = null;
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

  const EDGE_HIT_SIZE = 12;
  const CORNER_HIT_SIZE = 24;
  const DRAG_START_THRESHOLD = 3;
  let detailElement;
  let activeDetailTaskId = null;
  let editingDetailTitle = false;
  let panelSize = null;
  let minimumPanelSize = null;
  let isDragging = false;
  let isResizing = false;
  let panelPosition = null;
  let dragStart = null;
  let pointerAction = null;
  let panelCursor = '';
  let pendingPointerMove = null;
  let pointerMoveFrame = null;

  $: detailStyle = [
    panelPosition ? `left: ${panelPosition.x}px; top: ${panelPosition.y}px;` : '',
    panelSize ? `width: ${panelSize.width}px; height: ${panelSize.height}px;` : '',
    panelCursor ? `cursor: ${panelCursor};` : '',
  ]
    .filter(Boolean)
    .join(' ');

  $: noteTodos = parseNoteTodos(noteDraft);

  $: if (selectedTask?.id !== activeDetailTaskId) {
    activeDetailTaskId = selectedTask?.id ?? null;
    editingDetailTitle = false;
    panelSize = null;
    minimumPanelSize = null;
    panelPosition = null;

    if (selectedTask) {
      tick().then(positionPanelAtDefault);
    }
  }

  onMount(() => {
    window.addEventListener('resize', clampPanelPosition, { passive: true });
  });

  onDestroy(() => {
    removePointerListeners();
    cancelPendingPointerMove();
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', clampPanelPosition);
    }
  });

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

  function handlePanelPointerDown(event) {
    if (event.button !== 0) {
      return;
    }

    const rect = detailElement.getBoundingClientRect();
    const resizeEdges = resizeEdgesForPointer(event, rect);
    const shouldResize = resizeEdges.horizontal || resizeEdges.vertical;

    if (!shouldResize && isInteractiveTarget(event.target)) {
      return;
    }

    event.preventDefault();
    minimumPanelSize ??= { width: Math.round(rect.width), height: Math.round(rect.height) };
    panelPosition = { x: rect.left, y: rect.top };
    panelSize = { width: rect.width, height: rect.height };
    isDragging = false;
    isResizing = shouldResize;
    dragStart = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      panelX: rect.left,
      panelY: rect.top,
      width: rect.width,
      height: rect.height,
      edges: resizeEdges,
      hasMoved: shouldResize,
    };
    pointerAction = shouldResize ? 'resize' : 'move';

    detailElement.setPointerCapture?.(event.pointerId);
    window.addEventListener('pointermove', handlePanelPointerMove);
    window.addEventListener('pointerup', handlePanelPointerUp, { once: true });
  }

  function handlePanelPointerMove(event) {
    if (!dragStart) {
      return;
    }

    pendingPointerMove = {
      clientX: event.clientX,
      clientY: event.clientY,
    };

    if (pointerMoveFrame) {
      return;
    }

    pointerMoveFrame = window.requestAnimationFrame(applyPanelPointerMove);
  }

  function applyPanelPointerMove() {
    pointerMoveFrame = null;

    if (!dragStart || !pendingPointerMove) {
      return;
    }

    const deltaX = pendingPointerMove.clientX - dragStart.pointerX;
    const deltaY = pendingPointerMove.clientY - dragStart.pointerY;

    if (pointerAction === 'resize') {
      resizePanel(deltaX, deltaY);
      return;
    }

    if (!dragStart.hasMoved && Math.hypot(deltaX, deltaY) < DRAG_START_THRESHOLD) {
      return;
    }

    dragStart.hasMoved = true;
    isDragging = true;
    panelPosition = clampPosition(dragStart.panelX + deltaX, dragStart.panelY + deltaY, panelSize);
  }

  function handlePanelPointerUp() {
    if (pointerMoveFrame) {
      applyPanelPointerMove();
    }
    isDragging = false;
    isResizing = false;
    dragStart = null;
    pointerAction = null;
    pendingPointerMove = null;
    clearPanelCursor();
    removePointerListeners();
  }

  function removePointerListeners() {
    if (typeof window === 'undefined') {
      return;
    }

    window.removeEventListener('pointermove', handlePanelPointerMove);
    window.removeEventListener('pointerup', handlePanelPointerUp);
  }

  function cancelPendingPointerMove() {
    if (typeof window === 'undefined' || !pointerMoveFrame) {
      return;
    }

    window.cancelAnimationFrame(pointerMoveFrame);
    pointerMoveFrame = null;
    pendingPointerMove = null;
  }

  function portal(node) {
    if (typeof document === 'undefined') {
      return {};
    }

    document.body.appendChild(node);
    return {
      destroy() {
        node.remove();
      },
    };
  }

  function positionPanelAtDefault() {
    if (!detailElement || typeof window === 'undefined') {
      return;
    }

    const rect = detailElement.getBoundingClientRect();
    minimumPanelSize ??= { width: Math.round(rect.width), height: Math.round(rect.height) };
    panelPosition = detailAnchor ? positionPanelNearAnchor(rect, detailAnchor) : clampPosition(window.innerWidth - rect.width - 24, 24);
  }

  function positionPanelNearAnchor(panelRect, anchorRect) {
    const margin = window.innerWidth <= 560 ? 10 : 16;
    const gap = 12;
    const rightSideX = anchorRect.right + gap;
    const leftSideX = anchorRect.left - panelRect.width - gap;
    const alignedX = anchorRect.left;
    const x =
      rightSideX + panelRect.width <= window.innerWidth - margin
        ? rightSideX
        : leftSideX >= margin
          ? leftSideX
          : alignedX;

    return clampPosition(x, window.innerWidth <= 560 ? 10 : 24, { width: panelRect.width, height: panelRect.height });
  }

  function clampPanelPosition() {
    if (!panelPosition || !detailElement || typeof window === 'undefined') {
      return;
    }

    panelSize = panelSize ? clampSize(panelSize.width, panelSize.height) : panelSize;
    panelPosition = clampPosition(panelPosition.x, panelPosition.y, panelSize);
  }

  function resizePanel(deltaX, deltaY) {
    const edges = dragStart.edges;
    let nextX = dragStart.panelX;
    let nextY = dragStart.panelY;
    let nextWidth = dragStart.width;
    let nextHeight = dragStart.height;

    if (edges.horizontal === 'right') {
      nextWidth = dragStart.width + deltaX;
    } else if (edges.horizontal === 'left') {
      nextWidth = dragStart.width - deltaX;
      nextX = dragStart.panelX + deltaX;
    }

    if (edges.vertical === 'bottom') {
      nextHeight = dragStart.height + deltaY;
    } else if (edges.vertical === 'top') {
      nextHeight = dragStart.height - deltaY;
      nextY = dragStart.panelY + deltaY;
    }

    const clampedSize = clampSize(nextWidth, nextHeight);
    if (edges.horizontal === 'left') {
      nextX = dragStart.panelX + dragStart.width - clampedSize.width;
    }
    if (edges.vertical === 'top') {
      nextY = dragStart.panelY + dragStart.height - clampedSize.height;
    }

    panelSize = clampedSize;
    panelPosition = clampPosition(nextX, nextY, clampedSize);
  }

  function clampSize(width, height) {
    const minWidth = minimumPanelSize?.width ?? 420;
    const minHeight = minimumPanelSize?.height ?? 480;
    const maxWidth = Math.max(minWidth, Math.floor(window.innerWidth * 0.75));
    const maxHeight = Math.max(minHeight, Math.floor(window.innerHeight * 0.75));

    return {
      width: Math.min(Math.max(width, minWidth), maxWidth),
      height: Math.min(Math.max(height, minHeight), maxHeight),
    };
  }

  function clampPosition(x, y, size = null) {
    const rect = detailElement?.getBoundingClientRect();
    const width = size?.width ?? rect?.width ?? 420;
    const height = size?.height ?? rect?.height ?? 480;
    const margin = window.innerWidth <= 560 ? 10 : 16;
    const maxX = Math.max(margin, window.innerWidth - width - margin);
    const maxY = Math.max(margin, window.innerHeight - height - margin);

    return {
      x: Math.min(Math.max(x, margin), maxX),
      y: Math.min(Math.max(y, margin), maxY),
    };
  }

  function resizeEdgesForPointer(event, rect) {
    const nearLeft = event.clientX - rect.left <= EDGE_HIT_SIZE;
    const nearRight = rect.right - event.clientX <= EDGE_HIT_SIZE;
    const nearTop = event.clientY - rect.top <= EDGE_HIT_SIZE;
    const nearBottom = rect.bottom - event.clientY <= EDGE_HIT_SIZE;
    const inLeftCorner = event.clientX - rect.left <= CORNER_HIT_SIZE;
    const inRightCorner = rect.right - event.clientX <= CORNER_HIT_SIZE;
    const inTopCorner = event.clientY - rect.top <= CORNER_HIT_SIZE;
    const inBottomCorner = rect.bottom - event.clientY <= CORNER_HIT_SIZE;

    if (nearLeft && nearTop && inLeftCorner && inTopCorner) {
      return { horizontal: 'left', vertical: 'top' };
    }
    if (nearRight && nearTop && inRightCorner && inTopCorner) {
      return { horizontal: 'right', vertical: 'top' };
    }
    if (nearRight && nearBottom && inRightCorner && inBottomCorner) {
      return { horizontal: 'right', vertical: 'bottom' };
    }
    if (nearLeft && nearBottom && inLeftCorner && inBottomCorner) {
      return { horizontal: 'left', vertical: 'bottom' };
    }

    return {
      horizontal: nearLeft ? 'left' : nearRight ? 'right' : null,
      vertical: nearTop ? 'top' : nearBottom ? 'bottom' : null,
    };
  }

  function handlePanelPointerHover(event) {
    if (isDragging || isResizing) {
      return;
    }

    const rect = detailElement.getBoundingClientRect();
    panelCursor = cursorForEdges(resizeEdgesForPointer(event, rect));
  }

  function cursorForEdges(edges) {
    if (edges.horizontal === 'left' && edges.vertical === 'top') return 'nwse-resize';
    if (edges.horizontal === 'right' && edges.vertical === 'bottom') return 'nwse-resize';
    if (edges.horizontal === 'right' && edges.vertical === 'top') return 'nesw-resize';
    if (edges.horizontal === 'left' && edges.vertical === 'bottom') return 'nesw-resize';
    if (edges.horizontal) return 'ew-resize';
    if (edges.vertical) return 'ns-resize';
    return '';
  }

  function clearPanelCursor() {
    if (!isDragging && !isResizing) {
      panelCursor = '';
    }
  }

  function isInteractiveTarget(target) {
    return Boolean(
      target.closest(
        'button, input, textarea, select, option, a, label, [contenteditable="true"], .detail-title-display, .session-history, .finished-controls, .detail-timing-controls',
      ),
    );
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

<!-- svelte-ignore a11y_no_static_element_interactions -->
<aside
  bind:this={detailElement}
  class:is-open={selectedTask}
  class:is-dragging={isDragging}
  class:is-resizing={isResizing}
  class="task-detail"
  id="task-detail"
  aria-labelledby="detail-heading"
  aria-hidden={String(!selectedTask)}
  style={detailStyle}
  use:portal
  on:pointerdown={handlePanelPointerDown}
  on:pointermove={handlePanelPointerHover}
  on:pointerleave={clearPanelCursor}
>
  <span class="detail-resize-zone detail-resize-top" aria-hidden="true"></span>
  <span class="detail-resize-zone detail-resize-right" aria-hidden="true"></span>
  <span class="detail-resize-zone detail-resize-bottom" aria-hidden="true"></span>
  <span class="detail-resize-zone detail-resize-left" aria-hidden="true"></span>
  <span class="detail-resize-zone detail-resize-top-left" aria-hidden="true"></span>
  <span class="detail-resize-zone detail-resize-top-right" aria-hidden="true"></span>
  <span class="detail-resize-zone detail-resize-bottom-right" aria-hidden="true"></span>
  <span class="detail-resize-zone detail-resize-bottom-left" aria-hidden="true"></span>
  <div class="detail-header">
    <div>
      <p class="eyebrow">Task page</p>
      <h2 id="detail-heading">Details</h2>
    </div>
    <div class="detail-window-actions">
      {#if selectedTask}
        <button
          type="button"
          class="detail-save-note"
          disabled={noteDraft === (selectedTask.note ?? '')}
          on:click={() => onNoteSave(selectedTask.id, noteDraft)}
        >
          Save details
        </button>
        <button
          type="button"
          class="detail-delete-task"
          aria-label={`Delete ${selectedTask.title}`}
          on:click={() => onDeleteTask(selectedTask.id)}
        >
          Delete
        </button>
      {/if}
      <button type="button" class="detail-close" id="detail-close" aria-label="Close task details" on:click={onClose}>Close</button>
    </div>
  </div>
  {#if selectedTask}
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
  {/if}
</aside>
