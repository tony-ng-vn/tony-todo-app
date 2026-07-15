<script>
  import { onMount } from 'svelte';
  import '../../styles.css';
  import { insforge, isInsForgeConfigured } from '../../insforgeClient.js';
  import { getCurrentUser } from '../../auth.js';
  import { loadAllFeedback, updateFeedbackStatus } from '../../feedbackRemote.js';

  // Match the theme the user picked in the app (same storage key).
  function applyStoredTheme() {
    const stored = localStorage.getItem('done-log-theme');
    const theme =
      stored === 'light' || stored === 'dark'
        ? stored
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
    document.documentElement.dataset.theme = theme;
  }

  const STATUS_ORDER = ['new', 'in_progress', 'done'];
  const STATUS_LABEL = { new: 'New', in_progress: 'In progress', done: 'Done' };
  const CATEGORY_LABEL = { idea: 'Idea', bug: 'Bug', other: 'Other' };

  let phase = 'loading'; // loading | ready | denied | signed-out | error
  let feedback = [];
  let errorMessage = '';
  let busyId = null;

  onMount(async () => {
    applyStoredTheme();
    if (!isInsForgeConfigured) {
      phase = 'error';
      errorMessage = 'Backend is not configured.';
      return;
    }
    try {
      const { user } = await getCurrentUser(insforge);
      if (!user) {
        phase = 'signed-out';
        return;
      }
      feedback = await loadAllFeedback(insforge);
      phase = 'ready';
    } catch (error) {
      // The admin function returns 403 for anyone who isn't the owner.
      phase = 'denied';
      errorMessage = error?.message ?? '';
    }
  });

  async function setStatus(item, status) {
    if (item.status === status || busyId) {
      return;
    }
    busyId = item.id;
    try {
      const updated = await updateFeedbackStatus(insforge, item.id, status);
      feedback = feedback.map((f) => (f.id === item.id ? { ...f, status: updated?.status ?? status } : f));
    } catch (error) {
      errorMessage = error?.message ?? 'Could not update status.';
    } finally {
      busyId = null;
    }
  }

  function formatDate(value) {
    if (!value) return '';
    try {
      return new Date(value).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return value;
    }
  }

  $: counts = STATUS_ORDER.reduce((acc, s) => {
    acc[s] = feedback.filter((f) => f.status === s).length;
    return acc;
  }, {});
</script>

<svelte:head><title>Feedback dashboard</title></svelte:head>

<main class="feedback-dashboard">
  <header class="fd-header">
    <div>
      <p class="fd-eyebrow">Owner only</p>
      <h1>Feedback</h1>
    </div>
    <a class="fd-back" href="/">Back to app</a>
  </header>

  {#if phase === 'loading'}
    <p class="fd-note">Loading feedback...</p>
  {:else if phase === 'signed-out'}
    <p class="fd-note">Sign in to the app first, then reopen this page.</p>
  {:else if phase === 'denied'}
    <p class="fd-note">This dashboard is restricted to the app owner.</p>
  {:else if phase === 'error'}
    <p class="fd-note">{errorMessage || 'Something went wrong.'}</p>
  {:else}
    <p class="fd-summary">
      {feedback.length} total &middot; {counts.new} new &middot; {counts.in_progress} in progress &middot; {counts.done} done
    </p>

    {#if errorMessage}
      <p class="fd-error" role="alert">{errorMessage}</p>
    {/if}

    {#if feedback.length === 0}
      <p class="fd-note">No feedback yet. It'll show up here as it comes in.</p>
    {:else}
      <ul class="fd-list">
        {#each feedback as item (item.id)}
          <li class="fd-card" data-status={item.status}>
            <div class="fd-card-top">
              <span class="fd-badge" data-category={item.category}>{CATEGORY_LABEL[item.category] ?? item.category}</span>
              {#if item.page_context}<span class="fd-context">{item.page_context}</span>{/if}
              <span class="fd-date">{formatDate(item.created_at)}</span>
            </div>
            <p class="fd-message">{item.message}</p>
            <div class="fd-status-row" role="group" aria-label="Set status">
              {#each STATUS_ORDER as status}
                <button
                  type="button"
                  class="fd-status-button"
                  class:is-active={item.status === status}
                  disabled={busyId === item.id}
                  on:click={() => setStatus(item, status)}
                >
                  {STATUS_LABEL[status]}
                </button>
              {/each}
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</main>

<style>
  .feedback-dashboard {
    max-width: 720px;
    margin: 0 auto;
    padding: clamp(24px, 5vw, 56px) 20px 80px;
    color: var(--strong);
  }

  .fd-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 24px;
  }

  .fd-eyebrow {
    margin: 0 0 6px;
    color: var(--subtle);
    font-size: 12px;
    font-weight: 500;
    text-transform: uppercase;
  }

  .fd-header h1 {
    margin: 0;
    font-size: 26px;
    font-weight: 500;
  }

  .fd-back {
    color: var(--default);
    font-size: 13px;
    text-decoration: none;
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 6px 12px;
  }

  .fd-back:hover {
    color: var(--strong);
    border-color: var(--subtle);
  }

  .fd-note,
  .fd-summary {
    color: var(--default);
    font-size: 14px;
  }

  .fd-error {
    color: #e06c6c;
    font-size: 13px;
  }

  .fd-list {
    list-style: none;
    margin: 16px 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .fd-card {
    padding: 14px 16px;
    border: 1px solid var(--border);
    border-radius: 14px;
    background: var(--surface);
  }

  .fd-card[data-status='done'] {
    opacity: 0.6;
  }

  .fd-card-top {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
    font-size: 12px;
  }

  .fd-badge {
    padding: 2px 9px;
    border-radius: 999px;
    background: var(--surface-strong);
    color: var(--strong);
    font-weight: 500;
  }

  .fd-badge[data-category='bug'] {
    color: #e06c6c;
  }

  .fd-context {
    color: var(--subtle);
    text-transform: capitalize;
  }

  .fd-date {
    margin-left: auto;
    color: var(--subtle);
  }

  .fd-message {
    margin: 0 0 12px;
    color: var(--strong);
    font-size: 14px;
    line-height: 1.5;
    white-space: pre-wrap;
  }

  .fd-status-row {
    display: flex;
    gap: 6px;
  }

  .fd-status-button {
    min-height: 28px;
    padding: 0 12px;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: transparent;
    color: var(--default);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
  }

  .fd-status-button.is-active {
    background: var(--block-surface, var(--surface-strong));
    color: var(--strong);
    border-color: var(--subtle);
  }

  .fd-status-button:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
