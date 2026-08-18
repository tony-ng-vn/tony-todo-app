<script>
  import { tick } from 'svelte';
  import CalendarPicker from './CalendarPicker.svelte';

  export let open = false;
  export let title = '';
  export let kind = 'task';
  export let dueDate = '';
  export let error = '';
  export let onClose;
  export let onSubmit;

  let dialogEl;
  let titleInput;
  let wasOpen = false;
  let previousFocus = null;

  $: canAdd = title.trim().length > 0;
  $: heading = kind === 'project' ? 'New project' : 'New task';
  $: titleErrorId = error ? 'overlay-todo-title-error' : undefined;
  $: addHintId = canAdd ? titleErrorId : 'overlay-add-hint';
  $: if (open && !wasOpen) {
    wasOpen = true;
    void openDialog();
  } else if (!open && wasOpen) {
    wasOpen = false;
    closeDialog();
  }

  async function openDialog() {
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    await tick();
    if (!dialogEl?.open) {
      dialogEl?.showModal();
    }
    titleInput?.focus();
  }

  function closeDialog() {
    if (dialogEl?.open) {
      dialogEl.close();
    }
    previousFocus?.focus?.();
    previousFocus = null;
  }

  function handleDialogKeydown(event) {
    if (event.key === 'Escape' && dialogEl?.querySelector('.calendar-popover')) {
      event.preventDefault();
    }
  }

  function handleCancel(event) {
    event.preventDefault();
    if (dialogEl?.querySelector('.calendar-popover')) {
      return;
    }
    onClose?.();
  }

  function handleBackdropClick(event) {
    if (event.target === dialogEl) {
      onClose?.();
    }
  }

  function handleSubmit() {
    if (!canAdd) {
      return;
    }

    onSubmit?.();
  }
</script>

<dialog
  bind:this={dialogEl}
  class="composer-overlay"
  aria-labelledby="composer-heading"
  on:cancel={handleCancel}
  on:keydown={handleDialogKeydown}
  on:click={handleBackdropClick}
