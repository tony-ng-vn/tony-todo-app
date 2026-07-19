<script>
  import { linkifyText } from '../../linkify.js';

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
</script>

<section class="calendar-panel" aria-labelledby="calendar-heading">
  <div class="panel-heading">
    <div>
      <h2 id="calendar-heading">Calendar</h2>
      <span class="panel-count">Tasks completed each day</span>
    </div>
    <div class="view-toggle" role="group" aria-label="Workspace view">
      <button type="button" class="view-toggle-button" on:click={() => onViewChange?.('flow')}>Tasks</button>
      <button type="button" class="view-toggle-button" on:click={() => onViewChange?.('board')}>Board</button>
      <button type="button" class="view-toggle-button is-active" aria-current="page">Calendar</button>
      <button type="button" class="view-toggle-button" on:click={() => onViewChange?.('inbox')}>
        Inbox{inboxCount ? ` (${inboxCount})` : ''}
      </button>
      <button type="button" class="view-toggle-button" on:click={() => onViewChange?.('waiting')}>
        Waiting{waitingCount ? ` (${waitingCount})` : ''}
      </button>
      <button type="button" class="view-toggle-button" on:click={() => onViewChange?.('history')}>History</button>
      <button type="button" class="view-toggle-button" on:click={() => onViewChange?.('meetings')}>Meetings</button>
      <button type="button" class="view-toggle-button" on:click={() => onViewChange?.('settings')}>Settings</button>
    </div>
  </div>

  <div class="calendar-controls">
    <div class="calendar-nav">
      <button type="button" class="calendar-nav-button" on:click={onPrevMonth} aria-label="Previous month">&lsaquo;</button>
      <h3 class="calendar-month" aria-live="polite">{monthLabel}</h3>
      <button type="button" class="calendar-nav-button" on:click={onNextMonth} aria-label="Next month">&rsaquo;</button>
    </div>
    <button type="button" class="calendar-today-button" on:click={onToday}>Today</button>
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
            class:has-items={cell.items.length > 0}
            role="gridcell"
          >
            <span class="calendar-day-number">{cell.day}</span>
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
</section>

<style>
  .calendar-panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-5);
    border: 1px solid var(--border);
    border-radius: 20px;
    background: var(--surface);
    backdrop-filter: blur(24px) saturate(1.12);
    -webkit-backdrop-filter: blur(24px) saturate(1.12);
    min-height: 0;
    flex: 1 1 auto;
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
    display: flex;
    align-items: center;
    justify-content: space-between;
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
    align-self: flex-start;
    min-width: 22px;
    padding: 1px 6px;
    border-radius: 999px;
    color: var(--default);
    font-size: 12px;
    font-weight: 600;
    text-align: center;
  }

  .calendar-cell.is-today .calendar-day-number {
    background: var(--strong);
    color: var(--button-fg);
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
</style>
