<script>
  import { WORKSPACE_TABS } from '../../viewModes.js';

  export let currentView = 'flow';
  export let inboxCount = 0;
  export let waitingCount = 0;
  export let onViewChange;

  const PRIMARY_TABS = WORKSPACE_TABS.filter((tab) => tab.id !== 'settings');
  const SETTINGS_TAB = WORKSPACE_TABS.find((tab) => tab.id === 'settings');
</script>

<div class="view-toggle" role="group" aria-label="Workspace view">
  {#each PRIMARY_TABS as tab (tab.id)}
    <button
      type="button"
      class="view-toggle-button"
      class:is-active={currentView === tab.id}
      aria-current={currentView === tab.id ? 'page' : undefined}
      on:click={() => onViewChange?.(tab.id)}
    >
      {tab.label}{tab.id === 'inbox' && inboxCount
        ? ` (${inboxCount})`
        : tab.id === 'waiting' && waitingCount
          ? ` (${waitingCount})`
          : ''}
    </button>
  {/each}

  <span class="settings-tab-group">
    <button
      type="button"
      class="view-toggle-button"
      class:is-active={currentView === SETTINGS_TAB.id}
      aria-current={currentView === SETTINGS_TAB.id ? 'page' : undefined}
      on:click={() => onViewChange?.(SETTINGS_TAB.id)}
    >
      {SETTINGS_TAB.label}
    </button>
  </span>
</div>
