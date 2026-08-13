<script>
  import { formatDuration, getElapsedSeconds } from '../../todoStore.js';
  import { iconCheck, iconMoon, iconPage, iconSun } from './icons.js';
  import WorkspaceTabs from './WorkspaceTabs.svelte';

  export let syncMessage = 'Local only';
  export let groups = [];
  export let themeMode = 'light';
  export let inboxCount = 0;
  export let waitingCount = 0;
  export let onComplete;
  export let onOpenTask;
  export let onToggleTheme;
  export let onViewChange;
  export let showSignOut = false;
  export let onSignOut;

  $: overdueCount = groups
    .filter((group) => group.relation === 'overdue')
    .reduce((total, group) => total + group.items.length, 0);
  $: todayCount = groups
    .filter((group) => group.relation === 'today')
    .reduce((total, group) => total + group.items.length, 0);
  $: upcomingCount = groups
    .filter((group) => group.relation === 'tomorrow' || group.relation === 'upcoming')
    .reduce((total, group) => total + group.items.length, 0);
  $: totalCount = groups.reduce((total, group) => total + group.items.length, 0);

  function parseDayKey(dayKey) {
    if (!dayKey) {
      return null;
    }

    const date = new Date(`${dayKey}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function stationTitle(group) {
    if (group.relation === 'today') return 'Today';
    if (group.relation === 'tomorrow') return 'Tomorrow';
    if (group.relation === 'unscheduled') return 'Anytime';

    const date = parseDayKey(group.dateKey);
    return date ? new Intl.DateTimeFormat([], { weekday: 'long' }).format(date) : 'No date';
  }

  function stationDate(group) {
    const date = parseDayKey(group.dateKey);
    if (!date) return 'No due date';

    return new Intl.DateTimeFormat([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  }

  function stationKicker(group) {
    if (group.relation === 'today') return 'Due today';
    if (group.relation === 'tomorrow') return 'Next up';
    if (group.relation === 'unscheduled') return 'Needs a date';
    if (group.relation === 'overdue') {
      const days = Math.abs(group.daysFromToday);
      return `${days} ${days === 1 ? 'day' : 'days'} overdue`;
    }
    return `Due in ${group.daysFromToday} days`;
  }

  function statusLabel(status) {
    if (status === 'running') return 'In motion';
    if (status === 'paused') return 'Paused';
    return 'Ready';
  }
</script>

<section class="agenda-panel" aria-labelledby="agenda-heading">
  <header class="agenda-header">
    <div class="agenda-brand">
      <p class="eyebrow">Due date runway</p>
      <h1 id="agenda-heading">Agenda</h1>
      <p class="panel-note">See what is due, where the pressure is, and clear a task in one tap.</p>
    </div>

    <div class="agenda-header-actions">
      <output class="sync-status" aria-live="polite">{syncMessage}</output>
      <button
        type="button"
        class="theme-toggle"
        on:click={onToggleTheme}
        aria-label={`Switch to ${themeMode === 'dark' ? 'light' : 'dark'} mode`}
      >
        {@html themeMode === 'dark' ? iconSun() : iconMoon()}
        <span>{themeMode === 'dark' ? 'Light' : 'Dark'}</span>
      </button>
      {#if showSignOut}
        <button type="button" class="sign-out-button" on:click={onSignOut}>Sign out</button>
      {/if}
    </div>
  </header>

  <WorkspaceTabs
    currentView="agenda"
    {inboxCount}
    {waitingCount}
    {onViewChange}
  />

  <div class="agenda-overview" aria-label="Agenda task counts">
    <div class="agenda-stat is-overdue">
      <span class="agenda-stat-value">{overdueCount}</span>
      <span class="agenda-stat-label">Overdue</span>
    </div>
    <div class="agenda-stat is-today">
      <span class="agenda-stat-value">{todayCount}</span>
      <span class="agenda-stat-label">Due today</span>
    </div>
    <div class="agenda-stat is-upcoming">
      <span class="agenda-stat-value">{upcomingCount}</span>
      <span class="agenda-stat-label">Coming up</span>
    </div>
    <p class="agenda-overview-note">{totalCount} open {totalCount === 1 ? 'task' : 'tasks'} across {groups.length} {groups.length === 1 ? 'date' : 'dates'}</p>
  </div>

  {#if groups.length}
    <div class="agenda-runway">
      {#each groups as group (group.id)}
        <section
          class="agenda-station"
          class:is-overdue={group.relation === 'overdue'}
          class:is-today={group.relation === 'today'}
          class:is-tomorrow={group.relation === 'tomorrow'}
          class:is-unscheduled={group.relation === 'unscheduled'}
          data-agenda-group={group.id}
          aria-labelledby={`agenda-date-${group.id}`}
        >
          <header class="agenda-date-block">
            <span class="agenda-station-marker" aria-hidden="true"></span>
            <p class="agenda-date-kicker">{stationKicker(group)}</p>
            <h2 id={`agenda-date-${group.id}`}>{stationTitle(group)}</h2>
            <p class="agenda-date-full">{stationDate(group)}</p>
            <span class="agenda-date-count">{group.items.length} {group.items.length === 1 ? 'task' : 'tasks'}</span>
          </header>

          <div class="agenda-card-grid" role="list">
            {#each group.items as todo (todo.id)}
              <article
                class="agenda-card"
                class:is-running={todo.status === 'running'}
                class:is-paused={todo.status === 'paused'}
                data-agenda-todo-id={todo.id}
                role="listitem"
              >
                <div class="agenda-card-main">
                  <div class="agenda-card-status" data-status={todo.status}>
                    <span aria-hidden="true"></span>
                    {statusLabel(todo.status)}
                  </div>
                  <h3>{todo.title}</h3>
                  {#if todo.progressLabel}
                    <p class="agenda-card-progress">{todo.progressLabel}</p>
                  {/if}
                  {#if todo.status !== 'ready' || getElapsedSeconds(todo) > 0}
                    <p class="agenda-card-duration">
                      {todo.status === 'running' ? 'Tracking' : 'Logged'} {formatDuration(getElapsedSeconds(todo))}
                    </p>
                  {/if}
                  <button type="button" class="agenda-open-task" on:click={() => onOpenTask?.(todo.id)}>
                    {@html iconPage()}
                    <span>Details</span>
                  </button>
                </div>

                <button
                  type="button"
                  class="agenda-complete-task"
                  role="checkbox"
                  aria-checked="false"
                  aria-label={`Mark ${todo.title} done`}
                  on:click={() => onComplete?.(todo.id)}
                >
                  <span class="agenda-complete-ring" aria-hidden="true">{@html iconCheck()}</span>
                  <span class="agenda-complete-label">Done</span>
                </button>
              </article>
            {/each}
          </div>
        </section>
      {/each}
    </div>
  {:else}
    <div class="agenda-empty">
      <span class="agenda-empty-mark" aria-hidden="true">0</span>
      <div>
        <h2>Your runway is clear</h2>
        <p>Add a task from Tasks when something new lands.</p>
      </div>
    </div>
  {/if}
</section>
