<script>
  import { tick } from 'svelte';
  import { tokenizeLinks } from '../../linkify.js';

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

  async function beginEditing(event) {
    if (event?.target?.closest?.('a')) {
      return;
    }
    event?.preventDefault?.();
    await focus();
  }

  function handlePreviewKeydown(event) {
    if ((event.key === 'Enter' || event.key === ' ') && !event.target.closest('a')) {
      beginEditing(event);
    }
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
      role="group"
      aria-label={ariaLabel ?? 'Task note'}
      tabindex="0"
      on:mousedown={beginEditing}
      on:keydown={handlePreviewKeydown}
    >
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
  {/if}
</div>

<style>
  .rich-note-editor {
    position: relative;
    width: 100%;
    min-width: 0;
  }

  textarea,
  .rich-note-preview {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    margin: 0;
    border: 1px solid var(--border);
    background: var(--field-surface);
    color: var(--strong);
    font-family: inherit;
    font-weight: 400;
    white-space: pre-wrap;
  }

  textarea {
    display: block;
    -webkit-appearance: none;
    appearance: none;
  }

  textarea::placeholder {
    color: var(--subtle);
    opacity: 1;
  }

  textarea:focus::placeholder,
  textarea:focus-visible::placeholder {
    color: transparent;
  }

  .showing-preview textarea {
    position: absolute;
    inset: 0;
    opacity: 0;
    pointer-events: none;
  }

  .rich-note-preview {
    overflow: auto;
    overflow-wrap: anywhere;
    cursor: text;
  }

  .rich-note-preview:focus-visible,
  textarea:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 1px;
  }

  .rich-note-preview a {
    color: color-mix(in srgb, #e43c91 72%, var(--strong));
    font-weight: 500;
    text-decoration: none;
  }

  .rich-note-preview a:hover {
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .rich-note-preview a:focus-visible {
    border-radius: 4px;
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .rich-note-preview svg {
    display: inline-block;
    width: 1em;
    height: 1em;
    margin-right: 0.35em;
    overflow: visible;
    fill: none;
    stroke: currentcolor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 1.25;
    vertical-align: -0.12em;
  }

  .detail textarea,
  .detail .rich-note-preview {
    min-height: 96px;
    max-height: min(36vh, 280px);
    border-radius: 11px;
    padding: 14px 16px;
    font-size: 14px;
    line-height: 1.45;
  }

  .detail textarea {
    field-sizing: content;
    height: auto;
    resize: vertical;
  }

  .menubar textarea,
  .menubar .rich-note-preview {
    min-height: 72px;
    border-radius: 10px;
    padding: 9px 10px;
    font-size: 13px;
    line-height: 1.4;
  }

  .menubar textarea {
    resize: vertical;
  }

  .floating {
    height: 100%;
    min-height: 180px;
  }

  .floating textarea,
  .floating .rich-note-preview {
    height: 100%;
    min-height: 180px;
    border-radius: 14px;
    padding: 13px;
    font-size: 14px;
    line-height: 1.5;
  }

  .floating textarea {
    resize: none;
  }

  @media (max-width: 900px), (pointer: coarse) {
    .detail textarea,
    .detail .rich-note-preview {
      font-size: 16px;
    }
  }
</style>
