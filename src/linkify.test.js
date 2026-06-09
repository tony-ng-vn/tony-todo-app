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
      'Follow <a href="https://x.com/dickiebush/status/2062876058312224972" target="_blank" rel="noreferrer noopener">https://x.com/dickiebush/status/2062876058312224972</a> today',
    );
  });
});
