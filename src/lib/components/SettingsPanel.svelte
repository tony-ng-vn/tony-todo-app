<script>
  export let syncStatus = [];
  export let auditLog = [];
  export let userEmail = '';
  export let inboxCount = 0;
  export let waitingCount = 0;
  export let onViewChange;
  export let showSignOut = false;
  export let onSignOut;

  const SOURCE_LABELS = {
    'granola-personal': 'Granola (personal notes)',
    'granola-workspace': 'Granola (workspace notes)',
  };

  const ACTION_LABELS = {
    loop_created: 'Created a loop',
    draft_generated: 'Drafted a follow-up',
  };

  function formatLastSynced(iso) {
    if (!iso) return 'Never synced yet';
    return `Last synced ${new Intl.DateTimeFormat([], { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))}`;
  }

  function formatLogTime(iso) {
    return new Intl.DateTimeFormat([], { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  }
</script>

<section class="settings-panel" aria-labelledby="settings-heading">
  <div class="panel-heading">
    <div>
      <h2 id="settings-heading">Settings</h2>
      <span class="panel-count">{userEmail}</span>
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
      <button type="button" class="view-toggle-button" on:click={() => onViewChange?.('meetings')}>Meetings</button>
      <button type="button" class="view-toggle-button" on:click={() => onViewChange?.('profile')}>Profile</button>
      <button type="button" class="view-toggle-button is-active" aria-current="page">Settings</button>
    </div>
  </div>

  {#if showSignOut}
    <div class="settings-section">
      <h3 class="section-title">Account</h3>
      <button type="button" class="sign-out-button" on:click={onSignOut}>Sign out</button>
    </div>
  {/if}

  <div class="settings-section">
    <h3 class="section-title">Connected sources</h3>
    {#if syncStatus.length === 0}
      <p class="empty-note">No sources have synced yet. Use "Check for new loops" from the Inbox to run one.</p>
    {:else}
      <ul class="source-list">
        {#each syncStatus as source (source.source)}
          <li class="source-row">
            <span class="source-name">{SOURCE_LABELS[source.source] ?? source.source}</span>
            <span class="source-status">{formatLastSynced(source.lastSyncedAt)}</span>
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  <div class="settings-section">
    <h3 class="section-title">Recent AI activity</h3>
    {#if auditLog.length === 0}
      <p class="empty-note">Nothing logged yet.</p>
    {:else}
      <ul class="audit-list">
        {#each auditLog as entry (entry.id)}
          <li class="audit-row">
            <span class="audit-action">{ACTION_LABELS[entry.actionType] ?? entry.actionType}</span>
            <span class="audit-summary">{entry.summary}</span>
            <span class="audit-time">{formatLogTime(entry.createdAt)}</span>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</section>

<style>
  .settings-panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
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

  .settings-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .section-title {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    color: var(--strong);
  }

  .empty-note {
    margin: 0;
    font-size: 12px;
    color: var(--subtle);
  }

  .source-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .source-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--field-surface);
    font-size: 12px;
  }

  .source-name {
    font-weight: 600;
    color: var(--strong);
  }

  .source-status {
    color: var(--subtle);
  }

  .audit-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .audit-row {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--field-surface);
    font-size: 12px;
  }

  .audit-action {
    flex-shrink: 0;
    font-weight: 600;
    color: var(--strong);
  }

  .audit-summary {
    flex: 1;
    color: var(--default);
  }

  .audit-time {
    flex-shrink: 0;
    color: var(--subtle);
    font-size: 11px;
  }
</style>
