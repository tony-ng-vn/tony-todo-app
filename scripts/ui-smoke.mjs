import { chromium } from 'playwright';

const targetUrl = new URL(process.env.UI_SMOKE_URL ?? 'http://127.0.0.1:5174/');
targetUrl.searchParams.set('local', '1');

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
});

try {
  const mobile = await inspectViewport({ width: 390, height: 844 }, true);
  const mobileTaskDetail = await inspectMobileTaskDetail({ width: 390, height: 844 });
  const desktop = await inspectViewport({ width: 1366, height: 900 }, false);
  const overlayAddedTask = await inspectOverlayAddedTask({ width: 1366, height: 900 });
  const boardCardLayout = await inspectBoardCardLayout({ width: 1366, height: 900 });
  const duplicateTask = await inspectDuplicateTask({ width: 1366, height: 900 });
  const navigation = await inspectWorkspaceNavigation({ width: 1366, height: 900 });
  const runningTimingEdit = await inspectRunningTimingEdit({ width: 1366, height: 900 });
  const recapDayNavigation = await inspectRecapDayNavigation({ width: 1366, height: 900 });
  const nativeWorkspaceLayout = await inspectNativeWorkspaceLayout({ width: 1280, height: 820 });
  const nativeMinimumLayout = await inspectNativeWorkspaceLayout({ width: 900, height: 600 });
  const failures = [
    ...assertNoOverflow(mobile),
    ...assertNoOverflow(desktop),
    ...assertMobileTaskDetail(mobileTaskDetail),
    ...assertMinimumTarget(mobile, '#task-search', 44, 'mobile task search'),
    ...assertMinimumTarget(mobile, '.new-task-button', 44, 'mobile new-task button'),
    ...assertMinimumTarget(mobile, '#summary-date', 44, 'mobile date picker'),
    ...assertMinimumTarget(mobile, '#summary-previous-day', 44, 'mobile previous-day button'),
    ...assertMinimumTarget(mobile, '#summary-next-day', 44, 'mobile next-day button'),
    ...assertMinimumTarget(mobile, '.theme-toggle', 34, 'mobile theme toggle'),
    ...assertMinimumContrast(mobile, '.todo-item button', 4.5, 'Done button'),
    ...assertHasMotion(mobile, '.new-task-button', 'New task button'),
    ...assertHasMotion(mobile, '.todo-item button', 'Done button'),
    ...assertHasMotion(mobile, '.theme-toggle', 'Theme toggle'),
    ...assertTimerControlLabel(desktop),
    ...assertRowDelete(desktop),
    ...assertTaskRowSpacing(desktop),
    ...assertCalendarConsistency(desktop),
    ...assertNewTaskCalendarClear(desktop),
    ...assertOngoingSection(desktop),
    ...assertManualTiming(desktop),
    ...assertBoardCardLayout(boardCardLayout),
    ...assertDuplicateTask(duplicateTask),
    ...assertPausedTimeline(desktop),
    ...assertFullScreenShell(desktop, '.workspace', 'workspace shell'),
    ...assertFixedDocumentScroll(desktop),
    ...assertRecapRhythm(desktop),
    ...assertDetailEditing(desktop),
    ...assertCompletedFromDetail(desktop),
    ...assertGlassSurface(desktop, '.task-panel', 'task panel'),
    ...assertGlassSurface(desktop, '.summary-panel', 'summary panel'),
    ...assertExists(desktop, '.flow-rail', 'frosted focus rail'),
    ...assertExists(desktop, '.theme-toggle', 'theme toggle'),
    ...assertBucketLabels(desktop),
    ...assertIncludes(desktop.summaryDurations, '45m', 'summary duration text'),
    ...assertStartsWith(desktop.summaryTiming, 'Start ', 'summary start time'),
    ...assertIncludes(desktop.summaryTiming, 'End', 'summary end time'),
    ...assertStartsWith(desktop.taskTiming, 'Started ', 'running task start label'),
    ...assertOverlayAddedTask(overlayAddedTask),
    ...assertWorkspaceNavigation(navigation),
    ...assertRunningTimingEdit(runningTimingEdit),
    ...assertRecapDayNavigation(recapDayNavigation),
    ...assertNativeWorkspaceLayout(nativeWorkspaceLayout),
    ...assertNativeWorkspaceLayout(nativeMinimumLayout),
  ];

  if (failures.length) {
    console.error(failures.join('\n'));
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}

async function inspectMobileTaskDetail(viewport) {
  const page = await browser.newPage({
    viewport,
    isMobile: true,
    hasTouch: true,
  });
  await page.addInitScript(() => {
    localStorage.setItem('done-log-client-id', 'ui-smoke-mobile-detail');
    localStorage.setItem(
      'done-log-state',
      JSON.stringify({
        todos: [
          {
            id: 'ui-smoke-mobile-detail-task',
            title: 'Write the iPhone task note',
            createdAt: '2026-08-13T08:00:00.000Z',
            completedAt: null,
            firstStartedAt: '2026-08-13T09:15:00.000Z',
            activeStartedAt: null,
            trackedSeconds: 10 * 60,
            timeSegments: [
              {
                startedAt: '2026-08-13T09:15:00.000Z',
                endedAt: '2026-08-13T09:25:00.000Z',
                durationSeconds: 10 * 60,
              },
            ],
            note: '',
          },
        ],
      }),
    );
  });
  await page.goto(targetUrl.toString(), { waitUntil: 'networkidle' });
  await page.locator('[data-todo-id="ui-smoke-mobile-detail-task"] .open-task-button').tap();
  await page.waitForSelector('#task-detail');
  await page.waitForFunction(() => {
    const detail = document.querySelector('#task-detail');
    if (!detail) {
      return false;
    }
    const transform = getComputedStyle(detail).transform;
    return transform === 'none' || transform === 'matrix(1, 0, 0, 1, 0, 0)';
  });

  const layout = await page.evaluate(() => {
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    function box(selector) {
      const element = document.querySelector(selector);
      if (!element) {
        return null;
      }
      const rect = element.getBoundingClientRect();
      const visibleHeight = Math.max(0, Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0));
      const visibleWidth = Math.max(0, Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0));
      return {
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        viewportCoverage: Number((visibleHeight / viewportHeight).toFixed(3)),
        inViewport: visibleHeight > 24 && visibleWidth > 24,
      };
    }
    const detailEl = document.querySelector('#task-detail');
    const closeEl = document.querySelector('#detail-close');
    const closeRect = closeEl?.getBoundingClientRect();
    return {
      viewportHeight,
      viewportWidth,
      detail: box('#task-detail'),
      note: box('#detail-note'),
      close: box('#detail-close'),
      detailPosition: detailEl ? getComputedStyle(detailEl).position : null,
      closeTop: closeRect ? Math.round(closeRect.top) : null,
      closeRight: closeRect ? Math.round(closeRect.right) : null,
    };
  });

  let noteValue = '';
  let noteFillError = '';
  let noteLinkPresentation = null;
  try {
    const noteUrl = 'https://www.youtube.com/watch?v=8wysIxzqgPI&t=6s';
    await page.locator('#detail-note').tap();
    await page.locator('#detail-note').fill(`- watching: [${noteUrl}](${noteUrl})`);
    await page.locator('.detail-title-display').tap();
    const notePreview = page.locator('[data-note-link-preview]');
    await notePreview.waitFor();
    noteLinkPresentation = {
      text: (await notePreview.textContent()).trim(),
      href: await notePreview.locator('[data-note-link]').getAttribute('href'),
      raw: await page.locator('#detail-note').inputValue(),
    };
    const linkPopup = page.waitForEvent('popup', { timeout: 1000 }).then((popup) => popup.url()).catch(() => '');
    await notePreview.locator('[data-note-link]').click();
    noteLinkPresentation.linkPopupUrl = await linkPopup;
    noteLinkPresentation.linkClickEdit = await page.evaluate(
      () => document.activeElement?.id === 'detail-note',
    );
    await page.locator('.detail-title-display').tap();
    await notePreview.waitFor();
    await notePreview.locator('[data-note-link-edit]').press('Enter');
    noteLinkPresentation.keyboardEdit = await page.evaluate(
      () => document.activeElement?.id === 'detail-note',
    );
    // Long notes scroll inside the preview; a tap below the first screenful must still open the editor.
    const longLines = Array.from({ length: 40 }, (_, index) => `- line ${index + 1}`);
    await page.locator('#detail-note').fill([...longLines, `- watching: ${noteUrl}`, '- last line'].join('\n'));
    await page.locator('.detail-title-display').tap();
    await notePreview.waitFor();
    await notePreview.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    const previewBox = await notePreview.boundingBox();
    await page.mouse.click(previewBox.x + 24, previewBox.y + previewBox.height - 12);
    noteLinkPresentation.scrolledClickEdit = await page.evaluate(
      () => document.activeElement?.id === 'detail-note',
    );
    await page.locator('#detail-note').fill('iPhone note');
    noteValue = await page.locator('#detail-note').inputValue();
  } catch (error) {
    noteFillError = error instanceof Error ? error.message : String(error);
  }

  await page.locator('.detail-start-picker').scrollIntoViewIfNeeded();
  const closeAfterScroll = await page.evaluate(() => {
    const closeEl = document.querySelector('#detail-close');
    if (!closeEl) {
      return null;
    }
    const rect = closeEl.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const visibleHeight = Math.max(0, Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0));
    const visibleWidth = Math.max(0, Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0));
    return {
      top: Math.round(rect.top),
      right: Math.round(rect.right),
      inViewport: visibleHeight > 24 && visibleWidth > 24,
    };
  });
  await page.locator('.detail-start-picker').tap();
  await page.waitForSelector('.calendar-popover');
  const calendar = await page.evaluate(() => {
    const popover = document.querySelector('.calendar-popover');
    const rect = popover?.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    return {
      exists: Boolean(popover),
      top: rect ? Math.round(rect.top) : null,
      bottom: rect ? Math.round(rect.bottom) : null,
      inViewport: Boolean(
        rect &&
          rect.width > 8 &&
          rect.height > 8 &&
          rect.bottom > 0 &&
          rect.top < viewportHeight &&
          rect.left < viewportWidth &&
          rect.right > 0,
      ),
    };
  });

  await page.keyboard.press('Escape');
  await page.locator('#detail-close').tap();
  await page.waitForSelector('#task-detail', { state: 'detached' });
  const detailClosed = await page.evaluate(() => !document.querySelector('#task-detail'));

  await page.close();
  return { layout, noteValue, noteFillError, noteLinkPresentation, calendar, closeAfterScroll, detailClosed };
}

