<script>
  import { onMount, tick } from 'svelte';
  import { expandTodoCommand, parseNoteTodos, toggleNoteTodo } from '../../noteTodos.js';
  import { getTextareaKeyEdit } from '../../textareaEditing.js';

  export let todo;
  export let noteSaveStatus = 'saved';
  export let onNoteInput;

  let noteInput;

  onMount(() => {
    noteInput?.focus();
  });

  $: noteDraft = todo?.note ?? '';
  $: noteTodos = parseNoteTodos(noteDraft);

  function updateNote(nextNote) {
    noteDraft = nextNote;
    onNoteInput(todo.id, nextNote);
  }

  async function handleInput(event) {
    const textarea = event.currentTarget;
    const expanded = expandTodoCommand(
      textarea.value,
      textarea.selectionStart ?? textarea.value.length,
    );
    updateNote(expanded.value);

    if (expanded.changed) {
      await tick();
      textarea.setSelectionRange(expanded.cursor, expanded.cursor);
    }
  }

  async function handleKeydown(event) {
    if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    const textarea = event.currentTarget;
    const selectionStart = textarea.selectionStart ?? textarea.value.length;
    const selectionEnd = textarea.selectionEnd ?? selectionStart;
    const edit = getTextareaKeyEdit({
      value: textarea.value,
      selectionStart,
      selectionEnd,
      key: event.key,
      shiftKey: event.shiftKey,
    });
    if (!edit) {
      return;
    }

    event.preventDefault();
    updateNote(edit.value);
    await tick();
    textarea.setSelectionRange(edit.cursor, edit.cursor);
  }
</script>

<main class="floating-note-shell" aria-label={`Note for ${todo.title}`}>
  <header class="floating-note-header">
    <div>
      <p>Task note</p>
      <h1 class="floating-note-title">{todo.title}</h1>
    </div>
    <button type="button" on:click={() => window.close()}>Close</button>
  </header>

  <textarea
    bind:this={noteInput}
    class="floating-note-input"
    aria-label={`Note for ${todo.title}`}
    placeholder="Add context, links, or reminders for this task."
    value={noteDraft}
    on:input={handleInput}
    on:keydown={handleKeydown}
  ></textarea>

  {#if noteTodos.length}
    <div class="floating-note-todos" aria-label="Note todos">
      {#each noteTodos as item (item.lineIndex)}
        <button
          type="button"
          class:is-done={item.done}
          aria-pressed={item.done}
          on:click={() => updateNote(toggleNoteTodo(noteDraft, item.lineIndex))}
        >
          <span aria-hidden="true"></span>
          <strong>{item.label}</strong>
        </button>
      {/each}
    </div>
  {/if}

  <footer class="floating-note-save-status" aria-live="polite">
    {noteSaveStatus === 'saving'
      ? 'Saving note...'
      : noteSaveStatus === 'error'
        ? 'Saved locally - sync failed'
        : 'Note saved automatically'}
  </footer>
</main>

<style>
  :global(html),
  :global(body) {
    min-width: 320px;
    overflow: hidden;
  }

  .floating-note-shell {
    display: grid;
    grid-template-rows: auto minmax(180px, 1fr) auto auto;
    gap: 12px;
    width: 100%;
    height: 100dvh;
    padding: 18px;
    overflow: hidden;
    background: var(--workspace-surface);
    color: var(--strong);
    backdrop-filter: blur(28px) saturate(1.18);
    -webkit-backdrop-filter: blur(28px) saturate(1.18);
  }

  .floating-note-header {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: flex-start;
    gap: 12px;
  }

  .floating-note-header div {
    min-width: 0;
  }

  .floating-note-header p {
    margin: 0 0 4px;
    color: var(--subtle);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .floating-note-title {
    margin: 0;
    overflow: hidden;
    color: var(--strong);
    font-size: 16px;
    font-weight: 650;
    line-height: 1.25;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .floating-note-header button {
    min-height: 30px;
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 0 10px;
    background: var(--surface-strong);
    color: var(--default);
    font-size: 11px;
    font-weight: 600;
  }

  .floating-note-input {
    width: 100%;
    height: 100%;
    min-height: 180px;
    resize: none;
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 13px;
    background: var(--field-surface);
    color: var(--strong);
    font: inherit;
    font-size: 14px;
    line-height: 1.5;
  }

  .floating-note-input:focus-visible,
  .floating-note-header button:focus-visible,
  .floating-note-todos button:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 1px;
  }

  .floating-note-todos {
    display: grid;
    max-height: 112px;
    gap: 6px;
    overflow: auto;
  }

  .floating-note-todos button {
    display: grid;
    grid-template-columns: 18px minmax(0, 1fr);
    align-items: center;
    gap: 8px;
    min-height: 34px;
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 7px 9px;
    background: var(--empty-surface);
    color: var(--strong);
    text-align: left;
  }

  .floating-note-todos button span {
    width: 16px;
    height: 16px;
    border: 1px solid var(--subtle);
    border-radius: 5px;
  }

  .floating-note-todos button strong {
    overflow: hidden;
    font-size: 12px;
    font-weight: 550;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .floating-note-todos button.is-done span {
    border-color: var(--strong);
    background: var(--strong);
    box-shadow: inset 0 0 0 3px var(--surface-strong);
  }

  .floating-note-todos button.is-done strong {
    color: var(--subtle);
    text-decoration: line-through;
  }

  .floating-note-save-status {
    color: var(--subtle);
    font-size: 11px;
    font-weight: 550;
  }

  @media (prefers-reduced-transparency: reduce) {
    .floating-note-shell {
      background: var(--surface-strong);
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
    }
  }
</style>
