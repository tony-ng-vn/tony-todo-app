<script>
  export let selectedTask = null;
  export let noteDraft = '';
  export let selectedTaskSessions = [];
  export let onClose;
  export let onNoteInput;
  export let onDetailTitleCommit;
  export let onProgressiveChange;
  export let onProgressInput;
  export let formatDuration;
  export let completedTime;
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
    <label class="detail-title-label" for="detail-title-input">Task name</label>
    <input
      id="detail-title-input"
      class="detail-title-input"
      type="text"
      value={selectedTask.title}
      aria-label={`Edit ${selectedTask.title} title`}
      on:keydown={(event) => {
        if (event.key === 'Enter') {
          event.currentTarget.blur();
        }
      }}
      on:focusout={(event) => onDetailTitleCommit(selectedTask.id, event.currentTarget.value)}
    />
    <label class="progress-toggle">
      <input
        type="checkbox"
        checked={selectedTask.isProgressive}
        on:change={(event) => onProgressiveChange(selectedTask.id, event.currentTarget.checked)}
      />
      <span>
        <strong>Progressive task</strong>
        <small>Log today's session and keep this task open.</small>
      </span>
    </label>
    {#if selectedTask.isProgressive}
      <label class="detail-note-label" for="progress-label">Today progress</label>
      <input
        id="progress-label"
        class="progress-input"
        type="text"
        placeholder="pages 41-52, Chapter 4, lesson 2"
        value={selectedTask.progressLabel ?? ''}
        on:input={(event) => onProgressInput(selectedTask.id, event.currentTarget.value)}
      />
    {/if}
    <label class="detail-note-label" for="detail-note">Notes</label>
    <textarea
      id="detail-note"
      class="detail-note"
      placeholder="Add context, links, or reminders for this task."
      value={noteDraft}
      on:input={(event) => onNoteInput(event.currentTarget.value)}
    ></textarea>
    <p class="detail-meta" id="detail-meta">{detailMeta(selectedTask)}</p>
    {#if selectedTask.isProgressive}
      <div class="session-history" aria-label="Progress sessions">
        <h3>Sessions</h3>
        {#if selectedTaskSessions.length}
          <ol>
            {#each selectedTaskSessions as session (session.id)}
              <li>
                <time datetime={session.completedAt}>{completedTime(session.completedAt)}</time>
                <span>{session.progressLabel || 'Session logged'}</span>
                <small>{formatDuration(session.trackedSeconds)}</small>
              </li>
            {/each}
          </ol>
        {:else}
          <p>No sessions logged yet.</p>
        {/if}
      </div>
    {/if}
  {/if}
</aside>