function assertMobileTaskDetail(result) {
  const failures = [];
  if (
    result.layout.detailPosition !== 'fixed' ||
    !result.layout.detail ||
    result.layout.detail.viewportCoverage < 0.98 ||
    result.layout.detail.top > 2 ||
    result.layout.detail.width < (result.layout.viewportWidth ?? 0) - 2
  ) {
    failures.push(
      `iPhone task details are not a full-screen overlay after Open: ${JSON.stringify(result.layout)}`,
    );
  }
  if (
    !result.layout.close?.inViewport ||
    result.layout.closeTop == null ||
    result.layout.closeTop > 96 ||
    result.layout.closeRight == null ||
    (result.layout.viewportWidth ?? 0) - result.layout.closeRight > 80
  ) {
    failures.push(
      `iPhone task detail close is not pinned to the top right: ${JSON.stringify({
        close: result.layout.close,
        closeTop: result.layout.closeTop,
        closeRight: result.layout.closeRight,
        viewportWidth: result.layout.viewportWidth,
      })}`,
    );
  }
  if (!result.closeAfterScroll?.inViewport || result.closeAfterScroll.top > 96) {
    failures.push(
      `iPhone task detail close scrolled away with the note: ${JSON.stringify(result.closeAfterScroll)}`,
    );
  }
  if (!result.detailClosed) {
    failures.push('iPhone task details could not be closed from the overlay');
  }
  if (!result.layout.note?.inViewport) {
    failures.push(`iPhone task note is not on screen after Open: ${JSON.stringify(result.layout.note)}`);
  }
  if (result.noteValue !== 'iPhone note' || result.noteFillError) {
    failures.push(`iPhone task note could not be edited: ${JSON.stringify({
      noteValue: result.noteValue,
      noteFillError: result.noteFillError,
    })}`);
  }
  const expectedNoteUrl = 'https://www.youtube.com/watch?v=8wysIxzqgPI&t=6s';
  if (
    result.noteLinkPresentation?.text !== `- watching: ${expectedNoteUrl}` ||
    result.noteLinkPresentation?.href !== expectedNoteUrl ||
    result.noteLinkPresentation?.raw !==
      `- watching: [${expectedNoteUrl}](${expectedNoteUrl})` ||
    result.noteLinkPresentation?.linkPopupUrl ||
    !result.noteLinkPresentation?.linkClickEdit ||
    !result.noteLinkPresentation?.keyboardEdit ||
    !result.noteLinkPresentation?.scrolledClickEdit
  ) {
    failures.push(
      `task note link was not rendered cleanly or could not return to editing: ${JSON.stringify(result.noteLinkPresentation)}`,
    );
  }
  if (!result.calendar.inViewport) {
    failures.push(`iPhone time picker opened off screen: ${JSON.stringify(result.calendar)}`);
  }
  return failures;
}

async function inspectNativeWorkspaceLayout(viewport) {
  const page = await browser.newPage({ viewport });
  await page.addInitScript(() => {
    window.__doneLogNativeChrome = true;
    const now = new Date();
    const dayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const at = (hour, minute) =>
      new Date(`${dayKey}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`).toISOString();

    localStorage.setItem('done-log-client-id', 'ui-smoke-native-layout');
    localStorage.setItem(
      'done-log-state',
      JSON.stringify({
        todos: [
          {
            id: 'ui-smoke-native-paused',
            title: 'Exploring Grok Bot with a longer title',
            createdAt: at(8, 0),
            completedAt: null,
            firstStartedAt: at(9, 15),
            activeStartedAt: null,
            trackedSeconds: 44 * 60,
            timeSegments: [
              {
                startedAt: at(9, 15),
                endedAt: at(9, 59),
                durationSeconds: 44 * 60,
              },
            ],
            note: 'A note that should fit correctly in the native details panel.',
          },
          {
            id: 'ui-smoke-native-completed',
            title: 'Completed native layout check',
            createdAt: at(11, 30),
            completedAt: at(12, 49),
            trackedSeconds: 30 * 60,
          },
        ],
      }),
    );
  });
  await page.goto(targetUrl.toString(), { waitUntil: 'networkidle' });

  const defaultLayout = await captureNativeLayout(page);
  await page.click('[data-todo-id="ui-smoke-native-paused"] .open-task-button');
  await page.waitForSelector('.task-detail');
  const detailLayout = await captureNativeLayout(page);

  const views = {};
  await page.click('#detail-close');
  const viewPanels = {
    Board: '.board-panel',
    Calendar: '.calendar-panel',
    Inbox: '.inbox-panel',
    Waiting: '.waiting-panel',
    History: '.history-panel',
    Meetings: '.meetings-panel',
    Settings: '.settings-panel',
  };
  for (const [label, panelSelector] of Object.entries(viewPanels)) {
    await page.getByRole('button', { name: label, exact: true }).click();
    await page.waitForSelector(panelSelector);
    views[label] = await page.evaluate(() => {
      const workspace = document.querySelector('.workspace');
      const panel = workspace?.querySelector(
        '.board-panel, .calendar-panel, .inbox-panel, .waiting-panel, .history-panel, .meetings-panel, .settings-panel',
      );
      return {
        workspaceOverflow: Math.max(0, (workspace?.scrollWidth ?? 0) - (workspace?.clientWidth ?? 0)),
        panelOverflow: Math.max(0, (panel?.scrollWidth ?? 0) - (panel?.clientWidth ?? 0)),
      };
    });
  }

  await page.close();
  return { defaultLayout, detailLayout, views };
}

