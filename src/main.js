import './styles.css';
import { escapeHtml, linkifyText } from './linkify.js';
import {
  addTodo,
  completeTodo,
  createInitialState,
  formatDayKey,
  formatDuration,
  getDaySummary,
  getElapsedSeconds,
  getPendingTodos,
  pauseTodoTimer,
  reorderCompletedTodosForDay,
  startTodoTimer,
  updateTodoNote,
  updateTodoTitle,
} from './todoStore.js';
import { insforge, isInsForgeConfigured } from './insforgeClient.js';
import {
  completeRemoteTodo,
  insertRemoteTodo,
  loadRemoteTodos,
  updateRemoteTodoCompletion,
  updateRemoteTodoNote,
  updateRemoteTodoTimer,
  updateRemoteTodoTitle,
} from './todoRemote.js';

const STORAGE_KEY = 'done-log-state';
const CLIENT_ID_KEY = 'done-log-client-id';
const useRemote = isInsForgeConfigured && !new URLSearchParams(window.location.search).has('local');

let state = loadState();
let selectedDay = formatDayKey(new Date());
let syncMessage = useRemote ? 'Connecting' : 'Local only';
const clientId = getClientId();
let selectedTaskId = null;
let editingTaskId = null;
let noteSaveTimer = null;
let liveTimer = null;
let draftTitle = '';
let newlyAddedTodoId = null;

const app = document.querySelector('#app');

app.innerHTML = `
  <main class="workspace" aria-label="Done Log todo app">
    <section class="task-panel" aria-labelledby="task-heading">
      <div class="brand-row">
        <div>
          <p class="eyebrow">Done Log</p>
          <h1 id="task-heading">Today</h1>
          <p class="panel-note">A quiet workspace for the next thing, and proof of what already moved.</p>
        </div>
        <output class="sync-status" id="sync-status" aria-live="polite"></output>
      </div>

      <form class="new-task-form" id="new-task-form">
        <label for="todo-title">New task</label>
        <div class="input-row">
          <input id="todo-title" name="title" type="text" autocomplete="off" placeholder="+ Add task and press Enter" />
          <button type="submit">Add</button>
        </div>
      </form>

      <div class="section-heading">
        <h2>Open</h2>
        <span id="open-count"></span>
      </div>
      <ul class="todo-list" id="todo-list"></ul>
    </section>

    <div class="flow-rail" aria-label="Today progress">
      <output class="done-count" id="done-count" aria-label="Completed today"></output>
      <span class="rail-line" aria-hidden="true"></span>
      <span class="rail-caption">Done log</span>
    </div>

    <aside class="summary-panel" aria-labelledby="summary-heading">
      <div class="summary-top">
        <div>
          <p class="eyebrow">Daily ledger</p>
          <h2 id="summary-heading">Today recap</h2>
        </div>
        <input id="summary-date" type="date" />
      </div>
      <div class="day-rhythm" aria-hidden="true">
        <span>Morning</span>
        <span>Lunch</span>
        <span>Afternoon</span>
        <span>Evening</span>
      </div>
      <div class="summary-list" id="summary-list"></div>
    </aside>

    <aside class="task-detail" id="task-detail" aria-labelledby="detail-heading" aria-hidden="true">
      <div class="detail-header">
        <div>
          <p class="eyebrow">Task page</p>
          <h2 id="detail-heading">Details</h2>
        </div>
        <button type="button" class="detail-close" id="detail-close" aria-label="Close task details">Close</button>
      </div>
      <p class="detail-title" id="detail-title"></p>
      <label class="detail-note-label" for="detail-note">Notes</label>
      <textarea id="detail-note" class="detail-note" placeholder="Add context, links, or reminders for this task."></textarea>
      <p class="detail-meta" id="detail-meta"></p>
    </aside>
  </main>
`;

const form = document.querySelector('#new-task-form');
const titleInput = document.querySelector('#todo-title');
const todoList = document.querySelector('#todo-list');
const openCount = document.querySelector('#open-count');
const doneCount = document.querySelector('#done-count');
const summaryDate = document.querySelector('#summary-date');
const summaryList = document.querySelector('#summary-list');
const syncStatus = document.querySelector('#sync-status');
const taskDetail = document.querySelector('#task-detail');
const detailClose = document.querySelector('#detail-close');
const detailTitle = document.querySelector('#detail-title');
const detailNote = document.querySelector('#detail-note');
const detailMeta = document.querySelector('#detail-meta');

