<script>
  import { formatLoopAge } from '../../loopFormat.js';

  export let loops = [];
  export let now = new Date();
  export let onDraftFollowUp;
</script>

<section class="waiting-panel" aria-labelledby="waiting-heading">
  <div class="panel-heading">
    <h2 id="waiting-heading">Waiting</h2>
    <span class="panel-count">{loops.length} owned by someone else</span>
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
          <button type="button" class="draft-button" on:click={() => onDraftFollowUp?.(loop.id)}>
            Draft follow-up
          </button>
        </div>
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

  .empty-state {
    padding: var(--space-3);
    color: var(--subtle);
    font-size: 12px;
    list-style: none;
  }
</style>