async function captureNativeLayout(page) {
  return page.evaluate(() => {
    function boundsFor(element) {
      const rect = element?.getBoundingClientRect();
      return {
        left: Math.round(rect?.left ?? 0),
        right: Math.round(rect?.right ?? 0),
        top: Math.round(rect?.top ?? 0),
        bottom: Math.round(rect?.bottom ?? 0),
        width: Math.round(rect?.width ?? 0),
        height: Math.round(rect?.height ?? 0),
      };
    }

    const measure = (selector) => {
      const element = document.querySelector(selector);
      return {
        ...boundsFor(element),
        overflow: Math.max(0, (element?.scrollWidth ?? 0) - (element?.clientWidth ?? 0)),
      };
    };

    const measureGroup = (parentSelector, childSelector) => {
      const parent = document.querySelector(parentSelector);
      return {
        parent: boundsFor(parent),
        children: Array.from(parent?.querySelectorAll(childSelector) ?? []).map(boundsFor),
      };
    };

    return {
      workspace: measure('.workspace'),
      workspaceInsets: (() => {
        const style = getComputedStyle(document.querySelector('.workspace'));
        return {
          top: Number.parseFloat(style.paddingTop),
          right: Number.parseFloat(style.paddingRight),
          bottom: Number.parseFloat(style.paddingBottom),
          left: Number.parseFloat(style.paddingLeft),
        };
      })(),
      taskPanel: measure('.task-panel'),
      taskTitle: measure('#task-heading'),
      taskPanelNote: measure('.task-panel > .panel-note'),
      workspaceTabs: measure('.task-panel > .view-toggle'),
      taskToolbar: measure('.task-toolbar'),
      taskSearch: measure('#task-search'),
      taskContent: measure('[data-todo-id="ui-smoke-native-paused"] .task-content'),
      taskActions: measure('[data-todo-id="ui-smoke-native-paused"] .task-actions'),
      quickAddControls: measureGroup('.task-toolbar', '.task-search, .new-task-button'),
      taskCardControls: measureGroup(
        '[data-todo-id="ui-smoke-native-paused"]',
        ':scope > .task-content, :scope > .task-actions',
      ),
      taskActionControls: measureGroup(
        '[data-todo-id="ui-smoke-native-paused"] .task-actions',
        ':scope > button',
      ),
      summaryPanel: measure('.summary-panel'),
      summaryTop: measure('.summary-top'),
      summaryTitle: measure('#summary-heading'),
      firstSummaryCard: measure('.summary-section li'),
      summaryProgress: measure('.recap-completion-count'),
      taskDetail: measure('.task-detail'),
      taskDetailContent: measure('.task-detail .detail-title-display'),
      flowRailDisplay: getComputedStyle(document.querySelector('.flow-rail')).display,
      redundantLabels: Array.from(document.querySelectorAll('.rail-caption, .task-detail .eyebrow'))
        .map((element) => element.textContent.trim())
        .filter(Boolean),
    };
  });
}

function assertNativeWorkspaceLayout(result) {
  const failures = [];
  for (const [state, layout] of Object.entries({
    default: result.defaultLayout,
    detail: result.detailLayout,
  })) {
    for (const [area, metrics] of Object.entries(layout)) {
      if (metrics.overflow > 1) {
        failures.push(`native ${state} ${area} overflows by ${metrics.overflow}px`);
      }
    }
  }
  if (result.defaultLayout.taskSearch.width < 180) {
    failures.push(
      `native task search is too narrow at ${result.defaultLayout.taskSearch.width}px`,
    );
  }
  if (result.defaultLayout.flowRailDisplay !== 'none') {
    failures.push('native focus rail still consumes a layout column');
  }
  for (const [edge, inset] of Object.entries(result.defaultLayout.workspaceInsets)) {
    if (inset < 10) {
      failures.push(`native workspace ${edge} inset is only ${inset}px`);
    }
  }
  if (Math.abs(result.defaultLayout.taskTitle.left - result.defaultLayout.taskPanelNote.left) > 1) {
    failures.push('native Today heading does not align with the task content grid');
  }
  if (Math.abs(result.defaultLayout.taskTitle.top - result.defaultLayout.summaryTitle.top) > 1) {
    failures.push('native panel headings do not share a horizontal baseline');
  }
  if (
    Math.abs(result.defaultLayout.workspaceTabs.left - result.defaultLayout.taskToolbar.left) > 1 ||
    Math.abs(result.defaultLayout.workspaceTabs.right - result.defaultLayout.taskToolbar.right) > 1
  ) {
    failures.push('native task blocks do not share horizontal edges');
  }
  if (Math.abs(result.defaultLayout.firstSummaryCard.left - result.defaultLayout.summaryTitle.left) > 1) {
    failures.push('native recap cards do not align with the summary content grid');
  }
  if (result.defaultLayout.summaryProgress.width < 44) {
    failures.push('native recap header is missing the completed-today status');
  }
  // A narrow recap panel stacks its header; it must stay left-aligned instead of centering.
  for (const [state, layout] of Object.entries({
    default: result.defaultLayout,
    detail: result.detailLayout,
  })) {
    if (layout.summaryPanel.width > 0 && layout.summaryTitle.left - layout.summaryTop.left > 4) {
      failures.push(
        `native ${state} recap heading is not left-aligned in its header: ${JSON.stringify({
          headingLeft: layout.summaryTitle.left,
          headerLeft: layout.summaryTop.left,
        })}`,
      );
    }
  }
  for (const [state, layout] of Object.entries({
    default: result.defaultLayout,
    detail: result.detailLayout,
  })) {
    if (layout.redundantLabels.length) {
      failures.push(`native ${state} still shows redundant labels: ${layout.redundantLabels.join(', ')}`);
    }
  }
  if (result.detailLayout.taskContent.width < 180) {
    failures.push(
      `native detail-open task content is too narrow at ${result.detailLayout.taskContent.width}px`,
    );
  }
  if (result.detailLayout.taskDetail.width < 320 || result.detailLayout.taskDetailContent.width < 240) {
    failures.push(
      `native detail panel is too narrow: ${JSON.stringify({
        panel: result.detailLayout.taskDetail,
        content: result.detailLayout.taskDetailContent,
      })}`,
    );
  }
  for (const [state, layout] of Object.entries({
    default: result.defaultLayout,
    detail: result.detailLayout,
  })) {
    failures.push(...assertControlGroup(layout.quickAddControls, `native ${state} quick-add controls`, 44));
    failures.push(...assertControlGroup(layout.taskCardControls, `native ${state} task-card regions`));
    failures.push(...assertControlGroup(layout.taskActionControls, `native ${state} task actions`, 42));
  }
  for (const [view, metrics] of Object.entries(result.views)) {
    if (metrics.workspaceOverflow > 1 || metrics.panelOverflow > 1) {
      failures.push(`native ${view} view has horizontal overflow: ${JSON.stringify(metrics)}`);
    }
  }
  return failures;
}

function assertControlGroup(group, label, minimumWidth = 1) {
  const failures = [];
  for (const [index, child] of group.children.entries()) {
    if (child.width < minimumWidth) {
      failures.push(`${label} child ${index + 1} is only ${child.width}px wide`);
    }
    if (child.left < group.parent.left - 1 || child.right > group.parent.right + 1) {
      failures.push(`${label} child ${index + 1} escapes its parent`);
    }
  }
  for (let firstIndex = 0; firstIndex < group.children.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < group.children.length; secondIndex += 1) {
      if (rectanglesOverlap(group.children[firstIndex], group.children[secondIndex])) {
        failures.push(`${label} children ${firstIndex + 1} and ${secondIndex + 1} overlap`);
      }
    }
  }
  return failures;
}

