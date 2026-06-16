import { chromium } from 'playwright';

const targetUrl = new URL(process.env.UI_SMOKE_URL ?? 'http://127.0.0.1:5174/');
targetUrl.searchParams.set('local', '1');

const browser = await chromium.launch({ headless: true });

try {
  const mobile = await inspectViewport({ width: 390, height: 844 }, true);
  const desktop = await inspectViewport({ width: 1366, height: 900 }, false);
  const failures = [
    ...assertNoOverflow(mobile),
    ...assertNoOverflow(desktop),
    ...assertMinimumTarget(mobile, '#todo-title', 44, 'mobile task input'),
    ...assertMinimumTarget(mobile, '#summary-date', 44, 'mobile date picker'),
    ...assertMinimumTarget(mobile, '.theme-toggle', 34, 'mobile theme toggle'),
    ...assertMinimumContrast(mobile, '.todo-item button', 4.5, 'Done button'),
    ...assertHasMotion(mobile, '.input-row button', 'Add button'),
    ...assertHasMotion(mobile, '.todo-item button', 'Done button'),
    ...assertHasMotion(mobile, '.theme-toggle', 'Theme toggle'),
    ...assertTimerControlLabel(desktop),
    ...assertTaskRowSpacing(desktop),
    ...assertOngoingSection(desktop),
    ...assertFullScreenShell(desktop, '.workspace', 'workspace shell'),
    ...assertFixedDocumentScroll(desktop),
    ...assertRecapRhythm(desktop),
    ...assertDetailEditing(desktop),
    ...assertProgressiveSession(desktop),
    ...assertGlassSurface(desktop, '.task-panel', 'task panel'),
    ...assertGlassSurface(desktop, '.summary-panel', 'summary panel'),
    ...assertExists(desktop, '.flow-rail', 'frosted focus rail'),
    ...assertExists(desktop, '.theme-toggle', 'theme toggle'),
    ...assertBucketLabels(desktop),
    ...assertIncludes(desktop.summaryDurations, '45m', 'summary duration text'),
  ];

  if (failures.length) {
    console.error(failures.join('\n'));
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}

async function inspectViewport(viewport, isMobile) {
  const page = await browser.newPage({ viewport, isMobile });
  await page.addInitScript(() => {
    const today = new Date();
    const dayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const completedAt = (hour, minute) =>
      new Date(`${dayKey}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`).toISOString();

    window.__uiSmokeDayKey = dayKey;
    localStorage.setItem('done-log-client-id', 'ui-smoke-local');
    localStorage.setItem(
      'done-log-state',
      JSON.stringify({
        todos: [
          {
            id: 'ui-smoke-local-task',
            title: 'Review https://x.com/dickiebush/status/2062876058312224972 and https://www.linkedin.com/in/example',
            createdAt: '2026-06-08T08:00:00.000Z',
            completedAt: null,
            note: 'Existing note',
          },
          ...Array.from({ length: 14 }, (_, index) => ({
            id: `ui-smoke-overflow-task-${index}`,
            title: `Overflow task ${index + 1}`,
            createdAt: new Date(Date.UTC(2026, 5, 8, 8, index + 1, 0)).toISOString(),
            completedAt: null,
            firstStartedAt: index === 0 ? '2026-06-08T08:10:00.000Z' : null,
            activeStartedAt: index === 0 ? '2026-06-08T08:10:00.000Z' : null,
            trackedSeconds: index === 0 ? 180 : 0,
          })),
          {
            id: 'ui-smoke-morning-task',
            title: 'Morning completed task',
            createdAt: completedAt(7, 0),
            completedAt: completedAt(8, 15),
            trackedSeconds: 25 * 60,
          },
          {
            id: 'ui-smoke-lunch-task',
            title: 'Lunch completed task',
            createdAt: completedAt(10, 0),
            completedAt: completedAt(12, 10),
            firstStartedAt: completedAt(12, 5),
            trackedSeconds: 5 * 60,
          },
          {
            id: 'ui-smoke-evening-task',
            title: 'Evening completed task',
            createdAt: completedAt(15, 0),
            completedAt: completedAt(18, 30),
            trackedSeconds: 75 * 60,
          },
          {
            id: 'ui-smoke-night-task',
            title: 'Night completed task',
            createdAt: completedAt(19, 0),
            completedAt: completedAt(21, 20),
            trackedSeconds: 2 * 60 * 60,
          },
        ],
      }),
    );
  });
  await page.goto(targetUrl.toString(), { waitUntil: 'networkidle' });
  const summaryTimeEdit = isMobile ? null : await exerciseSummaryTimeEditing(page);
  const taskFlowChecks = isMobile ? null : await exerciseParallelAndReopen(page);
  const editChecks = isMobile ? null : await exerciseDetailEditing(page);

  const metrics = await page.evaluate(() => {
    function rectFor(selector) {
      const rect = document.querySelector(selector).getBoundingClientRect();
      return {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    }

    function rgbParts(value) {
      const match = value.match(/rgba?\(([^)]+)\)/);
      if (!match) {
        return null;
      }
      return match[1].split(',').slice(0, 3).map((part) => Number.parseFloat(part));
    }

    function luminance(parts) {
      const values = parts.map((part) => {
        const channel = part / 255;
        return channel <= 0.03928
          ? channel / 12.92
          : Math.pow((channel + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
    }

    function contrastFor(selector) {
      const element = document.querySelector(selector);
      const style = getComputedStyle(element);
      const foreground = luminance(rgbParts(style.color));
      const background = luminance(rgbParts(style.backgroundColor));
      return Number(
        ((Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05)).toFixed(2),
      );
    }

    function transitionFor(selector) {
      const style = getComputedStyle(document.querySelector(selector));
      return {
        property: style.transitionProperty,
        duration: style.transitionDuration,
      };
    }

    return {
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      exists: {
        '.flow-rail': Boolean(document.querySelector('.flow-rail')),
        '.theme-toggle': Boolean(document.querySelector('.theme-toggle')),
      },
      summaryBuckets: Array.from(document.querySelectorAll('.summary-section h3')).map((element) => element.textContent.trim()),
      summaryDurations: Array.from(document.querySelectorAll('.summary-duration')).map((element) => element.textContent.trim()),
      taskSections: Array.from(document.querySelectorAll('.task-list-section')).map((section) => ({
        heading: section.querySelector('h2')?.textContent.trim(),
        count: section.querySelector('.section-count')?.textContent.trim(),
        ids: Array.from(section.querySelectorAll('.todo-item')).map((item) => item.dataset.todoId),
      })),
      recapRhythm: Array.from(document.querySelectorAll('.summary-section')).map((section) => {
        const heading = section.querySelector('h3').getBoundingClientRect();
        const block = section.querySelector('ol > li').getBoundingClientRect();
        return Math.round(block.top - heading.bottom);
      }),
      scroll: {
        documentHeight: document.documentElement.scrollHeight,
        viewportHeight: document.documentElement.clientHeight,
        bodyOverflow: getComputedStyle(document.body).overflow,
        workspaceOverflow: getComputedStyle(document.querySelector('.workspace')).overflow,
        todoListOverflowY: getComputedStyle(document.querySelector('.todo-list')).overflowY,
        todoListScrollbarWidth: getComputedStyle(document.querySelector('.todo-list')).scrollbarWidth,
        todoListCanScroll: document.querySelector('.todo-list').scrollHeight > document.querySelector('.todo-list').clientHeight,
        summaryOverflowY: getComputedStyle(document.querySelector('.summary-list')).overflowY,
        summaryScrollbarWidth: getComputedStyle(document.querySelector('.summary-list')).scrollbarWidth,
      },
      rects: {
        '#todo-title': rectFor('#todo-title'),
        '#summary-date': rectFor('#summary-date'),
        '.theme-toggle': rectFor('.theme-toggle'),
        '.workspace': rectFor('.workspace'),
      },
      glass: {
        '.workspace': glassFor('.workspace'),
        '.task-panel': glassFor('.task-panel'),
        '.summary-panel': glassFor('.summary-panel'),
      },
      contrast: {
        '.todo-item button': contrastFor('.todo-item button'),
      },
      transitions: {
        '.input-row button': transitionFor('.input-row button'),
        '.todo-item button': transitionFor('.todo-item button'),
        '.theme-toggle': transitionFor('.theme-toggle'),
      },
      timerControl: (() => {
        const button = document.querySelector('.timer-button');
        const label = button?.querySelector('.timer-button-label');
        const labelRect = label?.getBoundingClientRect();
        return {
          text: label?.textContent.trim(),
          width: Math.round(labelRect?.width ?? 0),
          ariaLabel: button?.getAttribute('aria-label') ?? '',
        };
      })(),
      taskRowSpacing: (() => {
        const item = document.querySelector('.todo-item');
        const duration = item?.querySelector('.task-duration');
        const itemRect = item?.getBoundingClientRect();
        const durationRect = duration?.getBoundingClientRect();
        return {
          itemHeight: Math.round(itemRect?.height ?? 0),
          durationBottomGap: Math.round((itemRect?.bottom ?? 0) - (durationRect?.bottom ?? 0)),
          durationTopGap: Math.round((durationRect?.top ?? 0) - (itemRect?.top ?? 0)),
        };
      })(),
    };

    function glassFor(selector) {
      const style = getComputedStyle(document.querySelector(selector));
      return {
        background: style.backgroundColor,
        backdropFilter: style.backdropFilter || style.webkitBackdropFilter,
        borderRadius: style.borderRadius,
      };
    }
  });

  await page.close();
  return { viewport, editChecks, summaryTimeEdit, taskFlowChecks, ...metrics };
}

async function exerciseSummaryTimeEditing(page) {
  await page.locator('#summary-date').click();
  await page.waitForSelector('.calendar-popover');
  const summaryCalendarPresentation = await page.evaluate(() => ({
    calendarVisible: Boolean(document.querySelector('.calendar-popover')),
    nativeDateInputVisible: Boolean(document.querySelector('input[type="date"]')),
    nativeTimeInputVisible: Boolean(document.querySelector('input[type="time"], input[type="datetime-local"]')),
    monthHeading: document.querySelector('.calendar-month-title')?.textContent.trim(),
    dayButtonCount: document.querySelectorAll('.calendar-day').length,
  }));
  await page.keyboard.press('Escape');

  await page.locator('[data-summary-id="ui-smoke-morning-task"] time').dblclick();
  await page.fill('#summary-time-edit-ui-smoke-morning-task', '05:00');
  await page.locator('#summary-time-edit-ui-smoke-morning-task').press('Enter');

  return page.evaluate((summaryCalendarPresentation) => {
    const state = JSON.parse(localStorage.getItem('done-log-state'));
    const todo = state.todos.find((item) => item.id === 'ui-smoke-morning-task');
    const completedAt = new Date(todo.completedAt);

    return {
      completedHour: completedAt.getHours(),
      completedMinute: completedAt.getMinutes(),
      displayedTime: document.querySelector('[data-summary-id="ui-smoke-morning-task"] time')?.textContent.trim(),
      inputStillOpen: Boolean(document.querySelector('#summary-time-edit-ui-smoke-morning-task')),
      summaryCalendarPresentation,
    };
  }, summaryCalendarPresentation);
}

async function exerciseParallelAndReopen(page) {
  await page.click('[data-todo-id="ui-smoke-overflow-task-1"] .timer-button');
  await page.waitForFunction(() => {
    const state = JSON.parse(localStorage.getItem('done-log-state'));
    return ['ui-smoke-overflow-task-0', 'ui-smoke-overflow-task-1'].every(
      (id) => state.todos.find((item) => item.id === id)?.activeStartedAt,
    );
  });

  const parallelCheck = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('done-log-state'));
    return {
      activeIds: state.todos.filter((item) => item.activeStartedAt && !item.completedAt).map((item) => item.id),
      ongoingIds: Array.from(document.querySelectorAll('.task-list-section:first-child .todo-item')).map(
        (item) => item.dataset.todoId,
      ),
    };
  });

  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  await page.dispatchEvent('[data-summary-id="ui-smoke-morning-task"]', 'dragstart', { dataTransfer });
  await page.dispatchEvent('.task-panel', 'dragover', { dataTransfer });
  await page.waitForFunction(() => document.querySelector('.task-panel')?.classList.contains('is-open-drop-target'));
  const dropPresentation = await page.evaluate(() => ({
    panelTargeted: document.querySelector('.task-panel')?.classList.contains('is-open-drop-target'),
    countText: document.querySelector('#open-count')?.textContent.trim(),
  }));
  await page.dispatchEvent('.task-panel', 'drop', { dataTransfer });

  await page.waitForFunction(() => {
    const state = JSON.parse(localStorage.getItem('done-log-state'));
    return (
      state.todos.find((item) => item.id === 'ui-smoke-morning-task')?.completedAt === null &&
      Boolean(document.querySelector('[data-todo-id="ui-smoke-morning-task"]'))
    );
  });

  const reopenDragCheck = await page.evaluate((dropPresentation) => {
    const state = JSON.parse(localStorage.getItem('done-log-state'));
    const reopened = state.todos.find((item) => item.id === 'ui-smoke-morning-task');
    return {
      ...dropPresentation,
      completedAt: reopened?.completedAt,
      stillTrackedSeconds: reopened?.trackedSeconds,
      visibleOpenTask: Boolean(document.querySelector('[data-todo-id="ui-smoke-morning-task"]')),
      stillInSummary: Boolean(document.querySelector('[data-summary-id="ui-smoke-morning-task"]')),
    };
  }, dropPresentation);

  return { parallelCheck, reopenDragCheck };
}

async function exerciseDetailEditing(page) {
  const localTaskSelector = '[data-todo-id="ui-smoke-local-task"]';
  await page.click(`${localTaskSelector} .open-task-button`);
  await page.waitForSelector('.detail-title-display');
  const detailLayout = await captureDetailLayout(page);
  await page.evaluate(() => document.querySelector('#detail-close')?.click());
  await page.waitForTimeout(120);
  await page.click(`${localTaskSelector} .open-task-button`);
  await page.waitForSelector('.detail-title-display');
  const initialTitlePresentation = await page.evaluate(() => ({
    titleInputInitiallyVisible: Boolean(document.querySelector('#detail-title-input')),
    titleDisplayText: document.querySelector('.detail-title-display')?.textContent.trim(),
    titleLinks: Array.from(document.querySelectorAll('.detail-title-display a')).map((link) => link.textContent.trim()),
  }));

  await page.locator('.detail-title-display').dblclick();
  await page.fill('#detail-title-input', 'Smoke renamed task');
  await page.locator('#detail-title-input').blur();
  await page.waitForFunction(() => document.querySelector('.detail-title-display')?.textContent.trim() === 'Smoke renamed task');
  await page.fill('#detail-note', 'Smoke note');
  const noteBeforeSave = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('done-log-state'));
    const todo = state.todos.find((item) => item.id === 'ui-smoke-local-task');
    return {
      storedNote: todo?.note,
      saveVisible: Boolean(document.querySelector('.detail-save-note')),
      headerSaveVisible: Boolean(document.querySelector('.detail-window-actions .detail-save-note')),
      headerSaveText: document.querySelector('.detail-window-actions .detail-save-note')?.textContent.trim(),
      saveDisabled: document.querySelector('.detail-save-note')?.disabled ?? null,
    };
  });
  await page.click('.detail-save-note');
  await page.waitForFunction(() => {
    const state = JSON.parse(localStorage.getItem('done-log-state'));
    return state.todos.find((item) => item.id === 'ui-smoke-local-task')?.note === 'Smoke note';
  });
  await page.fill('#detail-note', '/todo Follow up with USCIS');
  await page.waitForFunction(() => document.querySelector('#detail-note')?.value === '- [ ] Follow up with USCIS');
  const slashTodoValue = await page.locator('#detail-note').inputValue();
  await page.click('.detail-save-note');
  await page.waitForFunction(() => {
    const state = JSON.parse(localStorage.getItem('done-log-state'));
    return state.todos.find((item) => item.id === 'ui-smoke-local-task')?.note === '- [ ] Follow up with USCIS';
  });
  await page.click('.note-todo-checkbox');
  await page.waitForFunction(() => {
    const state = JSON.parse(localStorage.getItem('done-log-state'));
    return state.todos.find((item) => item.id === 'ui-smoke-local-task')?.note === '- [x] Follow up with USCIS';
  });
  const clickedTodoValue = await page.locator('#detail-note').inputValue();
  await page.focus('#detail-note');
  await page.locator('#detail-note').evaluate((textarea) => textarea.setSelectionRange(0, 0));
  await page.keyboard.press('Tab');
  const tabEditCheck = await page.evaluate(() => ({
    noteValue: document.querySelector('#detail-note')?.value,
    selectionStart: document.querySelector('#detail-note')?.selectionStart,
    activeElementId: document.activeElement?.id,
  }));

  await page.mouse.click(24, 24);
  await page.waitForTimeout(120);
  const outsideClickKeepsDetailOpen = await page.evaluate(() => Boolean(document.querySelector('#task-detail')));

  await page.locator('.progress-toggle input').check();
  await page.fill('#progress-label', 'pages 41-52');
  await page.click('#detail-close');
  await page.waitForTimeout(120);
  await page.click(`${localTaskSelector} button[aria-label^="Log"]`);
  await page.waitForTimeout(100);
  await page.mouse.click(24, 24);
  await page.waitForTimeout(120);

  await page.click('[data-summary-id="ui-smoke-lunch-task"] .open-task-button');
  await page.waitForSelector('.detail-start-picker');
  const taskDetailScroll = await page.locator('.task-detail').evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      scrollbarWidth: style.scrollbarWidth,
      overflowX: style.overflowX,
      overflowY: style.overflowY,
      canScrollVertically: element.scrollHeight >= element.clientHeight,
    };
  });
  const deleteButtonUpfront = await page.locator('.detail-delete-task').isVisible();
  const detailUsesCustomCalendar = await page.evaluate(() => ({
    hasNativeDateTimeInput: Boolean(document.querySelector('#task-detail input[type="datetime-local"]')),
    hasStartPicker: Boolean(document.querySelector('.detail-start-picker')),
    hasEndPicker: Boolean(document.querySelector('.detail-end-picker')),
    hasDoneDatePicker: Boolean(document.querySelector('.detail-done-date-picker')),
  }));
  const dayKey = await page.evaluate(() => window.__uiSmokeDayKey);
  await page.locator('.detail-start-picker').click();
  await page.waitForSelector('.calendar-popover');
  await page.fill('.calendar-hour-input', '11');
  await page.fill('.calendar-minute-input', '25');
  await page.locator('.calendar-period-button', { hasText: 'AM' }).click();
  await page.click('.calendar-apply');
  await page.locator('.detail-end-picker').click();
  await page.waitForSelector('.calendar-popover');
  await page.fill('.calendar-hour-input', '12');
  await page.fill('.calendar-minute-input', '10');
  await page.locator('.calendar-period-button', { hasText: 'PM' }).click();
  await page.click('.calendar-apply');
  await page.waitForFunction(() => {
    const state = JSON.parse(localStorage.getItem('done-log-state'));
    return state.todos.find((item) => item.id === 'ui-smoke-lunch-task')?.trackedSeconds === 45 * 60;
  });
  await page.locator('.detail-done-date-picker').click();
  await page.waitForSelector('.calendar-popover');
  await page.evaluate(() => {
    const days = Array.from(document.querySelectorAll('.calendar-popover .calendar-day'));
    const selectedIndex = days.findIndex((day) => day.classList.contains('is-selected'));
    days[selectedIndex + 1]?.click();
  });
  await page.waitForFunction(
    (previousDayKey) => {
      const state = JSON.parse(localStorage.getItem('done-log-state'));
      const todo = state.todos.find((item) => item.id === 'ui-smoke-lunch-task');
      if (!todo?.completedAt) {
        return false;
      }

      const completedAt = new Date(todo.completedAt);
      const nextDayKey = `${completedAt.getFullYear()}-${String(completedAt.getMonth() + 1).padStart(2, '0')}-${String(completedAt.getDate()).padStart(2, '0')}`;
      return nextDayKey !== previousDayKey && Boolean(document.querySelector('[data-summary-id="ui-smoke-lunch-task"]'));
    },
    dayKey,
  );
  const doneDateMoveCheck = await page.evaluate((previousDayKey) => {
    const state = JSON.parse(localStorage.getItem('done-log-state'));
    const lunch = state.todos.find((item) => item.id === 'ui-smoke-lunch-task');
    const completedAt = lunch?.completedAt ? new Date(lunch.completedAt) : null;
    const completedDayKey = completedAt
      ? `${completedAt.getFullYear()}-${String(completedAt.getMonth() + 1).padStart(2, '0')}-${String(completedAt.getDate()).padStart(2, '0')}`
      : null;

    return {
      changedFromToday: completedDayKey !== previousDayKey,
      stillVisibleOnMovedDay: Boolean(document.querySelector('[data-summary-id="ui-smoke-lunch-task"]')),
    };
  }, dayKey);
  await page.locator('.detail-done-date-picker').click();
  await page.waitForSelector('.calendar-popover');
  await page.locator('.calendar-footer button', { hasText: 'Today' }).click();
  await page.waitForFunction((previousDayKey) => {
    const state = JSON.parse(localStorage.getItem('done-log-state'));
    const todo = state.todos.find((item) => item.id === 'ui-smoke-lunch-task');
    if (!todo?.completedAt) {
      return false;
    }

    const completedAt = new Date(todo.completedAt);
    const completedDayKey = `${completedAt.getFullYear()}-${String(completedAt.getMonth() + 1).padStart(2, '0')}-${String(completedAt.getDate()).padStart(2, '0')}`;
    return completedDayKey === previousDayKey;
  }, dayKey);
  await page.locator('#summary-date').click();
  await page.waitForSelector('.calendar-popover');
  await page.locator('.calendar-footer button', { hasText: 'Today' }).click();
  await page.waitForSelector('[data-summary-id="ui-smoke-evening-task"]');

  await page.mouse.click(24, 24);
  await page.click('[data-summary-id="ui-smoke-evening-task"] .open-task-button');
  await page.click('.detail-delete-task');
  await page.waitForFunction(() => {
    const state = JSON.parse(localStorage.getItem('done-log-state'));
    return !state.todos.some((item) => item.id === 'ui-smoke-evening-task');
  });

  const editChecks = await page.evaluate(({ taskDetailScroll, deleteButtonUpfront, detailUsesCustomCalendar, doneDateMoveCheck, noteBeforeSave, slashTodoValue, clickedTodoValue, tabEditCheck }) => {
    const state = JSON.parse(localStorage.getItem('done-log-state'));
    const todo = state.todos.find((item) => item.id === 'ui-smoke-local-task');
    const session = state.todos.find((item) => item.parentTaskId === 'ui-smoke-local-task');
    const lunch = state.todos.find((item) => item.id === 'ui-smoke-lunch-task');
    return {
      noteValue: document.querySelector('#detail-note')?.value,
      titleValue: document.querySelector('#detail-title-input')?.value,
      storedNote: todo?.note,
      storedTitle: todo?.title,
      storedIsProgressive: todo?.isProgressive,
      storedProgressLabel: todo?.progressLabel,
      parentStillOpen: todo?.completedAt === null,
      sessionTitle: session?.title,
      sessionProgressLabel: session?.progressLabel,
      sessionCompleted: Boolean(session?.completedAt),
      recapProgress: Array.from(document.querySelectorAll('.summary-progress')).map((element) => element.textContent.trim()),
      titleDisplayAfterEdit: document.querySelector('.detail-title-display')?.textContent.trim(),
      taskDetailScroll,
      deleteButtonUpfront,
      noteBeforeSave,
      slashTodoValue,
      clickedTodoValue,
      tabEditCheck,
      lunchTrackedSeconds: lunch?.trackedSeconds,
      lunchStart: lunch?.firstStartedAt,
      lunchCompletedAt: lunch?.completedAt,
      eveningDeleted: !state.todos.some((item) => item.id === 'ui-smoke-evening-task'),
      detailClosedAfterDelete: !document.querySelector('#task-detail')?.classList.contains('is-open'),
      detailUsesCustomCalendar,
      doneDateMoveCheck,
    };
  }, { taskDetailScroll, deleteButtonUpfront, detailUsesCustomCalendar, doneDateMoveCheck, noteBeforeSave, slashTodoValue, clickedTodoValue, tabEditCheck });

  return { ...editChecks, initialTitlePresentation, detailLayout, outsideClickKeepsDetailOpen };
}

