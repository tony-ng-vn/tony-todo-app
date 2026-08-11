import { describe, expect, it } from 'vitest';
import {
  getStandaloneWebUrl,
  isYouTubeUrl,
  linkifyText,
  shortenLinksText,
} from './linkify.js';

describe('linkifyText', () => {
  it('escapes plain text before rendering', () => {
    expect(linkifyText('<script>alert("x")</script>')).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;',
    );
  });

  it('renders web links as external anchors', () => {
    expect(linkifyText('Follow https://x.com/dickiebush/status/2062876058312224972 today')).toBe(
      'Follow <a href="https://x.com/dickiebush/status/2062876058312224972" target="_blank" rel="noreferrer noopener">X</a> today',
    );
  });

  it('labels known platform links by platform name', () => {
    expect(
      linkifyText('Profiles https://www.linkedin.com/in/example https://instagram.com/example https://github.com/example'),
    ).toBe(
      'Profiles <a href="https://www.linkedin.com/in/example" target="_blank" rel="noreferrer noopener">LinkedIn</a> <a href="https://instagram.com/example" target="_blank" rel="noreferrer noopener">Instagram</a> <a href="https://github.com/example" target="_blank" rel="noreferrer noopener">GitHub</a>',
    );
  });

  it('uses the hostname for unknown links', () => {
    expect(linkifyText('Read https://docs.example.com/path')).toBe(
      'Read <a href="https://docs.example.com/path" target="_blank" rel="noreferrer noopener">docs.example.com</a>',
    );
  });
});

describe('shortenLinksText', () => {
  it('shortens links without changing the surrounding task text', () => {
    expect(
      shortenLinksText('Review https://docs.example.com/a/very/long/path and https://x.com/example'),
    ).toBe('Review docs.example.com and X');
  });

  it('preserves punctuation after a shortened link', () => {
    expect(shortenLinksText('Review https://docs.example.com/path, then reply.')).toBe(
      'Review docs.example.com, then reply.',
    );
  });
});

describe('getStandaloneWebUrl', () => {
  it('returns a trimmed http link when it is the entire task title', () => {
    expect(getStandaloneWebUrl('  https://youtu.be/abc123?t=4  ')).toBe(
      'https://youtu.be/abc123?t=4',
    );
  });

  it('does not treat surrounding task text or unsafe schemes as a standalone web link', () => {
    expect(getStandaloneWebUrl('Watch https://youtu.be/abc123')).toBeNull();
    expect(getStandaloneWebUrl('javascript:alert(1)')).toBeNull();
  });
});

describe('isYouTubeUrl', () => {
  it('recognizes supported YouTube links without matching unrelated hosts', () => {
    expect(isYouTubeUrl('https://www.youtube.com/watch?v=abc123')).toBe(true);
    expect(isYouTubeUrl('https://music.youtube.com/watch?v=abc123')).toBe(true);
    expect(isYouTubeUrl('https://youtu.be/abc123')).toBe(true);
    expect(isYouTubeUrl('https://notyoutube.com/watch?v=abc123')).toBe(false);
    expect(isYouTubeUrl('not a URL')).toBe(false);
  });
});
