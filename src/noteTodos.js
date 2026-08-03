const TODO_LINE_PATTERN = /^-\s+\[( |x|X)\]\s+(.*)$/;

export function parseNoteTodos(note) {
  return String(note ?? '')
    .split('\n')
    .map((line, lineIndex) => {
      const match = line.match(TODO_LINE_PATTERN);
      return match
        ? {
            lineIndex,
            done: match[1].toLowerCase() === 'x',
            label: match[2],
          }
        : null;
    })
    .filter(Boolean);
}

export function expandTodoCommand(value, cursor) {
  const lineStart = value.lastIndexOf('\n', Math.max(0, cursor - 1)) + 1;
  const lineEndIndex = value.indexOf('\n', cursor);
  const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
  const line = value.slice(lineStart, lineEnd);
  const match = line.match(/^\/todo(?:\s+)?(.*)$/);

  if (!match) {
    return { value, cursor, changed: false };
  }

  const replacement = `- [ ] ${match[1] ?? ''}`;
  return {
    value: `${value.slice(0, lineStart)}${replacement}${value.slice(lineEnd)}`,
    cursor: lineStart + replacement.length,
    changed: true,
  };
}

export function toggleNoteTodo(note, lineIndex) {
  const lines = String(note ?? '').split('\n');
  const match = lines[lineIndex]?.match(TODO_LINE_PATTERN);
  if (!match) {
    return String(note ?? '');
  }

  const marker = match[1].toLowerCase() === 'x' ? ' ' : 'x';
  lines[lineIndex] = `- [${marker}] ${match[2]}`;
  return lines.join('\n');
}
