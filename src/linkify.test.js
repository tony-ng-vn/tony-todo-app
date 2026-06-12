import { describe, expect, it } from 'vitest';
import { linkifyText } from './linkify.js';

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
