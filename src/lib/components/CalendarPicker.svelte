<script>
  import { tick } from 'svelte';

  export let id = undefined;
  export let value = '';
  export let mode = 'date';
  export let label = 'Select date';
  export let triggerClass = '';
  export let onChange = () => {};

  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const VIEWPORT_MARGIN = 16;
  let triggerElement;
  let isOpen = false;
  let viewDate = startOfMonth(parseValue(value) ?? new Date());
  let draftDate = parseValue(value) ?? new Date();
  let draftHour = '09';
  let draftMinute = '00';
  let draftPeriod = 'AM';
  let popoverStyle = '';

  $: selectedDate = parseValue(value);
  $: monthTitle = new Intl.DateTimeFormat([], { month: 'long', year: 'numeric' }).format(viewDate);
  $: calendarDays = daysForMonth(viewDate);
  $: triggerText = mode === 'datetime' ? formatDateTimeLabel(value) : formatDateLabel(value);

  async function openCalendar() {
    const parsedValue = parseValue(value) ?? new Date();
    draftDate = parsedValue;
    viewDate = startOfMonth(parsedValue);
    setDraftTime(parsedValue);
    isOpen = true;
    await tick();
    positionPopover();
  }

  function closeCalendar() {
    isOpen = false;
  }

  function handleTriggerClick() {
    if (isOpen) {
      closeCalendar();
      return;
    }

    openCalendar();
  }

  function changeMonth(delta) {
    viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + delta, 1);
  }

  function selectDay(day) {
    draftDate = day.date;

    if (mode === 'date') {
      onChange(formatDateValue(day.date));
      closeCalendar();
    }
  }

  function applyDateTime() {
    const nextDate = new Date(draftDate);
    const hour = hour24FromDraft();
    const minute = clampNumber(draftMinute, 0, 59);
    nextDate.setHours(hour, minute, 0, 0);
    onChange(toDateTimeLocalValue(nextDate));
    closeCalendar();
  }

  function chooseToday() {
    const today = new Date();
    draftDate = today;
    viewDate = startOfMonth(today);

    if (mode === 'date') {
      onChange(formatDateValue(today));
      closeCalendar();
    }
  }

  function handleKeydown(event) {
    if (isOpen && event.key === 'Escape') {
      closeCalendar();
    }
  }

  function handleViewportChange() {
    if (isOpen) {
      positionPopover();
    }
  }

  function positionPopover() {
    if (!triggerElement || typeof window === 'undefined') {
      return;
    }

    const rect = triggerElement.getBoundingClientRect();
    const width = Math.min(mode === 'datetime' ? 560 : 340, window.innerWidth - VIEWPORT_MARGIN * 2);
    const estimatedHeight = mode === 'datetime' ? 510 : 390;
    const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_MARGIN;
    const shouldOpenAbove = mode === 'datetime' && spaceBelow < estimatedHeight;
    const left = Math.min(
      Math.max(rect.left + rect.width / 2 - width / 2, VIEWPORT_MARGIN),
      window.innerWidth - width - VIEWPORT_MARGIN,
    );
    const top = shouldOpenAbove
      ? Math.max(VIEWPORT_MARGIN, rect.top - estimatedHeight - 12)
      : Math.min(rect.bottom + 10, window.innerHeight - estimatedHeight - VIEWPORT_MARGIN);

    popoverStyle = `position: fixed; left: ${Math.round(left)}px; top: ${Math.round(top)}px; width: ${Math.round(width)}px;`;
  }

  function portal(node) {
    if (typeof document === 'undefined') {
      return {};
    }

    document.body.appendChild(node);
    return {
      destroy() {
        node.remove();
      },
    };
  }

  function setDraftTime(date) {
    let hour = date.getHours();
    draftPeriod = hour >= 12 ? 'PM' : 'AM';
    hour %= 12;
    if (hour === 0) {
      hour = 12;
    }
    draftHour = String(hour).padStart(2, '0');
    draftMinute = String(date.getMinutes()).padStart(2, '0');
  }

  function hour24FromDraft() {
    let hour = clampNumber(draftHour, 1, 12);
    if (draftPeriod === 'PM' && hour < 12) {
      hour += 12;
    }
    if (draftPeriod === 'AM' && hour === 12) {
      hour = 0;
    }
    return hour;
  }

  function clampNumber(value, min, max) {
    const number = Number.parseInt(value, 10);
    if (Number.isNaN(number)) {
      return min;
    }
    return Math.min(Math.max(number, min), max);
  }

  function daysForMonth(date) {
    const first = startOfMonth(date);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());

    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return {
        date: day,
        key: formatDateValue(day),
        number: day.getDate(),
        isCurrentMonth: day.getMonth() === date.getMonth(),
        isSelected: selectedDate ? sameDay(day, selectedDate) : false,
        isDraft: mode === 'datetime' && sameDay(day, draftDate),
        isToday: sameDay(day, new Date()),
      };
    });
  }

  function parseValue(nextValue) {
    if (!nextValue) {
      return null;
    }

    const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(nextValue);
    if (dateOnlyMatch) {
      const [, year, month, day] = dateOnlyMatch;
      return new Date(Number(year), Number(month) - 1, Number(day));
    }

    const parsed = new Date(nextValue);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function sameDay(first, second) {
    return (
      first.getFullYear() === second.getFullYear() &&
      first.getMonth() === second.getMonth() &&
      first.getDate() === second.getDate()
    );
  }

  function formatDateValue(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function toDateTimeLocalValue(date) {
    return `${formatDateValue(date)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  function formatDateLabel(nextValue) {
    const date = parseValue(nextValue);
    return date
      ? new Intl.DateTimeFormat([], { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
      : 'Select date';
  }

  function formatDateTimeLabel(nextValue) {
    const date = parseValue(nextValue);
    return date
      ? new Intl.DateTimeFormat([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date)
      : 'Select time';
  }
</script>

<svelte:window on:keydown={handleKeydown} on:resize={handleViewportChange} on:scroll={handleViewportChange} />

<div class="calendar-picker">
  <button
    bind:this={triggerElement}
    {id}
    type="button"
    class={`calendar-trigger ${triggerClass}`}
    aria-haspopup="dialog"
    aria-expanded={isOpen}
    aria-label={label}
    on:click={handleTriggerClick}
  >
    {triggerText}
  </button>

  {#if isOpen}
    <div class="calendar-popover" role="dialog" aria-label={label} style={popoverStyle} use:portal>
      <div class="calendar-shell" class:has-time={mode === 'datetime'}>
        <section class="calendar-month" aria-label="Calendar month">
          <div class="calendar-head">
            <strong class="calendar-month-title">{monthTitle}</strong>
            <div class="calendar-nav">
              <button type="button" aria-label="Previous month" on:click={() => changeMonth(-1)}>‹</button>
              <button type="button" aria-label="Next month" on:click={() => changeMonth(1)}>›</button>
            </div>
          </div>

          <div class="calendar-weekdays" aria-hidden="true">
            {#each WEEKDAYS as weekday}
              <span>{weekday}</span>
            {/each}
          </div>

          <div class="calendar-grid">
            {#each calendarDays as day (day.key)}
              <button
                type="button"
                class="calendar-day"
                class:is-muted={!day.isCurrentMonth}
                class:is-today={day.isToday}
                class:is-selected={day.isSelected || day.isDraft}
                aria-pressed={day.isSelected || day.isDraft}
                on:click={() => selectDay(day)}
              >
                {day.number}
              </button>
            {/each}
          </div>

          <div class="calendar-footer">
            <button type="button" on:click={chooseToday}>Today</button>
            <button type="button" on:click={closeCalendar}>Close</button>
          </div>
        </section>

        {#if mode === 'datetime'}
          <section class="calendar-time" aria-label="Time">
            <span>Time</span>
            <div class="calendar-time-fields">
              <input
                class="calendar-hour-input"
                inputmode="numeric"
                maxlength="2"
                bind:value={draftHour}
                aria-label="Hour"
              />
              <span aria-hidden="true">:</span>
              <input
                class="calendar-minute-input"
                inputmode="numeric"
                maxlength="2"
                bind:value={draftMinute}
                aria-label="Minute"
              />
            </div>
            <div class="calendar-period-group" aria-label="AM or PM">
              <button
                type="button"
                class="calendar-period-button"
                class:is-active={draftPeriod === 'AM'}
                on:click={() => (draftPeriod = 'AM')}
              >
                AM
              </button>
              <button
                type="button"
                class="calendar-period-button"
                class:is-active={draftPeriod === 'PM'}
                on:click={() => (draftPeriod = 'PM')}
              >
                PM
              </button>
            </div>
            <button type="button" class="calendar-apply" on:click={applyDateTime}>Apply</button>
          </section>
        {/if}
      </div>
    </div>
  {/if}
</div>
