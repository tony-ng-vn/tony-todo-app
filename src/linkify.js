const URL_PATTERN = /https?:\/\/[^\s<>"']+/g;

export function linkifyText(value) {
  const text = String(value);
  let rendered = '';
  let lastIndex = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const url = match[0];
    const index = match.index ?? 0;
    rendered += escapeHtml(text.slice(lastIndex, index));
    const escapedUrl = escapeHtml(url);
    rendered += `<a href="${escapedUrl}" target="_blank" rel="noreferrer noopener">${escapedUrl}</a>`;
    lastIndex = index + url.length;
  }

  return rendered + escapeHtml(text.slice(lastIndex));
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
