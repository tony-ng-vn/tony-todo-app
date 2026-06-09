<script>
  import { linkifyText } from '../../linkify.js';

  export let selectedTask = null;
  export let noteDraft = '';
  export let onClose;
  export let onNoteInput;
  export let detailMeta;
</script>

<aside class:is-open={selectedTask} class="task-detail" id="task-detail" aria-labelledby="detail-heading" aria-hidden={String(!selectedTask)}>
  <div class="detail-header">
    <div>
      <p class="eyebrow">Task page</p>
      <h2 id="detail-heading">Details</h2>
    </div>
    <button type="button" class="detail-close" id="detail-close" aria-label="Close task details" on:click={onClose}>Close</button>
  </div>
  {#if selectedTask}
    <p class="detail-title" id="detail-title">{@html linkifyText(selectedTask.title)}</p>
    <label class="detail-note-label" for="detail-note">Notes</label>
    <textarea
      id="detail-note"
      class="detail-note"
      placeholder="Add context, links, or reminders for this task."
      bind:value={noteDraft}
      on:input={onNoteInput}
    ></textarea>
    <p class="detail-meta" id="detail-meta">{detailMeta(selectedTask)}</p>
  {/if}
</aside>
