<script>
  export let loops = [];
  export let inboxCount = 0;
  export let waitingCount = 0;
  export let onRestore;
  export let onViewChange;
</script>

<section class="history-panel" aria-labelledby="history-heading">
  <div class="panel-heading">
    <div>
      <h2 id="history-heading">History</h2>
      <span class="panel-count">{loops.length} dismissed</span>
    </div>
    <div class="view-toggle" role="group" aria-label="Workspace view">
      <button type="button" class="view-toggle-button" on:click={() => onViewChange?.('flow')}>Flow</button>
      <button type="button" class="view-toggle-button" on:click={() => onViewChange?.('board')}>Board</button>
      <button type="button" class="view-toggle-button" on:click={() => onViewChange?.('inbox')}>
        Inbox{inboxCount ? ` (${inboxCount})` : ''}
      </button>
      <button type="button" class="view-toggle-button" on:click={() => onViewChange?.('waiting')}>
        Waiting{waitingCount ? ` (${waitingCount})` : ''}
      </button>
      <button type="button" class="view-toggle-button is-active" aria-current="page">History</button>
      <button type="button" class="view-toggle-button" on:click={() => onViewChange?.('meetings')}>Meetings</button>
      <button type="button" class="view-toggle-button" on:click={() => onViewChange?.('settings')}>Settings</button>
    </div>
  </div>
  <p class="panel-note">Loops you dismissed as not-a-task. Restore one if it was a mistake.</p>

  <ol class="loop-list">
    {#each loops as loop (loop.id)}
      <li class="loop-card">
        <div class="loop-card-header">
          {#if loop.priorityLabel}
            <span class="priority-badge" data-priority={loop.priorityLabel}>{loop.priorityLabel}</span>
          {/if}
          <span class="dismissed-at">
            Dismissed {new Intl.DateTimeFormat([], { dateStyle: 'medium' }).format(new Date(loop.updatedAt))}
          </span>
        </div>
        <h3 class="loop-title">{loop.title}</h3>
        <blockquote class="evidence">
          <p>&ldquo;{loop.evidence.excerpt}&rdquo;</p>
          <cite>{loop.evidence.author} &middot; {loop.evidence.sourceApp}</cite>
        </blockquote>
        <div class="loop-actions">
          <button type="button" class="restore-button" on:click={() => onRestore?.(loop.id)}>Restore</button>
        </div>
      </li>
    {:else}
      <li class="empty-state">Nothing dismissed yet.</li>
    {/each}
  </ol>
</section>

<style>
  .history-panel {
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

  .loop-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .loop-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3);
    border: 1px solid var(--border);
    border-radius: 14px;
    background: var(--field-surface);
    opacity: 0.85;
  }

  .loop-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .priority-badge {
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    color: var(--button-fg);
    background: var(--strong);
  }

  .dismissed-at {
    font-size: 11px;
    color: var(--subtle);
  }

  .loop-title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--strong);
    text-decoration: line-through;
    text-decoration-color: var(--border);
  }

  .evidence {
    margin: 0;
    padding: var(--space-2) var(--space-3);
    border-left: 2px solid var(--border);
    font-size: 12px;
    color: var(--default);
  }

  .evidence cite {
    display: block;
    margin-top: 4px;
    font-style: normal;
    color: var(--subtle);
  }

  .loop-actions {
    display: flex;
    gap: var(--space-2);
  }

  .restore-button {
    padding: 6px 12px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: transparent;
    color: var(--default);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }

  .empty-state {
    padding: var(--space-3);
    color: var(--subtle);
    font-size: 12px;
    list-style: none;
  }
</style>
