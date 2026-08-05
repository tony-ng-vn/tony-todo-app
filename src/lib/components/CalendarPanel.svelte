<script>
  import { linkifyText } from '../../linkify.js';
  import { formatDuration, getElapsedSeconds } from '../../todoStore.js';
  import WorkspaceTabs from './WorkspaceTabs.svelte';

  export let monthLabel = '';
  export let weeks = [];
  export let inboxCount = 0;
  export let waitingCount = 0;
  export let onViewChange;
  export let onPrevMonth;
  export let onNextMonth;
  export let onToday;
  export let onOpenTask;

  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  // Keep day cells readable: show a few tasks, then a "+N more" hint.
  const MAX_VISIBLE = 3;
  let selectedDateKey = null;
  let isDayPanelOpen = false;

  $: selectedCell = selectedDateKey
    ? weeks.flat().find((cell) => cell.dateKey === selectedDateKey) ?? null
    : null;
  $: selectedItems = selectedCell
    ? [...selectedCell.items].sort(
        (first, second) =>
          new Date(first.completedAt).getTime() - new Date(second.completedAt).getTime(),
      )
    : [];
  $: selectedDayLabel = selectedCell ? formatDayLabel(selectedCell.dateKey) : '';
  $: focusedSeconds = selectedItems.reduce(
    (total, todo) => total + getElapsedSeconds(todo),
    0,
  );
  $: selectedDaySummary = `${formatTaskCount(selectedItems.length)} - ${formatDuration(
    focusedSeconds,
  )} focused`;

  function openDay(cell) {
    selectedDateKey = cell.dateKey;
    isDayPanelOpen = true;
  }

  function closeDayPanel() {
    isDayPanelOpen = false;
  }

  function handleDayKeydown(event, cell) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openDay(cell);
    }
  }

  function handleGlobalKeydown(event) {
    if (event.key === 'Escape' && isDayPanelOpen) {
      closeDayPanel();
    }
  }

  function navigateCalendar(callback) {
    closeDayPanel();
    selectedDateKey = null;
    callback?.();
  }

  function parseDayKey(dateKey) {
    const [year, month, day] = dateKey.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  function formatDayLabel(dateKey) {
    return new Intl.DateTimeFormat([], {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }).format(parseDayKey(dateKey));
  }

  function formatCompletionTime(completedAt) {
    const date = new Date(completedAt);
    if (Number.isNaN(date.getTime())) {
      return 'Time unavailable';
    }

    return new Intl.DateTimeFormat([], {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  }

  function formatTaskCount(count) {
    return `${count} ${count === 1 ? 'task' : 'tasks'}`;
  }
</script>

<svelte:window on:keydown={handleGlobalKeydown} />

<section
  class="calendar-panel"
  class:is-day-panel-open={isDayPanelOpen && selectedCell}
  aria-labelledby="calendar-heading"
>
  <div class="panel-heading">
    <div>
      <h2 id="calendar-heading">Calendar</h2>
      <span class="panel-count">Tasks completed each day</span>
    </div>
    <WorkspaceTabs currentView="calendar" {inboxCount} {waitingCount} {onViewChange} />
  </div>

  <div class="calendar-controls">
    <div class="calendar-nav">
      <button
        type="button"
        class="calendar-nav-button"
        on:click={() => navigateCalendar(onPrevMonth)}
        aria-label="Previous month"
      >&lsaquo;</button>
      <h3 class="calendar-month" aria-live="polite">{monthLabel}</h3>
      <button
        type="button"
        class="calendar-nav-button"
        on:click={() => navigateCalendar(onNextMonth)}
        aria-label="Next month"
      >&rsaquo;</button>
    </div>
    <span class="calendar-day-hint">Double-click a date number to open that day</span>
    <button
      type="button"
      class="calendar-today-button"
      on:click={() => navigateCalendar(onToday)}
    >Today</button>
  </div>

  <div class="calendar-grid" role="grid" aria-label={`Tasks completed in ${monthLabel}`}>
    <div class="calendar-weekdays" role="row">
      {#each WEEKDAYS as weekday}
        <span class="calendar-weekday" role="columnheader">{weekday}</span>
      {/each}
    </div>
    {#each weeks as week}
      <div class="calendar-week" role="row">
        {#each week as cell (cell.dateKey)}
          <div
            class="calendar-cell"
            class:is-outside={!cell.inMonth}
            class:is-today={cell.isToday}
            class:is-selected={cell.dateKey === selectedDateKey}
            class:has-items={cell.items.length > 0}
            data-calendar-date={cell.dateKey}
            role="gridcell"
          >
            <button
              type="button"
              class="calendar-day-number"
              aria-label={`${formatDayLabel(cell.dateKey)}. Double-click to view completed tasks`}
              aria-pressed={cell.dateKey === selectedDateKey}
              on:dblclick={() => openDay(cell)}
              on:keydown={(event) => handleDayKeydown(event, cell)}
            >{cell.day}</button>
            <ul class="calendar-cell-tasks">
              {#each cell.items.slice(0, MAX_VISIBLE) as todo (todo.id)}
                <li>
                  <button
                    type="button"
                    class="calendar-task"
                    title={todo.title}
                    on:click={() => onOpenTask?.(todo.id)}
                  >
                    {@html linkifyText(todo.title)}
                  </button>
                </li>
              {/each}
              {#if cell.items.length > MAX_VISIBLE}
                <li class="calendar-more">+{cell.items.length - MAX_VISIBLE} more</li>
              {/if}
            </ul>
          </div>
        {/each}
      </div>
    {/each}
  </div>

  {#if isDayPanelOpen && selectedCell}
    <aside class="calendar-day-panel" aria-labelledby="calendar-day-panel-heading">
      <header class="calendar-day-panel-header">
        <div>
          <p class="calendar-day-kicker">Completed that day</p>
          <h2 id="calendar-day-panel-heading">{selectedDayLabel}</h2>
          <p class="calendar-day-panel-summary">{selectedDaySummary}</p>
        </div>
        <button
          type="button"
          class="calendar-day-panel-close"
          aria-label="Close daily timeline"
          on:click={closeDayPanel}
        >x</button>
      </header>

      <div class="calendar-day-panel-body">
        {#if selectedItems.length}
          <p class="calendar-day-joined-summary">{selectedDaySummary}</p>
          <div class="calendar-day-joined-cluster">
            {#each selectedItems as todo, index (todo.id)}
              <button
                type="button"
                class="calendar-day-task"
                class:is-clay={index % 2 === 1}
                on:click={() => onOpenTask?.(todo.id)}
              >
                <span class="calendar-day-task-index">{index + 1}</span>
                <span class="calendar-day-task-time">{formatCompletionTime(todo.completedAt)}</span>
                <span class="calendar-day-task-title">{todo.title}</span>
                <span class="calendar-day-task-duration">Focused for {formatDuration(getElapsedSeconds(todo))}</span>
              </button>
            {/each}
          </div>
        {:else}
          <div class="calendar-day-empty">
            <strong>0</strong>
            <h3>Nothing completed</h3>
            <p>A quiet day. Double-click another date whenever you want to look back.</p>
          </div>
        {/if}
      </div>
    </aside>
  {/if}
</section>

<style>
  .calendar-panel {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto auto minmax(0, 1fr);
    gap: var(--space-3);
    padding: var(--space-5);
    border: 1px solid var(--border);
    border-radius: 20px;
    background: var(--surface);
    backdrop-filter: blur(24px) saturate(1.12);
    -webkit-backdrop-filter: blur(24px) saturate(1.12);
    min-height: 0;
    flex: 1 1 auto;
    overflow: hidden;
    transition: grid-template-columns 220ms ease;
  }

  .calendar-panel.is-day-panel-open {
    grid-template-columns: minmax(0, 1fr) clamp(320px, 32vw, 420px);
  }

  .panel-heading {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .panel-heading h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--strong);
  }

  .panel-count {
    font-size: 12px;
    color: var(--subtle);
  }

  .calendar-controls {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: var(--space-3);
  }

  .calendar-nav {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .calendar-nav-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: transparent;
    color: var(--strong);
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
  }

  .calendar-nav-button:hover {
    border-color: var(--subtle);
  }

  .calendar-month {
    margin: 0;
    min-width: 9ch;
    text-align: center;
    font-size: 15px;
    font-weight: 600;
    color: var(--strong);
  }

  .calendar-today-button {
    justify-self: end;
    padding: 6px 14px;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: transparent;
    color: var(--default);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
  }

  .calendar-today-button:hover {
    border-color: var(--subtle);
    color: var(--strong);
  }

  .calendar-day-hint {
    color: var(--subtle);
    font-size: 10px;
    text-align: center;
  }

  .calendar-grid {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-height: 0;
    border: 1px solid var(--border);
    border-radius: 14px;
    overflow: hidden;
  }

  .calendar-weekdays,
  .calendar-week {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
  }

  .calendar-weekdays {
    border-bottom: 1px solid var(--border);
    background: var(--empty-surface);
  }

  .calendar-weekday {
    padding: 6px 8px;
    color: var(--subtle);
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    text-align: left;
  }

  .calendar-week {
    flex: 1 1 0;
    min-height: 0;
  }

  .calendar-week:not(:last-child) {
    border-bottom: 1px solid var(--border);
  }

  .calendar-cell {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-height: 84px;
    min-width: 0;
    padding: 6px;
    overflow: hidden;
  }

  .calendar-cell:not(:last-child) {
    border-right: 1px solid var(--border);
  }

  .calendar-cell.is-outside {
    background: var(--empty-surface);
    opacity: 0.55;
  }

  .calendar-day-number {
    display: grid;
    width: 24px;
    height: 24px;
    place-items: center;
    align-self: flex-start;
    padding: 0;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: var(--default);
    font-size: 11px;
    font-weight: 600;
    text-align: center;
    transition:
      background-color 160ms ease,
      color 160ms ease,
      transform 160ms ease;
  }

  .calendar-day-number:hover {
    background: rgba(120, 145, 124, 0.14);
    color: var(--strong);
  }

  .calendar-cell.is-today .calendar-day-number {
    background: var(--strong);
    color: var(--button-fg);
  }

  .calendar-cell.is-selected .calendar-day-number {
    background-color: var(--strong);
    color: var(--button-fg);
    transform: scale(1.03);
  }

  .calendar-cell-tasks {
    display: flex;
    flex-direction: column;
    gap: 3px;
    margin: 0;
    padding: 0;
    list-style: none;
    overflow: hidden;
  }

  .calendar-task {
    display: block;
    width: 100%;
    max-width: 100%;
    padding: 2px 6px;
    border: 0;
    border-radius: 6px;
    background: var(--block-surface, var(--empty-surface));
    color: var(--strong);
    font-size: 11px;
    font-weight: 500;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: pointer;
  }

  .calendar-task:hover {
    background: var(--bg-selected);
  }

  .calendar-more {
    padding: 0 6px;
    color: var(--subtle);
    font-size: 10px;
    font-weight: 500;
  }

  .calendar-day-panel {
    grid-column: 2;
    grid-row: 1 / 4;
    min-width: 0;
    margin: calc(var(--space-5) * -1) calc(var(--space-5) * -1) calc(var(--space-5) * -1) 0;
    overflow: hidden;
    border-left: 1px solid rgba(58, 54, 47, 0.12);
    background: #f7f3ea;
    color: #302f2b;
    box-shadow: -18px 0 52px rgba(65, 57, 46, 0.08);
    animation: calendar-day-panel-enter 220ms ease both;
  }

  .calendar-day-panel-header {
    display: flex;
    min-height: 112px;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding: 24px 22px 19px;
    border-bottom: 1px solid rgba(58, 54, 47, 0.12);
    background: #fffdf8;
  }

  .calendar-day-kicker {
    margin: 0;
    color: #99958b;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.13em;
    text-transform: uppercase;
  }

  .calendar-day-panel-header h2 {
    margin: 5px 0 3px;
    color: #302f2b;
    font-size: 20px;
    font-weight: 590;
    letter-spacing: -0.035em;
  }

  .calendar-day-panel-summary {
    margin: 0;
    color: #99958b;
    font-size: 10px;
  }

  .calendar-day-panel-close {
    display: grid;
    width: 31px;
    height: 31px;
    flex: 0 0 auto;
    place-items: center;
    border: 1px solid rgba(58, 54, 47, 0.12);
    border-radius: 9px;
    background: transparent;
    color: #69665f;
  }

  .calendar-day-panel-close:hover {
    background: rgba(120, 145, 124, 0.1);
    color: #302f2b;
  }

  .calendar-day-number:focus-visible,
  .calendar-day-panel-close:focus-visible,
  .calendar-day-task:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: -2px;
  }

  .calendar-day-panel-body {
    height: calc(100% - 112px);
    padding: 20px;
    overflow: auto;
    scrollbar-width: none;
  }

  .calendar-day-joined-summary {
    margin: 0 0 13px;
    color: #69665f;
    font-size: 10px;
    text-align: center;
  }

  .calendar-day-joined-cluster {
    overflow: hidden;
    border: 1px solid rgba(86, 77, 63, 0.1);
    border-radius: 24px;
    background: #fffdf8;
    box-shadow: 0 10px 28px rgba(86, 77, 63, 0.07);
  }

  .calendar-day-task {
    position: relative;
    display: block;
    width: 100%;
    min-height: 104px;
    padding: 21px 19px 21px 53px;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: #302f2b;
    text-align: left;
  }

  .calendar-day-task + .calendar-day-task {
    border-top: 1px solid rgba(58, 54, 47, 0.12);
  }

  .calendar-day-task:hover {
    background: rgba(120, 145, 124, 0.055);
  }

  .calendar-day-task-index {
    position: absolute;
    top: 19px;
    left: 18px;
    display: grid;
    width: 23px;
    height: 23px;
    place-items: center;
    border-radius: 999px;
    background: #eaf1e9;
    color: #78917c;
    font-size: 9px;
    font-weight: 700;
  }

  .calendar-day-task.is-clay .calendar-day-task-index {
    background: #f4e9e2;
    color: #b78369;
  }

  .calendar-day-task-time {
    display: flex;
    align-items: center;
    gap: 7px;
    color: #78917c;
    font-size: 9px;
    font-weight: 700;
  }

  .calendar-day-task-time::before {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: currentColor;
    content: '';
  }

  .calendar-day-task.is-clay .calendar-day-task-time {
    color: #b78369;
  }

  .calendar-day-task-title {
    display: block;
    margin: 12px 0 6px;
    font-size: 13px;
    font-weight: 580;
  }

  .calendar-day-task-duration {
    display: block;
    color: #99958b;
    font-size: 9px;
  }

  .calendar-day-empty {
    display: grid;
    min-height: 100%;
    place-content: center;
    justify-items: center;
    padding: 30px;
    text-align: center;
  }

  .calendar-day-empty strong {
    display: grid;
    width: 42px;
    height: 42px;
    place-items: center;
    border-radius: 999px;
    background: #eaf1e9;
    color: #78917c;
    font-size: 14px;
  }

  .calendar-day-empty h3 {
    margin: 16px 0 6px;
    font-size: 15px;
    font-weight: 590;
  }

  .calendar-day-empty p {
    max-width: 28ch;
    margin: 0;
    color: #99958b;
    font-size: 10px;
  }

  @keyframes calendar-day-panel-enter {
    from {
      opacity: 0;
      transform: translateX(24px);
    }
  }

  @media (max-width: 900px) {
    .calendar-panel.is-day-panel-open {
      grid-template-columns: minmax(0, 1fr);
    }

    .calendar-day-panel {
      position: absolute;
      inset: 0 0 0 auto;
      z-index: 20;
      width: min(92%, 420px);
      margin: 0;
    }

    .calendar-day-hint {
      display: none;
    }

    .calendar-controls {
      grid-template-columns: 1fr auto;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .calendar-panel,
    .calendar-day-number,
    .calendar-day-panel {
      transition: none;
      animation: none;
    }
  }
</style>
