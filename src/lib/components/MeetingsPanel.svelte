<script>
  export let meetings = [];
  export let inboxCount = 0;
  export let waitingCount = 0;
  export let onViewChange;

  const STATUS_LABELS = {
    inbox: 'Awaiting review',
    accepted: 'Accepted',
    dismissed: 'Dismissed',
  };
</script>

<section class="meetings-panel" aria-labelledby="meetings-heading">
  <div class="panel-heading">
    <div>
      <h2 id="meetings-heading">Meetings</h2>
      <span class="panel-count">{meetings.length} with loops</span>
    </div>
    <div class="view-toggle" role="group" aria-label="Workspace view">
      <button type="button" class="view-toggle-button" on:click={() => onViewChange?.('flow')}>Tasks</button>
      <button type="button" class="view-toggle-button" on:click={() => onViewChange?.('board')}>Board</button>
      <button type="button" class="view-toggle-button" on:click={() => onViewChange?.('calendar')}>Calendar</button>
      <button type="button" class="view-toggle-button" on:click={() => onViewChange?.('inbox')}>
        Inbox{inboxCount ? ` (${inboxCount})` : ''}
      </button>
      <button type="button" class="view-toggle-button" on:click={() => onViewChange?.('waiting')}>
        Waiting{waitingCount ? ` (${waitingCount})` : ''}
      </button>
      <button type="button" class="view-toggle-button" on:click={() => onViewChange?.('history')}>History</button>
      <button type="button" class="view-toggle-button is-active" aria-current="page">Meetings</button>
      <button type="button" class="view-toggle-button" on:click={() => onViewChange?.('settings')}>Settings</button>
    </div>
  </div>
  <p class="panel-note">Loops grouped by the meeting they were extracted from.</p>

  <ol class="meeting-list">
    {#each meetings as meeting (meeting.sourceObjectId)}
      <li class="meeting-card">
        <div class="meeting-header">
          <h3 class="meeting-title">{meeting.title ?? 'Untitled meeting'}</h3>
          <span class="meeting-date">
            {new Intl.DateTimeFormat([], { dateStyle: 'medium' }).format(new Date(meeting.occurredAt))}
          </span>
        </div>
        <ul class="meeting-loops">
          {#each meeting.loops as loop (loop.id)}
            <li class="meeting-loop-row">
              <span class="loop-status" data-status={loop.loopStatus}>{STATUS_LABELS[loop.loopStatus] ?? loop.loopStatus}</span>
              <span class="loop-title">{loop.title}</span>
              {#if loop.priorityLabel}
                <span class="priority-badge" data-priority={loop.priorityLabel}>{loop.priorityLabel}</span>
              {/if}
            </li>
          {/each}
        </ul>
      </li>
    {:else}
      <li class="empty-state">No meetings with detected loops yet.</li>
    {/each}
  </ol>
</section>

<style>
  .meetings-panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-5);
    border: 1px solid var(--border);
    border-radius: 20px;
    background: var(--surface);
    backdrop-filter: blur(24px) saturate(1.12);
    -webkit-backdrop-filter: blur(24px) saturate(1.12);
  }

  .panel-heading {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
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

  .panel-note {
    margin: 0;
    font-size: 12px;
    color: var(--subtle);
  }

  .meeting-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .meeting-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3);
    border: 1px solid var(--border);
    border-radius: 14px;
    background: var(--field-surface);
  }

  .meeting-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .meeting-title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--strong);
  }

  .meeting-date {
    font-size: 11px;
    color: var(--subtle);
    white-space: nowrap;
  }

  .meeting-loops {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .meeting-loop-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1) 0;
    font-size: 12px;
    color: var(--default);
  }

  .loop-status {
    flex-shrink: 0;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 600;
    background: var(--surface-strong);
    color: var(--subtle);
  }

  .loop-status[data-status='accepted'] {
    color: var(--board-done);
  }

  .loop-status[data-status='inbox'] {
    color: var(--board-in-progress);
  }

  .loop-title {
    flex: 1;
  }

  .priority-badge {
    flex-shrink: 0;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 700;
    color: var(--button-fg);
    background: var(--strong);
  }

  .empty-state {
    padding: var(--space-3);
    color: var(--subtle);
    font-size: 12px;
    list-style: none;
  }
</style>
