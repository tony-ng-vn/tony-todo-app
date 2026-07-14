<script>
  import '../../styles.css';
  import InboxPanel from '../../lib/components/InboxPanel.svelte';
  import WaitingPanel from '../../lib/components/WaitingPanel.svelte';
  import { mockInboxLoops, mockWaitingLoops } from '../../mockLoops.js';

  let inboxLoops = [...mockInboxLoops];
  let waitingLoops = [...mockWaitingLoops];
  let draftedLoopIds = new Set();

  function handleAccept(loopId) {
    inboxLoops = inboxLoops.filter((loop) => loop.id !== loopId);
  }

  function handleDismiss(loopId) {
    inboxLoops = inboxLoops.filter((loop) => loop.id !== loopId);
  }

  function handleDraftFollowUp(loopId) {
    draftedLoopIds = new Set(draftedLoopIds).add(loopId);
  }
</script>

<main class="preview-shell">
  <header class="preview-header">
    <p class="eyebrow">Thread &middot; preview</p>
    <h1>Inbox &amp; Waiting</h1>
    <p class="preview-note">
      A look at the two surfaces from docs/PRD.md Section 5, running on sample data. Nothing here reads
      or writes real tasks &mdash; accept, dismiss, and draft actions only update this page.
    </p>
  </header>

  <div class="preview-columns">
    <InboxPanel loops={inboxLoops} onAccept={handleAccept} onDismiss={handleDismiss} />
    <WaitingPanel loops={waitingLoops} onDraftFollowUp={handleDraftFollowUp} />
  </div>

  {#if draftedLoopIds.size > 0}
    <p class="draft-note">
      {draftedLoopIds.size} follow-up draft{draftedLoopIds.size === 1 ? '' : 's'} would be prepared here once
      the drafting pipeline is wired up.
    </p>
  {/if}
</main>

<style>
  .preview-shell {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    width: min(100vw, 1100px);
    margin: 0 auto;
    padding: var(--space-6);
  }

  .preview-header {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .eyebrow {
    margin: 0;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--subtle);
  }

  .preview-header h1 {
    margin: 0;
    font-size: 24px;
    font-weight: 600;
    color: var(--strong);
  }

  .preview-note {
    margin: 0;
    max-width: 60ch;
    font-size: 13px;
    color: var(--subtle);
  }

  .preview-columns {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: var(--space-5);
  }

  @media (max-width: 760px) {
    .preview-columns {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  .draft-note {
    margin: 0;
    padding: var(--space-3);
    border: 1px solid var(--border);
    border-radius: 14px;
    background: var(--surface-strong);
    font-size: 12px;
    color: var(--subtle);
  }
</style>
