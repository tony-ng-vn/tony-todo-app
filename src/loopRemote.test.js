import { describe, expect, it } from 'vitest';
import {
  acceptLoop,
  dismissLoop,
  loadDismissedLoops,
  loadInboxLoops,
  loadMeetings,
  loadSyncStatus,
  loadWaitingLoops,
  restoreLoop,
  snoozeLoop,
} from './loopRemote.js';

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

    const loops = await loadInboxLoops(client, 'user-123', new Date('2026-07-14T00:00:00.000Z'));

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
    expect(calls).toContainEqual(['or', 'next_review_at.is.null,next_review_at.lte.2026-07-14T00:00:00.000Z']);
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
  it('sets loop_status to accepted and bumps updated_at, scoped by user id', async () => {
    const calls = [];
    const client = fakeUpdateClient(calls);

    await acceptLoop(client, 'user-123', 'loop-1', new Date('2026-07-14T10:00:00.000Z'));

    expect(calls[0]).toEqual(['from', 'todos']);
    expect(calls[1]).toEqual([
      'update',
      { loop_status: 'accepted', updated_at: '2026-07-14T10:00:00.000Z' },
    ]);
    expect(calls).toContainEqual(['eq', 'id', 'loop-1']);
    expect(calls).toContainEqual(['eq', 'user_id', 'user-123']);
  });
});

describe('dismissLoop', () => {
  it('sets loop_status to dismissed and bumps updated_at, scoped by user id', async () => {
    const calls = [];
    const client = fakeUpdateClient(calls);

    await dismissLoop(client, 'user-123', 'loop-1', new Date('2026-07-14T10:00:00.000Z'));

    expect(calls[1]).toEqual([
      'update',
      { loop_status: 'dismissed', updated_at: '2026-07-14T10:00:00.000Z' },
    ]);
    expect(calls).toContainEqual(['eq', 'id', 'loop-1']);
    expect(calls).toContainEqual(['eq', 'user_id', 'user-123']);
  });
});

describe('snoozeLoop', () => {
  it('sets next_review_at and keeps loop_status as inbox, scoped by user id', async () => {
    const calls = [];
    const client = fakeUpdateClient(calls);

    await snoozeLoop(client, 'user-123', 'loop-1', new Date('2026-07-15T09:00:00.000Z'));

    expect(calls[0]).toEqual(['from', 'todos']);
    expect(calls[1]).toEqual(['update', { next_review_at: '2026-07-15T09:00:00.000Z', loop_status: 'inbox' }]);
    expect(calls).toContainEqual(['eq', 'id', 'loop-1']);
    expect(calls).toContainEqual(['eq', 'user_id', 'user-123']);
  });
});

describe('loadDismissedLoops', () => {
  it('loads dismissed loops for a user, most recently updated first, with evidence', async () => {
    const calls = [];
    const client = fakeSelectClient(calls, {
      todos: [
        {
          id: 'loop-1',
          title: 'Explore a new social media concept',
          loop_type: 'follow-up',
          priority_label: 'P2',
          updated_at: '2026-07-13T10:00:00.000Z',
        },
      ],
      evidence: [{ todo_id: 'loop-1', source_app: 'granola', author: 'Tony', excerpt: 'not relevant' }],
    });

    const loops = await loadDismissedLoops(client, 'user-123');

    expect(loops).toEqual([
      {
        id: 'loop-1',
        title: 'Explore a new social media concept',
        loopType: 'follow-up',
        priorityLabel: 'P2',
        updatedAt: '2026-07-13T10:00:00.000Z',
        evidence: { sourceApp: 'granola', author: 'Tony', excerpt: 'not relevant' },
      },
    ]);
    expect(calls).toContainEqual(['eq', 'user_id', 'user-123']);
    expect(calls).toContainEqual(['eq', 'loop_status', 'dismissed']);
    expect(calls).toContainEqual(['order', 'updated_at', { ascending: false }]);
  });
});

