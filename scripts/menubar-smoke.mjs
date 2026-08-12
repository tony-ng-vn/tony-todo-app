import { chromium } from 'playwright';

const targetUrl = new URL(process.env.UI_SMOKE_URL ?? 'http://127.0.0.1:5176/menubar');
targetUrl.searchParams.set('local', '1');
const expectUpdateAvailable = process.env.EXPECT_UPDATE_AVAILABLE === '1';

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
});

async function moveCalendarToMonth(page, target) {
  const targetTitle = new Intl.DateTimeFormat([], { month: 'long', year: 'numeric' }).format(target);

  for (let attempts = 0; attempts < 24; attempts += 1) {
    const currentTitle = (await page.locator('.calendar-month-title').textContent())?.trim();
    if (currentTitle === targetTitle) {
      return;
    }

    const current = new Date(`${currentTitle} 1`);
    const direction = current < target ? 'Next month' : 'Previous month';
    await page.getByRole('button', { name: direction, exact: true }).click();
  }

  throw new Error(`Could not navigate calendar to ${targetTitle}`);
}

async function chooseCalendarDay(page, selector, value) {
  const target = new Date(`${value}T12:00:00`);
  await page.locator(selector).click();
  await page.waitForSelector('.calendar-popover');
  await moveCalendarToMonth(page, target);
  await page
    .locator('.calendar-day:not(.is-muted)')
    .filter({ hasText: new RegExp(`^${target.getDate()}$`) })
    .click();
}

async function chooseCalendarDateTime(page, selector, value) {
  const target = new Date(value);
  await page.locator(selector).click();
  await page.waitForSelector('.calendar-popover');
  await moveCalendarToMonth(page, target);
  await page
    .locator('.calendar-day:not(.is-muted)')
    .filter({ hasText: new RegExp(`^${target.getDate()}$`) })
    .click();

  const hour = target.getHours() % 12 || 12;
  await page.fill('.calendar-hour-input', String(hour));
  await page.fill('.calendar-minute-input', String(target.getMinutes()).padStart(2, '0'));
  await page
    .locator('.calendar-period-button', { hasText: target.getHours() >= 12 ? 'PM' : 'AM' })
    .click();
  await page.click('.calendar-apply');
}

if (process.env.FLOATING_NOTE_ONLY === '1') {
  const result = await inspectFloatingNote();
  await browser.close();
  if (
    !result.request?.url?.includes('note=floating-note-task') ||
    result.request?.target !== 'done-log-note-floating-note-task' ||
    !result.request?.features?.includes('width=360') ||
    !result.nativeRequest?.url?.includes('note=floating-note-task') ||
    result.legacyRequest !== null ||
    !result.legacyOverlay ||
    result.legacyResizedBounds.width > result.legacyResizedBounds.viewportWidth - 16 ||
    result.legacyResizedBounds.height > result.legacyResizedBounds.viewportHeight - 16 ||
    result.presentation.title !== 'Running task' ||
    result.presentation.status !== 'Note saved automatically' ||
    result.presentation.overflow ||
    result.presentation.closeRight > result.presentation.viewportWidth ||
    result.presentation.statusBottom > result.presentation.viewportHeight ||
    result.presentation.isOverlay ||
    !result.noteSurvivedTimerChanges
  ) {
    throw new Error(`Floating note concurrency check failed: ${JSON.stringify(result)}`);
  }
  process.exit(0);
}