>
  <form class="composer-card" on:submit|preventDefault={handleSubmit}>
    <div class="composer-header">
      <h2 id="composer-heading">{heading}</h2>
      <button type="button" class="composer-close" on:click={() => onClose?.()}>Close</button>
    </div>
    <div class="composer-kind" data-kind={kind} role="radiogroup" aria-label="Capture as">
      <span class="composer-kind-pill" aria-hidden="true"></span>
      <label class:is-active={kind === 'task'}>
        <input class="sr-only" type="radio" name="overlay-composer-kind" value="task" bind:group={kind} />
        Task
      </label>
      <label class:is-active={kind === 'project'}>
        <input class="sr-only" type="radio" name="overlay-composer-kind" value="project" bind:group={kind} />
        Project
      </label>
    </div>
    <div class="composer-grid">
      <label class="sr-only" for="overlay-todo-title">
        {kind === 'project' ? 'Project idea' : 'Task name'}
      </label>
      <input
        id="overlay-todo-title"
        bind:this={titleInput}
        bind:value={title}
        class="composer-title"
        class:is-invalid={Boolean(error)}
        type="text"
        name="title"
        autocomplete="off"
        placeholder={kind === 'project' ? 'Name the project' : 'Name the task'}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? titleErrorId : undefined}
        on:input={() => (error = '')}
      />
      {#if kind === 'task'}
        <div class="composer-date">
          <CalendarPicker
            id="overlay-todo-due-date"
            value={dueDate}
            label="Assigned date"
            triggerClass="composer-date-trigger"
            allowClear={false}
            portalTarget={dialogEl}
            onChange={(nextDate) => (dueDate = nextDate)}
          />
        </div>
      {/if}
      <button
        type="submit"
        class="composer-add"
        disabled={!canAdd}
        aria-describedby={addHintId}
      >
        Add
      </button>
    </div>
    {#if error}
      <p id="overlay-todo-title-error" class="composer-error" role="alert">{error}</p>
    {:else if !canAdd}
      <p id="overlay-add-hint" class="sr-only">Add stays off until there is a title.</p>
    {/if}
  </form>
</dialog>

<style>
  .composer-overlay {
    z-index: 35;
    inset: 0;
    width: 100vw;
    max-width: none;
    height: 100vh;
    height: 100dvh;
    max-height: none;
    margin: 0;
    padding: max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right))
      max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
    border: 0;
    background: transparent;
  }

  .composer-overlay[open] {
    display: grid;
    place-items: center;
  }

  .composer-overlay::backdrop {
    background: color-mix(in srgb, var(--canvas) 42%, transparent);
    backdrop-filter: blur(10px) saturate(1.08);
    -webkit-backdrop-filter: blur(10px) saturate(1.08);
  }

  .composer-overlay[open]::backdrop {
    animation: composer-backdrop-in 280ms var(--ease-out) both;
  }

  .composer-overlay[open] .composer-card {
    animation: composer-sheet-in var(--motion-overlay) var(--ease-out) both;
  }

  @keyframes composer-sheet-in {
    from {
      opacity: 0;
      transform: translateY(12px) scale(0.98);
    }

    to {
      opacity: 1;
      transform: none;
    }
  }

  @keyframes composer-backdrop-in {
    from {
      opacity: 0;
    }

    to {
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .composer-overlay[open] .composer-card,
    .composer-overlay[open]::backdrop {
      animation: composer-fade-in 140ms ease both;
    }

    .composer-kind-pill {
      transition: none;
    }
  }

  @keyframes composer-fade-in {
    from {
      opacity: 0;
    }

    to {
      opacity: 1;
    }
  }

  .composer-card {
    display: grid;
    gap: 10px;
    width: min(100%, 520px);
    max-height: min(100%, 90dvh);
    overflow: auto;
    scrollbar-width: none;
    padding: 16px;
    border: 1px solid var(--border);
    border-radius: 18px;
    background: var(--surface);
    box-shadow:
      inset 0 1px 0 var(--inset-highlight),
      0 18px 48px var(--shadow);
    backdrop-filter: blur(24px) saturate(1.12);
    -webkit-backdrop-filter: blur(24px) saturate(1.12);
  }

  .composer-card::-webkit-scrollbar {
    display: none;
  }

  .composer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .composer-card h2 {
    margin: 0;
    color: var(--strong);
    font-size: 16px;
    font-weight: 600;
    text-wrap: balance;
  }

  .composer-close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 32px;
    padding: 0 10px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--empty-surface);
    color: var(--default);
    font-size: 12px;
    font-weight: 600;
    box-shadow: inset 0 1px 0 var(--inset-highlight);
  }

  .composer-close:hover {
    color: var(--strong);
    background: var(--bg-selected);
  }

  .composer-close:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .composer-kind {
    position: relative;
    display: grid;
    grid-template-columns: 1fr 1fr;
    width: fit-content;
    min-width: 168px;
    padding: 4px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--empty-surface);
  }

  .composer-kind-pill {
    position: absolute;
    top: 4px;
    left: 4px;
    z-index: 0;
    width: calc(50% - 4px);
    height: calc(100% - 8px);
    border-radius: 8px;
    background: var(--field-surface);
    box-shadow: inset 0 1px 0 var(--inset-highlight);
    transform: translateX(0);
    transition: transform var(--motion-hover) var(--ease-out);
  }

  .composer-kind[data-kind='project'] .composer-kind-pill {
    transform: translateX(100%);
  }

  .composer-kind label {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 0 12px;
    border-radius: 8px;
    color: var(--default);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }

  .composer-kind label.is-active {
    color: var(--strong);
  }

  .composer-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      'title add'
      'date add';
    gap: 8px 10px;
    align-items: stretch;
  }

  .composer-title {
    grid-area: title;
    min-width: 0;
    min-height: 48px;
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 0 12px;
    background: var(--field-surface);
    color: var(--strong);
    font-size: 16px;
    overflow-wrap: anywhere;
  }

  .composer-title::placeholder {
    color: var(--default);
  }

  .composer-title.is-invalid {
    border-color: color-mix(in srgb, var(--strong) 45%, var(--danger));
  }

  .composer-error {
    margin: 0;
    color: color-mix(in srgb, var(--strong) 55%, var(--danger));
    font-size: 12px;
    font-weight: 500;
    text-wrap: pretty;
  }

  .composer-date {
    grid-area: date;
    width: fit-content;
  }

  .composer-grid:not(:has(.composer-date)) {
    grid-template-areas: 'title add';
  }

  .composer-add {
    grid-area: add;
    align-self: stretch;
    min-width: 72px;
    padding: 0 18px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--button-bg);
    color: var(--button-fg);
    font-size: 13px;
    font-weight: 600;
    transition:
      background-color var(--motion-hover) ease,
      border-color var(--motion-hover) ease,
      transform var(--motion-press) var(--ease-out);
  }

  .composer-add:hover:not(:disabled) {
    border-color: var(--subtle);
  }

  .composer-add:active:not(:disabled) {
    transform: translateY(1px) scale(0.98);
  }

  .composer-add:disabled {
    cursor: not-allowed;
    opacity: 0.38;
  }

  .composer-title:focus-visible,
  .composer-add:focus-visible,
  .composer-close:focus-visible,
  .composer-kind label:focus-within {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  @media (max-width: 520px) {
    .composer-overlay {
      padding: 16px;
    }

    .composer-grid,
    .composer-grid:not(:has(.composer-date)) {
      grid-template-columns: minmax(0, 1fr);
      grid-template-areas:
        'title'
        'date'
        'add';
    }

    .composer-add,
    .composer-close {
      min-height: 44px;
    }
  }

  @media (pointer: coarse) {
    .composer-close {
      min-height: 44px;
    }
  }
</style>