function rectanglesOverlap(first, second) {
  return (
    first.left < second.right - 1 &&
    first.right > second.left + 1 &&
    first.top < second.bottom - 1 &&
    first.bottom > second.top + 1
  );
}

async function inspectRecapDayNavigation(viewport) {
  const page = await browser.newPage({ viewport });
  await page.goto(targetUrl.toString(), { waitUntil: 'networkidle' });

  const initialDate = await page.locator('#summary-date').getAttribute('data-value');
  await page.locator('#summary-previous-day').click();
  const previousDate = await page.locator('#summary-date').getAttribute('data-value');
  await page.locator('#summary-next-day').click();
  const returnedDate = await page.locator('#summary-date').getAttribute('data-value');
  await page.locator('#summary-next-day').click();
  const nextDate = await page.locator('#summary-date').getAttribute('data-value');
  await page.close();

  return { initialDate, previousDate, returnedDate, nextDate };
}

async function inspectDuplicateTask(viewport) {
  const page = await browser.newPage({ viewport });
  await page.addInitScript(() => {
    localStorage.setItem('done-log-client-id', 'ui-smoke-duplicate-task');
    localStorage.setItem(
      'done-log-state',
      JSON.stringify({
        todos: [
          {
            id: 'existing-task',
            title: 'Review launch checklist',
            createdAt: new Date().toISOString(),
            completedAt: null,
          },
        ],
      }),
    );
  });
  await page.goto(targetUrl.toString(), { waitUntil: 'networkidle' });
  await page.locator('.new-task-button').click();
  await page.fill('#overlay-todo-title', 'Review launch checklst');
  await page.click('.composer-add');
  await page.waitForFunction(() =>
    document.querySelector('#sync-status')?.textContent.includes('Duplicate task'),
  );

  const result = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('done-log-state'));
    return {
      taskCount: state.todos.length,
      draft: document.querySelector('#overlay-todo-title')?.value,
      message: document.querySelector('#sync-status')?.textContent.trim(),
    };
  });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Board', exact: true }).click();
  await page.waitForSelector('.board-panel');
  await page.click('[data-column="not_started"] .board-new-task');
  await page.fill('[data-board-draft="not_started"]', 'Review launch cheklist');
  await page.click('[data-column="not_started"] .board-draft-submit');
  result.board = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('done-log-state'));
    return {
      taskCount: state.todos.length,
      draft: document.querySelector('[data-board-draft="not_started"]')?.value,
    };
  });
  await page.close();
  return result;
}

async function inspectRunningTimingEdit(viewport) {
  const page = await browser.newPage({ viewport, timezoneId: 'America/Los_Angeles' });
  await page.clock.setFixedTime(new Date('2026-08-04T23:30:00.000Z'));
  await page.addInitScript(() => {
    localStorage.setItem('done-log-client-id', 'ui-smoke-running-timing');
    localStorage.setItem(
      'done-log-state',
      JSON.stringify({
        todos: [
          {
            id: 'running-timing-task',
            title: 'Forgotten start time',
            createdAt: '2026-08-04T23:30:00.000Z',
            completedAt: null,
            firstStartedAt: '2026-08-04T23:30:00.000Z',
            activeStartedAt: '2026-08-04T23:30:00.000Z',
            trackedSeconds: 0,
            timeSegments: [],
          },
        ],
      }),
    );
  });
  await page.goto(targetUrl.toString(), { waitUntil: 'networkidle' });
  await page.clock.setFixedTime(new Date('2026-08-04T23:31:00.000Z'));
  await page.click('[data-todo-id="running-timing-task"] .open-task-button');
  await page.waitForSelector('.detail-start-picker');
  await page.locator('.detail-start-picker').click();
  await page.fill('.calendar-hour-input', '12');
  await page.fill('.calendar-minute-input', '30');
  await page.locator('.calendar-period-button', { hasText: 'PM' }).click();
  await page.click('.calendar-apply');
  await page.waitForTimeout(100);
  const result = await page.evaluate(() => {
    const task = JSON.parse(localStorage.getItem('done-log-state')).todos.find(
      (item) => item.id === 'running-timing-task',
    );
    return {
      completed: Boolean(task?.completedAt),
      activeStartedAt: task?.activeStartedAt,
      trackedSeconds: task?.trackedSeconds,
      error: document.querySelector('.detail-timing-error')?.textContent.trim() ?? '',
      startText: document.querySelector('.detail-start-picker')?.textContent.trim(),
      endText: document.querySelector('.detail-end-picker')?.textContent.trim(),
    };
  });
  await page.close();
  return result;
}

function assertDuplicateTask(result) {
  const failures = [];
  if (result.taskCount !== 1) {
    failures.push(`duplicate task creation changed the task count: ${JSON.stringify(result)}`);
  }
  if (result.draft !== 'Review launch checklst') {
    failures.push(`duplicate task creation cleared the draft: ${JSON.stringify(result)}`);
  }
  if (result.message !== 'Duplicate task: "Review launch checklist" is already open') {
    failures.push(`duplicate task creation did not identify the match: ${JSON.stringify(result)}`);
  }
  if (result.board.taskCount !== 1 || result.board.draft !== 'Review launch cheklist') {
    failures.push(`board duplicate task creation was not blocked: ${JSON.stringify(result)}`);
  }
  return failures;
}

async function inspectWorkspaceNavigation(viewport) {
  const page = await browser.newPage({ viewport });
  await page.addInitScript(() => {
    if (sessionStorage.getItem('ui-smoke-navigation-seeded')) {
      return;
    }

    sessionStorage.setItem('ui-smoke-navigation-seeded', '1');
    localStorage.setItem('done-log-client-id', 'ui-smoke-navigation');
    localStorage.setItem('done-log-state', JSON.stringify({ todos: [] }));
    localStorage.setItem('done-log-view', 'flow');
  });
  await page.goto(targetUrl.toString(), { waitUntil: 'networkidle' });

  const initialNavigation = await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('.view-toggle-button'));
    const settingsTab = tabs.find((tab) => tab.textContent.trim() === 'Settings');
    const settingsGroup = settingsTab?.closest('.settings-tab-group');
    const separatorStyle = settingsGroup ? getComputedStyle(settingsGroup, '::before') : null;
    const separatorColor = separatorStyle?.backgroundColor ?? 'transparent';
    const alphaMatch = separatorColor.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([0-9.]+)\)/);

    return {
      labels: tabs.map((tab) => tab.textContent.trim()),
      separatorWidth: Number.parseFloat(separatorStyle?.width ?? '0'),
      separatorAlpha: alphaMatch ? Number.parseFloat(alphaMatch[1]) : separatorColor === 'transparent' ? 0 : 1,
    };
  });

  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const clickedSettings = await page.evaluate(() => ({
    heading: document.querySelector('#settings-heading')?.textContent.trim() ?? '',
    settingsIsActive:
      document.querySelector('.settings-tab-group .view-toggle-button')?.getAttribute('aria-current') === 'page',
  }));

  await page.evaluate(() => localStorage.setItem('done-log-view', 'profile'));
  await page.reload({ waitUntil: 'networkidle' });
  const migratedHeading = await page.locator('#settings-heading').textContent();

  await page.close();
  return { ...initialNavigation, ...clickedSettings, migratedHeading: migratedHeading?.trim() ?? '' };
}

function assertWorkspaceNavigation(navigation) {
  const failures = [];
  if (navigation.labels.includes('Profile')) {
    failures.push('Workspace navigation still includes the duplicate Profile tab');
  }
  if (navigation.heading !== 'Settings' || !navigation.settingsIsActive) {
    failures.push('Clicking the in-app Settings tab did not open Settings');
  }
  if (navigation.migratedHeading !== 'Settings') {
    failures.push('A saved Profile view did not migrate to Settings');
  }
  if (navigation.separatorWidth < 1 || navigation.separatorAlpha <= 0) {
    failures.push('Settings does not have a visible separator from workspace tabs');
  }
  return failures;
}