try {
  const runningTimingEdit = await inspectRunningTimingEdit();
  const page = await browser.newPage({ viewport: { width: 420, height: 640 } });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  if (expectUpdateAvailable) {
    await page.route('**/_app/version.json', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ version: 'newer-deployment' }),
        headers: { 'cache-control': 'no-store' },
      }),
    );
  }
  await page.route('**/api/link-title?*', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ title: 'I cancelled all my cloud storage subscriptions' }),
    }),
  );
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
            id: 'menubar-youtube',
            title: 'https://www.youtube.com/watch?v=QKNXjsYyMWw',
            createdAt: new Date(now - 28 * 60 * 1000).toISOString(),
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
      pausedInToday: Boolean(
        document
          .querySelector('[data-menubar-id="menubar-paused"]')
          ?.closest('[data-menubar-section="ready"]'),
      ),
      pausedInPausedSection: Boolean(
        document
          .querySelector('[data-menubar-id="menubar-paused"]')
          ?.closest('[data-menubar-section="paused"]'),
      ),
      pausedBadge: document
        .querySelector('[data-menubar-id="menubar-paused"] .menubar-paused-badge')
        ?.textContent.trim(),
      runningStarted: document.querySelector(
        '[data-menubar-id="menubar-running"] .menubar-task-started',
      )?.textContent.trim(),
      openVisible: Boolean(document.querySelector('[data-menubar-id="menubar-open"]')),
      youtubeLink: (() => {
        const row = document.querySelector('[data-menubar-id="menubar-youtube"]');
        const link = row?.querySelector('[data-menubar-link-title]');
        return {
          title: link?.textContent.trim(),
          href: link?.getAttribute('href'),
          hasIcon: Boolean(link?.querySelector('[data-youtube-icon]')),
          showsRawUrl: row?.textContent.includes('https://www.youtube.com/watch?v=QKNXjsYyMWw'),
        };
      })(),
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
      updateAvailable: document.querySelector('.menubar-update')?.classList.contains('is-available'),
      updateLiveRegion: document.querySelector('.menubar-update')?.getAttribute('aria-live'),
      themeLabel: document.querySelector('.theme-toggle')?.getAttribute('aria-label'),
      themeMode: document.documentElement.dataset.theme,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollbarWidth: shellStyle.scrollbarWidth,
      taskTransitionDuration: getComputedStyle(
        document.querySelector('[data-menubar-id="menubar-running"]'),
      ).transitionDuration,
      taskTransitionProperty: getComputedStyle(
        document.querySelector('[data-menubar-id="menubar-running"]'),
      ).transitionProperty,
    };
  });

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const pausedAnimationName = await page
    .locator('[data-menubar-id="menubar-paused"] .menubar-task-dot')
    .evaluate((element) => getComputedStyle(element).animationName);
  await page.emulateMedia({ reducedMotion: 'reduce' });

  await page.click('.theme-toggle');
  const themeChange = await page.evaluate(() => ({
    mode: document.documentElement.dataset.theme,
    stored: localStorage.getItem('done-log-theme'),
    label: document.querySelector('.theme-toggle')?.getAttribute('aria-label'),
  }));
  await page.click('.theme-toggle');

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
      expected: new Intl.DateTimeFormat([], {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(createdAt),
      firstStartedAt: todo.firstStartedAt,
    };
  });
  await page.click(`[data-menubar-id="${createdTask.id}"] .menubar-details-toggle`);
  const createdTimingDefault = {
    ...createdTask,
    value: (
      await page
        .locator(`[data-menubar-details="${createdTask.id}"] button[aria-label^="Start time for"]`)
        .textContent()
    )?.trim(),
  };
  await page.fill('#menubar-quick-add', 'Captured from menu ba');
  await page.locator('#menubar-quick-add').press('Enter');
  await page.waitForFunction(() =>
    document.querySelector('.menubar-sync')?.textContent.includes('Duplicate task'),
  );
  const duplicateTask = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('done-log-state'));
    return {
      matchingTasks: state.todos.filter((todo) => todo.title.startsWith('Captured from menu ba'))
        .length,
      draft: document.querySelector('#menubar-quick-add')?.value,
      message: document.querySelector('.menubar-sync')?.textContent.trim(),
    };
  });
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
  const calendarPresentation = await page.evaluate(() => {
    const details = document.querySelector('[data-menubar-details="menubar-open"]');
    return {
      nativeInputCount: details.querySelectorAll('input[type="date"], input[type="datetime-local"]').length,
      hasDuePicker: Boolean(details.querySelector('button[aria-label^="Due date for"]')),
      timingPickerCount: details.querySelectorAll(
        'button[aria-label^="Start time for"], button[aria-label^="End time for"]',
      ).length,
    };
  });
  await page.click(
    '[data-menubar-details="menubar-open"] button[aria-label^="Start time for"]',
  );
  await page.waitForSelector('.calendar-popover');
  calendarPresentation.compactLayout = await page.evaluate(() => {
    const popover = document.querySelector('.calendar-popover')?.getBoundingClientRect();
    const month = document.querySelector('.calendar-month')?.getBoundingClientRect();
    const time = document.querySelector('.calendar-time')?.getBoundingClientRect();
    return {
      left: Math.round(popover?.left ?? -1),
      right: Math.round(popover?.right ?? -1),
      viewportWidth: window.innerWidth,
      timeBelowMonth: (time?.top ?? 0) >= (month?.bottom ?? 1),
    };
  });
  await page.keyboard.press('Escape');
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
    '\tIndented line',
  );
  await page.locator('[data-menubar-details="menubar-open"] .menubar-note-input').press('End');
  await page.locator('[data-menubar-details="menubar-open"] .menubar-note-input').press('Enter');
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
  await page.waitForFunction(() => {
    const state = JSON.parse(localStorage.getItem('done-log-state'));
    return state.todos.find((todo) => todo.id === 'menubar-open')?.note === '\tIndented line\n\t';
  });
  const enterIndentPresentation = await page.evaluate(() => {
    const textarea = document.querySelector(
      '[data-menubar-details="menubar-open"] .menubar-note-input',
    );
    return {
      note: textarea?.value,
      selectionStart: textarea?.selectionStart,
      focused: document.activeElement === textarea,
    };
  });

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

  await chooseCalendarDateTime(
    page,
    '[data-menubar-details="menubar-open"] button[aria-label^="Start time"]',
    '2026-07-30T00:00',
  );
  await chooseCalendarDateTime(
    page,
    '[data-menubar-details="menubar-open"] button[aria-label^="End time"]',
    '2026-07-29T00:00',
  );
  await page.waitForSelector('[data-menubar-details="menubar-open"] .menubar-timing-error');
  const invalidTimingMessage = await page
    .locator('[data-menubar-details="menubar-open"] .menubar-timing-error')
    .textContent();
  await chooseCalendarDateTime(
    page,
    '[data-menubar-details="menubar-open"] button[aria-label^="End time"]',
    '2026-07-30T01:00',
  );
  await page.waitForFunction(() => {
    const state = JSON.parse(localStorage.getItem('done-log-state'));
    const todo = state.todos.find((item) => item.id === 'menubar-open');
    return !todo?.completedAt && !todo?.activeStartedAt && todo?.timeSegments?.length === 1;
  });
  await page.waitForFunction(() =>
    Boolean(document.querySelector('[data-menubar-id="menubar-open"]')) &&
    !document
      .querySelector('[data-menubar-id="menubar-open"]')
      ?.closest('[data-menubar-section="finished"]'),
  );
  await page.waitForSelector('[data-menubar-details="menubar-open"]');
  await chooseCalendarDateTime(
    page,
    '[data-menubar-details="menubar-open"] button[aria-label^="Start time"]',
    '2026-07-29T23:00',
  );
  await chooseCalendarDateTime(
    page,
    '[data-menubar-details="menubar-open"] button[aria-label^="End time"]',
    '2026-07-30T02:00',
  );
  await page.waitForFunction(() => {
    const state = JSON.parse(localStorage.getItem('done-log-state'));
    const todo = state.todos.find((item) => item.id === 'menubar-open');
    return todo?.trackedSeconds === 3 * 60 * 60;
  });
  await page.click('[data-menubar-details="menubar-open"] .menubar-add-time-block');
  await chooseCalendarDateTime(
    page,
    '[data-menubar-details="menubar-open"] button[aria-label="Start time for Renamed in menu bar block 2"]',
    '2026-07-30T03:00',
  );
  await chooseCalendarDateTime(
    page,
    '[data-menubar-details="menubar-open"] button[aria-label="End time for Renamed in menu bar block 2"]',
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
  await chooseCalendarDay(
    page,
    '[data-menubar-details="menubar-progressive"] button[aria-label^="Due date for"]',
    '2026-08-01',
  );
  await page.waitForFunction(() => {
    const state = JSON.parse(localStorage.getItem('done-log-state'));
    const todo = state.todos.find((item) => item.id === 'menubar-progressive');
    return todo?.progressLabel === 'Chapter\t3' && todo?.dueDate?.startsWith('2026-08-01');
  });
  await page.click(
    '[data-menubar-details="menubar-progressive"] button[aria-label^="Due date for"]',
  );
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await page.waitForFunction(() => {
    const state = JSON.parse(localStorage.getItem('done-log-state'));
    return state.todos.find((item) => item.id === 'menubar-progressive')?.dueDate === null;
  });
  await chooseCalendarDay(
    page,
    '[data-menubar-details="menubar-progressive"] button[aria-label^="Due date for"]',
    '2026-08-01',
  );
  await page.waitForFunction(() => {
    const state = JSON.parse(localStorage.getItem('done-log-state'));
    return state.todos.find((item) => item.id === 'menubar-progressive')?.dueDate?.startsWith('2026-08-01');
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
      nativeCalendarInputs: document.querySelectorAll('input[type="date"], input[type="datetime-local"]').length,
    };
  });

  const failures = [];
  if (initial.title !== 'Done Log') failures.push(`unexpected heading: ${JSON.stringify(initial)}`);
  if (initial.sync !== 'Local only') failures.push(`unexpected sync state: ${JSON.stringify(initial)}`);
  if (initial.openCount !== '6 open') failures.push(`unexpected open count: ${JSON.stringify(initial)}`);
  if (!initial.sectionsInOrder || !initial.runningVisible || !initial.pausedVisible || !initial.openVisible) {
    failures.push(`task sections are incomplete or out of order: ${JSON.stringify(initial)}`);
  }
  if (
    !initial.pausedInToday ||
    initial.pausedInPausedSection ||
    initial.pausedBadge !== 'Paused' ||
    pausedAnimationName !== 'none'
  ) {
    failures.push(
      `today's paused task is not clearly presented in Today: ${JSON.stringify({ initial, pausedAnimationName })}`,
    );
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
  if (
    initial.youtubeLink.title !== 'I cancelled all my cloud storage subscriptions' ||
    initial.youtubeLink.href !== 'https://www.youtube.com/watch?v=QKNXjsYyMWw' ||
    !initial.youtubeLink.hasIcon ||
    initial.youtubeLink.showsRawUrl
  ) {
    failures.push(`YouTube task is not shown as an icon and title: ${JSON.stringify(initial)}`);
  }
  if (initial.fullAppHref !== '/') failures.push(`full app link is wrong: ${JSON.stringify(initial)}`);
  if (
    !initial.themeLabel?.startsWith('Switch to ') ||
    themeChange.mode === initial.themeMode ||
    themeChange.stored !== themeChange.mode ||
    !themeChange.label?.includes(initial.themeMode)
  ) {
    failures.push(`theme toggle did not persist its state: ${JSON.stringify({ initial, themeChange })}`);
  }
  if (
    initial.updateButtonLabel !== (expectUpdateAvailable ? 'Update available' : 'Update') ||
    initial.updateAvailable !== expectUpdateAvailable ||
    initial.updateLiveRegion !== 'polite' ||
    !manualUpdate.keptLocalMode ||
    !manualUpdate.hasCacheBuster
  ) {
    failures.push(`manual update control did not reload Done Log safely: ${JSON.stringify({ initial, manualUpdate })}`);
  }
  if (initial.scrollWidth > initial.clientWidth || initial.scrollbarWidth !== 'none') {
    failures.push(`compact shell overflows or shows a scrollbar: ${JSON.stringify(initial)}`);
  }
  if (
    Number.parseFloat(initial.taskTransitionDuration) > 0.2 ||
    initial.taskTransitionProperty.includes('transform')
  ) {
    failures.push(`reduced motion is not gentle and non-spatial: ${JSON.stringify(initial)}`);
  }
  if (countAfterEmptyAdd !== 6) {
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
  if (
    duplicateTask.matchingTasks !== 1 ||
    duplicateTask.draft !== 'Captured from menu ba' ||
    duplicateTask.message !== 'Duplicate task: "Captured from menu bar" is already open'
  ) {
    failures.push(`menu bar duplicate matching failed: ${JSON.stringify(duplicateTask)}`);
  }
  if (!startedPresentation.visible || !startedPresentation.remainsInOngoing) {
    failures.push(
      `started task disappeared from the ongoing section: ${JSON.stringify(startedPresentation)}`,
    );
  }
  if (
    calendarPresentation.nativeInputCount !== 0 ||
    !calendarPresentation.hasDuePicker ||
    calendarPresentation.timingPickerCount !== 2 ||
    calendarPresentation.compactLayout?.left < 0 ||
    calendarPresentation.compactLayout?.right > calendarPresentation.compactLayout?.viewportWidth ||
    !calendarPresentation.compactLayout?.timeBelowMonth ||
    invalidTimingMessage?.trim() !== 'Start must be before end in each block.'
  ) {
    failures.push(
      `calendar controls did not share the custom picker or validate strictly: ${JSON.stringify({ calendarPresentation, invalidTimingMessage })}`,
    );
  }
  if (
    runningTimingEdit.completed ||
    runningTimingEdit.activeStartedAt !== '2026-08-04T23:31:00.000Z' ||
    runningTimingEdit.trackedSeconds !== 4 * 60 * 60 + 60 ||
    runningTimingEdit.error !== '' ||
    runningTimingEdit.startText !== 'Aug 4, 12:30 PM' ||
    runningTimingEdit.endText !== 'Aug 4, 4:31 PM'
  ) {
    failures.push(
      `running timing edit did not preserve the active task: ${JSON.stringify(runningTimingEdit)}`,
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
    final.completed ||
    !final.pausedCompleted ||
    final.progress !== 'Chapter\t3' ||
    !final.dueDate?.startsWith('2026-08-01') ||
    !final.progressSession ||
    noteAutosavePresentation.saveButtonVisible ||
    noteAutosavePresentation.status !== 'Note saved automatically' ||
    !final.progressiveParentOpen ||
    !final.deleted ||
    final.nativeCalendarInputs !== 0
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
  if (
    enterIndentPresentation.note !== '\tIndented line\n\t' ||
    enterIndentPresentation.selectionStart !== 16 ||
    !enterIndentPresentation.focused
  ) {
    failures.push(
      `menu bar enter key did not preserve note indentation: ${JSON.stringify(enterIndentPresentation)}`,
    );
  }

  if (failures.length) {
    console.error(failures.join('\n'));
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}

async function inspectFloatingNote() {
  const context = await browser.newContext({ viewport: { width: 772, height: 532 } });
  const page = await context.newPage();
  await page.addInitScript(() => {
    const now = new Date('2026-08-12T13:05:00.000Z').toISOString();
    localStorage.setItem(
      'done-log-state',
      JSON.stringify({
        todos: [
          {
            id: 'floating-note-task',
            title: 'Running task',
            createdAt: now,
            firstStartedAt: now,
            activeStartedAt: now,
            completedAt: null,
            note: '',
            trackedSeconds: 0,
            timeSegments: [],
          },
        ],
      }),
    );
  });
  await page.goto(targetUrl.toString(), { waitUntil: 'networkidle' });

  const request = await page.evaluate(() => {
    let openRequest = null;
    const originalOpen = window.open;
    window.open = (url, target, features) => {
      openRequest = { url: String(url), target, features };
      return { focus() {} };
    };
    document.querySelector('.menubar-open-note')?.click();
    window.open = originalOpen;
    return openRequest;
  });

  const nativePage = await context.newPage();
  await nativePage.addInitScript(() => {
    window.__doneLogNativeHost = true;
  });
  await nativePage.goto(targetUrl.toString(), { waitUntil: 'networkidle' });
  const nativeRequest = await captureOpenRequest(nativePage);

  const legacyContext = await browser.newContext({
    viewport: { width: 420, height: 640 },
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)',
  });
  const legacyPage = await legacyContext.newPage();
  await legacyPage.addInitScript(() => {
    Object.defineProperty(window, 'webkit', { value: {}, configurable: true });
    const now = new Date('2026-08-12T13:05:00.000Z').toISOString();
    localStorage.setItem(
      'done-log-state',
      JSON.stringify({
        todos: [
          {
            id: 'floating-note-task',
            title: 'Running task',
            createdAt: now,
            firstStartedAt: now,
            activeStartedAt: now,
            completedAt: null,
            note: '',
            trackedSeconds: 0,
            timeSegments: [],
          },
        ],
      }),
    );
  });
  await legacyPage.goto(targetUrl.toString(), { waitUntil: 'networkidle' });
  const legacyRequest = await captureOpenRequest(legacyPage);
  await legacyPage.waitForSelector('.floating-note-shell.is-overlay');
  const legacyOverlay = await legacyPage.locator('.floating-note-shell').isVisible();
  const legacyResizedBounds = await legacyPage.evaluate(() => {
    const shell = document.querySelector('.floating-note-shell');
    shell.style.width = '200vw';
    shell.style.height = '200vh';
    const bounds = shell.getBoundingClientRect();
    return {
      width: Math.round(bounds.width),
      height: Math.round(bounds.height),
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  });
  await legacyContext.close();

  const notePage = await context.newPage();
  await notePage.goto(request.url, { waitUntil: 'networkidle' });
  await notePage.waitForSelector('.floating-note-shell:not(.is-overlay)');
  await notePage.fill('.floating-note-input', 'Note from floating window');
  await notePage.waitForFunction(() => {
    const todo = JSON.parse(localStorage.getItem('done-log-state')).todos[0];
    return todo?.note === 'Note from floating window';
  });
  await notePage.waitForFunction(
    () =>
      document.querySelector('.floating-note-save-status')?.textContent.trim()
      === 'Note saved automatically',
  );

  const presentation = await notePage.evaluate(() => {
    const shell = document.querySelector('.floating-note-shell');
    return {
      title: document.querySelector('.floating-note-title')?.textContent.trim(),
      status: document.querySelector('.floating-note-save-status')?.textContent.trim(),
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      closeRight: Math.round(
        document.querySelector('.floating-note-header button')?.getBoundingClientRect().right ?? -1,
      ),
      statusBottom: Math.round(
        document.querySelector('.floating-note-save-status')?.getBoundingClientRect().bottom ?? -1,
      ),
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      isOverlay: shell.classList.contains('is-overlay'),
    };
  });

  await page.click('.menubar-pause');
  await page.waitForSelector('.menubar-start');
  await page.click('.menubar-start');
  const noteSurvivedTimerChanges = await page.evaluate(() => {
    const todo = JSON.parse(localStorage.getItem('done-log-state')).todos[0];
    return Boolean(todo?.activeStartedAt) && todo?.note === 'Note from floating window';
  });
  await context.close();

  return {
    request,
    nativeRequest,
    legacyRequest,
    legacyOverlay,
    legacyResizedBounds,
    presentation,
    noteSurvivedTimerChanges,
  };
}

async function captureOpenRequest(page) {
  return page.evaluate(() => {
    let openRequest = null;
    const originalOpen = window.open;
    window.open = (url, target, features) => {
      openRequest = { url: String(url), target, features };
      return { focus() {} };
    };
    document.querySelector('.menubar-open-note')?.click();
    window.open = originalOpen;
    return openRequest;
  });
}

async function inspectRunningTimingEdit() {
  const page = await browser.newPage({
    viewport: { width: 772, height: 532 },
    timezoneId: 'America/Los_Angeles',
  });
  await page.clock.setFixedTime(new Date('2026-08-04T23:30:00.000Z'));
  await page.addInitScript(() => {
    localStorage.setItem('done-log-client-id', 'menubar-running-timing');
    localStorage.setItem(
      'done-log-state',
      JSON.stringify({
        todos: [
          {
            id: 'menubar-running-timing',
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
  await page.click('[data-menubar-id="menubar-running-timing"] .menubar-details-toggle');
  await page.waitForSelector('[data-menubar-details="menubar-running-timing"]');
  await chooseCalendarDateTime(
    page,
    '[data-menubar-details="menubar-running-timing"] button[aria-label^="Start time"]',
    '2026-08-04T12:30:00-07:00',
  );
  await page.waitForTimeout(100);
  const result = await page.evaluate(() => {
    const task = JSON.parse(localStorage.getItem('done-log-state')).todos.find(
      (item) => item.id === 'menubar-running-timing',
    );
    return {
      completed: Boolean(task?.completedAt),
      activeStartedAt: task?.activeStartedAt,
      trackedSeconds: task?.trackedSeconds,
      error: document.querySelector(
        '[data-menubar-details="menubar-running-timing"] .menubar-timing-error',
      )?.textContent.trim() ?? '',
      startText: document.querySelector(
        '[data-menubar-details="menubar-running-timing"] button[aria-label^="Start time"]',
      )?.textContent.trim(),
      endText: document.querySelector(
        '[data-menubar-details="menubar-running-timing"] button[aria-label^="End time"]',
      )?.textContent.trim(),
    };
  });
  await page.close();
  return result;
}
