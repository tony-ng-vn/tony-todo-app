<script>
  export let userEmail = '';
  export let userId = '';
  export let syncMessage = 'Local only';
  export let inboxCount = 0;
  export let waitingCount = 0;
  export let onViewChange;
  export let showSignOut = false;
  export let onSignOut;
</script>

<section class="profile-panel" aria-labelledby="profile-heading">
  <div class="panel-heading">
    <div>
      <h2 id="profile-heading">Profile</h2>
      <span class="panel-count">Who this device is signed in as</span>
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
      <button type="button" class="view-toggle-button is-active" aria-current="page">Profile</button>
      <button type="button" class="view-toggle-button" on:click={() => onViewChange?.('settings')}>Settings</button>
    </div>
  </div>

  <div class="account-card">
    <span class="account-label">Signed in as</span>
    {#if userEmail}
      <p class="account-email">{userEmail}</p>
    {:else}
      <p class="account-email is-empty">Not signed in</p>
    {/if}

    <dl class="account-facts">
      <div class="account-fact">
        <dt>Account ID</dt>
        <dd class="account-id">{userId || 'None on this device'}</dd>
      </div>
      <div class="account-fact">
        <dt>Sync status</dt>
        <dd>{syncMessage}</dd>
      </div>
    </dl>

    <p class="account-hint">
      If your iPhone and computer show different tasks, check that this email and Account ID match on both devices.
    </p>

    {#if showSignOut}
      <button type="button" class="sign-out-button" on:click={onSignOut}>Sign out</button>
    {/if}
  </div>
</section>

<style>
  .profile-panel {
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

  .account-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4);
    border: 1px solid var(--border);
    border-radius: 16px;
    background: var(--field-surface);
  }

  .account-label {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: var(--subtle);
  }

  .account-email {
    margin: 0;
    font-size: 22px;
    font-weight: 600;
    color: var(--strong);
    word-break: break-word;
  }

  .account-email.is-empty {
    color: var(--subtle);
    font-weight: 500;
  }

  .account-facts {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin: 0;
  }

  .account-fact {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-2) 0;
    border-top: 1px solid var(--border);
  }

  .account-fact dt {
    font-size: 13px;
    color: var(--subtle);
  }

  .account-fact dd {
    margin: 0;
    font-size: 13px;
    color: var(--default);
    text-align: right;
    word-break: break-word;
  }

  .account-id {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px;
  }

  .account-hint {
    margin: 0;
    font-size: 12px;
    line-height: 1.5;
    color: var(--subtle);
  }

  .account-card .sign-out-button {
    align-self: flex-start;
  }
</style>
