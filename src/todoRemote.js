const TODO_SELECT_COLUMNS =
  'id,title,created_at,completed_at,due_date,note,source,notion_page_id,notion_database_id,notion_status,first_started_at,active_started_at,tracked_seconds,is_progressive,parent_task_id,is_progress_session,progress_label';

export function toRemoteRecord(todo, userId) {
  return {
    id: todo.id,
    user_id: userId,
    title: todo.title,
    created_at: todo.createdAt,
    completed_at: todo.completedAt,
    due_date: todo.dueDate ?? null,
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
    dueDate: record.due_date ?? null,
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

export async function updateRemoteTodoTimer(client, userId, todo) {
  await updateRemoteTodo(client, userId, todo, timerFields(todo));
}

export async function updateRemoteTodoProgress(client, userId, todo) {
  await updateRemoteTodo(client, userId, todo, progressFields(todo));
}

export async function updateRemoteTodoCompletion(client, userId, todo) {
  await updateRemoteTodo(client, userId, todo, completionFields(todo));
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
    notion_status: todo.notionStatus ?? null,
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