async function inspectOverlayAddedTask(viewport) {
  const page = await browser.newPage({ viewport });
  await page.addInitScript(() => {
    localStorage.setItem('done-log-client-id', 'ui-smoke-overlay-add');
    localStorage.setItem('done-log-state', JSON.stringify({ todos: [] }));
  });
  await page.goto(targetUrl.toString(), { waitUntil: 'networkidle' });
  await page.locator('.new-task-button').click();
  await page.fill('#overlay-todo-title', 'Fix');
  await page.click('.composer-add');
  await page.waitForSelector('.todo-item');
  await page.waitForTimeout(750);

  const taskMetrics = await page.evaluate(() => {
    const item = document.querySelector('.todo-item');
    const itemRect = item?.getBoundingClientRect();
    return {
      itemHeight: Math.round(itemRect?.height ?? 0),
      itemAlignSelf: item ? getComputedStyle(item).alignSelf : null,
      alignContent: getComputedStyle(document.querySelector('.todo-list')).alignContent,
      overlayOpen: Boolean(document.querySelector('.composer-overlay[open]')),
    };
  });

  await page.close();
  return taskMetrics;
}

async function inspectBoardCardLayout(viewport) {
  const page = await browser.newPage({ viewport });
  await page.addInitScript(() => {
    const now = new Date();
    const dayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const at = (hour, minute) =>
      new Date(
        `${dayKey}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`,
      ).toISOString();
    localStorage.setItem('done-log-client-id', 'ui-smoke-board-card');
    localStorage.setItem('done-log-view', 'board');
    localStorage.setItem(
      'done-log-state',
      JSON.stringify({
        todos: [
          {
            id: 'ui-smoke-board-progress',
            title: 'Board progress wrapping task',
            createdAt: at(8, 0),
            completedAt: at(12, 0),
            firstStartedAt: at(11, 0),
            trackedSeconds: 3600,
            progressLabel:
              'A long progress note that should wrap inside the card instead of becoming a giant pill that pushes the timing details out of view.',
          },
        ],
      }),
    );
  });
  await page.goto(targetUrl.toString(), { waitUntil: 'networkidle' });
  await page.waitForSelector('.board-card-progress');
  const result = await page.evaluate(() => {
    const progress = document.querySelector('.board-card-progress');
    const meta = document.querySelector('.board-card-meta');
    const timing = document.querySelector('.board-card-timing');
    const label = timing?.querySelector('.board-card-timing-label');
    const time = timing?.querySelector('time');
    const progressStyle = progress ? getComputedStyle(progress) : null;
    const timingStyle = timing ? getComputedStyle(timing) : null;
    return {
      progressWidth: Math.round(progress?.getBoundingClientRect().width ?? 0),
      metaWidth: Math.round(meta?.getBoundingClientRect().width ?? 0),
      progressDisplay: progressStyle?.display,
      progressBorderRadius: progressStyle?.borderRadius,
      progressWhiteSpace: progressStyle?.whiteSpace,
      progressOverflowWrap: progressStyle?.overflowWrap,
      timingGap: Number.parseFloat(timingStyle?.gap ?? '0'),
      timingLabelWidth: Math.round(label?.getBoundingClientRect().width ?? 0),
      timingTimeWidth: Math.round(time?.getBoundingClientRect().width ?? 0),
      nativeCalendarInputCount: document.querySelectorAll(
        '.board-panel input[type="date"], .board-panel input[type="datetime-local"]',
      ).length,
      hasBoardDayPicker: Boolean(document.querySelector('.board-day-picker')),
    };
  });
  await page.close();
  return result;
}

async function inspectViewport(viewport, isMobile) {
  const page = await browser.newPage({ viewport, isMobile, timezoneId: 'America/Los_Angeles' });
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
          {
            id: 'ui-smoke-today-task',
            title: 'Today section task',
            createdAt: completedAt(9, 5),
            completedAt: null,
            note: '',
          },
          {
            id: 'ui-smoke-manual-timing-task',
            title: 'Manual timing task',
            createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            completedAt: null,
            note: '',
          },
          ...Array.from({ length: 14 }, (_, index) => ({
            id: `ui-smoke-overflow-task-${index}`,
            title: `Overflow task ${index + 1}`,
            createdAt: new Date(Date.UTC(2026, 5, 8, 8, index + 1, 0)).toISOString(),
            completedAt: null,
            firstStartedAt: index === 0 ? completedAt(8, 10) : null,
            activeStartedAt: index === 0 ? completedAt(8, 10) : null,
            trackedSeconds: index === 0 ? 180 : 0,
          })),
          {
            id: 'ui-smoke-paused-task',
            title: 'Paused task',
            createdAt: completedAt(9, 10),
            completedAt: null,
            firstStartedAt: completedAt(9, 15),
            activeStartedAt: null,
            trackedSeconds: 10 * 60,
            timeSegments: [
              {
                startedAt: completedAt(9, 15),
                endedAt: completedAt(9, 25),
                durationSeconds: 10 * 60,
              },
            ],
          },
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
  const manualTiming = isMobile ? null : await exerciseManualTiming(page);
  const pausedTimeline = isMobile ? null : await inspectPausedTimeline(page);
  const summaryTimeEdit = isMobile ? null : await exerciseSummaryTimeEditing(page);
  const taskFlowChecks = isMobile ? null : await exerciseParallelAndReopen(page);
  const editChecks = isMobile ? null : await exerciseDetailEditing(page);
  const newTaskCalendarClear = isMobile ? null : await exerciseNewTaskCalendarClear(page);

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
      calendarPresentation: {
        nativeInputCount: document.querySelectorAll('input[type="date"], input[type="datetime-local"]').length,
        hasNewTaskPicker: Boolean(document.querySelector('.new-task-button[aria-haspopup="dialog"]')),
        hasSummaryPicker: Boolean(document.querySelector('#summary-date.calendar-trigger')),
      },
      summaryBuckets: Array.from(document.querySelectorAll('.summary-section h3')).map((element) => element.textContent.trim()),
      summaryDurations: Array.from(document.querySelectorAll('.summary-duration')).map((element) => element.textContent.trim()),
      summaryTiming: Array.from(
        document.querySelectorAll('.summary-time-label, .summary-timing'),
      ).map((element) => element.textContent.trim()),
      taskTiming: Array.from(document.querySelectorAll('.task-timing')).map((element) => element.textContent.trim()),
      taskSections: Array.from(document.querySelectorAll('.task-list-section')).map((section) => ({
        heading: section.querySelector('h2')?.textContent.trim(),
        count: section.querySelector('.section-count')?.textContent.trim(),
        ids: Array.from(section.querySelectorAll('.todo-item')).map((item) => item.dataset.todoId),
      })),
      pausedTodayPresentation: (() => {
        const row = document.querySelector('[data-todo-id="ui-smoke-paused-task"]');
        return {
          section: row?.closest('.task-list-section')?.querySelector('h2')?.textContent.trim(),
          state: row?.getAttribute('data-task-state'),
          badge: row?.querySelector('.task-state-badge')?.textContent.trim(),
          animationName: row ? getComputedStyle(row.querySelector('.task-block-dot')).animationName : null,
          boxShadow: row ? getComputedStyle(row.querySelector('.task-block-dot')).boxShadow : null,
        };
      })(),
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
        '#task-search': rectFor('#task-search'),
        '.new-task-button': rectFor('.new-task-button'),
        '#summary-date': rectFor('#summary-date'),
        '#summary-previous-day': rectFor('#summary-previous-day'),
        '#summary-next-day': rectFor('#summary-next-day'),
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
        '.new-task-button': transitionFor('.new-task-button'),
        '.todo-item button': transitionFor('.todo-item button'),
        '.theme-toggle': transitionFor('.theme-toggle'),
      },
      timerControl: (() => {
        const item = document.querySelector('.todo-item');
        const button = item?.querySelector('.timer-button');
        const other = item?.querySelector('.open-task-button');
        const visibleLabel = Array.from(button?.querySelectorAll('span') ?? []).find((span) => {
          const style = getComputedStyle(span);
          const rect = span.getBoundingClientRect();
          return style.position !== 'absolute' && rect.width > 1 && rect.height > 1;
        });
        const buttonRect = button?.getBoundingClientRect();
        const otherRect = other?.getBoundingClientRect();
        return {
          visibleText: visibleLabel?.textContent.trim() ?? '',
          width: Math.round(buttonRect?.width ?? 0),
          otherWidth: Math.round(otherRect?.width ?? 0),
          ariaLabel: button?.getAttribute('aria-label') ?? '',
          hasDelete: Boolean(item?.querySelector('.delete-task-button')),
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

  const rowDelete = isMobile ? null : await exerciseRowDelete(page);

  await page.close();
  return {
    viewport,
    editChecks,
    manualTiming,
    pausedTimeline,
    summaryTimeEdit,
    taskFlowChecks,
    newTaskCalendarClear,
    rowDelete,
    ...metrics,
  };
}

async function exerciseRowDelete(page) {
  const button = page.locator('[data-todo-id="ui-smoke-today-task"] .delete-task-button');
  const visible = await button.isVisible().catch(() => false);
  if (!visible) {
    return { visible: false, ariaLabel: '', removedFromList: false, removedFromState: false };
  }
  const ariaLabel = (await button.getAttribute('aria-label')) ?? '';
  await button.click();
  await page.waitForFunction(() => {
    const state = JSON.parse(localStorage.getItem('done-log-state'));
    return !state.todos.some((item) => item.id === 'ui-smoke-today-task') &&
      !document.querySelector('[data-todo-id="ui-smoke-today-task"]');
  });
  const after = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('done-log-state'));
    return {
      removedFromList: !document.querySelector('[data-todo-id="ui-smoke-today-task"]'),
      removedFromState: !state.todos.some((item) => item.id === 'ui-smoke-today-task'),
    };
  });
  return { visible, ariaLabel, ...after };
}

