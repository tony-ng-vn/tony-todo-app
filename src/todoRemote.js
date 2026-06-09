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
  };
}

export async function loadRemoteTodos(client, clientId) {
  const { data, error } = await client.database
    .from('todos')
    .select(
      'id,title,created_at,completed_at,note,source,notion_page_id,notion_database_id,notion_status,first_started_at,active_started_at,tracked_seconds',
    )
    .eq('client_id', clientId)
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return data.map(fromRemoteRecord);
}

export async function insertRemoteTodo(client, clientId, todo) {
  const { error } = await client.database.from('todos').insert([toRemoteRecord(todo, clientId)]);

  if (error) {
    throw error;
  }
}

export async function completeRemoteTodo(client, clientId, todo) {
  const { error } = await client.database
    .from('todos')
    .update({
      completed_at: todo.completedAt,
      first_started_at: todo.firstStartedAt ?? null,
      active_started_at: todo.activeStartedAt ?? null,
      tracked_seconds: normalizeTrackedSeconds(todo.trackedSeconds),
      updated_at: new Date().toISOString(),
    })
    .eq('id', todo.id)
    .eq('client_id', clientId);

  if (error) {
    throw error;
  }
}

export async function updateRemoteTodoNote(client, clientId, todo) {
  const { error } = await client.database
    .from('todos')
    .update({ note: todo.note ?? '', updated_at: new Date().toISOString() })
    .eq('id', todo.id)
    .eq('client_id', clientId);

  if (error) {
    throw error;
  }
}

export async function updateRemoteTodoTitle(client, clientId, todo) {
  const { error } = await client.database
    .from('todos')
    .update({ title: todo.title, updated_at: new Date().toISOString() })
    .eq('id', todo.id)
    .eq('client_id', clientId);

  if (error) {
    throw error;
  }
}

export async function updateRemoteTodoTimer(client, clientId, todo) {
  const { error } = await client.database
    .from('todos')
    .update({
      first_started_at: todo.firstStartedAt ?? null,
      active_started_at: todo.activeStartedAt ?? null,
      tracked_seconds: normalizeTrackedSeconds(todo.trackedSeconds),
      updated_at: new Date().toISOString(),
    })
    .eq('id', todo.id)
    .eq('client_id', clientId);

  if (error) {
    throw error;
  }
}

export async function updateRemoteTodoCompletion(client, clientId, todo) {
  const { error } = await client.database
    .from('todos')
    .update({
      completed_at: todo.completedAt,
      first_started_at: todo.firstStartedAt ?? null,
      active_started_at: todo.activeStartedAt ?? null,
      tracked_seconds: normalizeTrackedSeconds(todo.trackedSeconds),
      updated_at: new Date().toISOString(),
    })
    .eq('id', todo.id)
    .eq('client_id', clientId);

  if (error) {
    throw error;
  }
}

function normalizeTrackedSeconds(value) {
  return Math.max(0, Math.floor(Number(value ?? 0)));
}