async function captureDetailLayout(page) {
  return page.locator('.task-detail').evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const taskPanel = document.querySelector('.task-panel').getBoundingClientRect();
    const summaryPanel = document.querySelector('.summary-panel').getBoundingClientRect();
    const workspace = document.querySelector('.workspace').getBoundingClientRect();
    return {
      left: Math.round(rect.left),
      top: Math.round(rect.top),
      right: Math.round(rect.right),
      bottom: Math.round(rect.bottom),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      parentClass: element.parentElement?.className ?? '',
      position: getComputedStyle(element).position,
      workspaceHasDetail: document.querySelector('.workspace')?.classList.contains('has-detail'),
      taskPanelRight: Math.round(taskPanel.right),
      summaryLeft: Math.round(summaryPanel.left),
      summaryRight: Math.round(summaryPanel.right),
      workspaceRight: Math.round(workspace.right),
    };
  });
}

function assertNoOverflow(result) {
  return result.scrollWidth > result.clientWidth
    ? [`${result.viewport.width}px viewport has horizontal overflow: ${result.scrollWidth} > ${result.clientWidth}`]
    : [];
}

function assertMinimumTarget(result, selector, minimum, label) {
  const rect = result.rects[selector];
  return rect.height < minimum || rect.width < minimum
    ? [`${label} is ${rect.width}x${rect.height}; expected at least ${minimum}x${minimum}`]
    : [];
}

