import { labelForUrl } from '../../linkify.js';

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
]);

export async function resolveLinkTitle(rawUrl, { fetchImpl = globalThis.fetch } = {}) {
  const url = parseWebUrl(rawUrl);
  const fallbackTitle = YOUTUBE_HOSTS.has(url.hostname.toLowerCase())
    ? 'YouTube'
    : labelForUrl(url.href);
  const metadataUrl = youtubeMetadataUrl(url);
  if (!metadataUrl) {
    return { title: fallbackTitle };
  }

  try {
    const response = await fetchImpl(metadataUrl, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      return { title: fallbackTitle };
    }

    const data = await response.json();
    const title = normalizeTitle(data?.title);
    return { title: title || fallbackTitle };
  } catch {
    return { title: fallbackTitle };
  }
}

function parseWebUrl(rawUrl) {
  try {
    const url = new URL(String(rawUrl));
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.username || url.password) {
      throw new TypeError();
    }
    return url;
  } catch {
    throw new TypeError('Enter a valid web URL.');
  }
}

function youtubeMetadataUrl(url) {
  if (!YOUTUBE_HOSTS.has(url.hostname.toLowerCase())) {
    return null;
  }

  const params = new URLSearchParams({ url: url.href, format: 'json' });
  return `https://www.youtube.com/oembed?${params}`;
}

function normalizeTitle(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, 240) : '';
}
