const URL_PATTERN = /https?:\/\/[^\s<>"']+/g;
const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
]);
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

export function shortenLinksText(value) {
  return String(value).replace(URL_PATTERN, (match) => {
    const punctuation = match.match(/[.,!?;:]+$/)?.[0] ?? '';
    const url = match.slice(0, match.length - punctuation.length);
    return `${labelForUrl(url)}${punctuation}`;
  });
}

export function getStandaloneWebUrl(value) {
  const text = String(value).trim();
  if (!text || /\s/.test(text)) {
    return null;
  }

  try {
    const parsedUrl = new URL(text);
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:' ? text : null;
  } catch {
    return null;
  }
}

export function isYouTubeUrl(value) {
  try {
    const parsedUrl = value instanceof URL ? value : new URL(String(value));
    return YOUTUBE_HOSTS.has(parsedUrl.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function labelForUrl(url) {
  try {
    const parsedUrl = new URL(url);
    if (isYouTubeUrl(parsedUrl)) {
      return 'YouTube';
    }
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
