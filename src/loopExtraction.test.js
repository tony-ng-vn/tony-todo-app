import { describe, expect, it } from 'vitest';
import { parseLoopCandidates } from './loopExtraction.js';

describe('parseLoopCandidates', () => {
  it('parses a plain JSON array', () => {
    expect(parseLoopCandidates('[{"title":"Send the deck"}]')).toEqual([{ title: 'Send the deck' }]);
  });

  it('strips markdown code fences', () => {
    expect(parseLoopCandidates('```json\n[{"title":"Send the deck"}]\n```')).toEqual([
      { title: 'Send the deck' },
    ]);
  });

  it('returns an empty array for an empty-array response', () => {
    expect(parseLoopCandidates('[]')).toEqual([]);
  });

  it('returns an empty array when the model returns non-array JSON', () => {
    expect(parseLoopCandidates('{"title":"not an array"}')).toEqual([]);
  });

  it('returns an empty array when the content is not valid JSON', () => {
    expect(parseLoopCandidates('Sorry, I cannot help with that.')).toEqual([]);
  });
});
