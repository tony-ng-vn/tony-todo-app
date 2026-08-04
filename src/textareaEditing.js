export function getTextareaKeyEdit({
  value,
  selectionStart,
  selectionEnd,
  key,
  shiftKey = false,
}) {
  if (key === 'Tab' && !shiftKey) {
    return replaceSelection(value, selectionStart, selectionEnd, '\t');
  }

  if (key !== 'Enter') {
    return null;
  }

  const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
  const indentation = value.slice(lineStart, selectionStart).match(/^[\t ]+/)?.[0] ?? '';
  if (!indentation) {
    return null;
  }

  return replaceSelection(value, selectionStart, selectionEnd, `\n${indentation}`);
}

function replaceSelection(value, selectionStart, selectionEnd, replacement) {
  return {
    value: `${value.slice(0, selectionStart)}${replacement}${value.slice(selectionEnd)}`,
    cursor: selectionStart + replacement.length,
  };
}