summaryDate.value = selectedDay;

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const existingIds = new Set(state.todos.map((todo) => todo.id));
  state = addTodo(state, titleInput.value);
  const createdTodo = state.todos.find((todo) => !existingIds.has(todo.id));

  if (!createdTodo) {
    return;
  }

  newlyAddedTodoId = createdTodo.id;
  draftTitle = '';
  titleInput.value = '';
  saveState(state);
  render('Saving');
  titleInput.focus();
  window.setTimeout(() => {
    if (newlyAddedTodoId === createdTodo.id) {
      newlyAddedTodoId = null;
      render();
    }
  }, 700);

  try {
    await persistNewTodo(createdTodo);
    renderRemoteStatus();
  } catch (error) {
    render(`Offline cache: ${error.message}`);
  }
});

titleInput.addEventListener('input', () => {
  draftTitle = titleInput.value.trim();
  render();
  titleInput.focus();
});

todoList.addEventListener('click', async (event) => {
  if (event.target.closest('[data-title-input]')) {
    return;
  }

  const openButton = event.target.closest('[data-open-id]');
  if (openButton) {
    openTask(openButton.dataset.openId);
    return;
  }

  const timerButton = event.target.closest('[data-timer-action]');
  if (timerButton) {
    await handleTimerAction(timerButton.dataset.timerAction, timerButton.dataset.timerId);
    return;
  }

  const button = event.target.closest('[data-complete-id]');
  if (!button) {
    return;
  }

  state = completeTodo(state, button.dataset.completeId);
  const completedTodo = state.todos.find((todo) => todo.id === button.dataset.completeId);
  if (selectedTaskId === button.dataset.completeId) {
    selectedTaskId = null;
  }
  selectedDay = formatDayKey(new Date());
  summaryDate.value = selectedDay;
  saveState(state);
  render('Saving');

  try {
    await persistCompletedTodo(completedTodo);
    renderRemoteStatus();
  } catch (error) {
    render(`Offline cache: ${error.message}`);
  }
});

todoList.addEventListener('dblclick', (event) => {
  const title = event.target.closest('[data-title-id]');
  if (!title) {
    return;
  }

  startTitleEdit(title.dataset.titleId);
});

todoList.addEventListener('keydown', async (event) => {
  const input = event.target.closest('[data-title-input]');
  if (!input) {
    return;
  }

  if (event.key === 'Escape') {
    editingTaskId = null;
    render();
    return;
  }

  if (event.key === 'Enter') {
    event.preventDefault();
    await commitTitleEdit(input.dataset.titleInput, input.value);
  }
});

todoList.addEventListener(
  'focusout',
  async (event) => {
    const input = event.target.closest('[data-title-input]');
    if (!input || editingTaskId !== input.dataset.titleInput) {
      return;
    }

    await commitTitleEdit(input.dataset.titleInput, input.value);
  },
  true,
);

summaryList.addEventListener('click', (event) => {
  const openButton = event.target.closest('[data-open-id]');
  if (!openButton) {
    return;
  }

  openTask(openButton.dataset.openId);
});

summaryList.addEventListener('dragstart', (event) => {
  const row = event.target.closest('[data-summary-id]');
  if (!row) {
    return;
  }

  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', row.dataset.summaryId);
  row.classList.add('is-dragging');
});

summaryList.addEventListener('dragend', (event) => {
  event.target.closest('[data-summary-id]')?.classList.remove('is-dragging');
  clearSummaryDropTargets();
});

summaryList.addEventListener('dragover', (event) => {
  const row = event.target.closest('[data-summary-id]');
  if (row) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    markSummaryDropTarget(row);
  }
});

summaryList.addEventListener('drop', async (event) => {
  const targetRow = event.target.closest('[data-summary-id]');
  const draggedId = event.dataTransfer.getData('text/plain');
  if (!targetRow || !draggedId || targetRow.dataset.summaryId === draggedId) {
    return;
  }

  event.preventDefault();
  clearSummaryDropTargets();
  const summaryIds = getSummaryIdsForSelectedDay();
  const reorderedIds = moveIdBefore(summaryIds, draggedId, targetRow.dataset.summaryId);
  state = reorderCompletedTodosForDay(state, selectedDay, reorderedIds);
  saveState(state);
  render('Saving order');

  try {
    await persistReorderedTodos(reorderedIds);
    renderRemoteStatus();
  } catch (error) {
    render(`Offline cache: ${error.message}`);
  }
});

