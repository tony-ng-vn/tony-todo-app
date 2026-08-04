import { chromium } from 'playwright';

const targetUrl = new URL(process.env.UI_SMOKE_URL ?? 'http://127.0.0.1:5176/menubar');
targetUrl.searchParams.set('local', '1');

const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 420, height: 640 } });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    const now = Date.now();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    localStorage.setItem(
      'done-log-state',
      JSON.stringify({
        todos: [
          {
            id: 'menubar-running',
            title: 'Running task',
            createdAt: new Date(now - 60 * 60 * 1000).toISOString(),
            completedAt: null,
            note: 'Keep moving',
            firstStartedAt: new Date(now - 5 * 60 * 1000).toISOString(),
            activeStartedAt: new Date(now - 3 * 60 * 1000).toISOString(),
            trackedSeconds: 120,
          },
          {
            id: 'menubar-open',
            title: 'Open task',
            createdAt: new Date(now - 30 * 60 * 1000).toISOString(),
            completedAt: null,
            note: '',
            firstStartedAt: null,
            activeStartedAt: null,
            trackedSeconds: 0,
            dueDate: today.toISOString(),
          },
          {
            id: 'menubar-paused',
            title: 'Paused task',
            createdAt: new Date(now - 25 * 60 * 1000).toISOString(),
            completedAt: null,
            note: '',
            firstStartedAt: new Date(now - 20 * 60 * 1000).toISOString(),
            activeStartedAt: null,
            trackedSeconds: 5 * 60,
            timeSegments: [
              {
                startedAt: new Date(now - 20 * 60 * 1000).toISOString(),
                endedAt: new Date(now - 15 * 60 * 1000).toISOString(),
                durationSeconds: 5 * 60,
              },
            ],
            dueDate: today.toISOString(),
          },
          {
            id: 'menubar-progressive',
            title: 'Progressive task',
            createdAt: new Date(now - 20 * 60 * 1000).toISOString(),
            completedAt: null,
            note: '',
            firstStartedAt: null,
            activeStartedAt: null,
            trackedSeconds: 0,
            isProgressive: true,
            progressLabel: 'Chapter 2',
            dueDate: yesterday.toISOString(),
          },
          {
            id: 'menubar-delete',
            title: 'Delete task',
            createdAt: new Date(now - 10 * 60 * 1000).toISOString(),
            completedAt: null,
            note: '',
            firstStartedAt: null,
            activeStartedAt: null,
            trackedSeconds: 0,
            dueDate: twoDaysAgo.toISOString(),
          },
        ],
      }),
    );
  });

  await page.goto(targetUrl.toString(), { waitUntil: 'networkidle' });
  await page.waitForSelector('.menubar-shell');

  const initial = await page.evaluate(() => {
    const ongoing = document.querySelector('[data-menubar-section="ongoing"]');
    const ready = document.querySelector('[data-menubar-section="ready"]');
    const paused = document.querySelector('[data-menubar-section="paused"]');
    const shellStyle = getComputedStyle(document.querySelector('.menubar-shell'));
    return {
      title: document.querySelector('.menubar-heading')?.textContent.trim(),
      sync: document.querySelector('.menubar-sync')?.textContent.trim(),
      openCount: document.querySelector('.menubar-count')?.textContent.trim(),
      sectionsInOrder:
        ongoing?.getBoundingClientRect().top < ready?.getBoundingClientRect().top &&
        ready?.getBoundingClientRect().top < paused?.getBoundingClientRect().top,
      runningVisible: Boolean(document.querySelector('[data-menubar-id="menubar-running"]')),
      pausedVisible: Boolean(document.querySelector('[data-menubar-id="menubar-paused"]')),
      runningStarted: document.querySelector(
        '[data-menubar-id="menubar-running"] .menubar-task-started',
      )?.textContent.trim(),
      openVisible: Boolean(document.querySelector('[data-menubar-id="menubar-open"]')),
      readyDateGroups: [...document.querySelectorAll('[data-menubar-date-group]')].map((group) => ({
        id: group.getAttribute('data-menubar-date-group'),
        isToday: group.getAttribute('data-menubar-is-today'),
      })),
      todayReadyBeforePaused:
        document
          .querySelector('[data-menubar-date-group][data-menubar-is-today="true"]')
          ?.getBoundingClientRect().top < paused?.getBoundingClientRect().top,
      pausedBeforePastReady:
        paused?.getBoundingClientRect().top <
        document
          .querySelector('[data-menubar-date-group][data-menubar-is-today="false"]')
          ?.getBoundingClientRect().top,
      fullAppHref: document.querySelector('.menubar-open-full')?.getAttribute('href'),
      updateButtonLabel: document.querySelector('.menubar-update')?.textContent.trim(),
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollbarWidth: shellStyle.scrollbarWidth,
      taskTransitionDuration: getComputedStyle(
        document.querySelector('[data-menubar-id="menubar-running"]'),
      ).transitionDuration,
    };
  });

  await page.click('.menubar-update');
  await page.waitForURL((url) => url.searchParams.has('updated'));
  await page.waitForSelector('.menubar-shell');
  const updateUrl = new URL(page.url());
  const manualUpdate = {
    keptLocalMode: updateUrl.searchParams.has('local'),
    hasCacheBuster: updateUrl.searchParams.has('updated'),
  };

  await page.locator('#menubar-quick-add').press('Enter');
  await page.waitForTimeout(50);
  const countAfterEmptyAdd = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('done-log-state'));
    return state.todos.length;
  });

  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('done-log-state'));
    state.todos.push({
      id: 'menubar-external',
      title: 'Added outside popover',
      createdAt: new Date().toISOString(),
      completedAt: null,
      note: '',
      firstStartedAt: null,
      activeStartedAt: null,
      trackedSeconds: 0,
    });
    localStorage.setItem('done-log-state', JSON.stringify(state));
    window.dispatchEvent(new Event('focus'));
  });
  await page.waitForSelector('[data-menubar-id="menubar-external"]');

  await page.fill('#menubar-quick-add', 'Captured from menu bar');
  await page.locator('#menubar-quick-add').press('Enter');
  await page.waitForFunction(() => {
    const state = JSON.parse(localStorage.getItem('done-log-state'));
    return state.todos.some((todo) => todo.title === 'Captured from menu bar');
  });
  const createdTask = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('done-log-state'));
    const todo = state.todos.find((item) => item.title === 'Captured from menu bar');
    const createdAt = new Date(todo.createdAt);

    return {
      id: todo.id,
      expected: `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}-${String(createdAt.getDate()).padStart(2, '0')}T${String(createdAt.getHours()).padStart(2, '0')}:${String(createdAt.getMinutes()).padStart(2, '0')}`,
      firstStartedAt: todo.firstStartedAt,
    };
  });
  await page.click(`[data-menubar-id="${createdTask.id}"] .menubar-details-toggle`);
  const createdTimingDefault = {
    ...createdTask,
    value: await page.inputValue(
      `[data-menubar-details="${createdTask.id}"] input[aria-label^="Start time for"]`,
    ),
  };
  await page.click('[data-menubar-id="menubar-open"] .menubar-start');
  await page.waitForFunction(() => {
    const state = JSON.parse(localStorage.getItem('done-log-state'));
    return state.todos.find((todo) => todo.id === 'menubar-open')?.activeStartedAt;
  });
  await page.waitForFunction(() =>
    Boolean(
      document
        .querySelector('[data-menubar-id="menubar-open"]')
        ?.closest('[data-menubar-section="ongoing"]'),
    ),
  );
  const startedPresentation = await page.evaluate(() => {
    const row = document.querySelector('[data-menubar-id="menubar-open"]');
    return {
      visible: Boolean(row),
      remainsInOngoing: Boolean(row?.closest('[data-menubar-section="ongoing"]')),
    };
  });
  const parallelTimers = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('done-log-state'));
    return state.todos
      .filter((todo) => todo.activeStartedAt)
      .map((todo) => todo.id)
      .sort();
  });

  await page.click('[data-menubar-id="menubar-open"] .menubar-pause');
  await page.waitForFunction(() => {
    const state = JSON.parse(localStorage.getItem('done-log-state'));
    return state.todos.find((todo) => todo.id === 'menubar-open')?.activeStartedAt === null;
  });

  await page.click('[data-menubar-id="menubar-open"] .menubar-details-toggle');
  await page.waitForSelector('[data-menubar-details="menubar-open"]');
  await page.fill('[data-menubar-details="menubar-open"] .menubar-title-input', 'Renamed in menu bar');
  await page.locator('[data-menubar-details="menubar-open"] .menubar-title-input').press('Enter');
  await page.fill('[data-menubar-details="menubar-open"] .menubar-note-input', 'Compact');
  await page.locator('[data-menubar-details="menubar-open"] .menubar-note-input').press('End');
  await page.locator('[data-menubar-details="menubar-open"] .menubar-note-input').press('Tab');
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
  await page.locator('[data-menubar-details="menubar-open"] .menubar-note-input').pressSequentially(
    'note',
  );
  await page.waitForFunction(() => {
    const state = JSON.parse(localStorage.getItem('done-log-state'));
    const todo = state.todos.find((item) => item.id === 'menubar-open');
    return todo?.title === 'Renamed in menu bar' && todo?.note === 'Compact\tnote';
  });
  await page.waitForFunction(
    () =>
      document.querySelector('[data-menubar-details="menubar-open"] .menubar-note-save-status')
        ?.textContent.trim() === 'Note saved automatically',
  );
  const noteAutosavePresentation = await page.evaluate(() => ({
    saveButtonVisible: Boolean(document.querySelector('.menubar-save-note')),
    status: document
      .querySelector('[data-menubar-details="menubar-open"] .menubar-note-save-status')
      ?.textContent.trim(),
  }));

  await page.fill(
    '[data-menubar-details="menubar-open"] .menubar-note-input',
    '/todo Review menu bar',
  );
  await page.waitForFunction(() => {
    const state = JSON.parse(localStorage.getItem('done-log-state'));
    return state.todos.find((todo) => todo.id === 'menubar-open')?.note === '- [ ] Review menu bar';
  });
  const slashTodoPresentation = await page.evaluate(() => {
    const details = document.querySelector('[data-menubar-details="menubar-open"]');
    return {
      note: details?.querySelector('.menubar-note-input')?.value,
      label: details?.querySelector('.note-todo-item')?.textContent.trim(),
      pressed: details?.querySelector('.note-todo-item')?.getAttribute('aria-pressed'),
    };
  });
  await page.click('[data-menubar-details="menubar-open"] .note-todo-item');
  await page.waitForFunction(() => {
    const state = JSON.parse(localStorage.getItem('done-log-state'));
    return state.todos.find((todo) => todo.id === 'menubar-open')?.note === '- [x] Review menu bar';
  });
  const toggledTodoPressed = await page
    .locator('[data-menubar-details="menubar-open"] .note-todo-item')
    .getAttribute('aria-pressed');

  await page.fill(
    '[data-menubar-details="menubar-open"] input[aria-label^="Start time"]',
    '2026-07-30T00:00',
  );
  await page.fill(
    '[data-menubar-details="menubar-open"] input[aria-label^="End time"]',
    '2026-07-29T00:00',
  );
  await page.waitForSelector('[data-menubar-details="menubar-open"] .menubar-timing-error');
  const invalidTimingMessage = await page
    .locator('[data-menubar-details="menubar-open"] .menubar-timing-error')
    .textContent();
  const timingInputCount = await page
    .locator('[data-menubar-details="menubar-open"] input[type="datetime-local"]')
    .count();
  await page.fill(
    '[data-menubar-details="menubar-open"] input[aria-label^="End time"]',
    '2026-07-30T01:00',
  );
  await page.waitForFunction(() => {
    const state = JSON.parse(localStorage.getItem('done-log-state'));
    const todo = state.todos.find((item) => item.id === 'menubar-open');
    return Boolean(todo?.completedAt) && !todo?.activeStartedAt;
  });
  await page.waitForFunction(() =>
    Boolean(
      document
        .querySelector('[data-menubar-id="menubar-open"]')
        ?.closest('[data-menubar-section="finished"]'),
    ),
  );
  await page.waitForSelector('[data-menubar-details="menubar-open"]');
  await page.fill(
    '[data-menubar-details="menubar-open"] input[aria-label^="Start time"]',
    '2026-07-29T23:00',
  );
  await page.fill(
    '[data-menubar-details="menubar-open"] input[aria-label^="End time"]',
    '2026-07-30T02:00',
  );
  await page.waitForFunction(() => {
    const state = JSON.parse(localStorage.getItem('done-log-state'));
    const todo = state.todos.find((item) => item.id === 'menubar-open');
    return todo?.trackedSeconds === 3 * 60 * 60;
  });
  await page.click('[data-menubar-details="menubar-open"] .menubar-add-time-block');
  await page.fill(
    '[data-menubar-details="menubar-open"] input[aria-label="Start time for Renamed in menu bar block 2"]',
    '2026-07-30T03:00',
  );
  await page.fill(
    '[data-menubar-details="menubar-open"] input[aria-label="End time for Renamed in menu bar block 2"]',
    '2026-07-30T04:00',
  );
  await page.waitForFunction(() => {
    const state = JSON.parse(localStorage.getItem('done-log-state'));
    const todo = state.todos.find((item) => item.id === 'menubar-open');
    return todo?.timeSegments?.length === 2 && todo?.trackedSeconds === 4 * 60 * 60;
  });
  await page.click('[data-menubar-id="menubar-open"] .menubar-details-toggle');

  await page.click('[data-menubar-id="menubar-paused"] .menubar-finish');
  await page.waitForFunction(() => {
    const state = JSON.parse(localStorage.getItem('done-log-state'));
    const todo = state.todos.find((item) => item.id === 'menubar-paused');
    return Boolean(todo?.completedAt) && !todo?.activeStartedAt;
  });

  await page.click('[data-menubar-id="menubar-progressive"] .menubar-details-toggle');
  await page.fill('[data-menubar-details="menubar-progressive"] .menubar-progress-input', 'Chapter');
  await page.locator('[data-menubar-details="menubar-progressive"] .menubar-progress-input').press(
    'End',
  );
  await page.locator('[data-menubar-details="menubar-progressive"] .menubar-progress-input').press(
    'Tab',
  );
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
  await page.locator('[data-menubar-details="menubar-progressive"] .menubar-progress-input').type(
    '3',
  );
  await page.locator('[data-menubar-details="menubar-progressive"] .menubar-progress-input').blur();
  await page.fill(
    '[data-menubar-details="menubar-progressive"] input[type="date"]',
    '2026-08-01',
  );
  await page.locator('[data-menubar-details="menubar-progressive"] input[type="date"]').blur();
  await page.waitForFunction(() => {
    const state = JSON.parse(localStorage.getItem('done-log-state'));
    const todo = state.todos.find((item) => item.id === 'menubar-progressive');
    return todo?.progressLabel === 'Chapter\t3' && todo?.dueDate?.startsWith('2026-08-01');
  });

  await page.click('[data-menubar-id="menubar-progressive"] .menubar-finish');
  await page.waitForFunction(() => {
    const state = JSON.parse(localStorage.getItem('done-log-state'));
    const parent = state.todos.find((todo) => todo.id === 'menubar-progressive');
    const session = state.todos.find((todo) => todo.parentTaskId === 'menubar-progressive');
    return !parent?.completedAt && Boolean(session?.completedAt);
  });

  await page.click('[data-menubar-id="menubar-delete"] .menubar-details-toggle');
  await page.check(
    '[data-menubar-details="menubar-delete"] .menubar-progressive-toggle input[type="checkbox"]',
  );
  await page.waitForFunction(() => {
    const state = JSON.parse(localStorage.getItem('done-log-state'));
    return state.todos.find((todo) => todo.id === 'menubar-delete')?.isProgressive === true;
  });
  await page.click('[data-menubar-details="menubar-delete"] .menubar-delete');
  await page.waitForFunction(() => {
    const state = JSON.parse(localStorage.getItem('done-log-state'));
    return !state.todos.some((todo) => todo.id === 'menubar-delete');
  });

  const final = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('done-log-state'));
    return {
      added: state.todos.some((todo) => todo.title === 'Captured from menu bar'),
      addedDueDate: state.todos.find((todo) => todo.title === 'Captured from menu bar')?.dueDate,
      renamed: state.todos.find((todo) => todo.id === 'menubar-open')?.title,
      note: state.todos.find((todo) => todo.id === 'menubar-open')?.note,
      completed: Boolean(state.todos.find((todo) => todo.id === 'menubar-open')?.completedAt),
      completedTrackedSeconds: state.todos.find((todo) => todo.id === 'menubar-open')?.trackedSeconds,
      completedTimeBlocks: state.todos.find((todo) => todo.id === 'menubar-open')?.timeSegments?.length,
      pausedCompleted: Boolean(state.todos.find((todo) => todo.id === 'menubar-paused')?.completedAt),
      progress: state.todos.find((todo) => todo.id === 'menubar-progressive')?.progressLabel,
      dueDate: state.todos.find((todo) => todo.id === 'menubar-progressive')?.dueDate,
      progressSession: state.todos.some(
        (todo) => todo.parentTaskId === 'menubar-progressive' && todo.completedAt,
      ),
      progressiveParentOpen: !state.todos.find((todo) => todo.id === 'menubar-progressive')
        ?.completedAt,
      deleted: !state.todos.some((todo) => todo.id === 'menubar-delete'),
      nativeDateTimeInputs: document.querySelectorAll('input[type="datetime-local"]').length,
    };
  });

  const failures = [];
  if (initial.title !== 'Done Log') failures.push(`unexpected heading: ${JSON.stringify(initial)}`);
  if (initial.sync !== 'Local only') failures.push(`unexpected sync state: ${JSON.stringify(initial)}`);
  if (initial.openCount !== '5 open') failures.push(`unexpected open count: ${JSON.stringify(initial)}`);
  if (!initial.sectionsInOrder || !initial.runningVisible || !initial.pausedVisible || !initial.openVisible) {
    failures.push(`task sections are incomplete or out of order: ${JSON.stringify(initial)}`);
  }
  if (
    !initial.readyDateGroups.length ||
    initial.readyDateGroups[0]?.isToday !== 'true' ||
    !initial.todayReadyBeforePaused ||
    !initial.pausedBeforePastReady
  ) {
    failures.push(`ready task date groups are not newest first: ${JSON.stringify(initial)}`);
  }
  if (!initial.runningStarted?.startsWith('Started ')) {
    failures.push(`running task start time is missing: ${JSON.stringify(initial)}`);
  }
  if (initial.fullAppHref !== '/') failures.push(`full app link is wrong: ${JSON.stringify(initial)}`);
  if (
    initial.updateButtonLabel !== 'Update' ||
    !manualUpdate.keptLocalMode ||
    !manualUpdate.hasCacheBuster
  ) {
    failures.push(`manual update control did not reload Done Log safely: ${JSON.stringify({ initial, manualUpdate })}`);
  }
  if (initial.scrollWidth > initial.clientWidth || initial.scrollbarWidth !== 'none') {
    failures.push(`compact shell overflows or shows a scrollbar: ${JSON.stringify(initial)}`);
  }
  if (Number.parseFloat(initial.taskTransitionDuration) > 0.001) {
    failures.push(`reduced motion is not respected: ${JSON.stringify(initial)}`);
  }
  if (countAfterEmptyAdd !== 5) {
    failures.push(`empty quick add created a task: ${countAfterEmptyAdd}`);
  }
  if (!parallelTimers.includes('menubar-running') || !parallelTimers.includes('menubar-open')) {
    failures.push(`menu bar diverged from parallel timer behavior: ${JSON.stringify(parallelTimers)}`);
  }
  if (
    createdTimingDefault.value !== createdTimingDefault.expected ||
    createdTimingDefault.firstStartedAt !== null
  ) {
    failures.push(
      `new task start time does not default to creation time: ${JSON.stringify(createdTimingDefault)}`,
    );
  }
  if (!startedPresentation.visible || !startedPresentation.remainsInOngoing) {
    failures.push(
      `started task disappeared from the ongoing section: ${JSON.stringify(startedPresentation)}`,
    );
  }
  if (
    timingInputCount !== 2 ||
    invalidTimingMessage?.trim() !== 'Start must be before end in each block.'
  ) {
    failures.push(
      `timing controls did not validate strictly: ${JSON.stringify({ timingInputCount, invalidTimingMessage })}`,
    );
  }
  if (final.completedTrackedSeconds !== 4 * 60 * 60 || final.completedTimeBlocks !== 2) {
    failures.push(`time blocks did not accumulate in the menu bar: ${JSON.stringify(final)}`);
  }
  if (
    !final.added ||
    !final.addedDueDate ||
    final.renamed !== 'Renamed in menu bar' ||
    final.note !== '- [x] Review menu bar' ||
    !final.completed ||
    !final.pausedCompleted ||
    final.progress !== 'Chapter\t3' ||
    !final.dueDate?.startsWith('2026-08-01') ||
    !final.progressSession ||
    noteAutosavePresentation.saveButtonVisible ||
    noteAutosavePresentation.status !== 'Note saved automatically' ||
    !final.progressiveParentOpen ||
    !final.deleted ||
    final.nativeDateTimeInputs !== 0
  ) {
    failures.push(`compact task flow failed: ${JSON.stringify(final)}`);
  }
  if (
    slashTodoPresentation.note !== '- [ ] Review menu bar' ||
    slashTodoPresentation.label !== 'Review menu bar' ||
    slashTodoPresentation.pressed !== 'false' ||
    toggledTodoPressed !== 'true'
  ) {
    failures.push(
      `menu bar note todo behavior diverged from the full app: ${JSON.stringify({ slashTodoPresentation, toggledTodoPressed })}`,
    );
  }

  if (failures.length) {
    console.error(failures.join('\n'));
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
