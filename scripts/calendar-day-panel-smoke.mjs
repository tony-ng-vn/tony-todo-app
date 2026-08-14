import { chromium } from 'playwright';

const targetUrl = new URL(process.env.UI_SMOKE_URL ?? 'http://127.0.0.1:5174/');
targetUrl.searchParams.set('local', '1');
const theme = process.env.UI_SMOKE_THEME ?? 'light';
if (!['light', 'dark'].includes(theme)) {
  throw new Error(`UI_SMOKE_THEME must be light or dark, received ${theme}`);
}

const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({
    deviceScaleFactor: 2,
    locale: 'en-US',
    viewport: { width: 1421, height: 1066 },
    timezoneId: 'America/Los_Angeles',
  });
  const page = await context.newPage();
  const fixedNow = new Date('2026-08-05T19:00:00.000Z');
  await page.clock.install({ time: fixedNow });
  await page.clock.pauseAt(fixedNow);
  const browserErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      browserErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => browserErrors.push(error.message));

  await page.addInitScript((selectedTheme) => {
    localStorage.setItem('done-log-client-id', 'calendar-day-panel-smoke');
    localStorage.setItem('done-log-theme', selectedTheme);
    localStorage.setItem('done-log-view', 'calendar');
    localStorage.setItem(
      'done-log-state',
      JSON.stringify({
        todos: [
          {
            id: 'calendar-morning',
            title: 'Ship calendar interaction',
            createdAt: '2026-08-05T16:02:00.000Z',
            firstStartedAt: '2026-08-05T16:02:00.000Z',
            completedAt: '2026-08-05T17:36:00.000Z',
            trackedSeconds: 5640,
            timeSegments: [],
          },
          {
            id: 'calendar-afternoon',
            title: 'Clean up meeting notes',
            createdAt: '2026-08-05T21:44:00.000Z',
            firstStartedAt: '2026-08-05T21:44:00.000Z',
            completedAt: '2026-08-05T22:22:00.000Z',
            trackedSeconds: 2280,
            timeSegments: [],
          },
          {
            id: 'calendar-next-day',
            title: 'Prepare tomorrow handoff',
            createdAt: '2026-08-06T15:00:00.000Z',
            firstStartedAt: '2026-08-06T15:00:00.000Z',
            completedAt: '2026-08-06T15:30:00.000Z',
            trackedSeconds: 1800,
            timeSegments: [],
          },
          {
            id: 'calendar-open-task',
            title: 'This task is still open',
            createdAt: '2026-08-05T18:00:00.000Z',
            completedAt: null,
          },
        ],
      }),
    );
  }, theme);

  await page.goto(targetUrl.toString(), { waitUntil: 'networkidle' });
  await page.waitForSelector('.calendar-panel');

  const dayButton = (dateKey) => page.locator(`[data-calendar-date="${dateKey}"] .calendar-day-number`);
  const expectedInkBackground = theme === 'dark' ? 'rgb(244, 241, 232)' : 'rgb(41, 41, 41)';
  const waitForInkDot = (dateKey) =>
    page.waitForFunction(({ key, background }) => {
      const number = document.querySelector(`[data-calendar-date="${key}"] .calendar-day-number`);
      return number && getComputedStyle(number).backgroundColor === background;
    }, { key: dateKey, background: expectedInkBackground });

  await dayButton('2026-08-05').dblclick();
  await waitForInkDot('2026-08-05');
  await page.waitForSelector('.calendar-day-panel');
  await page.getByRole('button', { name: 'Close daily timeline' }).waitFor();
  const closeButtonHasFocus = await page
    .getByRole('button', { name: 'Close daily timeline' })
    .evaluate((node) => node === document.activeElement);
  if (!closeButtonHasFocus) {
    throw new Error('opening the daily timeline did not move focus to its close button');
  }

  const todayState = await page.evaluate(() => {
    const selectedCell = document.querySelector('[data-calendar-date="2026-08-05"]');
    const selectedNumber = selectedCell?.querySelector('.calendar-day-number');
    const taskTitles = Array.from(document.querySelectorAll('.calendar-day-task-title')).map((node) =>
      node.textContent.trim(),
    );

    return {
      selected: selectedCell?.classList.contains('is-selected'),
      selectedPressed: selectedNumber?.getAttribute('aria-pressed'),
      selectedBackground: selectedNumber ? getComputedStyle(selectedNumber).backgroundColor : null,
      panelBackground: getComputedStyle(document.querySelector('.calendar-day-panel')).backgroundColor,
      headerBackground: getComputedStyle(
        document.querySelector('.calendar-day-panel-header'),
      ).backgroundColor,
      clusterBackground: getComputedStyle(
        document.querySelector('.calendar-day-joined-cluster'),
      ).backgroundColor,
      headingColor: getComputedStyle(
        document.querySelector('#calendar-day-panel-heading'),
      ).color,
      taskColor: getComputedStyle(document.querySelector('.calendar-day-task')).color,
      mutedColor: getComputedStyle(document.querySelector('.calendar-day-task-duration')).color,
      panelTitle: document.querySelector('#calendar-day-panel-heading')?.textContent.trim(),
      panelSummary: document.querySelector('.calendar-day-panel-summary')?.textContent.trim(),
      taskTitles,
      taskTimes: Array.from(document.querySelectorAll('.calendar-day-task-time')).map((node) =>
        node.textContent.trim(),
      ),
      taskDurations: Array.from(document.querySelectorAll('.calendar-day-task-duration')).map((node) =>
        node.textContent.trim(),
      ),
    };
  });

  if (
    !todayState.selected ||
    todayState.selectedPressed !== 'true' ||
    todayState.selectedBackground !== expectedInkBackground ||
    todayState.panelTitle !== 'Wednesday, August 5' ||
    todayState.panelSummary !== '2 tasks - 2h 12m focused' ||
    JSON.stringify(todayState.taskTitles) !==
      JSON.stringify(['Ship calendar interaction', 'Clean up meeting notes']) ||
    JSON.stringify(todayState.taskTimes) !== JSON.stringify(['10:36 AM', '3:22 PM']) ||
    JSON.stringify(todayState.taskDurations) !==
      JSON.stringify(['Focused for 1h 34m', 'Focused for 38m'])
  ) {
    throw new Error(`today panel did not match the selected design: ${JSON.stringify(todayState)}`);
  }

  const expectedThemeState =
    theme === 'dark'
      ? {
          panelBackground: 'rgb(25, 24, 22)',
          headerBackground: 'rgba(42, 40, 36, 0.9)',
          clusterBackground: 'rgba(42, 40, 36, 0.9)',
          headingColor: 'rgb(244, 241, 232)',
          taskColor: 'rgb(244, 241, 232)',
          mutedColor: 'rgb(140, 138, 132)',
        }
      : {
          panelBackground: 'rgb(245, 245, 242)',
          headerBackground: 'rgba(255, 255, 255, 0.92)',
          clusterBackground: 'rgba(255, 255, 255, 0.92)',
          headingColor: 'rgb(41, 41, 41)',
          taskColor: 'rgb(41, 41, 41)',
          mutedColor: 'rgb(127, 127, 127)',
        };
  for (const [property, expected] of Object.entries(expectedThemeState)) {
    if (todayState[property] !== expected) {
      throw new Error(
        `${theme} daily timeline ${property} was ${todayState[property]}, expected ${expected}`,
      );
    }
  }

  await page.screenshot({ path: `/tmp/calendar-day-panel-${theme}-joined.png`, fullPage: true });

  await page.getByRole('button', { name: 'Close daily timeline' }).click();
  await page.waitForSelector('.calendar-day-panel', { state: 'hidden' });
  if ((await dayButton('2026-08-05').getAttribute('aria-pressed')) !== 'true') {
    throw new Error('closing the daily timeline did not preserve the selected date');
  }
  if (!(await dayButton('2026-08-05').evaluate((node) => node === document.activeElement))) {
    throw new Error('closing the daily timeline did not restore focus to its date button');
  }

  await dayButton('2026-08-05').dblclick();
  await page.waitForSelector('.calendar-day-panel');
  await page.keyboard.press('Escape');
  await page.waitForSelector('.calendar-day-panel', { state: 'hidden' });
  if (!(await dayButton('2026-08-05').evaluate((node) => node === document.activeElement))) {
    throw new Error('Escape did not restore focus to the selected date button');
  }

  await dayButton('2026-08-06').dblclick();
  await waitForInkDot('2026-08-06');
  const otherDateState = await page.evaluate(() => ({
    panelTitle: document.querySelector('#calendar-day-panel-heading')?.textContent.trim(),
    taskTitles: Array.from(document.querySelectorAll('.calendar-day-task-title')).map((node) =>
      node.textContent.trim(),
    ),
    previousPressed: document
      .querySelector('[data-calendar-date="2026-08-05"] .calendar-day-number')
      ?.getAttribute('aria-pressed'),
    selectedPressed: document
      .querySelector('[data-calendar-date="2026-08-06"] .calendar-day-number')
      ?.getAttribute('aria-pressed'),
    selectedBackground: getComputedStyle(
      document.querySelector('[data-calendar-date="2026-08-06"] .calendar-day-number'),
    ).backgroundColor,
  }));

  if (
    otherDateState.panelTitle !== 'Thursday, August 6' ||
    JSON.stringify(otherDateState.taskTitles) !== JSON.stringify(['Prepare tomorrow handoff']) ||
    otherDateState.previousPressed !== 'false' ||
    otherDateState.selectedPressed !== 'true' ||
    otherDateState.selectedBackground !== expectedInkBackground
  ) {
    throw new Error(`another date did not replace the selected day cleanly: ${JSON.stringify(otherDateState)}`);
  }

  await dayButton('2026-08-07').dblclick();
  await waitForInkDot('2026-08-07');
  const emptyState = await page.evaluate(() => ({
    panelTitle: document.querySelector('#calendar-day-panel-heading')?.textContent.trim(),
    emptyTitle: document.querySelector('.calendar-day-empty h3')?.textContent.trim(),
    emptyCopy: document.querySelector('.calendar-day-empty p')?.textContent.trim(),
    taskCount: document.querySelectorAll('.calendar-day-task').length,
    selectedPressed: document
      .querySelector('[data-calendar-date="2026-08-07"] .calendar-day-number')
      ?.getAttribute('aria-pressed'),
    selectedBackground: getComputedStyle(
      document.querySelector('[data-calendar-date="2026-08-07"] .calendar-day-number'),
    ).backgroundColor,
  }));

  if (
    emptyState.panelTitle !== 'Friday, August 7' ||
    emptyState.emptyTitle !== 'Nothing completed' ||
    !emptyState.emptyCopy?.includes('Double-click another date') ||
    emptyState.taskCount !== 0 ||
    emptyState.selectedPressed !== 'true' ||
    emptyState.selectedBackground !== expectedInkBackground
  ) {
    throw new Error(`empty-day state was not shown: ${JSON.stringify(emptyState)}`);
  }

  if (browserErrors.length) {
    throw new Error(`calendar interaction logged browser errors: ${browserErrors.join(' | ')}`);
  }

  await page.screenshot({ path: `/tmp/calendar-day-panel-${theme}-empty.png`, fullPage: true });
  console.log(JSON.stringify({ theme, todayState, otherDateState, emptyState }, null, 2));
  await page.close();
} finally {
  await browser.close();
}