summaryDate.addEventListener('change', () => {
  selectedDay = summaryDate.value || formatDayKey(new Date());
  render();
});

detailClose.addEventListener('click', closeTask);

detailNote.addEventListener('input', () => {
  if (!selectedTaskId) {
    return;
  }

  state = updateTodoNote(state, selectedTaskId, detailNote.value);
  saveState(state);
  render('Saving note');
  window.clearTimeout(noteSaveTimer);
  noteSaveTimer = window.setTimeout(async () => {
    const todo = findTodo(selectedTaskId);
    try {
      await persistTodoNote(todo);
      renderRemoteStatus();
    } catch (error) {
      render(`Offline cache: ${error.message}`);
    }
  }, 450);
});

render();
hydrateRemoteTodos();

function render(nextSyncMessage = syncMessage) {
  syncMessage = nextSyncMessage;
  const pendingTodos = getPendingTodos(state);
  const summary = getDaySummary(state, selectedDay);
  const completedToday = summary.reduce((total, section) => total + section.items.length, 0);

  openCount.textContent = `${pendingTodos.length} open`;
  doneCount.textContent = `${completedToday} done today`;
  syncStatus.textContent = syncMessage;

  todoList.innerHTML = pendingTodos.length
    ? `${pendingTodos.map(renderTodo).join('')}${renderInsertionCue()}`
    : `${renderInsertionCue()}<li class="empty-state">No open tasks. Add one when the next thing appears.</li>`;

  summaryList.innerHTML = summary.length
    ? summary.map(renderSummarySection).join('')
    : `<div class="empty-summary">
        <strong>No finished tasks for this date.</strong>
        <span>Complete a task and it will land here automatically.</span>
      </div>`;
  renderTaskDetail();
  updateLiveTimers();
  scheduleLiveTimer();
}

function renderTodo(todo) {
  const isRunning = Boolean(todo.activeStartedAt);
  const elapsedSeconds = getElapsedSeconds(todo);
  const timerLabel = formatDuration(elapsedSeconds);
  const timerAction = isRunning ? 'pause' : 'start';
  const timerText = isRunning ? 'Pause' : elapsedSeconds > 0 ? 'Resume' : 'Start';
  const titleMarkup =
    editingTaskId === todo.id
      ? `<input class="task-title-input" data-title-input="${todo.id}" value="${escapeHtml(todo.title)}" aria-label="Edit ${escapeHtml(todo.title)} title" />`
      : `<span class="task-title" data-title-id="${todo.id}" title="Double-click to rename">${linkifyText(todo.title)}</span>`;

  return `
    <li class="todo-item ${isRunning ? 'is-running' : ''} ${newlyAddedTodoId === todo.id ? 'is-new-block' : ''}">
      <span class="task-block-dot" aria-hidden="true"></span>
      <div class="task-content">
        ${titleMarkup}
        <span class="task-duration ${isRunning ? 'is-live' : ''}" data-timer-label="${todo.id}">
          ${isRunning ? 'Tracking' : 'Duration'} ${timerLabel}
        </span>
      </div>
      <div class="task-actions">
        <button type="button" class="timer-button" data-timer-action="${timerAction}" data-timer-id="${todo.id}" aria-label="${timerText} ${escapeHtml(todo.title)} timer">
          ${isRunning ? iconPause() : iconPlay()}
          <span>${timerText}</span>
        </button>
        <button type="button" class="open-task-button" data-open-id="${todo.id}" aria-label="Open ${escapeHtml(todo.title)} details">
          ${iconPage()}
          <span>Open</span>
        </button>
        <button type="button" data-complete-id="${todo.id}" aria-label="Mark ${escapeHtml(todo.title)} done">
          ${iconCheck()}
          <span>Done</span>
        </button>
      </div>
    </li>
  `;
}

function renderInsertionCue() {
  if (!draftTitle) {
    return '';
  }

  return `
    <li class="block-insertion-cue" aria-live="polite">
      <span class="block-insertion-line" aria-hidden="true"></span>
      <span class="block-insertion-label">New block lands here</span>
    </li>
  `;
}

