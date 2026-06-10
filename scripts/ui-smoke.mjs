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
    ...assertMinimumTarget(mobile, '#summary-date', 44, 'mobile date input'),
    ...assertMinimumTarget(mobile, '.theme-toggle', 34, 'mobile theme toggle'),
    ...assertMinimumContrast(mobile, '.todo-item button', 4.5, 'Done button'),
    ...assertHasMotion(mobile, '.input-row button', 'Add button'),
    ...assertHasMotion(mobile, '.todo-item button', 'Done button'),
    ...assertHasMotion(mobile, '.theme-toggle', 'Theme toggle'),
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
    ...assertIncludes(desktop.summaryDurations, '25m', 'summary duration text'),
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

    localStorage.setItem('done-log-client-id', 'ui-smoke-local');
    localStorage.setItem(
      'done-log-state',
      JSON.stringify({
        todos: [
          {
            id: 'ui-smoke-local-task',
            title: 'Review daily plan',
            createdAt: '2026-06-08T08:00:00.000Z',
            completedAt: null,
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
        summaryOverflowY: getComputedStyle(document.querySelector('.summary-list')).overflowY,
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
  return { viewport, editChecks, ...metrics };
}

async function exerciseDetailEditing(page) {
  await page.click('.todo-item .open-task-button');
  await page.fill('#detail-note', 'Smoke note');
  await page.fill('#detail-title-input', 'Smoke renamed task');
  await page.locator('#detail-title-input').blur();
  await page.waitForFunction(() => document.querySelector('#detail-title-input')?.value === 'Smoke renamed task');
  await page.locator('.progress-toggle input').check();
  await page.fill('#progress-label', 'pages 41-52');
  await page.click('.todo-item button[aria-label^="Log"]');
  await page.waitForTimeout(100);

  return page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('done-log-state'));
    const todo = state.todos.find((item) => item.id === 'ui-smoke-local-task');
    const session = state.todos.find((item) => item.parentTaskId === 'ui-smoke-local-task');
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
  return editChecks.noteValue === 'Smoke note' &&
    editChecks.storedNote === 'Smoke note' &&
    editChecks.titleValue === 'Smoke renamed task' &&
    editChecks.storedTitle === 'Smoke renamed task'
    ? []
    : [`detail editing failed: ${JSON.stringify(editChecks)}`];
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
