<script>
  import { tick } from 'svelte';
  import CalendarPicker from './CalendarPicker.svelte';
  import { linkifyText } from '../../linkify.js';
  import { iconPage } from './icons.js';

  export let summary = [];
  export let selectedDay;
  export let draggedSummaryId = null;
  export let dropTargetId = null;
  export let dropTargetBucket = null;
  export let onOpenTask;
  export let onDragStart;
  export let onDragEnd;
  export let onDragOver;
  export let onDrop;
  export let onBucketDragOver;
  export let onBucketDrop;
  export let onCompletedTimeChange;
  export let completedTime;

  let editingTimeId = null;
  let timeDraft = '';

  async function startTimeEdit(item) {
    editingTimeId = item.id;
    timeDraft = timeInputValue(item.completedAt);
    await tick();
    document.querySelector(`#summary-time-edit-${CSS.escape(item.id)}`)?.focus();
    document.querySelector(`#summary-time-edit-${CSS.escape(item.id)}`)?.select();
  }

  async function commitTimeEdit(item) {
    const nextTime = timeDraft.trim();
    editingTimeId = null;

    if (!nextTime || nextTime === timeInputValue(item.completedAt)) {
      return;
    }

    await onCompletedTimeChange(item.id, nextTime);
  }

  function handleTimeKeydown(event, item) {
    if (event.key === 'Escape') {
      editingTimeId = null;
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      event.currentTarget.blur();
    }
  }

  function timeInputValue(completedAt) {
    const date = new Date(completedAt);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }
</script>

<aside class="summary-panel" aria-labelledby="summary-heading">
  <div class="summary-top">
    <div>
      <p class="eyebrow">Daily ledger</p>
      <h2 id="summary-heading">Today recap</h2>
    </div>
    <CalendarPicker id="summary-date" value={selectedDay} label="Select recap date" onChange={(nextDate) => (selectedDay = nextDate)} />
  </div>
  <div class="day-rhythm" aria-hidden="true">
    <span>Morning</span>
    <span>Lunch</span>
    <span>Evening</span>
    <span>Night</span>
  </div>
  <div class="summary-list" id="summary-list">
    {#if summary.length}
      {#each summary as section (section.label)}
        <section
          class="summary-section"
          class:is-bucket-target={dropTargetBucket === section.label && !dropTargetId}
          aria-label={section.label}
          data-summary-bucket={section.label}
          on:dragover={(event) => onBucketDragOver(event, section.label)}
          on:drop={(event) => onBucketDrop(event, section.label)}
        >
          <h3>{section.label}</h3>
          <ol>
            {#if section.items.length}
              {#each section.items as item (item.id)}
                <li
                  draggable="true"
                  data-summary-id={item.id}
                  class:is-dragging={draggedSummaryId === item.id}
                  class:is-drop-target={dropTargetId === item.id}
                  on:dragstart={(event) => onDragStart(event, item.id)}
                  on:dragend={onDragEnd}
                  on:dragover={(event) => onDragOver(event, item.id, section.label)}
                  on:drop={(event) => onDrop(event, item.id, section.label)}
                >
                  {#if editingTimeId === item.id}
                    <input
                      id={`summary-time-edit-${item.id}`}
                      class="summary-time-input"
                      type="time"
                      step="60"
                      bind:value={timeDraft}
                      aria-label={`Edit ${item.title} finished time`}
                      on:keydown={(event) => handleTimeKeydown(event, item)}
                      on:focusout={() => commitTimeEdit(item)}
                    />
                  {:else}
                    <button
                      type="button"
                      class="summary-time-button"
                      title="Double-click to edit finished time"
                      on:dblclick={() => startTimeEdit(item)}
                      aria-label={`Edit ${item.title} finished time`}
                    >
                      <time datetime={item.completedAt}>{completedTime(item.completedAt)}</time>
                    </button>
                  {/if}
                  <div class="summary-block">
                    <span class="summary-title">{@html linkifyText(item.title)}</span>
                    {#if item.outcome === 'failed'}
                      <span class="summary-outcome is-failed">Failed</span>
                    {/if}
                    {#if item.progressLabel}
                      <span class="summary-progress">{item.progressLabel}</span>
                    {/if}
                    <span class="summary-duration">{item.durationLabel}</span>
                  </div>
                  <button type="button" class="open-task-button" on:click={(event) => onOpenTask(item.id, event.currentTarget)} aria-label={`Open ${item.title} details`}>
                    {@html iconPage()}
                    <span>Open</span>
                  </button>
                </li>
              {/each}
            {:else}
              <li class="summary-empty-bucket">Drop completed tasks here</li>
            {/if}
          </ol>
        </section>
      {/each}
    {:else}
      <div class="empty-summary">
        <strong>No finished tasks for this date.</strong>
        <span>Complete a task and it will land here automatically.</span>
      </div>
    {/if}
  </div>
</aside>
