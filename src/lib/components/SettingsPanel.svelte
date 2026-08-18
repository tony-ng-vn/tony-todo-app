<script>
  import { onMount } from 'svelte';
  import WorkspaceTabs from './WorkspaceTabs.svelte';
  import {
    AGENT_KEY_NAME_MAX,
    buildAgentSetupPrompt,
    createAgentToken,
    normalizeAgentKeyName,
  } from '../../agentSetup.js';
  import { deleteAgentToken, loadAgentToken, saveAgentToken } from '../../agentTokenRemote.js';

  export let syncStatus = [];
  export let auditLog = [];
  export let userEmail = '';
  export let inboxCount = 0;
  export let waitingCount = 0;
  export let onViewChange;
  export let showSignOut = false;
  export let onSignOut;
  export let showNativeUpdate = false;
  export let onCheckForUpdates;
  export let insforge = null;
  export let userId = null;

  let agentRecord = null;
  let agentTokenError = '';
  let agentBusy = false;
  let agentPane = 'list';
  let agentNameDraft = '';
  let revealedToken = null;
  let copiedKey = false;
  let copyTimer = null;

  onMount(() => {
    void refreshAgentToken();
    return () => {
      if (copyTimer) clearTimeout(copyTimer);
    };
  });

  async function refreshAgentToken() {
    if (!insforge || !userId) {
      agentRecord = null;
      return;
    }
    agentTokenError = '';
    try {
      agentRecord = await loadAgentToken(insforge, userId);
    } catch (error) {
      agentTokenError = error.message ?? 'Could not load the agent key.';
    }
  }

  function startCreateAgentKey() {
    if (agentBusy) return;
    agentTokenError = '';
    agentNameDraft = '';
    revealedToken = null;
    agentPane = 'name';
  }

  function startReplaceAgentKey() {
    if (agentBusy || !agentRecord) return;
    if (!window.confirm('Replace this key? Agents using it will stop working until they get the new one.')) {
      return;
    }
    agentTokenError = '';
    agentNameDraft = agentRecord.name;
    revealedToken = null;
    agentPane = 'name';
  }

  function cancelAgentName() {
    if (agentBusy) return;
    agentPane = 'list';
    agentNameDraft = '';
    agentTokenError = '';
  }

  async function submitAgentName() {
    if (!insforge || !userId || agentBusy) return;
    let name;
    try {
      name = normalizeAgentKeyName(agentNameDraft);
    } catch (error) {
      agentTokenError = error.message ?? 'Name the key so you can tell it apart later.';
      return;
    }

    agentBusy = true;
    agentTokenError = '';
    try {
      const token = createAgentToken();
      agentRecord = await saveAgentToken(insforge, userId, { token, name });
      revealedToken = token;
      agentPane = 'save';
      agentNameDraft = '';
    } catch (error) {
      agentTokenError = error.message ?? 'Could not create an agent key.';
    } finally {
      agentBusy = false;
    }
  }

  function closeSavedAgentKey() {
    revealedToken = null;
    agentPane = 'list';
  }

  async function removeAgentKey() {
    if (!insforge || !userId || agentBusy || !agentRecord) return;
    if (!window.confirm('Remove this key? Agents using it will no longer be able to reach Daymark.')) {
      return;
    }
    agentBusy = true;
    agentTokenError = '';
    try {
      await deleteAgentToken(insforge, userId);
      agentRecord = null;
      revealedToken = null;
      agentPane = 'list';
    } catch (error) {
      agentTokenError = error.message ?? 'Could not remove the agent key.';
    } finally {
      agentBusy = false;
    }
  }

  async function copyAgentKey() {
    const token = revealedToken;
    if (!token) return;
    try {
      await navigator.clipboard.writeText(buildAgentSetupPrompt({ token }));
      copiedKey = true;
      if (copyTimer) clearTimeout(copyTimer);
      copyTimer = setTimeout(() => {
        copiedKey = false;
      }, 2000);
    } catch {
      agentTokenError = 'Could not copy. Select the key and copy it manually.';
    }
  }

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
    <WorkspaceTabs currentView="settings" {inboxCount} {waitingCount} {onViewChange} />
  </div>

  {#if showNativeUpdate}
    <div class="settings-section">
      <h3 class="section-title">Desktop app</h3>
      <p class="empty-note">Daymark checks for signed releases automatically. You can also check now.</p>
      <button type="button" class="settings-update-button" on:click={onCheckForUpdates}>
        Check for Updates
      </button>
    </div>
  {/if}

  {#if showSignOut}
    <div class="settings-section">
      <h3 class="section-title">Account</h3>
      <button type="button" class="sign-out-button" on:click={onSignOut}>Sign out</button>
    </div>
  {/if}

  <div class="settings-section">
    <h3 class="section-title">Agents</h3>
    {#if !userId}
      <p class="empty-note">Sign in to create a personal agent key. Paste the setup into Cursor, Codex, or any tool that can POST JSON. The copied setup tells the tool to call describe for the current commands.</p>
    {:else}
      <p class="empty-note">Name the key, copy it once, then keep only the name here. Treat the secret like a password. The copied setup tells the tool to call describe for the current commands.</p>
      {#if agentTokenError}
        <p class="empty-note">{agentTokenError}</p>
      {/if}

      {#if agentPane === 'name'}
        <form class="agent-name-form" on:submit|preventDefault={submitAgentName}>
          <label class="agent-field">
            <span>Key name</span>
            <input
              type="text"
              bind:value={agentNameDraft}
              maxlength={AGENT_KEY_NAME_MAX}
              placeholder="Cursor"
              autocomplete="off"
              disabled={agentBusy}
            />
          </label>
          <div class="agent-actions">
            <button type="submit" class="sign-out-button" disabled={agentBusy}>
              {agentBusy ? 'Creating key' : 'Create key'}
            </button>
            <button type="button" class="sign-out-button" disabled={agentBusy} on:click={cancelAgentName}>
              Cancel
            </button>
          </div>
        </form>
      {:else if agentPane === 'save' && revealedToken}
        <p class="empty-note">Copy the key now. After you close this, only the name stays visible.</p>
        <p class="agent-key">{revealedToken}</p>
        <div class="agent-actions">
          <button type="button" class="sign-out-button" on:click={copyAgentKey}>
            {copiedKey ? 'Copied' : 'Copy key'}
          </button>
          <button type="button" class="sign-out-button" on:click={closeSavedAgentKey}>
            Done
          </button>
        </div>
      {:else if agentRecord}
        <div class="source-row">
          <span class="source-name">{agentRecord.name}</span>
          <div class="agent-actions">
            <button type="button" class="sign-out-button" disabled={agentBusy} on:click={startReplaceAgentKey}>
              Replace
            </button>
            <button type="button" class="sign-out-button" disabled={agentBusy} on:click={removeAgentKey}>
              Remove
            </button>
          </div>
        </div>
      {:else}
        <div class="agent-actions">
          <button type="button" class="sign-out-button" disabled={agentBusy} on:click={startCreateAgentKey}>
            Create agent key
          </button>
        </div>
      {/if}
    {/if}
  </div>

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

  .settings-update-button {
    align-self: flex-start;
    min-height: 36px;
    padding: 0 var(--space-3);
    border: 1px solid var(--border);
    border-radius: 999px;
    background: var(--surface-strong);
    color: var(--strong);
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition:
      background-color var(--motion-hover) ease,
      border-color var(--motion-hover) ease,
      transform var(--motion-press) var(--ease-out);
  }

  .settings-update-button:hover {
    border-color: var(--subtle);
    background: var(--block-hover);
  }

  .settings-update-button:active {
    transform: scale(0.97);
  }

  .settings-update-button:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 1px;
  }

  .agent-name-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .agent-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    font-size: 12px;
    color: var(--default);
  }

  .agent-field input {
    min-height: 40px;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--field-surface);
    color: var(--strong);
    font-size: 16px;
  }

  .agent-field input:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 1px;
  }

  .agent-key {
    margin: 0;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--field-surface);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px;
    color: var(--strong);
    word-break: break-all;
    overflow: hidden;
  }

  .agent-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
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
    flex-wrap: wrap;
    gap: var(--space-2);
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
