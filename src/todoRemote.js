import { fromRemoteRecord, parseTodoKind, toRemoteRecord } from './todoCommands.js';

export { fromRemoteRecord, toRemoteRecord };

const TODO_SELECT_COLUMNS =
  'id,title,created_at,completed_at,kind,someday_at,due_date,note,source,notion_page_id,notion_database_id,notion_status,first_started_at,active_started_at,tracked_seconds,time_segments,is_progressive,parent_task_id,is_progress_session,progress_label,photo_url,photo_key,updated_at';

export async function loadRemoteTodos(client, userId) {
  const { data, error } = await client.database
    .from('todos')
    .select(TODO_SELECT_COLUMNS)
    .eq('user_id', userId)
    .neq('loop_status', 'inbox')
    .order('created_at', { ascending: true });

  throwIfError(error);

  return data.map(fromRemoteRecord);
}

export async function insertRemoteTodo(client, userId, todo) {
  const { error } = await client.database.from('todos').insert([toRemoteRecord(todo, userId)]);

  throwIfError(error);
}

export async function completeRemoteTodo(client, userId, todo) {
  await updateRemoteTodo(client, userId, todo, completionFields(todo));
}

export async function updateRemoteTodoNote(client, userId, todo) {
  await updateRemoteTodo(client, userId, todo, { note: todo.note ?? '' });
}

export async function updateRemoteTodoTitle(client, userId, todo) {
  await updateRemoteTodo(client, userId, todo, { title: todo.title });
}

export async function updateRemoteTodoDueDate(client, userId, todo) {
  await updateRemoteTodo(client, userId, todo, { due_date: todo.dueDate ?? null });
}

export async function updateRemoteTodoPhoto(client, userId, todo) {
  await updateRemoteTodo(client, userId, todo, {
    photo_url: todo.photoUrl ?? null,
    photo_key: todo.photoKey ?? null,
  });
}

export async function updateRemoteTodoTimer(client, userId, todo) {
  await updateRemoteTodo(client, userId, todo, timerFields(todo));
}

export async function updateRemoteTodoProgress(client, userId, todo) {
  await updateRemoteTodo(client, userId, todo, progressFields(todo));
}

export async function updateRemoteTodoCompletion(client, userId, todo) {
  await updateRemoteTodo(client, userId, todo, completionFields(todo));
}

export async function updateRemoteTodoWorkflow(client, userId, todo) {
  await updateRemoteTodo(client, userId, todo, completionFields(todo));
}

export async function logRemoteProgressSession(client, parent, session) {
  const { error } = await client.database.rpc('log_progress_session', {
    p_parent_id: parent.id,
    p_session_id: session.id,
    p_title: session.title,
    p_created_at: session.createdAt,
    p_completed_at: session.completedAt,
    p_note: session.note ?? '',
    p_first_started_at: session.firstStartedAt ?? null,
    p_tracked_seconds: normalizeTrackedSeconds(session.trackedSeconds),
    p_time_segments: normalizeTimeSegments(session.timeSegments),
    p_progress_label: session.progressLabel ?? '',
  });

  throwIfError(error);
}

export async function deleteRemoteTodo(client, userId, todoId) {
  const { error } = await client.database.from('todos').delete().eq('id', todoId).eq('user_id', userId);

  throwIfError(error);
}

async function updateRemoteTodo(client, userId, todo, fields) {
  const { error } = await client.database
    .from('todos')
    .update({
      ...fields,
      updated_at: new Date().toISOString(),
    })
    .eq('id', todo.id)
    .eq('user_id', userId);

  throwIfError(error);
}

function completionFields(todo) {
  return {
    completed_at: todo.completedAt,
    kind: parseTodoKind(todo.kind),
    someday_at: todo.somedayAt ?? null,
    notion_status: todo.notionStatus ?? null,
    ...timerFields(todo),
  };
}

function timerFields(todo) {
  return {
    first_started_at: todo.firstStartedAt ?? null,
    active_started_at: todo.activeStartedAt ?? null,
    tracked_seconds: normalizeTrackedSeconds(todo.trackedSeconds),
    time_segments: normalizeTimeSegments(todo.timeSegments),
  };
}

function progressFields(todo) {
  return {
    is_progressive: Boolean(todo.isProgressive),
    progress_label: todo.progressLabel ?? '',
  };
}

function throwIfError(error) {
  if (error) {
    throw error;
  }
}

function normalizeTrackedSeconds(value) {
  return Math.max(0, Math.floor(Number(value ?? 0)));
}

function normalizeTimeSegments(value) {
  return Array.isArray(value)
    ? value.map((segment) => ({
        startedAt: segment.startedAt,
        endedAt: segment.endedAt,
      }))
    : [];
}
