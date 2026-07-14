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

    <button type="button" class="auth-toggle" on:click={() => onToggleMode(isSignUp ? 'sign-in' : 'sign-up')}>
      {isSignUp ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
    </button>
  </form>
</div>

<style>
  .auth-gate {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100dvh;
  }

  .auth-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    width: min(360px, 90vw);
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
    margin: 0 0 var(--space-2);
    font-size: 13px;
    color: var(--subtle);
  }

  .auth-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    font-size: 12px;
    color: var(--default);
  }

  .auth-field input {
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--field-surface);
    color: var(--strong);
    font-size: 13px;
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
    padding: var(--space-2) var(--space-3);
    border: none;
    border-radius: 10px;
    background: var(--button-bg);
    color: var(--button-fg);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }

  .auth-submit:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .auth-toggle {
    padding: 0;
    border: none;
    background: none;
    color: var(--subtle);
    font-size: 12px;
    text-decoration: underline;
    cursor: pointer;
    align-self: center;
  }
</style>
