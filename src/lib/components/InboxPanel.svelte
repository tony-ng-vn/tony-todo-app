<script>
  export let loops = [];
  export let onAccept;
  export let onDismiss;
</script>

<section class="inbox-panel" aria-labelledby="inbox-heading">
  <div class="panel-heading">
    <h2 id="inbox-heading">Inbox</h2>
    <span class="panel-count">{loops.length} awaiting review</span>
  </div>
  <p class="panel-note">Medium-confidence loops Thread isn't sure about yet. Accept to promote to Focus, dismiss to teach it.</p>

  <ol class="loop-list">
    {#each loops as loop (loop.id)}
      <li class="loop-card">
        <div class="loop-card-header">
          <span class="priority-badge" data-priority={loop.priorityLabel}>{loop.priorityLabel}</span>
          <span class="confidence-badge">{Math.round(loop.confidence * 100)}% confident</span>
        </div>
        <h3 class="loop-title">{loop.title}</h3>
        <p class="why-priority">{loop.whyPriority}</p>
        <blockquote class="evidence">
          <p>&ldquo;{loop.evidence.excerpt}&rdquo;</p>
          <cite>{loop.evidence.author} &middot; {loop.evidence.sourceApp}</cite>
        </blockquote>
        <div class="loop-actions">
          <button type="button" class="accept-button" on:click={() => onAccept?.(loop.id)}>Accept</button>
          <button type="button" class="dismiss-button" on:click={() => onDismiss?.(loop.id)}>Not a task</button>
        </div>
      </li>
    {:else}
      <li class="empty-state">Nothing waiting on review.</li>
    {/each}
  </ol>
</section>

<style>
  .inbox-panel {
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
    gap: var(--space-2);
    align-items: center;
  }

  .priority-badge {
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    color: var(--button-fg);
    background: var(--strong);
  }

  .confidence-badge {
    font-size: 11px;
    color: var(--subtle);
  }

  .loop-title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--strong);
  }

  .why-priority {
    margin: 0;
    font-size: 12px;
    color: var(--default);
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

  .accept-button,
  .dismiss-button {
    padding: 6px 12px;
    border: 1px solid var(--border);
    border-radius: 10px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }

  .accept-button {
    background: var(--button-bg);
    color: var(--button-fg);
    border: none;
  }

  .dismiss-button {
    background: transparent;
    color: var(--subtle);
  }

  .empty-state {
    padding: var(--space-3);
    color: var(--subtle);
    font-size: 12px;
    list-style: none;
  }
</style>
