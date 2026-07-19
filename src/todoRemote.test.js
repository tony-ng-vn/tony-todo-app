import { describe, expect, it } from 'vitest';
import {
  completeRemoteTodo,
  deleteRemoteTodo,
  fromRemoteRecord,
  loadRemoteTodos,
  toRemoteRecord,
  updateRemoteTodoDueDate,
  updateRemoteTodoProgress,
  updateRemoteTodoTimer,
  updateRemoteTodoTitle,
} from './todoRemote.js';

describe('todo remote mapping', () => {
  it('excludes unreviewed inbox-status loops from the main list', async () => {
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
            neq(column, value) {
              calls.push(['neq', column, value]);
              return this;
            },
            order(column, options) {
              calls.push(['order', column, options]);
              return this;
            },
            then(resolve) {
              resolve({ data: [], error: null });
            },
          };
        },
      },
    };

    await loadRemoteTodos(client, 'user-123');

    expect(calls).toContainEqual(['eq', 'user_id', 'user-123']);
    expect(calls).toContainEqual(['neq', 'loop_status', 'inbox']);
  });


  it('maps local todos to InsForge records with a user scope', () => {
    expect(
      toRemoteRecord(
        {
          id: 'todo-1',
          title: 'Send invoice',
          createdAt: '2026-06-08T08:00:00.000Z',
          completedAt: null,
          dueDate: '2026-06-12T00:00:00.000Z',
          note: 'Bring account number',
          firstStartedAt: '2026-06-08T08:10:00.000Z',
          activeStartedAt: null,
          trackedSeconds: 1800,
          isProgressive: true,
          parentTaskId: null,
          isProgressSession: false,
          progressLabel: 'pages 41-52',
        },
        'user-123',
      ),
    ).toEqual({
      id: 'todo-1',
      user_id: 'user-123',
      title: 'Send invoice',
      created_at: '2026-06-08T08:00:00.000Z',
      completed_at: null,
      due_date: '2026-06-12T00:00:00.000Z',
      note: 'Bring account number',
      source: 'app',
      notion_page_id: null,
      notion_database_id: null,
      notion_status: null,
      first_started_at: '2026-06-08T08:10:00.000Z',
      active_started_at: null,
      tracked_seconds: 1800,
      is_progressive: true,
      parent_task_id: null,
      is_progress_session: false,
      progress_label: 'pages 41-52',
    });
  });

  it('maps InsForge records back to local todo shape', () => {
    expect(
      fromRemoteRecord({
        id: 'todo-1',
        title: 'Send invoice',
        created_at: '2026-06-08T08:00:00.000Z',
        completed_at: '2026-06-08T09:00:00.000Z',
        due_date: '2026-06-12T00:00:00.000Z',
        note: 'Bring account number',
        source: 'notion',
        notion_page_id: 'notion-page-1',
        notion_database_id: 'notion-db-1',
        notion_status: 'Done',
        first_started_at: '2026-06-08T08:10:00.000Z',
        active_started_at: null,
        tracked_seconds: 1800,
        is_progressive: true,
        parent_task_id: null,
        is_progress_session: false,
        progress_label: 'Chapter 4',
      }),
    ).toEqual({
      id: 'todo-1',
      title: 'Send invoice',
      createdAt: '2026-06-08T08:00:00.000Z',
      completedAt: '2026-06-08T09:00:00.000Z',
      dueDate: '2026-06-12T00:00:00.000Z',
      note: 'Bring account number',
      source: 'notion',
      notionPageId: 'notion-page-1',
      notionDatabaseId: 'notion-db-1',
      notionStatus: 'Done',
      firstStartedAt: '2026-06-08T08:10:00.000Z',
      activeStartedAt: null,
      trackedSeconds: 1800,
      isProgressive: true,
      parentTaskId: null,
      isProgressSession: false,
      progressLabel: 'Chapter 4',
    });
  });

  it('updates a remote todo title scoped by user id', async () => {
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

    await updateRemoteTodoTitle(client, 'user-123', { id: 'todo-1', title: 'New title' });

    expect(calls[0]).toEqual(['from', 'todos']);
    expect(calls[1][0]).toBe('update');
    expect(calls[1][1]).toMatchObject({ title: 'New title' });
    expect(calls).toContainEqual(['eq', 'id', 'todo-1']);
    expect(calls).toContainEqual(['eq', 'user_id', 'user-123']);
  });

  it('maps a missing due date to null in both directions', () => {
    expect(
      toRemoteRecord(
        { id: 'todo-1', title: 'No due date', createdAt: '2026-06-08T08:00:00.000Z', completedAt: null },
        'user-123',
      ).due_date,
    ).toBeNull();
    expect(fromRemoteRecord({ id: 'todo-1', title: 'No due date' }).dueDate).toBeNull();
  });

  it('updates a remote due date scoped by user id', async () => {
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

    await updateRemoteTodoDueDate(client, 'user-123', {
      id: 'todo-1',
      dueDate: '2026-06-12T00:00:00.000Z',
    });

    expect(calls[1][0]).toBe('update');
    expect(calls[1][1]).toMatchObject({ due_date: '2026-06-12T00:00:00.000Z' });
    expect(calls).toContainEqual(['eq', 'id', 'todo-1']);
    expect(calls).toContainEqual(['eq', 'user_id', 'user-123']);
  });

  it('updates remote timer fields scoped by user id', async () => {
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

    await updateRemoteTodoTimer(client, 'user-123', {
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
    expect(calls).toContainEqual(['eq', 'user_id', 'user-123']);
  });

  it('updates remote progress fields scoped by user id', async () => {
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

    await updateRemoteTodoProgress(client, 'user-123', {
      id: 'todo-1',
      isProgressive: true,
      progressLabel: 'pages 41-52',
    });

    expect(calls[0]).toEqual(['from', 'todos']);
    expect(calls[1][0]).toBe('update');
    expect(calls[1][1]).toMatchObject({
      is_progressive: true,
      progress_label: 'pages 41-52',
    });
    expect(calls).toContainEqual(['eq', 'id', 'todo-1']);
    expect(calls).toContainEqual(['eq', 'user_id', 'user-123']);
  });

  it('syncs a failed terminal outcome through remote completion fields', async () => {
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

    await completeRemoteTodo(client, 'user-123', {
      id: 'todo-1',
      completedAt: '2026-06-08T09:00:00.000Z',
      firstStartedAt: null,
      activeStartedAt: null,
      trackedSeconds: 0,
      notionStatus: 'Failed',
    });

    expect(calls[1][1]).toMatchObject({
      completed_at: '2026-06-08T09:00:00.000Z',
      notion_status: 'Failed',
    });
    expect(calls).toContainEqual(['eq', 'id', 'todo-1']);
    expect(calls).toContainEqual(['eq', 'user_id', 'user-123']);
  });

  it('deletes a remote todo scoped by user id', async () => {
    const calls = [];
    const client = {
      database: {
        from(table) {
          calls.push(['from', table]);
          return {
            delete() {
              calls.push(['delete']);
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

    await deleteRemoteTodo(client, 'user-123', 'todo-1');

    expect(calls).toEqual([
      ['from', 'todos'],
      ['delete'],
      ['eq', 'id', 'todo-1'],
      ['eq', 'user_id', 'user-123'],
    ]);
  });
});
