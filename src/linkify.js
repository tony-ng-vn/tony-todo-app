const URL_PATTERN = /https?:\/\/[^\s<>"']+/g;
const PLATFORM_LABELS = new Map([
  ['linkedin.com', 'LinkedIn'],
  ['x.com', 'X'],
  ['twitter.com', 'X'],
  ['instagram.com', 'Instagram'],
  ['github.com', 'GitHub'],
  ['youtube.com', 'YouTube'],
  ['youtu.be', 'YouTube'],
  ['tiktok.com', 'TikTok'],
  ['facebook.com', 'Facebook'],
  ['threads.net', 'Threads'],
]);

export function linkifyText(value) {
  const text = String(value);
  let rendered = '';
  let lastIndex = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const url = match[0];
    const index = match.index ?? 0;
    rendered += escapeHtml(text.slice(lastIndex, index));
    const escapedUrl = escapeHtml(url);
    rendered += `<a href="${escapedUrl}" target="_blank" rel="noreferrer noopener">${escapeHtml(labelForUrl(url))}</a>`;
    lastIndex = index + url.length;
  }

  return rendered + escapeHtml(text.slice(lastIndex));
}

export function labelForUrl(url) {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase().replace(/^www\./, '');
    return PLATFORM_LABELS.get(hostname) ?? hostname;
  } catch {
    return url;
  }
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