function assertMinimumContrast(result, selector, minimum, label) {
  const contrast = result.contrast[selector];
  return contrast < minimum ? [`${label} contrast is ${contrast}; expected at least ${minimum}`] : [];
}

function assertHasMotion(result, selector, label) {
  const transition = result.transitions[selector];
  return transition.duration === '0s' || transition.property === 'all'
    ? [`${label} transition is ${transition.property} ${transition.duration}; expected explicit micro-interaction timing`]
    : [];
}

function assertTimerControlLabel(result) {
  return ['Start', 'Stop'].includes(result.timerControl.text) &&
    result.timerControl.width > 22 &&
    result.timerControl.ariaLabel.includes(result.timerControl.text)
    ? []
    : [`timer control label is not visible/clear: ${JSON.stringify(result.timerControl)}`];
}

function assertTaskRowSpacing(result) {
  return result.taskRowSpacing.itemHeight >= 88 &&
    result.taskRowSpacing.durationBottomGap >= 14 &&
    result.taskRowSpacing.durationTopGap >= 42
    ? []
    : [`wrapped task row content is cramped: ${JSON.stringify(result.taskRowSpacing)}`];
}

function assertOngoingSection(result) {
  const [ongoing, open] = result.taskSections;
  return ongoing?.heading === 'Ongoing' &&
    ongoing?.ids.includes('ui-smoke-overflow-task-0') &&
    open?.heading === 'Open' &&
    !open?.ids.includes('ui-smoke-overflow-task-0')
    ? []
    : [`running tasks are not separated into an Ongoing section: ${JSON.stringify(result.taskSections)}`];
}

