<script>
  import { formatLoopAge } from '../../loopFormat.js';

  export let loops = [];
  export let now = new Date();
  export let inboxCount = 0;
  export let draftingLoopId = null;
  export let draftsByLoopId = {};
  export let onDraftFollowUp;
  export let onViewChange;

  let copiedLoopId = null;
  let copyErrorLoopId = null;

  async function copyDraft(loopId, text) {
    try {
      await navigator.clipboard.writeText(text);
      copiedLoopId = loopId;
      copyErrorLoopId = null;
    } catch {
      copyErrorLoopId = loopId;
      copiedLoopId = null;
    }
    setTimeout(() => {
      if (copiedLoopId === loopId) copiedLoopId = null;
      if (copyErrorLoopId === loopId) copyErrorLoopId = null;
    }, 1500);
  }
</script>

<section class="waiting-panel" aria-labelledby="waiting-heading">
  <div class="panel-heading">
    <div>
      <h2 id="waiting-heading">Waiting</h2>
      <span class="panel-count">{loops.length} owned by someone else</span>
    </div>
    <div class="view-toggle" role="group" aria-label="Workspace view">
      <button type="button" class="view-toggle-button" on:click={() => onViewChange?.('flow')}>Flow</button>
      <button type="button" class="view-toggle-button" on:click={() => onViewChange?.('board')}>Board</button>
      <button type="button" class="view-toggle-button" on:click={() => onViewChange?.('inbox')}>
        Inbox{inboxCount ? ` (${inboxCount})` : ''}
      </button>
      <button type="button" class="view-toggle-button is-active" aria-current="page">Waiting</button>
      <button type="button" class="view-toggle-button" on:click={() => onViewChange?.('history')}>History</button>
      <button type="button" class="view-toggle-button" on:click={() => onViewChange?.('meetings')}>Meetings</button>
      <button type="button" class="view-toggle-button" on:click={() => onViewChange?.('settings')}>Settings</button>
    </div>
  </div>
  <p class="panel-note">Work you're not blocked on, but should know is aging.</p>

  <ol class="loop-list">
    {#each loops as loop (loop.id)}
      <li class="loop-card">
        <div class="loop-card-header">
          <span class="counterparty">{loop.counterpartyName}</span>
          <span class="age-badge">{formatLoopAge(loop.createdAt, now)}</span>
        </div>
        <h3 class="loop-title">{loop.title}</h3>
        <blockquote class="evidence">
          <p>&ldquo;{loop.evidence.excerpt}&rdquo;</p>
          <cite>{loop.evidence.sourceApp}</cite>
        </blockquote>
        {#if loop.dueAt}
          <p class="due-note">Expected {new Intl.DateTimeFormat([], { dateStyle: 'medium' }).format(new Date(loop.dueAt))}</p>
        {/if}
        <div class="loop-actions">
          <button
            type="button"
            class="draft-button"
            on:click={() => onDraftFollowUp?.(loop.id)}
            disabled={draftingLoopId === loop.id}
          >
            {draftingLoopId === loop.id ? 'Drafting...' : 'Draft follow-up'}
          </button>
        </div>
        {#if draftsByLoopId[loop.id]}
          <div class="draft-box">
            <textarea
              class="draft-text"
              readonly
              rows="4"
              value={draftsByLoopId[loop.id]}
              on:focus={(event) => event.currentTarget.select()}
            ></textarea>
            <button type="button" class="copy-button" on:click={() => copyDraft(loop.id, draftsByLoopId[loop.id])}>
              {#if copiedLoopId === loop.id}
                Copied
              {:else if copyErrorLoopId === loop.id}
                Couldn't copy -- select the text above
              {:else}
                Copy
              {/if}
            </button>
          </div>
        {/if}
      </li>
    {:else}
      <li class="empty-state">Nothing waiting on anyone else right now.</li>
    {/each}
  </ol>
</section>

<style>
  .waiting-panel {
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
  }

  .loop-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .counterparty {
    font-size: 12px;
    font-weight: 600;
    color: var(--strong);
  }

  .age-badge {
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 11px;
    color: var(--subtle);
    background: var(--surface-strong);
  }

  .loop-title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--strong);
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

  .due-note {
    margin: 0;
    font-size: 12px;
    color: var(--subtle);
  }

  .loop-actions {
    display: flex;
    gap: var(--space-2);
  }

  .draft-button {
    padding: 6px 12px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: transparent;
    color: var(--default);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }

  .draft-button:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .draft-box {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3);
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface-strong);
  }

  .draft-text {
    width: 100%;
    margin: 0;
    padding: var(--space-2);
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--field-surface);
    color: var(--strong);
    font: inherit;
    font-size: 12px;
    resize: vertical;
  }

  .copy-button {
    align-self: flex-start;
    padding: 4px 10px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: transparent;
    color: var(--default);
    font-size: 11px;
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
