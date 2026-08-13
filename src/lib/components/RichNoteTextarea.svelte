<script>
  import { tick } from 'svelte';
  import { tokenizeLinks } from '../../linkify.js';
  import './RichNoteTextarea.css';

  export let id = undefined;
  export let value = '';
  export let rows = undefined;
  export let placeholder = '';
  export let ariaLabel = undefined;
  export let variant = 'detail';
  export let onInput;
  export let onKeydown;

  let textarea;
  let editing = false;

  $: tokens = tokenizeLinks(value);
  $: hasLinks = tokens.some((token) => token.type === 'link');
  $: showingPreview = hasLinks && !editing;

  export async function focus() {
    editing = true;
    await tick();
    textarea?.focus();
  }

  async function beginEditing() {
    await focus();
  }
</script>

<div class={`rich-note-editor ${variant}`} class:showing-preview={showingPreview}>
  <textarea
    bind:this={textarea}
    {id}
    {rows}
    {placeholder}
    value={value}
    aria-label={ariaLabel}
    tabindex={showingPreview ? -1 : 0}
    on:focus={() => (editing = true)}
    on:blur={() => (editing = false)}
    on:input={onInput}
    on:keydown={onKeydown}
  ></textarea>

  {#if showingPreview}
    <div
      class="rich-note-preview"
      data-note-link-preview
    >
      <button
        class="rich-note-edit"
        data-note-link-edit
        type="button"
        aria-label={ariaLabel ? `Edit ${ariaLabel}` : 'Edit task note'}
        on:click={beginEditing}
      ></button>
      <div class="rich-note-content">
        {#each tokens as token}
          {#if token.type === 'link'}
            <a data-note-link href={token.href} target="_blank" rel="noreferrer noopener">
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <circle cx="8" cy="8" r="6.25"></circle>
                <path d="M1.75 8h12.5M8 1.75c1.65 1.7 2.5 3.78 2.5 6.25S9.65 12.55 8 14.25C6.35 12.55 5.5 10.47 5.5 8S6.35 3.45 8 1.75Z"></path>
              </svg><span>{token.label}</span>
            </a>
          {:else}{token.value}{/if}
        {/each}
      </div>
    </div>
  {/if}
</div>
