<script>
  // Self-contained feedback widget: a floating button that opens a small form
  // to submit an idea / bug / other. Copyable to other projects -- it only
  // needs an `onSubmit` async callback; it knows nothing about the backend.
  export let onSubmit; // async ({ category, message }) => Promise<void>
  export let categories = ['idea', 'bug', 'other'];

  const LABELS = { idea: 'Idea', bug: 'Bug', other: 'Other' };

  let open = false;
  let category = categories[0];
  let message = '';
  let state = 'idle'; // idle | sending | sent | error
  let errorMessage = '';

  function toggle() {
    open = !open;
    if (open) {
      state = 'idle';
      errorMessage = '';
    }
  }

  async function handleSubmit() {
    const trimmed = message.trim();
    if (!trimmed || state === 'sending') {
      return;
    }
    state = 'sending';
    errorMessage = '';
    try {
      await onSubmit?.({ category, message: trimmed });
      state = 'sent';
      message = '';
      setTimeout(() => {
        state = 'idle';
        open = false;
      }, 1400);
    } catch (error) {
      state = 'error';
      errorMessage = error?.message ?? 'Could not send feedback. Please try again.';
    }
  }
</script>

<div class="feedback-widget">
  {#if open}
    <div class="feedback-panel" role="dialog" aria-label="Send feedback">
      <div class="feedback-panel-head">
        <span>Share an idea</span>
        <button type="button" class="feedback-close" on:click={toggle} aria-label="Close">×</button>
      </div>

      <div class="feedback-chips" role="group" aria-label="Feedback type">
        {#each categories as option}
          <button
            type="button"
            class="feedback-chip"
            class:is-active={category === option}
            aria-pressed={category === option}
            on:click={() => (category = option)}
          >
            {LABELS[option] ?? option}
          </button>
        {/each}
      </div>

      <textarea
        class="feedback-input"
        rows="4"
        placeholder="What's on your mind? An idea, something broken, anything."
        bind:value={message}
        disabled={state === 'sending' || state === 'sent'}
      ></textarea>

      {#if state === 'error'}
        <p class="feedback-error" role="alert">{errorMessage}</p>
      {/if}

      <button
        type="button"
        class="feedback-submit"
        on:click={handleSubmit}
        disabled={!message.trim() || state === 'sending' || state === 'sent'}
      >
        {#if state === 'sending'}Sending...{:else if state === 'sent'}Thanks!{:else}Submit{/if}
      </button>
    </div>
  {/if}

  <button
    type="button"
    class="feedback-fab"
    class:is-open={open}
    on:click={toggle}
    aria-expanded={open}
    aria-label="Send feedback"
  >
    Feedback
  </button>
</div>

<style>
  .feedback-widget {
    position: absolute;
    right: 26px;
    bottom: 24px;
    z-index: 45;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 10px;
  }

  @media (max-width: 900px) {
    .feedback-widget {
      right: 16px;
      bottom: 16px;
    }
  }

  @media (max-width: 560px) {
    .feedback-widget {
      right: 12px;
      bottom: 12px;
    }

    .feedback-panel {
      width: min(300px, calc(100vw - 24px));
    }
  }

  .feedback-fab {
    min-height: 34px;
    padding: 6px 14px;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: var(--surface-strong);
    color: var(--default);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
  }

  .feedback-fab:hover,
  .feedback-fab.is-open {
    color: var(--strong);
    border-color: var(--subtle);
  }

  .feedback-panel {
    width: min(300px, 78vw);
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
    border: 1px solid var(--border);
    border-radius: 16px;
    background: var(--surface);
    box-shadow: var(--shadow-raised, 0 12px 40px rgba(0, 0, 0, 0.35));
    backdrop-filter: blur(24px) saturate(1.12);
    -webkit-backdrop-filter: blur(24px) saturate(1.12);
  }

  .feedback-panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: var(--strong);
    font-size: 13px;
    font-weight: 500;
  }

  .feedback-close {
    border: 0;
    background: transparent;
    color: var(--subtle);
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
  }

  .feedback-close:hover {
    color: var(--strong);
  }

  .feedback-chips {
    display: flex;
    gap: 6px;
  }

  .feedback-chip {
    flex: 1;
    min-height: 30px;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: transparent;
    color: var(--default);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
  }

  .feedback-chip.is-active {
    background: var(--block-surface, var(--surface-strong));
    color: var(--strong);
    border-color: var(--subtle);
  }

  .feedback-input {
    width: 100%;
    resize: vertical;
    padding: 10px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface-strong);
    color: var(--strong);
    font-size: 13px;
  }

  .feedback-input:focus-visible {
    outline: none;
    border-color: var(--subtle);
  }

  .feedback-error {
    margin: 0;
    color: #e06c6c;
    font-size: 12px;
  }

  .feedback-submit {
    min-height: 34px;
    border: 1px solid transparent;
    border-radius: 999px;
    background: var(--bg-selected, #f5f5f5);
    color: #111;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }

  .feedback-submit:disabled {
    opacity: 0.55;
    cursor: default;
  }
</style>
