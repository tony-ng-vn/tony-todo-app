export const NOTE_HEADING_PATTERN = /^(?:Start:|End:|@) \d{4}-\d{2}-\d{2} \d{2}:\d{2}\s*$/;

export function noteBody(note) {
  return String(note ?? '')
    .split('\n')
    .filter((line) => !NOTE_HEADING_PATTERN.test(line))
    .join('\n');
}

export async function waitForStoredNoteBody(page, todoId, expected) {
  await page.waitForFunction(
    ({ id, expectedBody }) => {
      const pattern = /^(?:Start:|End:|@) \d{4}-\d{2}-\d{2} \d{2}:\d{2}\s*$/;
      const todos = JSON.parse(localStorage.getItem('done-log-state')).todos;
      const stored = id
        ? todos.find((item) => item.id === id)?.note
        : todos[0]?.note;
      const body = String(stored ?? '')
        .split('\n')
        .filter((line) => !pattern.test(line))
        .join('\n');
      return body === expectedBody;
    },
    { id: todoId, expectedBody: expected },
  );
}