async function exerciseNewTaskCalendarClear(page) {
  await page.locator('.new-task-button').click();
  await page.waitForSelector('#overlay-todo-due-date');
  await page.locator('#overlay-todo-due-date').click();
  await page.waitForSelector('.calendar-popover');
  const clearAvailable = Boolean(
    await page.locator('.calendar-footer button', { hasText: 'Clear' }).count(),
  );
  const triggerText = (await page.locator('#overlay-todo-due-date').textContent())?.trim() ?? '';
  const nativeInputCount = await page.locator('input[type="date"], input[type="datetime-local"]').count();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (!(await page.locator('.composer-overlay[open]').count())) {
      break;
    }
    await page.keyboard.press('Escape');
  }
  return {
    clearAvailable,
    triggerText,
    nativeInputCount,
  };
}

async function exerciseManualTiming(page) {
  await page.click('[data-todo-id="ui-smoke-manual-timing-task"] .open-task-button');
  await page.waitForSelector('.detail-start-picker');

  async function choosePastDateTime(selector, hour, minute, period, choosePreviousMonth = true) {
    await page.locator(selector).click();
    await page.waitForSelector('.calendar-popover');
    if (choosePreviousMonth) {
      const currentMonthTitle = await page.locator('.calendar-month-title').textContent();
      await page.locator('.calendar-nav button[aria-label="Previous month"]').click();
      await page.waitForFunction(
        (previousTitle) =>
          document.querySelector('.calendar-month-title')?.textContent !== previousTitle,
        currentMonthTitle,
      );
      await page.locator('.calendar-day:not(.is-muted)').last().click();
    }
    await page.fill('.calendar-hour-input', String(hour).padStart(2, '0'));
    await page.fill('.calendar-minute-input', String(minute).padStart(2, '0'));
    await page.locator('.calendar-period-button', { hasText: period }).click();
    await page.click('.calendar-apply');
  }

  await choosePastDateTime('.detail-end-picker', 10, 0, 'AM');
  await choosePastDateTime('.detail-start-picker', 11, 0, 'AM');
  const invalidError = await page.locator('.detail-timing-error').textContent();

  await choosePastDateTime('.detail-start-picker', 9, 0, 'AM', false);
  await page.waitForFunction(() => {
    const state = JSON.parse(localStorage.getItem('done-log-state'));
    const task = state.todos.find((item) => item.id === 'ui-smoke-manual-timing-task');
    return Boolean(task?.firstStartedAt) && !task?.completedAt;
  });
  await page.getByRole('button', { name: 'Add time block', exact: true }).click();
  await choosePastDateTime('.time-block-start-picker', 11, 0, 'AM');
  const incompleteBlockError = await page.locator('.detail-timing-error').textContent();
  await choosePastDateTime('.time-block-end-picker', 11, 30, 'AM');
  await page.waitForFunction(() => {
    const state = JSON.parse(localStorage.getItem('done-log-state'));
    const task = state.todos.find((item) => item.id === 'ui-smoke-manual-timing-task');
    return task?.timeSegments?.length === 2 && task?.trackedSeconds === 90 * 60;
  });
  const result = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('done-log-state'));
    const task = state.todos.find((item) => item.id === 'ui-smoke-manual-timing-task');
    const completedAt = task?.completedAt ? new Date(task.completedAt) : null;
    return {
      completed: Boolean(task?.completedAt),
      trackedSeconds: task?.trackedSeconds,
      timeBlockCount: task?.timeSegments?.length,
      totalLabel: document.querySelector('.time-block-heading > strong')?.textContent.trim(),
      completedDayKey: completedAt
        ? `${completedAt.getFullYear()}-${String(completedAt.getMonth() + 1).padStart(2, '0')}-${String(completedAt.getDate()).padStart(2, '0')}`
        : null,
    };
  });
  result.incompleteBlockError = incompleteBlockError?.trim() ?? '';
  result.invalidError = invalidError?.trim() ?? '';
  await page.click('#detail-close');
  await page.locator('#summary-date').click();
  await page.waitForSelector('.calendar-popover');
  await page.locator('.calendar-footer button', { hasText: 'Today' }).click();
  return result;
}

async function inspectPausedTimeline(page) {
  await page.click('[data-todo-id="ui-smoke-paused-task"] .open-task-button');
  await page.waitForSelector('.time-segment-history');
  const result = await page.evaluate(() => ({
    heading: document.querySelector('.time-block-heading h3')?.textContent.trim(),
    blockCount: document.querySelectorAll('.time-block-item').length,
    total: document.querySelector('.time-block-heading > strong')?.textContent.trim(),
    hasAddButton: Boolean(document.querySelector('.time-block-add')),
  }));
  await page.click('#detail-close');
  return result;
}

