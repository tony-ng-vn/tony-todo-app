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
    ...assertMinimumContrast(mobile, '.todo-item button', 4.5, 'Done button'),
    ...assertHasMotion(mobile, '.input-row button', 'Add button'),
    ...assertHasMotion(mobile, '.todo-item button', 'Done button'),
    ...assertFullScreenShell(desktop, '.workspace', 'workspace shell'),
    ...assertGlassSurface(desktop, '.task-panel', 'task panel'),
    ...assertGlassSurface(desktop, '.summary-panel', 'summary panel'),
    ...assertExists(desktop, '.flow-rail', 'frosted focus rail'),
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
        ],
      }),
    );
  });
  await page.goto(targetUrl.toString(), { waitUntil: 'networkidle' });

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
      },
      rects: {
        '#todo-title': rectFor('#todo-title'),
        '#summary-date': rectFor('#summary-date'),
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
  return { viewport, ...metrics };
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
