<script>
  export let mode = 'sign-in';
  export let email = '';
  export let password = '';
  export let error = '';
  export let loading = false;
  export let onSubmit;
  export let onToggleMode;

  $: isSignUp = mode === 'sign-up';

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit({ email, password, mode });
  }
</script>

<div class="auth-gate">
  <form class="auth-card" on:submit={handleSubmit}>
    <h1 class="auth-title">Done Log</h1>
    <p class="auth-subtitle">
      {isSignUp ? 'Create an account to sync your tasks.' : 'Sign in to sync your tasks.'}
    </p>

    <div class="auth-mode-switch" role="group" aria-label="Account mode">
      <button
        type="button"
        class="auth-mode"
        class:is-active={!isSignUp}
        aria-pressed={!isSignUp}
        on:click={() => onToggleMode('sign-in')}
      >
        Sign in
      </button>
      <button
        type="button"
        class="auth-mode"
        class:is-active={isSignUp}
        aria-pressed={isSignUp}
        on:click={() => onToggleMode('sign-up')}
      >
        Sign up
      </button>
    </div>

    <label class="auth-field">
      <span>Email</span>
      <input type="email" bind:value={email} autocomplete="email" required />
    </label>

    <label class="auth-field">
      <span>Password</span>
      <input
        type="password"
        bind:value={password}
        autocomplete={isSignUp ? 'new-password' : 'current-password'}
        minlength="8"
        required
      />
    </label>

    {#if error}
      <p class="auth-error" role="alert">{error}</p>
    {/if}

    <button type="submit" class="auth-submit" disabled={loading}>
      {#if loading}
        Working...
      {:else}
        {isSignUp ? 'Sign up' : 'Sign in'}
      {/if}
    </button>
  </form>
</div>

<style>
  .auth-gate {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    height: 100svh;
    height: 100dvh;
    overflow-x: hidden;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    padding:
      max(24px, env(safe-area-inset-top, 0px))
      max(16px, env(safe-area-inset-right, 0px))
      max(24px, env(safe-area-inset-bottom, 0px))
      max(16px, env(safe-area-inset-left, 0px));
  }

  .auth-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    flex: 0 0 auto;
    width: min(360px, 100%);
    margin-block: auto;
    padding: var(--space-6);
    border: 1px solid var(--border);
    border-radius: 20px;
    background: var(--surface-strong);
    backdrop-filter: blur(24px) saturate(1.12);
    -webkit-backdrop-filter: blur(24px) saturate(1.12);
    box-shadow: var(--shadow-soft);
  }

  .auth-title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--strong);
  }

  .auth-subtitle {
    margin: 0;
    font-size: 13px;
    color: var(--subtle);
  }

  .auth-mode-switch {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
    margin: var(--space-1) 0 var(--space-2);
    padding: 4px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--field-surface);
  }

  .auth-mode {
    min-height: 40px;
    padding: 0 var(--space-3);
    border: none;
    border-radius: 9px;
    background: transparent;
    color: var(--default);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    -webkit-appearance: none;
    appearance: none;
  }

  .auth-mode.is-active {
    background: var(--button-bg);
    color: var(--button-fg);
    font-weight: 600;
  }

  .auth-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    font-size: 12px;
    color: var(--default);
  }

  .auth-field input {
    min-height: 44px;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--field-surface);
    color: var(--strong);
    /* 16px prevents iOS Safari from zooming the page on focus and hiding the Sign up control. */
    font-size: 16px;
  }

  .auth-field input:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 1px;
  }

  .auth-error {
    margin: 0;
    font-size: 12px;
    color: #c0392b;
  }

  .auth-submit {
    min-height: 44px;
    padding: var(--space-2) var(--space-3);
    border: none;
    border-radius: 10px;
    background: var(--button-bg);
    color: var(--button-fg);
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    -webkit-appearance: none;
    appearance: none;
  }

  .auth-submit:disabled {
    opacity: 0.6;
    cursor: default;
  }
</style>