function renderSummarySection(section) {
  return `
    <section class="summary-section" aria-label="${section.label}">
      <h3>${section.label}</h3>
      <ol>
        ${section.items.map(renderSummaryItem).join('')}
      </ol>
    </section>
  `;
}

function renderSummaryItem(item) {
  const time = new Intl.DateTimeFormat([], {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(item.completedAt));

  return `
    <li draggable="true" data-summary-id="${item.id}">
      <time datetime="${item.completedAt}">${time}</time>
      <div class="summary-block">
        <span class="summary-title">${linkifyText(item.title)}</span>
        <span class="summary-duration">${item.durationLabel}</span>
      </div>
      <button type="button" class="open-task-button" data-open-id="${item.id}" aria-label="Open ${escapeHtml(item.title)} details">
        ${iconPage()}
        <span>Open</span>
      </button>
    </li>
  `;
}

function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? createInitialState(JSON.parse(stored).todos ?? []) : createInitialState();
  } catch {
    return createInitialState();
  }
}

function saveState(nextState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
}

async function hydrateRemoteTodos() {
  if (!useRemote) {
    return;
  }

  render('Loading cloud');

  try {
    const cachedTodos = state.todos;
    const remoteTodos = await loadRemoteTodos(insforge, clientId);

    if (remoteTodos.length === 0 && cachedTodos.length > 0) {
      await Promise.all(cachedTodos.map((todo) => insertRemoteTodo(insforge, clientId, todo)));
      renderRemoteStatus(cachedTodos.length);
      return;
    }

    state = createInitialState(remoteTodos);
    saveState(state);
    renderRemoteStatus(remoteTodos.length);
  } catch (error) {
    render(`Offline cache: ${error.message}`);
  }
}

async function persistNewTodo(todo) {
  if (!useRemote) {
    return;
  }

  await insertRemoteTodo(insforge, clientId, todo);
}

async function persistCompletedTodo(todo) {
  if (!useRemote || !todo) {
    return;
  }

  await completeRemoteTodo(insforge, clientId, todo);
}

async function persistTodoNote(todo) {
  if (!useRemote || !todo) {
    return;
  }

  await updateRemoteTodoNote(insforge, clientId, todo);
}

async function persistTodoTitle(todo) {
  if (!useRemote || !todo) {
    return;
  }

  await updateRemoteTodoTitle(insforge, clientId, todo);
}

async function persistTodoTimer(todo) {
  if (!useRemote || !todo) {
    return;
  }

  await updateRemoteTodoTimer(insforge, clientId, todo);
}

async function persistReorderedTodos(orderedIds) {
  if (!useRemote) {
    return;
  }

  const todosToUpdate = orderedIds.map((id) => findTodo(id)).filter(Boolean);
  await Promise.all(todosToUpdate.map((todo) => updateRemoteTodoCompletion(insforge, clientId, todo)));
}

async function handleTimerAction(action, todoId) {
  const beforeTodos = state.todos;
  state = action === 'pause' ? pauseTodoTimer(state, todoId) : startTodoTimer(state, todoId);
  const changedTodos = getTimerChangedTodos(beforeTodos, state.todos);
  saveState(state);
  render('Saving time');

  try {
    await Promise.all(changedTodos.map((todo) => persistTodoTimer(todo)));
    renderRemoteStatus();
  } catch (error) {
    render(`Offline cache: ${error.message}`);
  }
}

function renderRemoteStatus(count = state.todos.length) {
  render(useRemote ? `Cloud synced: ${count}` : 'Local only');
}

function getClientId() {
  const existing = localStorage.getItem(CLIENT_ID_KEY);
  if (existing) {
    return existing;
  }

  const nextClientId = crypto.randomUUID();
  localStorage.setItem(CLIENT_ID_KEY, nextClientId);
  return nextClientId;
}

function openTask(todoId) {
  selectedTaskId = todoId;
  render();
  detailNote.focus();
}

function startTitleEdit(todoId) {
  editingTaskId = todoId;
  render();
  const input = document.querySelector(`[data-title-input="${CSS.escape(todoId)}"]`);
  input?.focus();
  input?.select();
}