async function exerciseSummaryTimeEditing(page) {
  await page.locator('#summary-date').click();
  await page.waitForSelector('.calendar-popover');
  const summaryCalendarPresentation = await page.evaluate(() => ({
    calendarVisible: Boolean(document.querySelector('.calendar-popover')),
    nativeDateInputVisible: Boolean(document.querySelector('.summary-panel input[type="date"]')),
    nativeTimeInputVisible: Boolean(
      document.querySelector('.summary-panel input[type="time"], .summary-panel input[type="datetime-local"]'),
    ),
    monthHeading: document.querySelector('.calendar-month-title')?.textContent.trim(),
    dayButtonCount: document.querySelectorAll('.calendar-day').length,
  }));
  await page.keyboard.press('Escape');

  await page.locator('[data-summary-id="ui-smoke-lunch-task"] .summary-time-button time').dblclick();
  await page.fill('#summary-time-edit-ui-smoke-lunch-task', '11:00');
  await page.locator('#summary-time-edit-ui-smoke-lunch-task').press('Enter');
  const invalidEndError = await page
    .locator('#summary-time-error-ui-smoke-lunch-task')
    .textContent();
  const invalidInputStillOpen = Boolean(
    await page.locator('#summary-time-edit-ui-smoke-lunch-task').count(),
  );
  await page.fill('#summary-time-edit-ui-smoke-lunch-task', '12:20');
  await page.locator('#summary-time-edit-ui-smoke-lunch-task').press('Enter');

  await page.locator('[data-summary-id="ui-smoke-morning-task"] .summary-time-button time').dblclick();
  await page.fill('#summary-time-edit-ui-smoke-morning-task', '05:00');
  await page.locator('#summary-time-edit-ui-smoke-morning-task').press('Enter');

  const result = await page.evaluate(({ summaryCalendarPresentation, invalidEndError, invalidInputStillOpen }) => {
    const state = JSON.parse(localStorage.getItem('done-log-state'));
    const todo = state.todos.find((item) => item.id === 'ui-smoke-morning-task');
    const completedAt = new Date(todo.completedAt);

    return {
      completedHour: completedAt.getHours(),
      completedMinute: completedAt.getMinutes(),
      displayedTime: document.querySelector(
        '[data-summary-id="ui-smoke-morning-task"] .summary-time-button time',
      )?.textContent.trim(),
      inputStillOpen: Boolean(document.querySelector('#summary-time-edit-ui-smoke-morning-task')),
      summaryCalendarPresentation,
      invalidEndError,
      invalidInputStillOpen,
    };
  }, {
    summaryCalendarPresentation,
    invalidEndError: invalidEndError?.trim() ?? '',
    invalidInputStillOpen,
  });

  await page.click('[data-summary-id="ui-smoke-morning-task"] .open-task-button');
  await page.waitForSelector('.detail-start-picker');
  const missingStart = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('done-log-state'));
    const todo = state.todos.find((item) => item.id === 'ui-smoke-morning-task');
    const createdAt = new Date(todo.createdAt);

    return {
      pickerText: document.querySelector('.detail-start-picker')?.textContent.trim(),
      expectedPickerText: new Intl.DateTimeFormat([], {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(createdAt),
      disclosure: document.querySelector('.detail-start-missing')?.textContent.trim(),
      firstStartedAt: todo.firstStartedAt,
    };
  });
  await page.click('#detail-close');

  return { ...result, missingStart };
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
  const noteAfterInput = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('done-log-state'));
    const todo = state.todos.find((item) => item.id === 'ui-smoke-local-task');
    return {
      storedNote: todo?.note,
      saveVisible: Boolean(document.querySelector('.detail-save-note')),
      statusText: document.querySelector('.detail-note-row span')?.textContent.trim(),
    };
  });
  await page.waitForFunction(() => {
    const state = JSON.parse(localStorage.getItem('done-log-state'));
    return state.todos.find((item) => item.id === 'ui-smoke-local-task')?.note === 'Smoke note';
  });
  await page.fill('#detail-note', '/todo Follow up with USCIS');
  await page.waitForFunction(() => document.querySelector('#detail-note')?.value === '- [ ] Follow up with USCIS');
  const slashTodoValue = await page.locator('#detail-note').inputValue();
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
  await page.locator('#detail-note').evaluate((textarea) => {
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => {
    const state = JSON.parse(localStorage.getItem('done-log-state'));
    return state.todos.find((item) => item.id === 'ui-smoke-local-task')?.note === '\t- [x] Follow up with USCIS\n\t- [ ] ';
  });
  const enterIndentCheck = await page.evaluate(() => ({
    noteValue: document.querySelector('#detail-note')?.value,
    selectionStart: document.querySelector('#detail-note')?.selectionStart,
    activeElementId: document.activeElement?.id,
  }));

  await page.mouse.click(24, 24);
  await page.waitForTimeout(120);
  const outsideClickKeepsDetailOpen = await page.evaluate(() => Boolean(document.querySelector('#task-detail')));

  await page.click('#detail-close');
  await page.waitForTimeout(120);
  await page.click(`${localTaskSelector} button[aria-label^="Mark"]`);
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
    hasNativeCalendarInput: Boolean(
      document.querySelector('#task-detail input[type="date"], #task-detail input[type="datetime-local"]'),
    ),
    hasDueDatePicker: Boolean(document.querySelector('.detail-due-picker')),
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

  const editChecks = await page.evaluate(({ taskDetailScroll, deleteButtonUpfront, detailUsesCustomCalendar, doneDateMoveCheck, noteAfterInput, slashTodoValue, clickedTodoValue, tabEditCheck, enterIndentCheck }) => {
    const state = JSON.parse(localStorage.getItem('done-log-state'));
    const todo = state.todos.find((item) => item.id === 'ui-smoke-local-task');
    const session = state.todos.find((item) => item.parentTaskId === 'ui-smoke-local-task');
    const lunch = state.todos.find((item) => item.id === 'ui-smoke-lunch-task');
    return {
      noteValue: document.querySelector('#detail-note')?.value,
      titleValue: document.querySelector('#detail-title-input')?.value,
      storedNote: todo?.note,
      storedTitle: todo?.title,
      localTaskCompleted: Boolean(todo?.completedAt),
      sessionCreated: Boolean(session),
      titleDisplayAfterEdit: document.querySelector('.detail-title-display')?.textContent.trim(),
      taskDetailScroll,
      deleteButtonUpfront,
      noteAfterInput,
      slashTodoValue,
      clickedTodoValue,
      tabEditCheck,
      enterIndentCheck,
      lunchTrackedSeconds: lunch?.trackedSeconds,
      lunchStart: lunch?.firstStartedAt,
      lunchCompletedAt: lunch?.completedAt,
      eveningDeleted: !state.todos.some((item) => item.id === 'ui-smoke-evening-task'),
      detailClosedAfterDelete: !document.querySelector('#task-detail')?.classList.contains('is-open'),
      detailUsesCustomCalendar,
      doneDateMoveCheck,
    };
  }, { taskDetailScroll, deleteButtonUpfront, detailUsesCustomCalendar, doneDateMoveCheck, noteAfterInput, slashTodoValue, clickedTodoValue, tabEditCheck, enterIndentCheck });

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
  const control = result.timerControl;
  const iconSized = control.width === 42 && control.width === control.otherWidth;
  const named = /Start|Pause/.test(control.ariaLabel);
  return !control.visibleText && iconSized && named && control.hasDelete
    ? []
    : [`timer and delete row actions are not icon-only: ${JSON.stringify(control)}`];
}

function assertRowDelete(result) {
  return result.rowDelete?.visible &&
    result.rowDelete.ariaLabel.includes('Delete') &&
    result.rowDelete.removedFromList &&
    result.rowDelete.removedFromState
    ? []
    : [`row delete did not remove the task from the list: ${JSON.stringify(result.rowDelete)}`];
}

function assertTaskRowSpacing(result) {
  return result.taskRowSpacing.itemHeight >= 88 &&
    result.taskRowSpacing.durationBottomGap >= 14 &&
    result.taskRowSpacing.durationTopGap >= 42
    ? []
    : [`wrapped task row content is cramped: ${JSON.stringify(result.taskRowSpacing)}`];
}

