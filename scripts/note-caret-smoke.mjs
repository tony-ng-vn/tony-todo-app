import { chromium } from 'playwright';

const targetUrl = new URL(process.env.UI_SMOKE_URL ?? 'http://127.0.0.1:5174/');
targetUrl.searchParams.set('local', '1');

const lines = Array.from({ length: 48 }, (_, index) => `Context line ${index + 1}`);
const scenarios = [
  {
    name: 'continued-list',
    note: [...lines, '- final item'].join('\n'),
    expectedSuffix: '\n- ',
  },
  {
    name: 'plain-line',
    note: [...lines, 'plain final line'].join('\n'),
    expectedSuffix: '\n',
  },
];

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
});

try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  await page.addInitScript(() => {
    localStorage.setItem('done-log-client-id', 'note-caret-smoke');
    localStorage.setItem(
      'done-log-state',
      JSON.stringify({
        todos: [
          {
            id: 'note-caret-task',
            title: 'Note caret check',
            createdAt: new Date().toISOString(),
            completedAt: null,
            note: '',
          },
        ],
      }),
    );
  });
  await page.goto(targetUrl.toString(), { waitUntil: 'networkidle' });
  await page.click('[data-todo-id="note-caret-task"] .open-task-button');
  const textarea = page.locator('#detail-note');
  await textarea.waitFor();

  const failures = [];
  for (const scenario of scenarios) {
    await textarea.fill(scenario.note);
    await textarea.evaluate((element) => {
      element.setSelectionRange(element.value.length, element.value.length);
      element.scrollTop = element.scrollHeight;
    });
    const before = await textarea.evaluate(caretMetrics);
    await textarea.press('Enter');
    await page.waitForFunction(
      ({ selector, suffix }) => document.querySelector(selector)?.value.endsWith(suffix),
      { selector: '#detail-note', suffix: scenario.expectedSuffix },
    );
    await textarea.evaluate(
      () =>
        new Promise((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(resolve));
        }),
    );
    const after = await textarea.evaluate(caretMetrics);

    console.log(`${scenario.name} before ${JSON.stringify(before)}`);
    console.log(`${scenario.name} after ${JSON.stringify(after)}`);
    if (!before.caretLineVisible || !after.caretLineVisible) {
      failures.push(`${scenario.name} caret line left the visible textarea`);
    }
  }

  if (failures.length) {
    console.error(failures.join('\n'));
    process.exitCode = 1;
  }

  await page.close();
} finally {
  await browser.close();
}

function caretMetrics(textarea) {
  const style = getComputedStyle(textarea);
  const lineHeight = Number.parseFloat(style.lineHeight);
  const paddingTop = Number.parseFloat(style.paddingTop);
  const selectionStart = textarea.selectionStart ?? 0;
  const lineIndex = textarea.value.slice(0, selectionStart).split('\n').length - 1;
  const caretTop = paddingTop + lineIndex * lineHeight;

  return {
    scrollTop: Math.round(textarea.scrollTop),
    selectionStart,
    caretLineVisible:
      caretTop >= textarea.scrollTop &&
      caretTop + lineHeight <= textarea.scrollTop + textarea.clientHeight,
  };
}
