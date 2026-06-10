<script>
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
  export let completedTime;
</script>

<aside class="summary-panel" aria-labelledby="summary-heading">
  <div class="summary-top">
    <div>
      <p class="eyebrow">Daily ledger</p>
      <h2 id="summary-heading">Today recap</h2>
    </div>
    <input id="summary-date" type="date" bind:value={selectedDay} />
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
                  <time datetime={item.completedAt}>{completedTime(item.completedAt)}</time>
                  <div class="summary-block">
                    <span class="summary-title">{@html linkifyText(item.title)}</span>
                    {#if item.progressLabel}
                      <span class="summary-progress">{item.progressLabel}</span>
                    {/if}
                    <span class="summary-duration">{item.durationLabel}</span>
                  </div>
                  <button type="button" class="open-task-button" on:click={() => onOpenTask(item.id)} aria-label={`Open ${item.title} details`}>
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