function assertOngoingSection(result) {
  const ongoing = result.taskSections.find((section) => section.heading === 'Ongoing');
  const todayIndex = result.taskSections.findIndex((section) => section.heading === 'Today todos');
  const today = result.taskSections[todayIndex];
  const dated = result.taskSections.find((section) => section.ids.includes('ui-smoke-local-task'));
  return ongoing?.heading === 'Ongoing' &&
    ongoing?.ids.includes('ui-smoke-overflow-task-0') &&
    ongoing?.ids[0] === 'ui-smoke-overflow-task-1' &&
    today?.heading === 'Today todos' &&
    today.ids.includes('ui-smoke-today-task') &&
    today.ids.includes('ui-smoke-paused-task') &&
    dated?.heading === 'Jun 8, 2026' &&
    dated.ids.includes('ui-smoke-local-task') &&
    todayIndex >= 0 &&
    !today?.ids.includes('ui-smoke-overflow-task-0') &&
    !dated?.ids.includes('ui-smoke-overflow-task-0') &&
    result.pausedTodayPresentation?.section === 'Today todos' &&
    result.pausedTodayPresentation?.state === 'paused' &&
    result.pausedTodayPresentation?.badge === 'Paused' &&
    result.pausedTodayPresentation?.animationName === 'none' &&
    result.pausedTodayPresentation?.boxShadow !== 'none'
    ? []
    : [`running, paused, and dated tasks are not separated correctly: ${JSON.stringify(result.taskSections)}`];
}

function assertManualTiming(result) {
  const timing = result.manualTiming;
  return timing?.invalidError === 'Start time must be before end time in each block.' &&
    timing.completed === false &&
    timing.trackedSeconds === 90 * 60 &&
    timing.timeBlockCount === 2 &&
    timing.totalLabel === 'Total 1h 30m' &&
    timing.incompleteBlockError === 'Choose both a start and end time in each block.' &&
    timing.completedDayKey === null
    ? []
    : [
        `manual timing controls did not validate and keep the task open: ${JSON.stringify(timing)}`,
      ];
}

function assertBoardCardLayout(result) {
  return result.progressDisplay === 'block' &&
    result.progressWhiteSpace === 'normal' &&
    result.progressOverflowWrap === 'anywhere' &&
    result.progressWidth <= result.metaWidth &&
    Number.parseFloat(result.progressBorderRadius) <= 12 &&
    result.timingGap >= 4 &&
    result.timingLabelWidth > 0 &&
    result.timingTimeWidth > 0 &&
    result.nativeCalendarInputCount === 0 &&
    result.hasBoardDayPicker
    ? []
    : [`board card progress/timing layout is not restrained: ${JSON.stringify(result)}`];
}

function assertCalendarConsistency(result) {
  const presentation = result.calendarPresentation;
  return presentation.nativeInputCount === 0 &&
    presentation.hasNewTaskPicker &&
    presentation.hasSummaryPicker
    ? []
    : [`calendar controls are not using the shared picker: ${JSON.stringify(presentation)}`];
}

function assertNewTaskCalendarClear(result) {
  return result.newTaskCalendarClear &&
    result.newTaskCalendarClear.clearAvailable === false &&
    result.newTaskCalendarClear.triggerText &&
    result.newTaskCalendarClear.triggerText !== 'Select date' &&
    result.newTaskCalendarClear.nativeInputCount === 0
    ? []
    : [`new-task assigned date did not open with today prefilled: ${JSON.stringify(result.newTaskCalendarClear)}`];
}

function assertPausedTimeline(result) {
  return result.pausedTimeline?.heading === 'Time blocks' &&
    result.pausedTimeline.blockCount === 1 &&
    result.pausedTimeline.total === 'Total 10m' &&
    result.pausedTimeline.hasAddButton
    ? []
    : [`paused task timeline is missing or incomplete: ${JSON.stringify(result.pausedTimeline)}`];
}

function assertRunningTimingEdit(result) {
  return result.completed === false &&
    result.activeStartedAt === '2026-08-04T23:31:00.000Z' &&
    result.trackedSeconds === 4 * 60 * 60 + 60 &&
    result.error === '' &&
    result.startText === 'Aug 4, 12:30 PM' &&
    result.endText === 'Aug 4, 4:31 PM'
    ? []
    : [`running timing edit did not preserve the active task: ${JSON.stringify(result)}`];
}

function assertRecapDayNavigation(result) {
  return shiftDayKey(result.initialDate, -1) === result.previousDate &&
    result.initialDate === result.returnedDate &&
    shiftDayKey(result.initialDate, 1) === result.nextDate
    ? []
    : [`recap day controls did not move one day backward and forward: ${JSON.stringify(result)}`];
}

function shiftDayKey(dayKey, offset) {
  const [year, month, day] = dayKey.split('-').map(Number);
  const shiftedDate = new Date(year, month - 1, day);
  shiftedDate.setDate(shiftedDate.getDate() + offset);
  return `${shiftedDate.getFullYear()}-${String(shiftedDate.getMonth() + 1).padStart(2, '0')}-${String(shiftedDate.getDate()).padStart(2, '0')}`;
}

function assertExists(result, selector, label) {
  return result.exists[selector] ? [] : [`${label} is missing from the rendered interface`];
}

function assertBucketLabels(result) {
  const expected = ['Early morning', 'Morning', 'Lunch', 'Evening', 'Night'];
  return expected.every((label, index) => result.summaryBuckets[index] === label)
    ? []
    : [`summary buckets are ${result.summaryBuckets.join(', ')}; expected ${expected.join(', ')}`];
}

function assertIncludes(values, expected, label) {
  return values.includes(expected) ? [] : [`${label} does not include ${expected}; saw ${values.join(', ')}`];
}

function assertStartsWith(values, expected, label) {
  return values.some((value) => value.startsWith(expected))
    ? []
    : [`${label} does not start with ${expected}; saw ${values.join(', ')}`];
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
    summaryTimeEdit.inputStillOpen ||
    summaryTimeEdit.invalidEndError !== 'End time must be after start time.' ||
    !summaryTimeEdit.invalidInputStillOpen
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

  if (
    summaryTimeEdit.missingStart?.pickerText !== summaryTimeEdit.missingStart?.expectedPickerText ||
    summaryTimeEdit.missingStart?.disclosure !== 'Defaults to creation time' ||
    summaryTimeEdit.missingStart?.firstStartedAt !== null
  ) {
    failures.push(`missing start time does not default to creation time: ${JSON.stringify(summaryTimeEdit)}`);
  }

  if (editChecks.storedNote !== '\t- [x] Follow up with USCIS\n\t- [ ] ' || editChecks.storedTitle !== 'Smoke renamed task') {
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
    editChecks.enterIndentCheck?.noteValue !== '\t- [x] Follow up with USCIS\n\t- [ ] ' ||
    editChecks.enterIndentCheck?.selectionStart !== 35 ||
    editChecks.enterIndentCheck?.activeElementId !== 'detail-note'
  ) {
    failures.push(`enter key did not continue the indented checklist: ${JSON.stringify(editChecks.enterIndentCheck)}`);
  }

  if (
    editChecks.noteAfterInput?.storedNote !== 'Smoke note' ||
    editChecks.noteAfterInput?.saveVisible ||
    editChecks.noteAfterInput?.statusText !== 'Saving details...'
  ) {
    failures.push(`detail notes did not autosave on input: ${JSON.stringify(editChecks.noteAfterInput)}`);
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
    editChecks.detailUsesCustomCalendar?.hasNativeCalendarInput ||
    !editChecks.detailUsesCustomCalendar?.hasDueDatePicker ||
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

function assertCompletedFromDetail(result) {
  const editChecks = result.editChecks;
  return editChecks.localTaskCompleted === true && editChecks.sessionCreated !== true
    ? []
    : [`completing from the open list did not finish the task: ${JSON.stringify(editChecks)}`];
}

function assertOverlayAddedTask(result) {
  const failures = [];
  if (result?.overlayOpen) {
    failures.push('new-task overlay stayed open after adding a task');
  }
  if (result?.alignContent !== 'start') {
    failures.push(`todo list align-content is ${result?.alignContent}; expected start`);
  }
  if (!result?.itemHeight || result.itemHeight > 120) {
    failures.push(`single open task block stretched: height ${result?.itemHeight}`);
  }
  return failures;
}