function assertExists(result, selector, label) {
  return result.exists[selector] ? [] : [`${label} is missing from the rendered interface`];
}

function assertBucketLabels(result) {
  const expected = ['Morning', 'Lunch', 'Evening', 'Night'];
  return expected.every((label, index) => result.summaryBuckets[index] === label)
    ? []
    : [`summary buckets are ${result.summaryBuckets.join(', ')}; expected ${expected.join(', ')}`];
}

function assertIncludes(values, expected, label) {
  return values.includes(expected) ? [] : [`${label} does not include ${expected}; saw ${values.join(', ')}`];
}

function assertGlassSurface(result, selector, label) {
  const glass = result.glass[selector];
  return glass.backdropFilter.includes('blur') && glass.borderRadius !== '0px'
    ? []
    : [`${label} is not using a rounded blurred glass surface`];
}

function assertFullScreenShell(result, selector, label) {
  const rect = result.rects[selector];
  return rect.width === result.viewport.width && rect.height >= result.viewport.height
    ? []
    : [`${label} is ${rect.width}x${rect.height}; expected full ${result.viewport.width}x${result.viewport.height}`];
}

function assertFixedDocumentScroll(result) {
  const scroll = result.scroll;
  const failures = [];
  if (scroll.documentHeight > scroll.viewportHeight) {
    failures.push(`document scrolls vertically: ${scroll.documentHeight} > ${scroll.viewportHeight}`);
  }
  if (scroll.bodyOverflow !== 'hidden' || scroll.workspaceOverflow !== 'hidden') {
    failures.push(`page overflow is body=${scroll.bodyOverflow}, workspace=${scroll.workspaceOverflow}; expected hidden`);
  }
  if (scroll.todoListOverflowY !== 'auto' || !scroll.todoListCanScroll) {
    failures.push(`open task list is not independently scrollable: ${JSON.stringify(scroll)}`);
  }
  if (scroll.todoListScrollbarWidth !== 'none' || scroll.summaryScrollbarWidth !== 'none') {
    failures.push(`internal scrollbars are visible: ${JSON.stringify(scroll)}`);
  }
  if (scroll.summaryOverflowY !== 'auto') {
    failures.push(`summary list overflow-y is ${scroll.summaryOverflowY}; expected auto`);
  }
  return failures;
}