describe('loadSyncStatus', () => {
  it('loads ingestion cursor rows for a user', async () => {
    const calls = [];
    const client = {
      database: {
        from(table) {
          calls.push(['from', table]);
          return {
            select(columns) {
              calls.push(['select', columns]);
              return this;
            },
            eq(column, value) {
              calls.push(['eq', column, value]);
              return this;
            },
            then(resolve) {
              resolve({
                data: [
                  { source: 'granola-personal', last_synced_at: '2026-07-13T18:15:00.000Z' },
                  { source: 'granola-workspace', last_synced_at: null },
                ],
                error: null,
              });
            },
          };
        },
      },
    };

    const status = await loadSyncStatus(client, 'user-123');

    expect(status).toEqual([
      { source: 'granola-personal', lastSyncedAt: '2026-07-13T18:15:00.000Z' },
      { source: 'granola-workspace', lastSyncedAt: null },
    ]);
    expect(calls).toContainEqual(['from', 'ingestion_cursor']);
    expect(calls).toContainEqual(['eq', 'user_id', 'user-123']);
  });
});

describe('loadMeetings', () => {
  it('groups loops by their source meeting, most recent first', async () => {
    const calls = [];
    const client = fakeMeetingsClient(calls, {
      evidence: [
        {
          todo_id: 'loop-2',
          source_app: 'granola',
          source_object_id: 'note-b',
          source_title: 'Founder sync',
          occurred_at: '2026-07-12T09:00:00.000Z',
          author: 'Tony',
        },
        {
          todo_id: 'loop-1',
          source_app: 'granola',
          source_object_id: 'note-a',
          source_title: 'Investor update',
          occurred_at: '2026-07-10T09:00:00.000Z',
          author: 'Tony',
        },
      ],
      todos: [
        { id: 'loop-1', title: 'Send the deck', loop_status: 'accepted', priority_label: 'P1' },
        { id: 'loop-2', title: 'Follow up on hiring', loop_status: 'inbox', priority_label: 'P2' },
      ],
    });

    const meetings = await loadMeetings(client, 'user-123');

    expect(meetings).toEqual([
      {
        sourceObjectId: 'note-b',
        title: 'Founder sync',
        occurredAt: '2026-07-12T09:00:00.000Z',
        author: 'Tony',
        loops: [{ id: 'loop-2', title: 'Follow up on hiring', loopStatus: 'inbox', priorityLabel: 'P2' }],
      },
      {
        sourceObjectId: 'note-a',
        title: 'Investor update',
        occurredAt: '2026-07-10T09:00:00.000Z',
        author: 'Tony',
        loops: [{ id: 'loop-1', title: 'Send the deck', loopStatus: 'accepted', priorityLabel: 'P1' }],
      },
    ]);
    expect(calls).toContainEqual(['eq', 'user_id', 'user-123']);
    expect(calls).toContainEqual(['order', 'occurred_at', { ascending: false }]);
  });

  it('groups multiple loops from the same meeting together', async () => {
    const client = fakeMeetingsClient([], {
      evidence: [
        {
          todo_id: 'loop-1',
          source_app: 'granola',
          source_object_id: 'note-a',
          source_title: 'Founder sync',
          occurred_at: '2026-07-12T09:00:00.000Z',
          author: 'Tony',
        },
        {
          todo_id: 'loop-2',
          source_app: 'granola',
          source_object_id: 'note-a',
          source_title: 'Founder sync',
          occurred_at: '2026-07-12T09:00:00.000Z',
          author: 'Tony',
        },
      ],
      todos: [
        { id: 'loop-1', title: 'Send the deck', loop_status: 'accepted', priority_label: 'P1' },
        { id: 'loop-2', title: 'Follow up on hiring', loop_status: 'inbox', priority_label: 'P2' },
      ],
    });

    const meetings = await loadMeetings(client, 'user-123');

    expect(meetings).toHaveLength(1);
    expect(meetings[0].loops).toHaveLength(2);
  });
});

function fakeMeetingsClient(calls, { evidence, todos }) {
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
          order(column, options) {
            calls.push(['order', column, options]);
            return builder;
          },
          then(resolve) {
            const data = state.table === 'evidence' ? evidence : todos;
            resolve({ data, error: null });
          },
        };
        return builder;
      },
    },
  };
}

describe('restoreLoop', () => {
  it('sets loop_status back to inbox, scoped by user id', async () => {
    const calls = [];
    const client = fakeUpdateClient(calls);

    await restoreLoop(client, 'user-123', 'loop-1', new Date('2026-07-14T10:00:00.000Z'));

    expect(calls[1]).toEqual([
      'update',
      { loop_status: 'inbox', updated_at: '2026-07-14T10:00:00.000Z' },
    ]);
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
          or(expression) {
            calls.push(['or', expression]);
            return builder;
          },
          order(column, options) {
            calls.push(['order', column, options]);
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
