export function getTextareaKeyEdit({
  value,
  selectionStart,
  selectionEnd,
  key,
  shiftKey = false,
}) {
  const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
  const lineEnd = value.indexOf('\n', selectionStart);
  const currentLine = value.slice(lineStart, lineEnd === -1 ? value.length : lineEnd);
  const listItem = parseListItem(currentLine);

  if (key === 'Tab') {
    if (!listItem) {
      return shiftKey ? null : replaceSelection(value, selectionStart, selectionEnd, '\t');
    }

    if (!shiftKey) {
      return insertAt(value, lineStart, '\t', selectionStart + 1);
    }

    const nextIndentation = removeIndentLevel(listItem.indentation);
    if (nextIndentation === listItem.indentation) {
      return null;
    }

    const removedLength = listItem.indentation.length - nextIndentation.length;
    return {
      value: `${value.slice(0, lineStart)}${nextIndentation}${value.slice(lineStart + listItem.indentation.length)}`,
      cursor: Math.max(lineStart, selectionStart - removedLength),
    };
  }

  if (key !== 'Enter' || shiftKey) {
    return null;
  }

  if (listItem) {
    if (!listItem.content.trim()) {
      const nextIndentation = removeIndentLevel(listItem.indentation);
      const lineEndIndex = lineEnd === -1 ? value.length : lineEnd;

      if (nextIndentation !== listItem.indentation) {
        const replacement = `${nextIndentation}${listItem.prefix}`;
        return replaceRange(value, lineStart, lineEndIndex, replacement);
      }

      return replaceRange(value, lineStart, lineEndIndex, '');
    }

    return replaceSelection(
      value,
      selectionStart,
      selectionEnd,
      `\n${listItem.indentation}${listItem.nextPrefix}`,
    );
  }

  const indentation = value.slice(lineStart, selectionStart).match(/^[\t ]+/)?.[0] ?? '';
  if (!indentation) {
    return null;
  }

  return replaceSelection(value, selectionStart, selectionEnd, `\n${indentation}`);
}

function replaceSelection(value, selectionStart, selectionEnd, replacement) {
  return replaceRange(value, selectionStart, selectionEnd, replacement);
}

function replaceRange(value, start, end, replacement) {
  return {
    value: `${value.slice(0, start)}${replacement}${value.slice(end)}`,
    cursor: start + replacement.length,
  };
}

function insertAt(value, index, insertion, cursor) {
  return {
    value: `${value.slice(0, index)}${insertion}${value.slice(index)}`,
    cursor,
  };
}

function parseListItem(line) {
  const checkbox = line.match(/^([\t ]*)([-+*][\t ]+\[[ xX]\])(?:([\t ]+)(.*))?$/);
  if (checkbox) {
    const spacing = checkbox[3] ?? ' ';
    return {
      indentation: checkbox[1],
      prefix: `${checkbox[2]}${spacing}`,
      nextPrefix: `${checkbox[2].replace(/\[[xX]\]/, '[ ]')}${spacing}`,
      content: checkbox[4] ?? '',
    };
  }

  const bullet = line.match(/^([\t ]*)([-+*][\t ]+)(.*)$/);
  if (bullet) {
    return {
      indentation: bullet[1],
      prefix: bullet[2],
      nextPrefix: bullet[2],
      content: bullet[3],
    };
  }

  const numbered = line.match(/^([\t ]*)(\d+)([.)])([\t ]+)(.*)$/);
  if (!numbered) {
    return null;
  }

  return {
    indentation: numbered[1],
    prefix: `${numbered[2]}${numbered[3]}${numbered[4]}`,
    nextPrefix: `${Number(numbered[2]) + 1}${numbered[3]}${numbered[4]}`,
    content: numbered[5],
  };
}

function removeIndentLevel(indentation) {
  if (indentation.endsWith('\t')) {
    return indentation.slice(0, -1);
  }

  return indentation.replace(/ {1,4}$/, '');
}
