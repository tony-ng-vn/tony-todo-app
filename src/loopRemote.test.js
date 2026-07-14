import { describe, expect, it } from 'vitest';
import { acceptLoop, dismissLoop, loadInboxLoops, loadWaitingLoops } from './loopRemote.js';

describe('loadInboxLoops', () => {
  it('loads inbox-status loops for a user and attaches evidence', async () => {
    const calls = [];
    const client = fakeSelectClient(calls, {
      todos: [
        {
          id: 'loop-1',
          title: 'Confirm the MSA redlines',
          loop_type: 'approval',
          confidence: 0.72,
          priority_label: 'P1',
          why_priority: 'Blocks the contract.',
        },
      ],
      evidence: [
        { todo_id: 'loop-1', source_app: 'granola', author: 'legal@acme.com', excerpt: 'Can you confirm?' },
      ],
    });

    const loops = await loadInboxLoops(client, 'user-123');

    expect(loops).toEqual([
      {
        id: 'loop-1',
        title: 'Confirm the MSA redlines',
        loopType: 'approval',
        confidence: 0.72,
        priorityLabel: 'P1',
        whyPriority: 'Blocks the contract.',
        evidence: { sourceApp: 'granola', author: 'legal@acme.com', excerpt: 'Can you confirm?' },
      },
    ]);
    expect(calls).toContainEqual(['eq', 'user_id', 'user-123']);
    expect(calls).toContainEqual(['eq', 'loop_status', 'inbox']);
  });

  it('falls back to an empty evidence excerpt when none exists', async () => {
    const client = fakeSelectClient([], {
      todos: [{ id: 'loop-1', title: 'Untitled loop', loop_type: 'promise', confidence: 0.7, priority_label: 'P2', why_priority: null }],
      evidence: [],
    });

    const loops = await loadInboxLoops(client, 'user-123');

    expect(loops[0].evidence).toEqual({ sourceApp: null, author: null, excerpt: '' });
  });
});

describe('loadWaitingLoops', () => {
  it('loads open waiting-type loops for a user', async () => {
    const calls = [];
    const client = fakeSelectClient(calls, {
      todos: [
        {
          id: 'loop-2',
          title: 'Q2 sales numbers',
          loop_type: 'waiting',
          created_at: '2026-07-08T09:00:00.000Z',
        },
      ],
      evidence: [{ todo_id: 'loop-2', source_app: 'slack', author: 'Priya', excerpt: "I'll get you the numbers." }],
    });

    const loops = await loadWaitingLoops(client, 'user-123');

    expect(loops).toEqual([
      {
        id: 'loop-2',
        title: 'Q2 sales numbers',
        counterpartyName: 'Priya',
        createdAt: '2026-07-08T09:00:00.000Z',
        dueAt: null,
        evidence: { sourceApp: 'slack', excerpt: "I'll get you the numbers." },
      },
    ]);
    expect(calls).toContainEqual(['eq', 'loop_type', 'waiting']);
    expect(calls).toContainEqual(['is', 'completed_at', null]);
  });

  it('falls back to a generic counterparty name when evidence has no author', async () => {
    const client = fakeSelectClient([], {
      todos: [{ id: 'loop-2', title: 'Something pending', loop_type: 'waiting', created_at: '2026-07-08T09:00:00.000Z' }],
      evidence: [],
    });

    const loops = await loadWaitingLoops(client, 'user-123');

    expect(loops[0].counterpartyName).toBe('Someone else');
  });
});

describe('acceptLoop', () => {
  it('sets loop_status to accepted, scoped by user id', async () => {
    const calls = [];
    const client = fakeUpdateClient(calls);

    await acceptLoop(client, 'user-123', 'loop-1');

    expect(calls[0]).toEqual(['from', 'todos']);
    expect(calls[1]).toEqual(['update', { loop_status: 'accepted' }]);
    expect(calls).toContainEqual(['eq', 'id', 'loop-1']);
    expect(calls).toContainEqual(['eq', 'user_id', 'user-123']);
  });
});

describe('dismissLoop', () => {
  it('sets loop_status to dismissed, scoped by user id', async () => {
    const calls = [];
    const client = fakeUpdateClient(calls);

    await dismissLoop(client, 'user-123', 'loop-1');

    expect(calls[1]).toEqual(['update', { loop_status: 'dismissed' }]);
    expect(calls).toContainEqual(['eq', 'id', 'loop-1']);
    expect(calls).toContainEqual(['eq', 'user_id', 'user-123']);
  });
});

function fakeSelectClient(calls, { todos, evidence }) {
  return {
    database: {
      from(table) {
        calls.push(['from', table]);
        const state = { table };
        const builder = {
          select(columns) {
            calls.push(['select', columns]);
            return builder;
          },
          eq(column, value) {
            calls.push(['eq', column, value]);
            return builder;
          },
          is(column, value) {
            calls.push(['is', column, value]);
            return builder;
          },
          then(resolve) {
            const data = state.table === 'todos' ? todos : evidence;
            resolve({ data, error: null });
          },
        };
        return builder;
      },
    },
  };
}

function fakeUpdateClient(calls) {
  return {
    database: {
      from(table) {
        calls.push(['from', table]);
        return {
          update(values) {
            calls.push(['update', values]);
            return {
              eq(column, value) {
                calls.push(['eq', column, value]);
                return this;
              },
              then(resolve) {
                resolve({ error: null });
              },
            };
          },
        };
      },
    },
  };
}
