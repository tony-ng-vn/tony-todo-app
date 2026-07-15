import { describe, expect, it } from 'vitest';
import { FEEDBACK_CATEGORIES, buildFeedbackRecord } from './feedbackRemote.js';

describe('FEEDBACK_CATEGORIES', () => {
  it('is the fixed set the UI and DB check agree on', () => {
    expect(FEEDBACK_CATEGORIES).toEqual(['idea', 'bug', 'other']);
  });
});

describe('buildFeedbackRecord', () => {
  const userId = 'user-1';

  it('builds a record from valid input', () => {
    const record = buildFeedbackRecord(userId, {
      category: 'idea',
      message: 'Add dark mode toggle',
      pageContext: 'flow',
    });
    expect(record).toEqual({
      user_id: 'user-1',
      category: 'idea',
      message: 'Add dark mode toggle',
      page_context: 'flow',
    });
  });

  it('trims the message', () => {
    const record = buildFeedbackRecord(userId, { category: 'bug', message: '  broken  ' });
    expect(record.message).toBe('broken');
  });

  it('defaults page_context to null when absent', () => {
    const record = buildFeedbackRecord(userId, { category: 'other', message: 'hi' });
    expect(record.page_context).toBeNull();
  });

  it('throws on an empty or whitespace-only message', () => {
    expect(() => buildFeedbackRecord(userId, { category: 'idea', message: '   ' })).toThrow(
      /message/i
    );
    expect(() => buildFeedbackRecord(userId, { category: 'idea', message: '' })).toThrow(/message/i);
  });

  it('throws on an unknown category', () => {
    expect(() => buildFeedbackRecord(userId, { category: 'praise', message: 'nice' })).toThrow(
      /category/i
    );
  });

  it('throws when there is no user id', () => {
    expect(() => buildFeedbackRecord(null, { category: 'idea', message: 'hi' })).toThrow(/sign/i);
  });
});
