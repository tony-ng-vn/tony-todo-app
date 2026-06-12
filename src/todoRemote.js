const TODO_SELECT_COLUMNS =
  'id,title,created_at,completed_at,note,source,notion_page_id,notion_database_id,notion_status,first_started_at,active_started_at,tracked_seconds,is_progressive,parent_task_id,is_progress_session,progress_label';

export function toRemoteRecord(todo, clientId) {
  return {
    id: todo.id,
    client_id: clientId,
    title: todo.title,
    created_at: todo.createdAt,
    completed_at: todo.completedAt,
    note: todo.note ?? '',
    source: todo.source ?? 'app',
    notion_page_id: todo.notionPageId ?? null,
    notion_database_id: todo.notionDatabaseId ?? null,
    notion_status: todo.notionStatus ?? null,
    first_started_at: todo.firstStartedAt ?? null,
    active_started_at: todo.activeStartedAt ?? null,
    tracked_seconds: normalizeTrackedSeconds(todo.trackedSeconds),
    is_progressive: Boolean(todo.isProgressive),
    parent_task_id: todo.parentTaskId ?? null,
    is_progress_session: Boolean(todo.isProgressSession),
    progress_label: todo.progressLabel ?? '',
  };
}

export function fromRemoteRecord(record) {
  return {
    id: record.id,
    title: record.title,
    createdAt: record.created_at,
    completedAt: record.completed_at,
    note: record.note ?? '',
    source: record.source ?? 'app',
    notionPageId: record.notion_page_id ?? null,
    notionDatabaseId: record.notion_database_id ?? null,
    notionStatus: record.notion_status ?? null,
    firstStartedAt: record.first_started_at ?? null,
    activeStartedAt: record.active_started_at ?? null,
    trackedSeconds: normalizeTrackedSeconds(record.tracked_seconds),
    isProgressive: Boolean(record.is_progressive),
    parentTaskId: record.parent_task_id ?? null,
    isProgressSession: Boolean(record.is_progress_session),
    progressLabel: record.progress_label ?? '',
  };
}

export async function loadRemoteTodos(client, clientId) {
  const { data, error } = await client.database
    .from('todos')
    .select(TODO_SELECT_COLUMNS)
    .eq('client_id', clientId)
    .order('created_at', { ascending: true });

  throwIfError(error);

  return data.map(fromRemoteRecord);
}

export async function insertRemoteTodo(client, clientId, todo) {
  const { error } = await client.database.from('todos').insert([toRemoteRecord(todo, clientId)]);

  throwIfError(error);
}

export async function completeRemoteTodo(client, clientId, todo) {
  await updateRemoteTodo(client, clientId, todo, completionFields(todo));
}

export async function updateRemoteTodoNote(client, clientId, todo) {
  await updateRemoteTodo(client, clientId, todo, { note: todo.note ?? '' });
}

export async function updateRemoteTodoTitle(client, clientId, todo) {
  await updateRemoteTodo(client, clientId, todo, { title: todo.title });
}

export async function updateRemoteTodoTimer(client, clientId, todo) {
  await updateRemoteTodo(client, clientId, todo, timerFields(todo));
}

export async function updateRemoteTodoProgress(client, clientId, todo) {
  await updateRemoteTodo(client, clientId, todo, progressFields(todo));
}

export async function updateRemoteTodoCompletion(client, clientId, todo) {
  await updateRemoteTodo(client, clientId, todo, completionFields(todo));
}

export async function deleteRemoteTodo(client, clientId, todoId) {
  const { error } = await client.database.from('todos').delete().eq('id', todoId).eq('client_id', clientId);

  throwIfError(error);
}

async function updateRemoteTodo(client, clientId, todo, fields) {
  const { error } = await client.database
    .from('todos')
    .update({
      ...fields,
      updated_at: new Date().toISOString(),
    })
    .eq('id', todo.id)
    .eq('client_id', clientId);

  throwIfError(error);
}

function completionFields(todo) {
  return {
    completed_at: todo.completedAt,
    ...timerFields(todo),
  };
}

function timerFields(todo) {
  return {
    first_started_at: todo.firstStartedAt ?? null,
    active_started_at: todo.activeStartedAt ?? null,
    tracked_seconds: normalizeTrackedSeconds(todo.trackedSeconds),
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
