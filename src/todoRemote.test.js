import { describe, expect, it } from 'vitest';
import { fromRemoteRecord, toRemoteRecord, updateRemoteTodoTimer, updateRemoteTodoTitle } from './todoRemote.js';

describe('todo remote mapping', () => {
  it('maps local todos to InsForge records with a client scope', () => {
    expect(
      toRemoteRecord(
        {
          id: 'todo-1',
          title: 'Send invoice',
          createdAt: '2026-06-08T08:00:00.000Z',
          completedAt: null,
          note: 'Bring account number',
          firstStartedAt: '2026-06-08T08:10:00.000Z',
          activeStartedAt: null,
          trackedSeconds: 1800,
        },
        'client-123',
      ),
    ).toEqual({
      id: 'todo-1',
      client_id: 'client-123',
      title: 'Send invoice',
      created_at: '2026-06-08T08:00:00.000Z',
      completed_at: null,
      note: 'Bring account number',
      source: 'app',
      notion_page_id: null,
      notion_database_id: null,
      notion_status: null,
      first_started_at: '2026-06-08T08:10:00.000Z',
      active_started_at: null,
      tracked_seconds: 1800,
    });
  });

  it('maps InsForge records back to local todo shape', () => {
    expect(
      fromRemoteRecord({
        id: 'todo-1',
        title: 'Send invoice',
        created_at: '2026-06-08T08:00:00.000Z',
        completed_at: '2026-06-08T09:00:00.000Z',
        note: 'Bring account number',
        source: 'notion',
        notion_page_id: 'notion-page-1',
        notion_database_id: 'notion-db-1',
        notion_status: 'Done',
        first_started_at: '2026-06-08T08:10:00.000Z',
        active_started_at: null,
        tracked_seconds: 1800,
      }),
    ).toEqual({
      id: 'todo-1',
      title: 'Send invoice',
      createdAt: '2026-06-08T08:00:00.000Z',
      completedAt: '2026-06-08T09:00:00.000Z',
      note: 'Bring account number',
      source: 'notion',
      notionPageId: 'notion-page-1',
      notionDatabaseId: 'notion-db-1',
      notionStatus: 'Done',
      firstStartedAt: '2026-06-08T08:10:00.000Z',
      activeStartedAt: null,
      trackedSeconds: 1800,
    });
  });

  it('updates a remote todo title scoped by client id', async () => {
    const calls = [];
    const client = {
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

    await updateRemoteTodoTitle(client, 'client-123', { id: 'todo-1', title: 'New title' });

    expect(calls[0]).toEqual(['from', 'todos']);
    expect(calls[1][0]).toBe('update');
    expect(calls[1][1]).toMatchObject({ title: 'New title' });
    expect(calls).toContainEqual(['eq', 'id', 'todo-1']);
    expect(calls).toContainEqual(['eq', 'client_id', 'client-123']);
  });

  it('updates remote timer fields scoped by client id', async () => {
    const calls = [];
    const client = {
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

    await updateRemoteTodoTimer(client, 'client-123', {
      id: 'todo-1',
      firstStartedAt: '2026-06-08T08:10:00.000Z',
      activeStartedAt: '2026-06-08T08:20:00.000Z',
      trackedSeconds: 600,
    });

    expect(calls[0]).toEqual(['from', 'todos']);
    expect(calls[1][0]).toBe('update');
    expect(calls[1][1]).toMatchObject({
      first_started_at: '2026-06-08T08:10:00.000Z',
      active_started_at: '2026-06-08T08:20:00.000Z',
      tracked_seconds: 600,
    });
    expect(calls).toContainEqual(['eq', 'id', 'todo-1']);
    expect(calls).toContainEqual(['eq', 'client_id', 'client-123']);
  });
});
