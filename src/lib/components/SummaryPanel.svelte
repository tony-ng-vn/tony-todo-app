<script>
  import { tick } from 'svelte';
  import CalendarPicker from './CalendarPicker.svelte';
  import { linkifyText } from '../../linkify.js';
  import { shiftDayKey } from '../../todoStore.js';
  import { iconChevronLeft, iconChevronRight, iconPage } from './icons.js';

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
  let timeError = '';

  $: recapItemCount = summary.reduce(
    (count, section) => count + section.items.filter((item) => item.outcome !== 'failed').length,
    0,
  );

  async function startTimeEdit(item) {
    editingTimeId = item.id;
    timeDraft = timeInputValue(item.completedAt);
    timeError = '';
    await tick();
    document.querySelector(`#summary-time-edit-${CSS.escape(item.id)}`)?.focus();
    document.querySelector(`#summary-time-edit-${CSS.escape(item.id)}`)?.select();
  }

  async function commitTimeEdit(item) {
    const nextTime = timeDraft.trim();
    if (!nextTime || nextTime === timeInputValue(item.completedAt)) {
      editingTimeId = null;
      return;
    }

    const result = await onCompletedTimeChange(item.id, nextTime);
    if (result?.ok === false) {
      timeError = result.error ?? 'End time must be after start time.';
      return;
    }

    editingTimeId = null;
    timeError = '';
  }

  function handleTimeKeydown(event, item) {
    if (event.key === 'Escape') {
      editingTimeId = null;
      timeError = '';
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

  function changeSelectedDay(offset) {
    selectedDay = shiftDayKey(selectedDay, offset);
  }
</script>

<aside class="summary-panel" aria-labelledby="summary-heading">
  <div class="summary-top">
    <div class="summary-heading">
      <h2 id="summary-heading">Today recap</h2>
      <output class="recap-completion-count" aria-label={`${recapItemCount} completed on this day`}>
        {recapItemCount} done
      </output>
    </div>
    <div class="summary-date-navigation" aria-label="Recap day navigation">
      <button
        id="summary-previous-day"
        type="button"
        class="summary-day-button"
        aria-label="View previous day"
        title="Previous day"
        on:click={() => changeSelectedDay(-1)}
      >
        {@html iconChevronLeft()}
      </button>
      <CalendarPicker id="summary-date" value={selectedDay} label="Select recap date" onChange={(nextDate) => (selectedDay = nextDate)} />
      <button
        id="summary-next-day"
        type="button"
        class="summary-day-button"
        aria-label="View next day"
        title="Next day"
        on:click={() => changeSelectedDay(1)}
      >
        {@html iconChevronRight()}
      </button>
    </div>
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
                      aria-invalid={Boolean(timeError)}
                      aria-describedby={timeError ? `summary-time-error-${item.id}` : undefined}
                      on:keydown={(event) => handleTimeKeydown(event, item)}
                      on:focusout={() => commitTimeEdit(item)}
                    />
                    {#if timeError}
                      <span class="summary-time-error" id={`summary-time-error-${item.id}`} role="alert">
                        {timeError}
                      </span>
                    {/if}
                  {:else}
                    <button
                      type="button"
                      class="summary-time-button"
                      title="Double-click to edit finished time"
                      on:dblclick={() => startTimeEdit(item)}
                      aria-label={`Edit ${item.title} finished time`}
                    >
                      <span class="summary-time-label">End</span>
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
                    <span class="summary-timing" aria-label="Task start time">
                      Start
                      {#if item.startedAt}
                        <time datetime={item.startedAt}>{completedTime(item.startedAt)}</time>
                      {:else}
                        not recorded
                      {/if}
                    </span>
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