function assertRecapRhythm(result) {
  const tooTight = result.recapRhythm.filter((gap) => gap < 12);
  return tooTight.length ? [`summary label-to-block gaps are ${result.recapRhythm.join(', ')}; expected at least 12`] : [];
}

function assertDetailEditing(result) {
  const editChecks = result.editChecks;
  const failures = [];
  const summaryTimeEdit = result.summaryTimeEdit;

  if (
    !summaryTimeEdit ||
    summaryTimeEdit.completedHour !== 5 ||
    summaryTimeEdit.completedMinute !== 0 ||
    summaryTimeEdit.inputStillOpen
  ) {
    failures.push(`summary time inline edit failed: ${JSON.stringify(summaryTimeEdit)}`);
  }

  if (
    !summaryTimeEdit.summaryCalendarPresentation?.calendarVisible ||
    summaryTimeEdit.summaryCalendarPresentation?.nativeDateInputVisible ||
    summaryTimeEdit.summaryCalendarPresentation?.nativeTimeInputVisible ||
    summaryTimeEdit.summaryCalendarPresentation?.dayButtonCount < 28
  ) {
    failures.push(`summary date picker is not using the custom calendar: ${JSON.stringify(summaryTimeEdit.summaryCalendarPresentation)}`);
  }

  if (editChecks.storedNote !== '- [x] Follow up with USCIS' || editChecks.storedTitle !== 'Smoke renamed task') {
    failures.push(`detail editing failed: ${JSON.stringify(editChecks)}`);
  }

  if (editChecks.slashTodoValue !== '- [ ] Follow up with USCIS') {
    failures.push(`slash todo command did not create a todo box line: ${JSON.stringify(editChecks)}`);
  }

  if (editChecks.clickedTodoValue !== '- [x] Follow up with USCIS') {
    failures.push(`note todo checkbox did not toggle done: ${JSON.stringify(editChecks)}`);
  }

  if (
    !editChecks.tabEditCheck?.noteValue?.startsWith('\t') ||
    editChecks.tabEditCheck?.selectionStart !== 1 ||
    editChecks.tabEditCheck?.activeElementId !== 'detail-note'
  ) {
    failures.push(`tab key did not insert a tab inside task details: ${JSON.stringify(editChecks.tabEditCheck)}`);
  }

  if (
    editChecks.noteBeforeSave?.storedNote === 'Smoke note' ||
    !editChecks.noteBeforeSave?.saveVisible ||
    !editChecks.noteBeforeSave?.headerSaveVisible ||
    editChecks.noteBeforeSave?.headerSaveText !== 'Save' ||
    editChecks.noteBeforeSave?.saveDisabled
  ) {
    failures.push(`detail notes did not wait for explicit save: ${JSON.stringify(editChecks.noteBeforeSave)}`);
  }

  if (editChecks.initialTitlePresentation?.titleInputInitiallyVisible) {
    failures.push(`detail title initially looked editable: ${JSON.stringify(editChecks.initialTitlePresentation)}`);
  }

  const expectedLinks = ['X', 'LinkedIn'];
  if (!expectedLinks.every((label) => editChecks.initialTitlePresentation?.titleLinks.includes(label))) {
    failures.push(`detail title links were not platform labeled: ${JSON.stringify(editChecks.initialTitlePresentation)}`);
  }

  if (!editChecks.outsideClickKeepsDetailOpen) {
    failures.push('outside click closed the in-flow task detail panel');
  }

  if (
    editChecks.taskDetailScroll?.scrollbarWidth !== 'none' ||
    editChecks.taskDetailScroll?.overflowX !== 'auto' ||
    editChecks.taskDetailScroll?.overflowY !== 'auto'
  ) {
    failures.push(`task detail scrollbars are not hidden while scroll remains enabled: ${JSON.stringify(editChecks.taskDetailScroll)}`);
  }

  if (!editChecks.deleteButtonUpfront || !editChecks.eveningDeleted || !editChecks.detailClosedAfterDelete) {
    failures.push(`detail delete action failed: ${JSON.stringify(editChecks)}`);
  }

  if (
    editChecks.detailUsesCustomCalendar?.hasNativeDateTimeInput ||
    !editChecks.detailUsesCustomCalendar?.hasStartPicker ||
    !editChecks.detailUsesCustomCalendar?.hasEndPicker ||
    !editChecks.detailUsesCustomCalendar?.hasDoneDatePicker
  ) {
    failures.push(`detail timing still uses native browser pickers: ${JSON.stringify(editChecks.detailUsesCustomCalendar)}`);
  }

  if (editChecks.lunchTrackedSeconds !== 45 * 60) {
    failures.push(`completed task timing did not update duration: ${JSON.stringify(editChecks)}`);
  }

  if (!editChecks.doneDateMoveCheck?.changedFromToday || !editChecks.doneDateMoveCheck?.stillVisibleOnMovedDay) {
    failures.push(`completed task done date did not move the task to the selected recap day: ${JSON.stringify(editChecks)}`);
  }

  if (
    !result.taskFlowChecks?.parallelCheck?.activeIds?.includes('ui-smoke-overflow-task-0') ||
    !result.taskFlowChecks?.parallelCheck?.activeIds?.includes('ui-smoke-overflow-task-1') ||
    !result.taskFlowChecks?.parallelCheck?.ongoingIds?.includes('ui-smoke-overflow-task-0') ||
    !result.taskFlowChecks?.parallelCheck?.ongoingIds?.includes('ui-smoke-overflow-task-1')
  ) {
    failures.push(`parallel task running failed: ${JSON.stringify(result.taskFlowChecks?.parallelCheck)}`);
  }

  if (
    result.taskFlowChecks?.reopenDragCheck?.completedAt !== null ||
    result.taskFlowChecks?.reopenDragCheck?.stillTrackedSeconds !== 25 * 60 ||
    !result.taskFlowChecks?.reopenDragCheck?.visibleOpenTask ||
    result.taskFlowChecks?.reopenDragCheck?.stillInSummary ||
    !result.taskFlowChecks?.reopenDragCheck?.panelTargeted ||
    result.taskFlowChecks?.reopenDragCheck?.countText !== 'Drop to reopen'
  ) {
    failures.push(`dragging a finished task back to open failed: ${JSON.stringify(result.taskFlowChecks?.reopenDragCheck)}`);
  }

  const layout = editChecks.detailLayout;
  if (
    !layout?.workspaceHasDetail ||
    !String(layout.parentClass).includes('workspace') ||
    layout.position === 'fixed' ||
    layout.left < layout.summaryRight - 2 ||
    layout.right > layout.workspaceRight + 2
  ) {
    failures.push(`detail panel is not the right-side workspace block: ${JSON.stringify(layout)}`);
  }

  return failures;
}

function assertProgressiveSession(result) {
  const editChecks = result.editChecks;
  return editChecks.storedIsProgressive === true &&
    editChecks.storedProgressLabel === 'pages 41-52' &&
    editChecks.parentStillOpen === true &&
    editChecks.sessionTitle === 'Smoke renamed task' &&
    editChecks.sessionProgressLabel === 'pages 41-52' &&
    editChecks.sessionCompleted === true &&
    editChecks.recapProgress.includes('pages 41-52')
    ? []
    : [`progressive session failed: ${JSON.stringify(editChecks)}`];
}
