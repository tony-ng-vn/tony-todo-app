<script>
  import { onDestroy } from 'svelte';
  import { insforge } from '../../insforgeClient.js';
  import { resolveTaskPhotoSrc } from '../../todoPhoto.js';

  export let todo;
  export let busy = false;
  export let error = '';
  export let onSelect;
  export let onRemove;

  let displaySrc = '';
  let inputEl;
  let requestId = 0;

  $: loadDisplaySrc(todo);

  async function loadDisplaySrc(nextTodo) {
    const current = ++requestId;
    displaySrc = nextTodo?.photoUrl ?? '';
    const signed = await resolveTaskPhotoSrc(insforge, nextTodo);
    if (current !== requestId) {
      return;
    }
    displaySrc = signed ?? nextTodo?.photoUrl ?? '';
  }

  async function handleFileChange(event) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) {
      return;
    }
    await onSelect?.(todo.id, file);
  }

  onDestroy(() => {
    requestId += 1;
  });
</script>

<div class="task-photo-field">
  <span class="task-photo-label">Photo</span>
  {#if displaySrc}
    <div class="task-photo-preview">
      <img src={displaySrc} alt={`Photo for ${todo.title}`} />
      <div class="task-photo-actions">
        <button type="button" class="task-photo-button" disabled={busy} on:click={() => inputEl?.click()}>
          {busy ? 'Uploading...' : 'Replace photo'}
        </button>
        <button type="button" class="task-photo-button is-remove" disabled={busy} on:click={() => onRemove?.(todo.id)}>
          Remove
        </button>
      </div>
    </div>
  {:else}
    <button type="button" class="task-photo-button" disabled={busy} on:click={() => inputEl?.click()}>
      {busy ? 'Uploading...' : 'Add a photo'}
    </button>
  {/if}
  <input
    bind:this={inputEl}
    class="task-photo-input"
    type="file"
    accept="image/jpeg,image/png,image/webp,image/gif"
    aria-label={`Choose a photo for ${todo.title}`}
    on:change={handleFileChange}
  />
  {#if error}
    <p class="task-photo-error" role="alert">{error}</p>
  {/if}
</div>
