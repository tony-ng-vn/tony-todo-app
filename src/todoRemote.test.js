import { describe, expect, it } from 'vitest';
import {
  completeRemoteTodo,
  deleteRemoteTodo,
  fromRemoteRecord,
  loadRemoteTodos,
  toRemoteRecord,
  updateRemoteTodoDueDate,
  updateRemoteTodoPhoto,
  updateRemoteTodoTimer,
  updateRemoteTodoTitle,
  updateRemoteTodoWorkflow,
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
    expect(calls.find((call) => call[0] === 'select')[1]).toContain('updated_at');
  });


  it('maps local todos to InsForge records with a user scope', () => {
    expect(
      toRemoteRecord(
        {
          id: 'todo-1',
          title: 'Send invoice',
          createdAt: '2026-06-08T08:00:00.000Z',
          completedAt: null,
          somedayAt: '2026-06-08T09:30:00.000Z',
          dueDate: '2026-06-12T00:00:00.000Z',
          note: 'Bring account number',
          firstStartedAt: '2026-06-08T08:10:00.000Z',
          activeStartedAt: null,
          trackedSeconds: 1800,
          timeSegments: [
            {
              startedAt: '2026-06-08T08:10:00.000Z',
              endedAt: '2026-06-08T08:40:00.000Z',
            },
          ],
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
      kind: 'task',
      someday_at: '2026-06-08T09:30:00.000Z',
      due_date: '2026-06-12T00:00:00.000Z',
      note: 'Bring account number',
      source: 'app',
      notion_page_id: null,
      notion_database_id: null,
      notion_status: null,
      first_started_at: '2026-06-08T08:10:00.000Z',
      active_started_at: null,
      tracked_seconds: 1800,
      time_segments: [
        {
          startedAt: '2026-06-08T08:10:00.000Z',
          endedAt: '2026-06-08T08:40:00.000Z',
        },
      ],
      is_progressive: true,
      parent_task_id: null,
      is_progress_session: false,
      progress_label: 'pages 41-52',
      photo_url: null,
      photo_key: null,
    });
  });

  it('maps InsForge records back to local todo shape', () => {
    expect(
      fromRemoteRecord({
        id: 'todo-1',
        title: 'Send invoice',
        created_at: '2026-06-08T08:00:00.000Z',
        completed_at: '2026-06-08T09:00:00.000Z',
        someday_at: null,
        due_date: '2026-06-12T00:00:00.000Z',
        note: 'Bring account number',
        source: 'notion',
        notion_page_id: 'notion-page-1',
        notion_database_id: 'notion-db-1',
        notion_status: 'Done',
        first_started_at: '2026-06-08T08:10:00.000Z',
        active_started_at: null,
        tracked_seconds: 1800,
        time_segments: [
          {
            startedAt: '2026-06-08T08:10:00.000Z',
            endedAt: '2026-06-08T08:40:00.000Z',
          },
        ],
        is_progressive: true,
        parent_task_id: null,
        is_progress_session: false,
        progress_label: 'Chapter 4',
        updated_at: '2026-08-13T16:44:21.431Z',
      }),
    ).toEqual({
      id: 'todo-1',
      title: 'Send invoice',
      createdAt: '2026-06-08T08:00:00.000Z',
      completedAt: '2026-06-08T09:00:00.000Z',
      kind: 'task',
      somedayAt: null,
      dueDate: '2026-06-12T00:00:00.000Z',
      note: 'Bring account number',
      source: 'notion',
      notionPageId: 'notion-page-1',
      notionDatabaseId: 'notion-db-1',
      notionStatus: 'Done',
      firstStartedAt: '2026-06-08T08:10:00.000Z',
      activeStartedAt: null,
      trackedSeconds: 1800,
      timeSegments: [
        {
          startedAt: '2026-06-08T08:10:00.000Z',
          endedAt: '2026-06-08T08:40:00.000Z',
        },
      ],
      isProgressive: true,
      parentTaskId: null,
      isProgressSession: false,
      progressLabel: 'Chapter 4',
      photoUrl: null,
      photoKey: null,
      updatedAt: '2026-08-13T16:44:21.431Z',
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

  it('maps a missing photo to null in both directions', () => {
    expect(
      toRemoteRecord(
        { id: 'todo-1', title: 'No photo', createdAt: '2026-06-08T08:00:00.000Z', completedAt: null },
        'user-123',
      ),
    ).toMatchObject({ photo_url: null, photo_key: null });
    expect(fromRemoteRecord({ id: 'todo-1', title: 'No photo' })).toMatchObject({
      photoUrl: null,
      photoKey: null,
    });
  });

  it('round-trips a task photo url and key', () => {
    expect(
      fromRemoteRecord({
        id: 'todo-1',
        title: 'Receipt',
        photo_url: 'https://files.example/photo.jpg',
        photo_key: 'user-123/todo-1/photo.jpg',
      }),
    ).toMatchObject({
      photoUrl: 'https://files.example/photo.jpg',
      photoKey: 'user-123/todo-1/photo.jpg',
    });
  });

  it('maps a missing someday timestamp to null in both directions', () => {
    expect(
      toRemoteRecord(
        { id: 'todo-1', title: 'Active task', createdAt: '2026-06-08T08:00:00.000Z' },
        'user-123',
      ).someday_at,
    ).toBeNull();
    expect(fromRemoteRecord({ id: 'todo-1', title: 'Active task' }).somedayAt).toBeNull();
  });

  it('maps a missing kind to task and round-trips project', () => {
    expect(fromRemoteRecord({ id: 'todo-1', title: 'Legacy row' }).kind).toBe('task');
    expect(
      toRemoteRecord(
        {
          id: 'todo-2',
          title: 'Garden studio',
          createdAt: '2026-06-08T08:00:00.000Z',
          kind: 'project',
        },
        'user-123',
      ).kind,
    ).toBe('project');
  });

  it('updates the complete workflow state when a task moves to someday', async () => {
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

    await updateRemoteTodoWorkflow(client, 'user-123', {
      id: 'todo-1',
      completedAt: null,
      somedayAt: '2026-06-08T09:30:00.000Z',
      firstStartedAt: '2026-06-08T09:00:00.000Z',
      activeStartedAt: null,
      trackedSeconds: 1800,
      timeSegments: [
        {
          startedAt: '2026-06-08T09:00:00.000Z',
          endedAt: '2026-06-08T09:30:00.000Z',
        },
      ],
    });

    expect(calls[1][1]).toMatchObject({
      completed_at: null,
      someday_at: '2026-06-08T09:30:00.000Z',
      active_started_at: null,
      tracked_seconds: 1800,
    });
    expect(calls).toContainEqual(['eq', 'id', 'todo-1']);
    expect(calls).toContainEqual(['eq', 'user_id', 'user-123']);
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

  it('updates remote photo fields scoped by user id', async () => {
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

    await updateRemoteTodoPhoto(client, 'user-123', {
      id: 'todo-1',
      photoUrl: 'https://files.example/photo.jpg',
      photoKey: 'user-123/todo-1/photo.jpg',
    });

    expect(calls[1][0]).toBe('update');
    expect(calls[1][1]).toMatchObject({
      photo_url: 'https://files.example/photo.jpg',
      photo_key: 'user-123/todo-1/photo.jpg',
    });
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
      timeSegments: [
        {
          startedAt: '2026-06-08T08:10:00.000Z',
          endedAt: '2026-06-08T08:20:00.000Z',
        },
      ],
    });

    expect(calls[0]).toEqual(['from', 'todos']);
    expect(calls[1][0]).toBe('update');
    expect(calls[1][1]).toMatchObject({
      first_started_at: '2026-06-08T08:10:00.000Z',
      active_started_at: '2026-06-08T08:20:00.000Z',
      tracked_seconds: 600,
      time_segments: [
        {
          startedAt: '2026-06-08T08:10:00.000Z',
          endedAt: '2026-06-08T08:20:00.000Z',
        },
      ],
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