async function commitTitleEdit(todoId, title) {
  if (editingTaskId !== todoId) {
    return;
  }

  const before = findTodo(todoId);
  state = updateTodoTitle(state, todoId, title);
  editingTaskId = null;
  saveState(state);
  render('Saving title');
  const after = findTodo(todoId);

  if (!before || !after || before.title === after.title) {
    renderRemoteStatus();
    return;
  }

  try {
    await persistTodoTitle(after);
    renderRemoteStatus();
  } catch (error) {
    render(`Offline cache: ${error.message}`);
  }
}

function closeTask() {
  selectedTaskId = null;
  render();
}

function renderTaskDetail() {
  const todo = findTodo(selectedTaskId);
  const isOpen = Boolean(todo);
  taskDetail.setAttribute('aria-hidden', String(!isOpen));
  taskDetail.classList.toggle('is-open', isOpen);

  if (!todo) {
    detailTitle.textContent = '';
    detailNote.value = '';
    detailMeta.textContent = '';
    return;
  }

  detailTitle.innerHTML = linkifyText(todo.title);
  if (detailNote.value !== (todo.note ?? '')) {
    detailNote.value = todo.note ?? '';
  }
  const durationText = `Duration ${formatDuration(getElapsedSeconds(todo))}`;
  detailMeta.textContent = todo.completedAt
    ? `Completed ${new Intl.DateTimeFormat([], { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(todo.completedAt))}`
    : `Created ${new Intl.DateTimeFormat([], { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(todo.createdAt))}`;
  detailMeta.textContent = `${detailMeta.textContent} · ${durationText}`;
}

function findTodo(todoId) {
  return state.todos.find((todo) => todo.id === todoId);
}

function getSummaryIdsForSelectedDay() {
  return getDaySummary(state, selectedDay).flatMap((section) => section.items.map((item) => item.id));
}

function moveIdBefore(ids, draggedId, targetId) {
  const withoutDragged = ids.filter((id) => id !== draggedId);
  const targetIndex = withoutDragged.indexOf(targetId);
  if (targetIndex === -1) {
    return ids;
  }

  return [...withoutDragged.slice(0, targetIndex), draggedId, ...withoutDragged.slice(targetIndex)];
}

function markSummaryDropTarget(row) {
  if (row.classList.contains('is-drop-target')) {
    return;
  }

  clearSummaryDropTargets();
  row.classList.add('is-drop-target');
}

function clearSummaryDropTargets() {
  for (const row of summaryList.querySelectorAll('.is-drop-target')) {
    row.classList.remove('is-drop-target');
  }
}

function getTimerChangedTodos(beforeTodos, afterTodos) {
  const beforeById = new Map(beforeTodos.map((todo) => [todo.id, todo]));
  return afterTodos.filter((todo) => {
    const before = beforeById.get(todo.id);
    return (
      before &&
      (before.firstStartedAt !== todo.firstStartedAt ||
        before.activeStartedAt !== todo.activeStartedAt ||
        before.trackedSeconds !== todo.trackedSeconds)
    );
  });
}

function scheduleLiveTimer() {
  window.clearInterval(liveTimer);
  if (!state.todos.some((todo) => todo.activeStartedAt && !todo.completedAt)) {
    liveTimer = null;
    return;
  }

  liveTimer = window.setInterval(updateLiveTimers, 1000);
}

function updateLiveTimers() {
  for (const label of document.querySelectorAll('[data-timer-label]')) {
    const todo = findTodo(label.dataset.timerLabel);
    if (!todo) {
      continue;
    }

    const prefix = todo.activeStartedAt ? 'Tracking' : 'Duration';
    label.textContent = `${prefix} ${formatDuration(getElapsedSeconds(todo))}`;
  }

  renderTaskDetail();
}

function iconPage() {
  return `
    <svg class="nucleo-icon" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4.5 2.5h5L12.5 5.5v8h-8z" />
      <path d="M9.5 2.5v3h3" />
      <path d="M6.25 8.25h5" />
      <path d="M6.25 10.75h4" />
    </svg>
  `;
}

function iconCheck() {
  return `
    <svg class="nucleo-icon" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3.25 8.25l3 3 7-7" />
    </svg>
  `;
}

function iconPlay() {
  return `
    <svg class="nucleo-icon" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M5.25 3.25v9.5l8-4.75z" />
    </svg>
  `;
}

function iconPause() {
  return `
    <svg class="nucleo-icon" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M5.25 3.5v9" />
      <path d="M10.75 3.5v9" />
    </svg>
  `;
}
